"""Lead Analysis Schemas for LeadPulse AI V2.

Defines the final synthesized intelligence record produced by the Lead Analyst:
- LeadAnalysis: Unified lead profile merging candidate scorecard data,
  specialist research evidence, opportunity score, problem statement,
  canonical service recommendation, research status, and explicit limitations.

ANTI-HALLUCINATION INVARIANTS:
- research_status must be 'complete', 'partial', or 'failed'
- If research_status is 'partial' or 'failed', limitations must not be empty
- If a specialist failed, the Lead Analyst must NEVER assume or fabricate its findings
- opportunity_score bounded [0.0, 100.0]
- confidence bounded [0.0, 1.0]
- recommended_service must belong to approved canonical business profile services
"""

from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.agent import TokenUsage
from app.schemas.evidence import Evidence
from app.schemas.opportunity import normalize_service_name

PriorityLevel = Literal["high", "medium", "low"]
ResearchStatus = Literal["complete", "partial", "failed"]


class LeadAnalysis(BaseModel):
    """Structured final lead intelligence record synthesized across all pipeline stages."""
    model_config = ConfigDict(populate_by_name=True)

    business_name: str = Field(..., min_length=1, description="Target business name")
    qualification_status: str = Field(
        ...,
        min_length=1,
        description="Qualification decision: 'qualified' or 'disqualified'"
    )
    priority: PriorityLevel = Field(..., description="Outreach and engagement priority tier: high, medium, low")
    prospect_score: float = Field(..., ge=0.0, description="Deterministic scorecard prospect score (0-10 or scaled)")
    opportunity_score: float = Field(..., ge=0.0, le=100.0, description="Synthesized opportunity score (0.0 - 100.0)")
    primary_problem: str = Field(..., min_length=1, description="Core identified operational or conversion bottleneck")
    recommended_service: str = Field(..., min_length=1, description="Approved canonical service recommendation")
    why_this_service: str = Field(..., min_length=1, description="Rationale linking problem to service value proposition")
    evidence: list[Evidence] = Field(default_factory=list, description="Preserved grounded evidence across all specialists")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Overall intelligence confidence (0.0 - 1.0)")
    research_status: ResearchStatus = Field(
        ...,
        description="Research completion status: 'complete', 'partial', or 'failed'"
    )
    limitations: list[str] = Field(
        default_factory=list,
        description="Explicit record of unavailable research channels, timeouts, or data gaps"
    )

    # Execution telemetry metadata
    execution_time_ms: float = Field(default=0.0, ge=0.0, description="Total pipeline execution time in ms")
    token_usage: Optional[TokenUsage] = Field(default=None, description="Aggregated token usage across all agents")

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, v: Any) -> str:
        if isinstance(v, str):
            norm = v.strip().lower()
            if norm in ("high", "medium", "low"):
                return norm
            if norm in ("immediate", "urgent"):
                return "high"
            if norm in ("skip", "rejected", "none", "disqualified"):
                return "low"
        return v

    @field_validator("research_status", mode="before")
    @classmethod
    def normalize_research_status(cls, v: Any) -> str:
        if isinstance(v, str):
            norm = v.strip().lower()
            if norm in ("complete", "partial", "failed"):
                return norm
        return v

    @field_validator("qualification_status", mode="before")
    @classmethod
    def normalize_qualification_status(cls, v: Any) -> str:
        if isinstance(v, str):
            norm = v.strip().lower()
            if norm in ("qualified", "true", "yes", "pass"):
                return "qualified"
            if norm in ("disqualified", "false", "no", "skip", "reject"):
                return "disqualified"
            return norm
        return str(v)

    @field_validator("recommended_service", mode="before")
    @classmethod
    def validate_recommended_service(cls, v: Any) -> str:
        return normalize_service_name(str(v))

    @field_validator("opportunity_score", mode="before")
    @classmethod
    def normalize_opportunity_score(cls, v: Any) -> float:
        if isinstance(v, str):
            try:
                v = float(v.strip())
            except ValueError:
                raise ValueError(f"Invalid opportunity_score: '{v}'")
        if not isinstance(v, (int, float)):
            raise ValueError(f"opportunity_score must be numeric, got {type(v)}")
        score = float(v)
        if score < 0.0 or score > 100.0:
            raise ValueError(f"opportunity_score must be between 0.0 and 100.0, got {score}")
        return round(score, 1)

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

    @model_validator(mode="after")
    def validate_anti_hallucination_and_limitations(self) -> "LeadAnalysis":
        # 1. Bounded checks
        if not (0.0 <= self.opportunity_score <= 100.0):
            raise ValueError(f"opportunity_score {self.opportunity_score} must be between 0.0 and 100.0")
        if not (0.0 <= self.confidence <= 1.0):
            raise ValueError(f"confidence {self.confidence} must be between 0.0 and 1.0")

        # 2. Partial research requires explicit limitations
        if self.research_status == "partial":
            if not self.limitations:
                raise ValueError(
                    "Anti-hallucination guard: research_status='partial' strictly requires explicit "
                    "limitations recording which specialist research was unavailable or failed."
                )

        if self.research_status == "failed":
            if not self.limitations:
                raise ValueError(
                    "Anti-hallucination guard: research_status='failed' requires explicit limitations."
                )

        # 3. If Ads research is unavailable or failed, forbid claiming heavy or active ad spend
        ads_unavailable = any("ads research unavailable" in lim.lower() or "ads" in lim.lower() for lim in self.limitations)
        if ads_unavailable:
            text_corpus = f"{self.primary_problem} {self.why_this_service}".lower()
            if "spending heavily on" in text_corpus or "heavy ad spend" in text_corpus or "high ad spend" in text_corpus:
                raise ValueError(
                    "Anti-hallucination guard: Cannot claim active or heavy ad spend when Ads research is recorded as unavailable."
                )

        return self


__all__ = [
    "PriorityLevel",
    "ResearchStatus",
    "LeadAnalysis",
]
