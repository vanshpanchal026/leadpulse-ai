"""Controlled Website Content Retrieval Service with Strict SSRF Guardrails.

Provides safe, controlled, rate-limited, and sandboxed website retrieval for the Website Specialist Agent:
- URL validation and scheme normalization (prefers HTTPS)
- Multi-layer SSRF prevention:
  * Rejection of localhost, loopback, private IPv4/IPv6, link-local, carrier NAT, cloud metadata
  * Pre-request DNS resolution verification: every resolved IP is validated against blocked CIDRs
  * Redirect traversal validation: every redirect target is re-validated before following (max 3)
- Size limits (max 512 KB)
- Strict timeouts (5.0s max)
- Content-type validation (HTML / Plain text only)
- Zero credential / cookie transmission
- Clean HTML text extraction (Title, Meta description, CTAs, Contact/Booking links)

INVARIANT: HTTP errors or unreachable domains must NEVER be treated as evidence of poor business quality.
"""

import asyncio
from html.parser import HTMLParser
import ipaddress
import logging
import re
import socket
from typing import Any, Optional
from urllib.parse import urljoin, urlparse

import httpx
from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger("ai_worker.services.website_fetcher")

# Blocked hostnames and prefixes
BLOCKED_HOSTS: set[str] = {
    "localhost",
    "localhost.localdomain",
    "metadata.google.internal",
    "metadata.internal",
    "instance-data",
}

# Explicitly blocked IP networks (IPv4 and IPv6)
BLOCKED_NETWORKS: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = [
    # IPv4 loopback, private, link-local, and special
    ipaddress.ip_network("127.0.0.0/8"),       # Loopback
    ipaddress.ip_network("10.0.0.0/8"),        # Private-Use RFC 1918
    ipaddress.ip_network("172.16.0.0/12"),     # Private-Use RFC 1918
    ipaddress.ip_network("192.168.0.0/16"),    # Private-Use RFC 1918
    ipaddress.ip_network("169.254.0.0/16"),    # Link-Local / Cloud Metadata (169.254.169.254)
    ipaddress.ip_network("0.0.0.0/8"),         # This network
    ipaddress.ip_network("100.64.0.0/10"),     # Shared Address Space (Carrier-grade NAT)
    ipaddress.ip_network("192.0.0.0/24"),      # IETF Protocol Assignments
    ipaddress.ip_network("192.0.2.0/24"),      # TEST-NET-1
    ipaddress.ip_network("198.51.100.0/24"),   # TEST-NET-2
    ipaddress.ip_network("203.0.113.0/24"),    # TEST-NET-3
    ipaddress.ip_network("224.0.0.0/4"),       # Multicast
    ipaddress.ip_network("240.0.0.0/4"),       # Reserved for future use
    ipaddress.ip_network("255.255.255.255/32"),# Broadcast
    # IPv6 loopback, link-local, unique local
    ipaddress.ip_network("::1/128"),           # IPv6 Loopback
    ipaddress.ip_network("::/128"),            # IPv6 Unspecified
    ipaddress.ip_network("fe80::/10"),         # IPv6 Link-Local
    ipaddress.ip_network("fc00::/7"),          # IPv6 Unique Local
    ipaddress.ip_network("ff00::/8"),          # IPv6 Multicast
]

BOOKING_SYSTEM_PATTERNS: list[re.Pattern] = [
    re.compile(r"calendly\.com", re.IGNORECASE),
    re.compile(r"acuityscheduling\.com", re.IGNORECASE),
    re.compile(r"zocdoc\.com", re.IGNORECASE),
    re.compile(r"zenoti\.com", re.IGNORECASE),
    re.compile(r"fresha\.com", re.IGNORECASE),
    re.compile(r"booksy\.com", re.IGNORECASE),
    re.compile(r"squareup\.com/appointments", re.IGNORECASE),
    re.compile(r"setmore\.com", re.IGNORECASE),
    re.compile(r"appointy\.com", re.IGNORECASE),
    re.compile(r"simplybook\.me", re.IGNORECASE),
]

