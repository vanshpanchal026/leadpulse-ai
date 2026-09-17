"""Schemas for standardized error responses."""

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    """Standardized API error response payload."""
    error: str = Field(..., description="High-level error summary")
    detail: str = Field(..., description="Sanitized description of the issue")
    error_code: str = Field(..., description="Machine-readable error identifier")
