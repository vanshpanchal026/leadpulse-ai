"""Controlled Apify REST API Client with Invariant Enforcement.

Security & Reliability Invariants:
1. Actor Whitelist: Only pre-authorized actors can ever be executed.
2. Secret Redaction: API tokens are never logged or exposed in errors.
3. Strict Timeouts: Configurable execution timeouts per call.
4. Bounded Retries: Exponential backoff on transient errors (429, 5xx).
5. Clean Isolation: The LLM never sees or manipulates this layer.
"""

import asyncio
import logging
import re
from typing import Any, Optional
import httpx
from pydantic import SecretStr

from app.core.config import get_settings
from app.tools.apify.schemas import ApifyToolException

logger = logging.getLogger("ai_worker.tools.apify")

AUTHORIZED_ACTORS: set[str] = {
    "compass/crawler-google-places",
    "trudax/reddit-scraper-lite",
    "apify/facebook-ads-scraper",
}


def _redact_token(text: str, token: Optional[str]) -> str:
    """Sanitize any occurrence of the secret token from text."""
    if not token or not text:
        return text
    return text.replace(token, "[REDACTED_APIFY_TOKEN]")


class ApifyRestClient:
    """Secure client for executing whitelisted Apify actors via REST API."""

    def __init__(
        self,
        token: Optional[SecretStr] = None,
        base_url: Optional[str] = None,
        timeout_seconds: float = 120.0,
        max_retries: int = 2,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ):
        settings = get_settings()
        self._token = token or settings.APIFY_API_TOKEN
        self.base_url = (base_url or settings.APIFY_BASE_URL).rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self._transport = transport

    def has_token(self) -> bool:
        """Return True if an Apify token is configured."""
        return self._token is not None and bool(self._token.get_secret_value().strip())

    def _get_raw_token(self) -> str:
        """Retrieve raw token safely for internal HTTP request authorization header."""
        if not self.has_token():
            raise ApifyToolException(
                code="MISSING_APIFY_TOKEN",
                message="APIFY_API_TOKEN is not configured in worker environment",
                retryable=False
            )
        assert self._token is not None
        return self._token.get_secret_value()

    async def call_actor(
        self,
        actor_id: str,
        actor_input: dict[str, Any],
        timeout_secs: Optional[int] = None,
        max_items: Optional[int] = None,
    ) -> tuple[list[dict[str, Any]], Optional[str]]:
        """Execute an authorized Apify actor and retrieve its resulting dataset items.

        Returns:
            tuple[list[dict], Optional[str]]: (items_list, run_id)
        """
        # 1. Enforce Actor Whitelist
        clean_actor_id = actor_id.strip()
        if clean_actor_id not in AUTHORIZED_ACTORS:
            logger.error("Security violation: Attempted call to unauthorized actor '%s'", clean_actor_id)
            raise ApifyToolException(
                code="UNAUTHORIZED_ACTOR",
                message=f"Actor '{clean_actor_id}' is not in the authorized Apify tool whitelist.",
                retryable=False
            )

        raw_token = self._get_raw_token()
        timeout = float(timeout_secs or self.timeout_seconds)
        actor_id_safe = clean_actor_id.replace("/", "~")
        
        headers = {
            "Authorization": f"Bearer {raw_token}",
            "Content-Type": "application/json",
        }

        # Shorthand endpoint: run-sync-get-dataset-items
        sync_url = f"{self.base_url}/acts/{actor_id_safe}/run-sync-get-dataset-items"
        params: dict[str, Any] = {"timeout": int(timeout)}
        if max_items:
            params["limit"] = int(max_items)

        logger.info(
            "Executing Apify actor '%s' via REST API (timeout=%ss)...",
            clean_actor_id,
            timeout
        )

        last_exception: Optional[Exception] = None

        for attempt in range(1, self.max_retries + 2):
            try:
                async with httpx.AsyncClient(
                    transport=self._transport,
                    timeout=httpx.Timeout(timeout + 15.0, connect=10.0)
                ) as client:
                    response = await client.post(
                        sync_url,
                        headers=headers,
                        params=params,
                        json=actor_input
                    )

                    # Successful synchronous run
                    if response.status_code in (200, 201):
                        data = response.json()
                        run_id = response.headers.get("x-apify-actor-run-id")
                        items = data if isinstance(data, list) else data.get("items", [])
                        logger.info(
                            "Apify actor '%s' succeeded on attempt %s. Fetched %s items.",
                            clean_actor_id,
                            attempt,
                            len(items)
                        )
                        return items, run_id

                    # Rate limited or server error -> eligible for retry
                    if response.status_code in (429, 500, 502, 503, 504):
                        err_text = _redact_token(response.text, raw_token)
                        logger.warning(
                            "Apify actor call transient status %s (attempt %s/%s): %s",
                            response.status_code,
                            attempt,
                            self.max_retries + 1,
                            err_text
                        )
                        if attempt <= self.max_retries:
                            backoff = 1.0 * (2 ** (attempt - 1))
                            await asyncio.sleep(backoff)
                            continue

                        raise ApifyToolException(
                            code=f"APIFY_HTTP_{response.status_code}",
                            message=f"Apify API returned HTTP {response.status_code}: {err_text}",
                            retryable=True
                        )

                    # Non-retryable client error
                    err_text = _redact_token(response.text, raw_token)
                    raise ApifyToolException(
                        code=f"APIFY_HTTP_{response.status_code}",
                        message=f"Apify API execution error: {err_text}",
                        retryable=False
                    )

            except httpx.TimeoutException as exc:
                last_exception = exc
                logger.warning("Apify actor call timeout on attempt %s: %s", attempt, exc)
                if attempt <= self.max_retries:
                    await asyncio.sleep(1.0 * attempt)
                    continue
                raise ApifyToolException(
                    code="APIFY_TIMEOUT",
                    message=f"Apify actor execution timed out after {timeout} seconds",
                    retryable=True
                ) from exc

            except ApifyToolException:
                raise

            except Exception as exc:
                last_exception = exc
                logger.error("Apify actor unexpected error on attempt %s: %s", attempt, exc)
                if attempt <= self.max_retries:
                    await asyncio.sleep(1.0 * attempt)
                    continue
                sanitized_msg = _redact_token(str(exc), raw_token)
                raise ApifyToolException(
                    code="APIFY_EXECUTION_ERROR",
                    message=f"Unexpected error executing Apify actor: {sanitized_msg}",
                    retryable=False
                ) from exc

        raise ApifyToolException(
            code="APIFY_RETRIES_EXHAUSTED",
            message=f"Failed to execute actor '{clean_actor_id}' after retries: {last_exception}",
            retryable=False
        )


__all__ = ["ApifyRestClient", "AUTHORIZED_ACTORS"]
