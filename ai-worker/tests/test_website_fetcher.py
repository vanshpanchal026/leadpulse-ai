"""Unit tests for controlled website content retrieval and SSRF security guardrails."""

import pytest
import httpx
from unittest.mock import patch, AsyncMock

from app.services.website_fetcher import (
    validate_and_resolve_url,
    SSRFSecurityError,
    WebsiteContentFetcher,
    _TextExtractor,
    fetch_website_safely,
)


class TestSSRFDefense:
    """Security tests asserting comprehensive SSRF protection."""

    @pytest.mark.parametrize("target", [
        "http://localhost",
        "http://localhost:8000",
        "https://localhost.localdomain",
        "http://127.0.0.1",
        "http://127.0.0.1:3000/admin",
        "http://127.0.1.1",
        "http://0.0.0.0",
        "http://10.0.0.1",
        "http://10.254.0.1",
        "http://172.16.0.1",
        "http://172.31.255.255",
        "http://192.168.1.1",
        "http://192.168.0.254",
        "http://169.254.169.254/latest/meta-data",
        "http://169.254.0.1",
        "http://100.64.0.1",
        "http://metadata.google.internal",
        "http://instance-data",
    ])
    def test_blocks_private_and_metadata_targets(self, target: str):
        with pytest.raises(SSRFSecurityError):
            validate_and_resolve_url(target)

    def test_unsupported_schemes_rejected(self):
        with pytest.raises(ValueError, match="Unsupported URL scheme"):
            validate_and_resolve_url("ftp://ftp.example.com")

        with pytest.raises(ValueError, match="Unsupported URL scheme"):
            validate_and_resolve_url("file:///etc/passwd")

        with pytest.raises(ValueError, match="Unsupported URL scheme"):
            validate_and_resolve_url("gopher://evil.com")

    def test_dns_resolution_blocks_dns_rebinding_to_private_ip(self):
        # Even if hostname is "safe-looking.com", if it resolves to 127.0.0.1, it must be rejected!
        with patch("socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [
                (2, 1, 6, "", ("127.0.0.1", 80))
            ]
            with pytest.raises(SSRFSecurityError, match="blocked/private IP"):
                validate_and_resolve_url("http://safe-looking-domain.com")


