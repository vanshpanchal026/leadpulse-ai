"""Evidence, Confidence, and Specialist Intelligence Schemas.

Defines the Phase 5 structured evidence models and specialist output schemas:
- Evidence (grounded finding with source, confidence [0.0, 1.0], and classification)
- LeadTriageResult (triage decision determining if candidate deserves deep research)
- WebsiteAnalysisResult (controlled website specialist output)
- AdsAnalysisResult (controlled advertising specialist output)
- MapsAnalysisResult (controlled maps specialist output)
- SpecialistResearchAggregate (isolated, resilient parallel research aggregate)

ANTI-HALLUCINATION INVARIANTS:
- Classification must be explicitly: "observed", "inferred", or "unknown"
- "unknown" must never be converted into "observed"
- Inferred findings must be explicitly tagged as "inferred"
- Confidence must be bounded [0.0, 1.0]
- Metrics not present in data (ad spend, ROAS, fabricated review sentiment) are forbidden
"""

from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.schemas.agent import TokenUsage

EvidenceSource = Literal["website", "maps", "ads", "reddit"]
EvidenceClassification = Literal["observed", "inferred", "unknown"]
TriagePriority = Literal["high", "medium", "low"]
SpecialistAgentType = Literal["website", "ads", "maps"]


class Evidence(BaseModel):
    """Structured, source-grounded finding with bounded confidence."""
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    finding: str = Field(..., min_length=1, description="Concise statement of the finding")
    source: EvidenceSource = Field(..., description="Data source from which finding was derived")
    evidence: str = Field(..., min_length=1, description="Specific supporting snippet, URL, or observation")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score strictly bounded between 0.0 and 1.0")
    classification: EvidenceClassification = Field(
        ...,
        description="Whether finding is directly observed, inferred from evidence, or unknown"
    )

    @field_validator("confidence", mode="before")
    @classmethod
    def normalize_confidence(cls, v: Any) -> float:
        if isinstance(v, str):
            try:
                return float(v.strip())
            except ValueError:
                raise ValueError(f"Invalid confidence score: '{v}'")
        return v

    @field_validator("classification", mode="before")
    @classmethod
    def normalize_classification(cls, v: Any) -> str:
        if isinstance(v, str):
            normalized = v.strip().lower()
            if normalized in ("observed", "inferred", "unknown"):
                return normalized
        return v

    @field_validator("finding", "evidence")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Evidence finding and supporting text must not be empty or whitespace.")
        return v.strip()

    @model_validator(mode="after")
    def validate_observed_evidence(self) -> "Evidence":
        # Observed findings require actual supporting data; unknown must never be converted into observed
        if self.classification == "observed":
            ev_clean = self.evidence.strip().lower()
            if ev_clean in ("unknown", "none", "n/a", "not available", "unobservable", "unavailable", "nil"):
                raise ValueError(
                    "Anti-hallucination guard: Observed findings require actual supporting data. "
                    f"Cannot have classification='observed' with placeholder evidence: '{self.evidence}'."
                )
        return self


class LeadTriageResult(BaseModel):
    """Structured decision on whether a candidate deserves expensive specialist research."""
    model_config = ConfigDict(populate_by_name=True)

    qualified: bool = Field(..., description="True if candidate qualifies for deep specialist research")
    priority: TriagePriority = Field(..., description="Research and outreach priority tier: high, medium, low")
    reason: str = Field(..., min_length=1, description="Concise rationale for triage decision")
    research_agents: list[SpecialistAgentType] = Field(
        default_factory=list,
        description="Specialist agents selected for execution: website, ads, maps"
    )

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, v: Any) -> str:
        if isinstance(v, str):
            normalized = v.strip().lower()
            if normalized in ("high", "medium", "low"):
                return normalized
            # Map legacy or synonym tiers if model emits them
            if normalized in ("immediate", "urgent"):
                return "high"
            if normalized in ("skip", "rejected", "none"):
                return "low"
        return v

    @field_validator("research_agents", mode="before")
    @classmethod
    def validate_research_agents(cls, v: Any) -> list[str]:
        if not isinstance(v, list):
            return []
        cleaned = []
        valid_agents = {"website", "ads", "maps"}
        for item in v:
            if isinstance(item, str):
                normalized = item.strip().lower()
                if normalized in valid_agents and normalized not in cleaned:
                    cleaned.append(normalized)
        return cleaned

    @model_validator(mode="after")
    def validate_triage_consistency(self) -> "LeadTriageResult":
        if not self.qualified:
            self.research_agents = []
        return self


