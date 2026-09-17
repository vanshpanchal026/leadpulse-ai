"""Health and readiness probe endpoints."""

import logging
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.provider import is_provider_ready, get_client, init_provider
from app.schemas.health import HealthResponse, ReadinessResponse, ProviderInfo

from urllib.parse import urlsplit, urlunsplit

router = APIRouter(tags=["Health"])
logger = logging.getLogger("ai_worker.api.health")


def _sanitize_url(url_str: str) -> str:
    """Sanitize URL to strip user credentials if present."""
    try:
        parts = urlsplit(url_str)
        if parts.username or parts.password:
            hostname = parts.hostname or ""
            port = f":{parts.port}" if parts.port else ""
            netloc = f"***@{hostname}{port}"
            return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))
    except Exception:
        pass
    return url_str


@router.get(
    "",
    response_model=HealthResponse,
    summary="Worker liveness check",
    description="Returns worker service status, version, and provider configuration status without revealing secrets."
)
@router.get(
    "/",
    include_in_schema=False,
    response_model=HealthResponse
)
async def get_health() -> HealthResponse:
    """Return health status of the worker process."""
    settings = get_settings()
    if not is_provider_ready():
        try:
            init_provider(settings)
        except Exception:
            pass
    ready = is_provider_ready()

    return HealthResponse(
        status="healthy",
        service="leadpulse-ai-worker",
        version="2.0.0",
        provider=ProviderInfo(
            configured=ready,
            mode=settings.AI_API_MODE,
            model=settings.AI_MODEL
        )
    )


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    summary="Worker readiness probe",
    description="Actively checks whether the upstream AI provider endpoint is reachable."
)
async def get_readiness() -> JSONResponse:
    """Check connectivity to upstream OpenAI-compatible gateway."""
    settings = get_settings()

    try:
        client = get_client()
        # Verify upstream gateway responsiveness via models probe
        await client.models.list()
        sanitized_url = _sanitize_url(settings.AI_BASE_URL)
        response_data = ReadinessResponse(
            status="ready",
            provider_accessible=True,
            provider_status="Connected to upstream AI gateway",
            details=f"Endpoint: {sanitized_url} (Model: {settings.AI_MODEL})"
        )
        return JSONResponse(status_code=status.HTTP_200_OK, content=response_data.model_dump())
    except Exception as exc:
        logger.warning("Readiness probe check failed: %s", exc)
        response_data = ReadinessResponse(
            status="unready",
            provider_accessible=False,
            provider_status="Upstream AI gateway unreachable",
            details="Failed to reach upstream model gateway"
        )
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=response_data.model_dump())