class TestHTMLExtraction:
    """Tests asserting correct extraction of CTAs, booking flows, and visible text."""

    SAMPLE_HTML = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Dr. Gupta Dental Clinic | Luxury Cosmetic Dentistry</title>
        <meta name="description" content="Premier cosmetic dentist offering smile makeovers and dental implants in Gurgaon.">
        <style>body { font-family: sans-serif; }</style>
        <script>var tracking = true;</script>
    </head>
    <body>
        <header>
            <h1>Welcome to Dr. Gupta Dental Clinic</h1>
            <nav>
                <a href="/about">About Us</a>
                <a href="tel:+919876543210">Call: +91 9876543210</a>
                <a href="https://wa.me/919876543210" class="btn">WhatsApp Us</a>
            </nav>
        </header>
        <main>
            <h2>State of the Art Aesthetic Care</h2>
            <p>We provide world-class dental implants and invisible aligners.</p>
            <a href="https://calendly.com/drgupta/consult" class="cta-button">Book Appointment</a>
            <button>Schedule Free Consultation</button>
        </main>
        <footer>
            <p>&copy; 2026 Dr. Gupta Dental. All rights reserved.</p>
        </footer>
    </body>
    </html>
    """

    def test_text_extractor_parses_sample_html(self):
        parser = _TextExtractor()
        parser.feed(self.SAMPLE_HTML)

        assert parser.title == "Dr. Gupta Dental Clinic | Luxury Cosmetic Dentistry"
        assert "Premier cosmetic dentist" in (parser.meta_description or "")
        assert any("calendly.com" in link for link in parser.booking_links)
        assert any("wa.me" in link for link in parser.whatsapp_links)
        assert "+919876543210" in parser.phone_links or "+91 9876543210" in parser.phone_links

        ctas_lower = [c.lower() for c in parser.observed_ctas]
        assert any("book" in c for c in ctas_lower)
        assert any("consultation" in c or "whatsapp" in c for c in ctas_lower)

        # Confirm style and script content was stripped
        combined = " ".join(parser.text_chunks)
        assert "tracking = true" not in combined
        assert "font-family" not in combined


class TestWebsiteContentFetcher:
    """Tests asserting end-to-end fetcher behavior, redirects, and error handling."""

    @pytest.mark.asyncio
    async def test_fetch_success_with_mocked_http(self):
        fetcher = WebsiteContentFetcher()

        mock_resp = httpx.Response(
            status_code=200,
            headers={"Content-Type": "text/html; charset=utf-8"},
            text=TestHTMLExtraction.SAMPLE_HTML,
            request=httpx.Request("GET", "https://example-dental.com")
        )

        with patch("app.services.website_fetcher.validate_and_resolve_url") as mock_val, \
             patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_val.return_value = ("https://example-dental.com", "93.184.216.34")
            mock_get.return_value = mock_resp

            result = await fetcher.fetch("https://example-dental.com")
            assert result.success is True
            assert result.status_code == 200
            assert result.title == "Dr. Gupta Dental Clinic | Luxury Cosmetic Dentistry"
            assert result.has_booking_system is True
            assert result.has_whatsapp_cta is True
            assert len(result.observed_ctas) >= 1

    @pytest.mark.asyncio
    async def test_fetch_handles_server_error_safely(self):
        fetcher = WebsiteContentFetcher()

        mock_resp = httpx.Response(
            status_code=503,
            headers={"Content-Type": "text/html"},
            text="Service Unavailable",
            request=httpx.Request("GET", "https://failing-clinic.com")
        )

        with patch("app.services.website_fetcher.validate_and_resolve_url") as mock_val, \
             patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_val.return_value = ("https://failing-clinic.com", "93.184.216.34")
            mock_get.return_value = mock_resp

            result = await fetcher.fetch("https://failing-clinic.com")
            assert result.success is False
            assert result.status_code == 503
            assert "503" in (result.error or "")

    @pytest.mark.asyncio
    async def test_fetch_rejects_non_html_content(self):
        fetcher = WebsiteContentFetcher()

        mock_resp = httpx.Response(
            status_code=200,
            headers={"Content-Type": "application/pdf"},
            content=b"%PDF-1.4...",
            request=httpx.Request("GET", "https://example-dental.com/brochure.pdf")
        )

        with patch("app.services.website_fetcher.validate_and_resolve_url") as mock_val, \
             patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_val.return_value = ("https://example-dental.com/brochure.pdf", "93.184.216.34")
            mock_get.return_value = mock_resp

            result = await fetcher.fetch("https://example-dental.com/brochure.pdf")
            assert result.success is False
            assert "Content-Type" in (result.error or "")

    @pytest.mark.asyncio
    async def test_fetch_blocks_redirect_to_internal_metadata(self):
        fetcher = WebsiteContentFetcher()

        mock_redirect_resp = httpx.Response(
            status_code=302,
            headers={"Location": "http://169.254.169.254/latest/meta-data"},
            request=httpx.Request("GET", "https://redirector.com")
        )

        with patch("app.services.website_fetcher.validate_and_resolve_url") as mock_val, \
             patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            # First URL is valid, but redirect location targets cloud metadata!
            mock_val.side_effect = [
                ("https://redirector.com", "93.184.216.34"),
                SSRFSecurityError("Target IP address '169.254.169.254' is in a blocked network range.")
            ]
            mock_get.return_value = mock_redirect_resp

            result = await fetcher.fetch("https://redirector.com")
            assert result.success is False
            assert "SSRF guard" in (result.error or "")

    def test_blocks_urls_with_embedded_credentials(self):
        with pytest.raises(SSRFSecurityError, match="embedded credentials/userinfo"):
            validate_and_resolve_url("http://user:pass@example.com")

        with pytest.raises(SSRFSecurityError, match="embedded credentials/userinfo"):
            validate_and_resolve_url("https://admin@example.com/login")

    def test_blocks_non_standard_web_ports(self):
        with pytest.raises(SSRFSecurityError, match="not an allowed public web port"):
            validate_and_resolve_url("http://example.com:22")

        with pytest.raises(SSRFSecurityError, match="not an allowed public web port"):
            validate_and_resolve_url("http://example.com:6379/keys")

        with pytest.raises(SSRFSecurityError, match="not an allowed public web port"):
            validate_and_resolve_url("http://example.com:25/smtp")

    def test_blocks_internal_tlds_and_local_domains(self):
        with pytest.raises(SSRFSecurityError, match="explicitly blocked"):
            validate_and_resolve_url("http://backend-api.internal")

        with pytest.raises(SSRFSecurityError, match="explicitly blocked"):
            validate_and_resolve_url("http://printer.local")

        with pytest.raises(SSRFSecurityError, match="explicitly blocked"):
            validate_and_resolve_url("http://router.lan")

        with pytest.raises(SSRFSecurityError, match="explicitly blocked"):
            validate_and_resolve_url("http://nas.home")
