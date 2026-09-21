"""Schemas for agent execution requests, responses, token accounting, and structured outputs."""

from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field, AliasChoices, field_validator


class LeadTriageResult(BaseModel):
    """Resilient Pydantic model for structured lead qualification output.
    
    Uses AliasChoices and populate_by_name=True to defend against upstream model
    synonym emission under dynamic routing (proven in Phase 1 verification).
    """
    model_config = ConfigDict(populate_by_name=True)

    business_name: str = Field(
        ...,
        validation_alias=AliasChoices("business_name", "name", "company", "business"),
        description="Name of the evaluated business or prospect"
    )
    score: int = Field(
        ...,
        validation_alias=AliasChoices("score", "qualification_score", "lead_score", "rating"),
        description="10-point prospect qualification score",
        ge=0,
        le=10
    )
    priority: str = Field(
        ...,
        validation_alias=AliasChoices("priority", "lead_priority", "urgency"),
        description="Outreach priority category (immediate, high, medium, skip)"
    )
    recommended_channel: str = Field(
        default="whatsapp",
        validation_alias=AliasChoices("recommended_channel", "channel", "direct_contact_channel"),
        description="Recommended initial outreach channel (e.g. whatsapp)"
    )

    @field_validator("priority")
    @classmethod
    def normalize_priority(cls, v: str) -> str:
        return v.strip().lower()


class TokenUsage(BaseModel):
    """Token consumption accounting aggregated across turns."""
    prompt_tokens: int = Field(default=0, description="Input/prompt tokens consumed")
    completion_tokens: int = Field(default=0, description="Output/completion tokens generated")
    total_tokens: int = Field(default=0, description="Sum of prompt and completion tokens")


class AgentRunRequest(BaseModel):
    """Payload for invoking an agent through the worker API."""
    prompt: str = Field(..., min_length=1, description="Input query or business context for the agent")
    agent_type: str = Field(
        default="triage",
        description="Agent persona to execute ('base' or 'triage')"
    )
    timeout_seconds: Optional[float] = Field(
        default=None,
        gt=0.0,
        le=300.0,
        description="Optional execution timeout override in seconds"
    )
    context: Optional[dict[str, Any]] = Field(
        default=None,
        description="Optional auxiliary key-value metadata"
    )

    @field_validator("agent_type")
    @classmethod
    def validate_agent_type(cls, v: str) -> str:
        normalized = v.strip().lower()
        allowed = (
            "base",
            "triage",
            "profile_test",
            "profile",
            "search_strategist",
            "search",
            "lead_triage",
            "specialist_triage",
            "website_specialist",
            "website",
            "ads_specialist",
            "ads",
            "maps_specialist",
            "maps",
            "opportunity",
            "opportunity_agent",
            "lead_analyst",
            "analyst",
            "outreach",
            "outreach_agent",
        )
        if normalized not in allowed:
            raise ValueError(
                f"Unknown agent type '{v}'. Supported types: {list(allowed)}."
            )
        return normalized



class AgentRunResponse(BaseModel):
    """Standardized response from the agent runner service."""
    success: bool = Field(..., description="Whether the agent completed successfully")
    output: Any = Field(..., description="Agent final output (text string or structured dict)")
    agent_type: str = Field(..., description="The type of agent executed")
    execution_time_ms: float = Field(..., description="Total wall-clock duration in milliseconds")
    token_usage: Optional[TokenUsage] = Field(default=None, description="Aggregated token usage metadata")
    error: Optional[str] = Field(default=None, description="Sanitized error description if failed")
