"""Outreach Schemas for LeadPulse AI V2 Phase 7.

Defines schemas for:
- OutreachDraft: Structured short, personalized outreach message grounded in evidence.
- OutreachValidationResult: Deterministic validation result with explicit rejection reasons.
- ApprovalStatus: Controlled human approval boundary state.
- OutreachRecord: Unified record combining lead intelligence, draft, validation, and approval state.
"""

from datetime import datetime, timezone
import re
from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.agent import TokenUsage
from app.schemas.evidence import Evidence
from app.schemas.lead_analysis import LeadAnalysis
from app.schemas.opportunity import APPROVED_SERVICES, normalize_service_name

ApprovalStatus = Literal["awaiting_human_approval", "approved", "rejected"]
DraftStatus = Literal["draft", "rejected"]


class OutreachValidationResult(BaseModel):
    """Deterministic validation result produced without LLM interference."""
    model_config = ConfigDict(populate_by_name=True)

    valid: bool = Field(..., description="Whether the outreach message passed all deterministic checks")
    errors: list[str] = Field(default_factory=list, description="List of validation errors")
    reasons: list[str] = Field(default_factory=list, description="List of failure or caution reasons (backward-compatible)")
    character_count: int = Field(default=0, ge=0, description="Message length in characters")
    sentence_count: int = Field(default=0, ge=0, description="Count of detected complete sentences")
    detected_service: Optional[str] = Field(default=None, description="Canonical detected or requested service name")
    banned_phrase_found: bool = Field(default=False, description="True if banned sales/agency phrases detected")
    unsupported_claim_detected: bool = Field(default=False, description="True if unsupported financial/performance claims detected")
    placeholder_detected: bool = Field(default=False, description="True if template placeholders were detected")
    unsupported_service: bool = Field(default=False, description="True if service is not in approved business profile")

    @model_validator(mode="before")
    @classmethod
    def sync_errors_and_reasons(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "errors" in data and ("reasons" not in data or not data["reasons"]):
                data["reasons"] = list(data["errors"])
            elif "reasons" in data and ("errors" not in data or not data["errors"]):
                data["errors"] = list(data["reasons"])
        return data


class OutreachDraft(BaseModel):
    """Structured outreach message produced by the Outreach Agent."""
    model_config = ConfigDict(populate_by_name=True)

    message: str = Field(..., min_length=1, description="Personalized outreach draft text (2-3 sentences, <=300 chars)")
    service: str = Field(..., min_length=1, description="Approved canonical service recommendation")
    evidence_used: list[Evidence] = Field(default_factory=list, description="Grounding evidence items referenced in the message")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence in the relevance of this outreach [0.0 - 1.0]")
    status: DraftStatus = Field(default="draft", description="Draft state: 'draft' or 'rejected'")
    validation_reasons: list[str] = Field(default_factory=list, description="Deterministic validator feedback or rejection reasons")
    character_count: int = Field(default=0, ge=0, description="Pre-computed character length")
    sentence_count: int = Field(default=0, ge=0, description="Pre-computed sentence count")

    @field_validator("service", mode="before")
    @classmethod
    def validate_service(cls, v: Any) -> str:
        return normalize_service_name(str(v))

    @field_validator("confidence", mode="before")
    @classmethod
    def normalize_confidence(cls, v: Any) -> float:
        if isinstance(v, str):
            try:
                v = float(v.strip())
            except ValueError:
                raise ValueError(f"Invalid confidence: '{v}'")
        if not isinstance(v, (int, float)):
            raise ValueError(f"confidence must be numeric, got {type(v)}")
        conf = float(v)
        if conf < 0.0 or conf > 1.0:
            raise ValueError(f"confidence must be between 0.0 and 1.0, got {conf}")
        return round(conf, 3)

    @field_validator("message")
    @classmethod
    def validate_message_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Outreach message cannot be empty or whitespace.")
        return v.strip()


class OutreachRecord(BaseModel):
    """Full outreach record tracking generation, validation, and human approval boundary."""
    model_config = ConfigDict(populate_by_name=True)

    lead_id: str = Field(..., min_length=1, description="Unique lead identifier")
    business_name: str = Field(..., min_length=1, description="Business name")
    opportunity_score: float = Field(default=0.0, ge=0.0, le=100.0, description="Synthesized opportunity score")
    primary_problem: str = Field(default="", description="Core identified bottleneck")
    recommended_service: str = Field(..., min_length=1, description="Canonical service recommendation")
    confidence: float = Field(default=0.5, ge=0.0, le=1.0, description="Confidence in outreach relevance")
    evidence: list[Evidence] = Field(default_factory=list, description="Underlying evidence items")
    draft: OutreachDraft = Field(..., description="Current outreach draft")
    validation: OutreachValidationResult = Field(..., description="Validation outcome for the current draft")
    approval_status: ApprovalStatus = Field(
        default="awaiting_human_approval",
        description="Controlled approval state. NEVER automatically advances to external send."
    )
    lifecycle_status: Literal[
        "research_ready",
        "outreach_draft",
        "validated",
        "awaiting_human_approval",
        "approved",
        "rejected",
    ] = Field(
        default="awaiting_human_approval",
        description="Explicit lifecycle tracking: research_ready -> outreach_draft -> validated -> awaiting_human_approval -> approved/rejected"
    )
    regeneration_count: int = Field(default=0, ge=0, description="Number of regeneration attempts performed")
    token_usage: Optional[TokenUsage] = Field(default=None, description="Aggregated token usage")
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class OutreachDraftRequest(BaseModel):
    """Request payload for generating an outreach draft."""
    model_config = ConfigDict(populate_by_name=True)

    lead_id: Optional[str] = Field(default=None, description="Optional lead identifier")
    business_name: str = Field(..., min_length=1, description="Target business name")
    lead_analysis: Optional[LeadAnalysis] = Field(default=None, description="Pre-computed LeadAnalysis record")
    primary_problem: Optional[str] = Field(default=None, description="Identified bottleneck if no LeadAnalysis")
    recommended_service: Optional[str] = Field(default=None, description="Canonical service recommendation")
    why_this_service: Optional[str] = Field(default=None, description="Service relevance explanation")
    evidence: list[Evidence] = Field(default_factory=list, description="Grounding evidence items")
    confidence: Optional[float] = Field(default=0.8, ge=0.0, le=1.0, description="Confidence level")
    opportunity_score: Optional[float] = Field(default=50.0, ge=0.0, le=100.0, description="Opportunity score")
    public_context: Optional[dict[str, Any]] = Field(default=None, description="Safe public context")


class OutreachEditRequest(BaseModel):
    """Request payload for human editing of an outreach draft."""
    message: str = Field(..., min_length=1, description="Edited outreach message (will be re-validated)")
    service: Optional[str] = Field(default=None, description="Optional service override")


class OutreachApproveRequest(BaseModel):
    """Request payload for human operator approval."""
    approved_by: Optional[str] = Field(default="human_operator", description="Identifier of the approving reviewer")
    notes: Optional[str] = Field(default=None, description="Optional approval notes")


class OutreachRejectRequest(BaseModel):
    """Request payload for rejecting an outreach draft."""
    reason: Optional[str] = Field(default=None, description="Reason for rejection")


__all__ = [
    "ApprovalStatus",
    "DraftStatus",
    "OutreachDraft",
    "OutreachValidationResult",
    "OutreachRecord",
    "OutreachDraftRequest",
    "OutreachEditRequest",
    "OutreachApproveRequest",
    "OutreachRejectRequest",
]