class WebsiteAnalysisResult(BaseModel):
    """Structured output from the controlled Website Specialist Agent."""
    model_config = ConfigDict(populate_by_name=True)

    status: Literal["available", "unavailable", "partial", "error"] = Field(
        ...,
        description="Website availability status"
    )
    findings: list[str] = Field(default_factory=list, description="Key observations from website inspection")
    evidence: list[Evidence] = Field(default_factory=list, description="Structured evidence items")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence in the overall website assessment")
    limitations: list[str] = Field(default_factory=list, description="Known constraints or unobservable data")
    website_url: Optional[str] = Field(default=None, description="Analyzed website URL")
    has_booking_system: Optional[bool] = Field(default=None, description="Observed online booking system/flow")
    has_whatsapp_cta: Optional[bool] = Field(default=None, description="Observed WhatsApp button or chat link")
    primary_cta: Optional[str] = Field(default=None, description="Primary call-to-action observed on site")
    friction_points: list[str] = Field(default_factory=list, description="Observed conversion or UX friction points")
    conversion_notes: Optional[str] = Field(default=None, description="Notes on lead capture or conversion paths")

    @model_validator(mode="after")
    def validate_anti_hallucination(self) -> "WebsiteAnalysisResult":
        # If website is unavailable or error, never claim observed booking, WhatsApp, or primary CTA
        if self.status in ("unavailable", "error"):
            if self.has_booking_system is True:
                raise ValueError("Anti-hallucination guard: Cannot report has_booking_system=True when website is unavailable.")
            if self.has_whatsapp_cta is True:
                raise ValueError("Anti-hallucination guard: Cannot report has_whatsapp_cta=True when website is unavailable.")
            if self.primary_cta is not None and self.primary_cta.strip().lower() not in ("none", "unknown", "n/a", ""):
                raise ValueError(
                    f"Anti-hallucination guard: Cannot report primary_cta='{self.primary_cta}' when website is unavailable."
                )
            for text in list(self.findings) + list(self.friction_points):
                lower = text.lower()
                if any(bad in lower for bad in ("poor website", "bad website", "broken booking", "bad booking system", "unprofessional website")):
                    raise ValueError(
                        f"Anti-hallucination guard: Cannot infer poor website quality ('{text}') simply because the website could not be reached."
                    )
        return self


class AdsAnalysisResult(BaseModel):
    """Structured output from the controlled Ads Specialist Agent."""
    model_config = ConfigDict(populate_by_name=True)

    status: Literal["active_ads", "no_ads", "unavailable", "partial", "error"] = Field(
        ...,
        description="Advertising status from Meta Ads data"
    )
    findings: list[str] = Field(default_factory=list, description="Observable signals from ad creative and copy")
    evidence: list[Evidence] = Field(default_factory=list, description="Structured evidence items")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score strictly bounded 0.0-1.0")
    limitations: list[str] = Field(default_factory=list, description="Observability constraints")
    active_ad_count: Optional[int] = Field(default=None, ge=0, description="Observed number of active ad creatives")
    ad_themes: list[str] = Field(default_factory=list, description="Creative or message themes observed in copy")
    observed_ctas: list[str] = Field(default_factory=list, description="Calls-to-action observed in ad creative")
    ad_to_website_consistency: Optional[str] = Field(
        default=None,
        description="Assessment of messaging consistency between ad and landing page"
    )
    funnel_friction: list[str] = Field(default_factory=list, description="Identified friction points in ad funnel")

    # STRICT INVARIANT: Disallow fabricated metrics
    ad_spend: Optional[Any] = Field(default=None, description="FORBIDDEN: Must always remain None/Unknown")
    roas: Optional[Any] = Field(default=None, description="FORBIDDEN: Must always remain None/Unknown")
    conversion_rate: Optional[Any] = Field(default=None, description="FORBIDDEN: Must always remain None/Unknown")
    cac: Optional[Any] = Field(default=None, description="FORBIDDEN: Must always remain None/Unknown")
    impressions: Optional[Any] = Field(default=None, description="FORBIDDEN: Must always remain None/Unknown")
    revenue: Optional[Any] = Field(default=None, description="FORBIDDEN: Must always remain None/Unknown")
    campaign_performance: Optional[Any] = Field(default=None, description="FORBIDDEN: Must always remain None/Unknown")

    @model_validator(mode="after")
    def validate_forbidden_metrics(self) -> "AdsAnalysisResult":
        for forbidden in ("ad_spend", "roas", "conversion_rate", "cac", "impressions", "revenue", "campaign_performance"):
            val = getattr(self, forbidden, None)
            if val is not None and str(val).strip().lower() not in ("unknown", "none", "n/a", "unavailable", ""):
                raise ValueError(
                    f"Anti-hallucination guard: Forbidden metric '{forbidden}' was populated with '{val}'. "
                    "Specialist agents are strictly forbidden from fabricating unobservable advertising performance metrics."
                )
        return self