CTA_KEYWORD_PATTERN = re.compile(
    r"\b(book|appointment|schedule|consult|contact|whatsapp|call now|inquire|reserve|get quote|pricing)\b",
    re.IGNORECASE
)


class SSRFSecurityError(ValueError):
    """Raised when a URL targets a private, loopback, or metadata network."""
    pass


class WebsiteFetchResult(BaseModel):
    """Normalized, compact representation of public website content."""
    model_config = ConfigDict(frozen=True)

    success: bool
    url: str
    status_code: Optional[int] = None
    title: Optional[str] = None
    meta_description: Optional[str] = None
    text_summary: str = ""
    observed_ctas: list[str] = Field(default_factory=list)
    whatsapp_links: list[str] = Field(default_factory=list)
    phone_links: list[str] = Field(default_factory=list)
    booking_links: list[str] = Field(default_factory=list)
    has_booking_system: bool = False
    has_whatsapp_cta: bool = False
    error: Optional[str] = None


class _TextExtractor(HTMLParser):
    """Lightweight, safe streaming HTML parser extracting visible text, metadata, and CTAs."""

    def __init__(self):
        super().__init__()
        self._in_title = False
        self._in_script_or_style = False
        self.title: Optional[str] = None
        self.meta_description: Optional[str] = None
        self.text_chunks: list[str] = []
        self.observed_ctas: list[str] = []
        self.whatsapp_links: list[str] = []
        self.phone_links: list[str] = []
        self.booking_links: list[str] = []
        self._current_tag = ""
        self._current_tag_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]):
        tag_lower = tag.lower()
        self._current_tag = tag_lower
        self._current_tag_text = []

        if tag_lower in ("script", "style", "noscript", "svg"):
            self._in_script_or_style = True
            return

        if tag_lower == "title":
            self._in_title = True
            return

        attr_dict = {k.lower(): (v or "").strip() for k, v in attrs}

        if tag_lower == "meta":
            name = attr_dict.get("name", "").lower()
            prop = attr_dict.get("property", "").lower()
            content = attr_dict.get("content", "").strip()
            if content and (name == "description" or prop == "og:description"):
                if not self.meta_description:
                    self.meta_description = content

        if tag_lower == "a":
            href = attr_dict.get("href", "").strip()
            if href:
                href_lower = href.lower()
                if "wa.me/" in href_lower or "api.whatsapp.com" in href_lower or "whatsapp:" in href_lower:
                    if href not in self.whatsapp_links:
                        self.whatsapp_links.append(href)
                elif href_lower.startswith("tel:"):
                    clean_phone = href[4:].strip()
                    if clean_phone and clean_phone not in self.phone_links:
                        self.phone_links.append(clean_phone)
                for pat in BOOKING_SYSTEM_PATTERNS:
                    if pat.search(href):
                        if href not in self.booking_links:
                            self.booking_links.append(href)
                        break

    def handle_endtag(self, tag: str):
        tag_lower = tag.lower()
        if tag_lower in ("script", "style", "noscript", "svg"):
            self._in_script_or_style = False
            return

        if tag_lower == "title":
            self._in_title = False
            return

        # Check if button or link had CTA text
        if tag_lower in ("button", "a"):
            combined_text = " ".join(self._current_tag_text).strip()
            if combined_text and CTA_KEYWORD_PATTERN.search(combined_text):
                # Clean up whitespace
                clean_cta = " ".join(combined_text.split())
                if len(clean_cta) <= 60 and clean_cta not in self.observed_ctas:
                    self.observed_ctas.append(clean_cta)

    def handle_data(self, data: str):
        if self._in_script_or_style:
            return

        cleaned = data.strip()
        if not cleaned:
            return

        if self._in_title:
            if not self.title:
                self.title = cleaned
            return

        self.text_chunks.append(cleaned)
        if self._current_tag in ("button", "a", "span", "p", "h1", "h2", "h3"):
            self._current_tag_text.append(cleaned)


