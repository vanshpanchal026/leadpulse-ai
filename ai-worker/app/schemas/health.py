"""Schemas for worker health and readiness probes."""

from typing import Optional
from pydantic import BaseModel, Field


class ProviderInfo(BaseModel):
    """Metadata describing the active AI provider without exposing secrets."""
    configured: bool = Field(..., description="Whether the provider has been initialized")
    mode: str = Field(..., description="Operational API mode (e.g. chat_completions)")
    model: str = Field(..., description="Configured model identifier")


class HealthResponse(BaseModel):
    """Liveness probe response model."""
    status: str = Field(default="healthy", description="Worker service status")
    service: str = Field(default="leadpulse-ai-worker", description="Service name")
    version: str = Field(default="2.0.0", description="Worker semantic version")
    provider: ProviderInfo = Field(..., description="Configured model provider status")


class ReadinessResponse(BaseModel):
    """Readiness probe response model."""
    status: str = Field(..., description="Readiness status ('ready' or 'unready')")
    provider_accessible: bool = Field(..., description="Whether the upstream AI gateway responds")
    provider_status: str = Field(..., description="Brief upstream description")
    details: Optional[str] = Field(default=None, description="Optional diagnostic details (sanitized)")