class MapsAnalysisResult(BaseModel):
    """Structured output from the controlled Google Maps / Local Profile Specialist Agent."""
    model_config = ConfigDict(populate_by_name=True)

    status: Literal["verified", "unverified", "unavailable", "partial", "error"] = Field(
        ...,
        description="Local profile verification status"
    )
    findings: list[str] = Field(default_factory=list, description="Observable local profile signals")
    evidence: list[Evidence] = Field(default_factory=list, description="Structured evidence items")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score strictly bounded 0.0-1.0")
    limitations: list[str] = Field(default_factory=list, description="Observability constraints")
    business_category: Optional[str] = Field(default=None, description="Observed primary business category")
    rating: Optional[float] = Field(default=None, ge=0.0, le=5.0, description="Observed Google Maps rating")
    review_count: Optional[int] = Field(default=None, ge=0, description="Observed Google Maps review count")
    address: Optional[str] = Field(default=None, description="Observed physical location or address")
    phone: Optional[str] = Field(default=None, description="Observed phone number")
    website_present: Optional[bool] = Field(default=None, description="Whether website URL is linked on Maps profile")
    instagram_present: Optional[bool] = Field(default=None, description="Whether Instagram profile was detected")
    services: list[str] = Field(default_factory=list, description="List of services observable on profile")
    review_sentiment: Optional[str] = Field(
        default=None,
        description="Review sentiment analysis. MUST be None or 'unknown' unless actual review text was provided."
    )
    reviews_provided: bool = Field(
        default=False,
        description="Whether actual customer review text was provided in context"
    )

    @model_validator(mode="after")
    def validate_maps_anti_hallucination(self) -> "MapsAnalysisResult":
        # 1. Review sentiment requires actual review text
        if not self.reviews_provided:
            if self.review_sentiment is not None and str(self.review_sentiment).strip().lower() not in ("unknown", "none", "n/a", "unavailable", ""):
                raise ValueError(
                    f"Anti-hallucination guard: Cannot report review_sentiment='{self.review_sentiment}' "
                    "when actual customer review text was not provided in the context."
                )
        # 2. Rating claims require actual numeric rating data
        if self.rating is None:
            for text in self.findings:
                lower = text.lower()
                if "highly rated" in lower or "poorly rated" in lower or "high rating" in lower or "low rating" in lower:
                    raise ValueError(
                        f"Anti-hallucination guard: Cannot claim '{text}' without actual numeric rating data."
                    )
        return self


class SpecialistResearchAggregate(BaseModel):
    """Aggregated intelligence produced across parallel specialist agents with failure isolation."""
    model_config = ConfigDict(populate_by_name=True)

    business_name: str = Field(..., description="Name of the researched business")
    source_platform: Optional[str] = Field(default=None, description="Original discovery platform")
    triage_result: LeadTriageResult = Field(..., description="Triage evaluation determining research scope")
    website_analysis: Optional[WebsiteAnalysisResult] = Field(default=None, description="Website specialist output")
    ads_analysis: Optional[AdsAnalysisResult] = Field(default=None, description="Ads specialist output")
    maps_analysis: Optional[MapsAnalysisResult] = Field(default=None, description="Maps specialist output")
    aggregated_evidence: list[Evidence] = Field(default_factory=list, description="Combined evidence across all agents")
    execution_status: dict[str, str] = Field(
        default_factory=dict,
        description="Per-specialist status record (e.g. {'website': 'success', 'ads': 'timeout'})"
    )
    execution_time_ms: float = Field(default=0.0, ge=0.0, description="Total wall-clock execution time in ms")
    token_usage: Optional[TokenUsage] = Field(default=None, description="Aggregated token consumption across all agents")


__all__ = [
    "EvidenceSource",
    "EvidenceClassification",
    "TriagePriority",
    "SpecialistAgentType",
    "Evidence",
    "LeadTriageResult",
    "WebsiteAnalysisResult",
    "AdsAnalysisResult",
    "MapsAnalysisResult",
    "SpecialistResearchAggregate",
]