def is_ip_blocked(ip_addr: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Evaluate whether an IP address belongs to any restricted or private network."""
    if ip_addr.is_loopback or ip_addr.is_private or ip_addr.is_link_local or ip_addr.is_reserved or ip_addr.is_multicast:
        return True
    for blocked_net in BLOCKED_NETWORKS:
        if ip_addr in blocked_net:
            return True
    return False


def validate_and_resolve_url(target_url: str) -> tuple[str, str]:
    """Validate target URL against SSRF rules and resolve its DNS to ensure public routing.
    
    Returns:
        tuple[normalized_url, resolved_ip]
    Raises:
        SSRFSecurityError: If URL points to internal, loopback, or metadata addresses.
        ValueError: If URL is malformed or uses unsupported scheme.
    """
    if not target_url or not isinstance(target_url, str):
        raise ValueError("Target URL must be a non-empty string.")

    cleaned_url = target_url.strip()
    parsed_initial = urlparse(cleaned_url)
    if parsed_initial.scheme:
        if parsed_initial.scheme not in ("http", "https"):
            raise ValueError(f"Unsupported URL scheme '{parsed_initial.scheme}'. Only http/https are permitted.")
    else:
        cleaned_url = "https://" + cleaned_url

    parsed = urlparse(cleaned_url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Unsupported URL scheme '{parsed.scheme}'. Only http/https are permitted.")

    # 1. Reject embedded credentials / userinfo
    if parsed.username or parsed.password:
        raise SSRFSecurityError("Target URL contains embedded credentials/userinfo, which is prohibited.")

    # 2. Restrict ports to standard public web ports
    if parsed.port is not None and parsed.port not in (80, 443, 8080, 8443):
        raise SSRFSecurityError(f"Target port '{parsed.port}' is not an allowed public web port (80, 443, 8080, 8443).")

    hostname = (parsed.hostname or "").strip().lower()
    if not hostname:
        raise ValueError("URL is missing a valid hostname.")

    # 3. Check blocked hostnames and internal domain extensions
    if (
        hostname in BLOCKED_HOSTS
        or hostname.endswith(".localhost")
        or hostname.endswith(".local")
        or hostname.endswith(".internal")
        or hostname.endswith(".lan")
        or hostname.endswith(".home")
    ):
        raise SSRFSecurityError(f"Target hostname '{hostname}' is explicitly blocked (SSRF guard).")

    # 4. Check if hostname is an integer, hex, or dotted IP literal
    try:
        if hostname.isdigit() or (hostname.startswith("0x") and len(hostname) > 2):
            int_ip = int(hostname, 0)
            direct_ip = ipaddress.ip_address(int_ip)
            if is_ip_blocked(direct_ip):
                raise SSRFSecurityError(f"Target IP literal '{hostname}' is in a blocked network range.")
            return cleaned_url, str(direct_ip)
    except (ValueError, OverflowError):
        pass

    try:
        direct_ip = ipaddress.ip_address(hostname)
        if is_ip_blocked(direct_ip):
            raise SSRFSecurityError(f"Target IP address '{hostname}' is in a blocked network range.")
        return cleaned_url, str(direct_ip)
    except ValueError:
        # Not a direct IP address; resolve via DNS
        pass

    try:
        addr_info = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError(f"DNS resolution failed for hostname '{hostname}': {exc}") from exc

    if not addr_info:
        raise ValueError(f"No IP addresses resolved for hostname '{hostname}'.")

    resolved_ip_str: Optional[str] = None
    for family, socktype, proto, canonname, sockaddr in addr_info:
        ip_str = sockaddr[0]
        try:
            ip_obj = ipaddress.ip_address(ip_str)
        except ValueError:
            continue

        if is_ip_blocked(ip_obj):
            raise SSRFSecurityError(
                f"Hostname '{hostname}' resolved to blocked/private IP '{ip_str}' (SSRF guard)."
            )
        if resolved_ip_str is None:
            resolved_ip_str = ip_str

    if resolved_ip_str is None:
        raise SSRFSecurityError(f"Could not verify resolved IP for hostname '{hostname}'.")

    return cleaned_url, resolved_ip_str


from httpcore._backends.anyio import AnyIOBackend
from httpcore import ConnectError


class SSRFSafeBackend(AnyIOBackend):
    """Network backend that enforces SSRF validation at TCP connection time and pins connection to verified IP."""

    async def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: float | None = None,
        local_address: str | None = None,
        socket_options: Any = None,
    ) -> Any:
        loop = asyncio.get_running_loop()
        try:
            addr_info = await loop.getaddrinfo(host, port, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM)
        except socket.gaierror as exc:
            raise ConnectError(f"DNS resolution failed for '{host}': {exc}") from exc

        if not addr_info:
            raise ConnectError(f"No IP addresses resolved for '{host}'")

        resolved_ip = None
        for *_, sockaddr in addr_info:
            try:
                ip_obj = ipaddress.ip_address(sockaddr[0])
            except ValueError:
                continue
            if is_ip_blocked(ip_obj):
                raise ConnectError(f"SSRF Blocked: Host '{host}' resolved to restricted IP '{sockaddr[0]}'")
            if resolved_ip is None:
                resolved_ip = sockaddr[0]

        if resolved_ip is None:
            raise ConnectError(f"No valid public IP resolved for '{host}'")

        # Connect directly to the verified IP to prevent DNS rebinding TOCTOU attacks
        return await super().connect_tcp(
            resolved_ip,
            port,
            timeout=timeout,
            local_address=local_address,
            socket_options=socket_options,
        )


class SSRFSafeTransport(httpx.AsyncHTTPTransport):
    """HTTP transport configured with SSRFSafeBackend to eliminate DNS rebinding attacks."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._pool._network_backend = SSRFSafeBackend()


class WebsiteContentFetcher:
    """Controlled HTTP fetching service with SSRF defense, size caps, and content parsing."""

    def __init__(
        self,
        timeout_seconds: float = 6.0,
        max_bytes: int = 524_288,  # 512 KB
        max_redirects: int = 3,
        user_agent: str = "LeadPulse-Research-Bot/2.0 (Business-Qualification-Scanner)"
    ):
        self.timeout_seconds = timeout_seconds
        self.max_bytes = max_bytes
        self.max_redirects = max_redirects
        self.user_agent = user_agent

    async def fetch(self, url: str) -> WebsiteFetchResult:
        """Fetch and extract visible text from target URL with strict SSRF defense."""
        try:
            current_url, _ = validate_and_resolve_url(url)
        except (SSRFSecurityError, ValueError) as exc:
            logger.warning("Website validation rejected '%s': %s", url, exc)
            return WebsiteFetchResult(
                success=False,
                url=url,
                error=f"URL validation failed: {str(exc)}"
            )

        headers = {
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9",
            "Accept-Language": "en-US,en;q=0.8",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
        }

        timeout_config = httpx.Timeout(
            connect=3.0,
            read=self.timeout_seconds,
            write=3.0,
            pool=3.0
        )

        redirects_followed = 0
        transport = SSRFSafeTransport(verify=True)

        async with httpx.AsyncClient(transport=transport, timeout=timeout_config, verify=True, follow_redirects=False) as client:
            while redirects_followed <= self.max_redirects:
                try:
                    response = await client.get(current_url, headers=headers)
                except httpx.TimeoutException:
                    logger.info("Website fetch timed out for URL '%s'", current_url)
                    return WebsiteFetchResult(
                        success=False,
                        url=current_url,
                        error=f"Connection timed out after {self.timeout_seconds:.1f}s"
                    )
                except httpx.RequestError as exc:
                    logger.info("Website fetch network error for URL '%s': %s", current_url, exc)
                    return WebsiteFetchResult(
                        success=False,
                        url=current_url,
                        error=f"Network request failed: {type(exc).__name__}"
                    )

                # Check for redirects manually to validate destination against SSRF
                if response.status_code in (301, 302, 303, 307, 308):
                    redirect_location = response.headers.get("location")
                    if not redirect_location:
                        break
                    redirect_url = urljoin(current_url, redirect_location)
                    try:
                        current_url, _ = validate_and_resolve_url(redirect_url)
                        redirects_followed += 1
                        continue
                    except (SSRFSecurityError, ValueError) as exc:
                        logger.warning("SSRF redirect target blocked '%s': %s", redirect_url, exc)
                        return WebsiteFetchResult(
                            success=False,
                            url=current_url,
                            status_code=response.status_code,
                            error=f"Redirect blocked by SSRF guard: {str(exc)}"
                        )

                # Process final response
                if response.status_code >= 400:
                    return WebsiteFetchResult(
                        success=False,
                        url=current_url,
                        status_code=response.status_code,
                        error=f"Server returned HTTP {response.status_code}"
                    )

                content_type = response.headers.get("content-type", "").lower()
                if content_type and not any(ct in content_type for ct in ("text/html", "application/xhtml", "text/plain")):
                    return WebsiteFetchResult(
                        success=False,
                        url=current_url,
                        status_code=response.status_code,
                        error=f"Unsupported Content-Type '{content_type}'. Only HTML or text is permitted."
                    )

                raw_bytes = response.content[: self.max_bytes]
                encoding = response.encoding or "utf-8"
                try:
                    html_text = raw_bytes.decode(encoding, errors="replace")
                except Exception:
                    html_text = raw_bytes.decode("utf-8", errors="replace")

                # Parse HTML content
                parser = _TextExtractor()
                try:
                    parser.feed(html_text)
                except Exception as exc:
                    logger.debug("HTML parser encountered error on '%s': %s", current_url, exc)

                text_combined = " ".join(parser.text_chunks)
                # Compact text summary capped at 2500 characters
                compact_summary = " ".join(text_combined.split())[:2500]

                has_booking = bool(parser.booking_links) or any(
                    "book" in cta.lower() or "appointment" in cta.lower() or "schedule" in cta.lower()
                    for cta in parser.observed_ctas
                )
                has_wa = bool(parser.whatsapp_links) or any("whatsapp" in cta.lower() for cta in parser.observed_ctas)

                return WebsiteFetchResult(
                    success=True,
                    url=current_url,
                    status_code=response.status_code,
                    title=parser.title,
                    meta_description=parser.meta_description,
                    text_summary=compact_summary,
                    observed_ctas=parser.observed_ctas[:10],
                    whatsapp_links=parser.whatsapp_links[:5],
                    phone_links=parser.phone_links[:5],
                    booking_links=parser.booking_links[:5],
                    has_booking_system=has_booking,
                    has_whatsapp_cta=has_wa,
                    error=None
                )

            return WebsiteFetchResult(
                success=False,
                url=current_url,
                error=f"Exceeded maximum redirect limit ({self.max_redirects})"
            )


_default_fetcher: Optional[WebsiteContentFetcher] = None


def get_website_fetcher() -> WebsiteContentFetcher:
    """Retrieve singleton instance of WebsiteContentFetcher."""
    global _default_fetcher
    if _default_fetcher is None:
        _default_fetcher = WebsiteContentFetcher()
    return _default_fetcher


async def fetch_website_safely(url: str) -> WebsiteFetchResult:
    """Convenience helper to fetch website content with SSRF protection."""
    fetcher = get_website_fetcher()
    return await fetcher.fetch(url)


__all__ = [
    "BLOCKED_HOSTS",
    "BLOCKED_NETWORKS",
    "SSRFSecurityError",
    "WebsiteFetchResult",
    "WebsiteContentFetcher",
    "is_ip_blocked",
    "validate_and_resolve_url",
    "get_website_fetcher",
    "fetch_website_safely",
]
