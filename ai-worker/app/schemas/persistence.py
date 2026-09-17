"""Persistence Schemas for LeadPulse AI V2 Phase 8.

Defines schemas for:
- ResearchRunRecord & ResearchRunCreate: Tracking campaign runs and execution telemetry
- LeadPersistenceRecord: Complete persistent business intelligence record
- LeadReportResponse: API-ready contract for Phase 9 React dashboard
- List responses with pagination metadata
"""

from datetime import datetime, timezone
from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.evidence import Evidence
from app.schemas.lead_analysis import LeadAnalysis
from app.schemas.opportunity import OpportunityResult, normalize_service_name
from app.schemas.outreach import OutreachRecord

ResearchRunStatus = Literal["pending", "running", "completed", "partial", "failed", "cancelled"]
LeadResearchStatus = Literal["pending", "running", "complete", "partial", "failed"]
LeadResearchPriority = Literal["immediate", "high", "medium", "low", "skip"]
LeadOutreachStatus = Literal["draft", "validated", "awaiting_human_approval", "approved", "rejected"]


class ResearchRunCreate(BaseModel):
    """Payload for initializing a research run."""
    model_config = ConfigDict(populate_by_name=True)

    campaign_id: Optional[str] = Field(default=None, description="Identifier of the associated campaign")
    configuration: dict[str, Any] = Field(
        default_factory=dict,
        description="Configuration parameters (niche, geo, limits) without secrets"
    )
    run_id: Optional[str] = Field(default=None, description="Optional custom run_id")


class ResearchRunRecord(BaseModel):
    """Complete persistent representation of a campaign or pipeline research run."""
    model_config = ConfigDict(populate_by_name=True)

    run_id: str = Field(..., description="Unique research run identifier")
    campaign_id: Optional[str] = Field(default=None, description="Associated campaign identifier")
    status: ResearchRunStatus = Field(default="pending", description="Run status")
    started_at: Optional[str] = Field(default=None, description="ISO timestamp when run started")
    completed_at: Optional[str] = Field(default=None, description="ISO timestamp when run finished")
    queries_generated: int = Field(default=0, ge=0, description="Number of search queries generated")
    businesses_found: int = Field(default=0, ge=0, description="Raw businesses acquired")
    businesses_filtered: int = Field(default=0, ge=0, description="Businesses filtered by pre-filter or deduplication")
    businesses_triaged: int = Field(default=0, ge=0, description="Businesses evaluated by lead triage")
    businesses_researched: int = Field(default=0, ge=0, description="Businesses researched by specialists")
    qualified_leads: int = Field(default=0, ge=0, description="Leads marked qualified")
    total_tokens: int = Field(default=0, ge=0, description="Aggregated token consumption")
    tool_calls: int = Field(default=0, ge=0, description="Count of agent tool invocations")
    apify_calls: int = Field(default=0, ge=0, description="Count of external Apify actor runs")
    errors: list[dict[str, Any]] = Field(default_factory=list, description="Structured log of run errors")
    configuration: dict[str, Any] = Field(default_factory=dict, description="Run configuration metadata")
    created_at: Optional[str] = Field(default=None)
    updated_at: Optional[str] = Field(default=None)


class LeadPersistenceRecord(BaseModel):
    """Complete persistent representation of a lead record matching Supabase public.leads schema."""
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str = Field(..., description="Unique lead identifier (UUID)")
    source_platform: str = Field(..., description="Discovery source (google_maps, meta_ads, reddit, x)")
    source_url: str = Field(..., description="Unique source URL for deduplication")
    author: Optional[str] = None
    subreddit_or_handle: Optional[str] = None
    title: str = Field(..., description="Lead or business display title")
    body_text: Optional[str] = None
    identified_problem: Optional[str] = None
    business_type: Optional[str] = None
    confidence_score: float = Field(default=0.0, description="Confidence score")
    draft_pitch: Optional[str] = None
    status: str = Field(default="new", description="V1 status: new, pitch_sent, replied, meeting_booked, archived")
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    # Local prospecting columns (V1 & Phase 4)
    business_name: Optional[str] = None
    phone_number: Optional[str] = None
    website_url: Optional[str] = None
    instagram_url: Optional[str] = None
    google_maps_url: Optional[str] = None
    address: Optional[str] = None
    rating: Optional[float] = None
    review_count: int = 0
    has_active_ads: bool = False
    prospect_score: int = 0
    audit_friction_points: list[str] = Field(default_factory=list)
    direct_contact_channel: str = "whatsapp"

    # LeadPulse V2 Research Columns (Phase 5 - 8)
    research_status: LeadResearchStatus = Field(default="pending")
    research_priority: LeadResearchPriority = Field(default="medium")
    opportunity_score: float = Field(default=0.0, ge=0.0, le=100.0)
    recommended_service: Optional[str] = None
    primary_problem: Optional[str] = None
    why_this_service: Optional[str] = None
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    research_sources: list[str] = Field(default_factory=list)
    specialist_results: dict[str, Any] = Field(default_factory=dict)
    lead_analysis: dict[str, Any] = Field(default_factory=dict)
    outreach_draft: dict[str, Any] = Field(default_factory=dict)
    outreach_status: LeadOutreachStatus = Field(default="draft")
    agent_version: Optional[str] = "2.0.0"
    prompt_version: Optional[str] = "2.0.0"
    model_name: Optional[str] = None
    token_usage: dict[str, Any] = Field(default_factory=dict)
    research_timestamp: Optional[str] = None
    research_run_id: Optional[str] = None

    @field_validator("recommended_service", mode="before")
    @classmethod
    def validate_rec_service(cls, v: Any) -> Optional[str]:
        if v:
            try:
                return normalize_service_name(str(v))
            except Exception:
                return str(v)
        return None


class SpecialistReportSection(BaseModel):
    """Specialist research subsection in business intelligence report."""
    model_config = ConfigDict(extra="ignore")

    website: Optional[dict[str, Any]] = None
    ads: Optional[dict[str, Any]] = None
    maps: Optional[dict[str, Any]] = None

    @field_validator("website", "ads", "maps", mode="before")
    @classmethod
    def coerce_to_dict(cls, v: Any) -> Optional[dict[str, Any]]:
        """Safely coerce string error messages or lists into valid dictionary payloads."""
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        if isinstance(v, (str, int, float, bool)):
            return {"status": "recorded", "details": str(v)}
        if isinstance(v, list):
            return {"items": v}
        return {"raw": str(v)}


class LeadReportMetadata(BaseModel):
    """Metadata block for the complete business report."""
    model_config = ConfigDict(extra="ignore")

    research_status: str = "pending"
    confidence_score: float = 0.0
    agent_version: str = "2.0.0"
    prompt_version: str = "2.0.0"
    model_name: str = "unknown"
    research_timestamp: Optional[str] = None
    research_run_id: Optional[str] = None
    token_usage: dict[str, Any] = Field(default_factory=dict)


class LeadReportResponse(BaseModel):
    """Stable response contract for the complete business intelligence report.

    Designed directly for the Phase 9 React/Next.js dashboard.
    """
    model_config = ConfigDict(populate_by_name=True)

    lead: dict[str, Any] = Field(..., description="Core business and contact details")
    discovery: dict[str, Any] = Field(..., description="Discovery source and raw findings")
    specialists: SpecialistReportSection = Field(default_factory=SpecialistReportSection, description="Per-specialist analysis results")
    opportunity: dict[str, Any] = Field(..., description="Synthesized opportunity score, problem, and service recommendation")
    analysis: dict[str, Any] = Field(..., description="Lead Analyst final synthesis, qualification, and limitations")
    outreach: dict[str, Any] = Field(..., description="Outreach draft, validation, and human approval status")
    metadata: LeadReportMetadata = Field(..., description="Provenance, versioning, and telemetry metadata")


class LeadListResponse(BaseModel):
    """Paginated lead records list response."""
    items: list[LeadPersistenceRecord]
    total: int
    limit: int
    offset: int


class ResearchRunListResponse(BaseModel):
    """Paginated research run records list response."""
    items: list[ResearchRunRecord]
    total: int
    limit: int
    offset: int



class CampaignRecord(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    
    id: str = Field(..., description="Campaign UUID")
    name: str = Field(..., description="Campaign name")
    goal: str = Field(default="Find high-ticket prospects likely to buy automation services")
    locations: list[str] = Field(default_factory=lambda: ["Delhi", "Gurgaon", "Noida"])
    verticals: list[str] = Field(default_factory=lambda: ["Dermatology", "Med Spa", "Hair Transplant", "Dental", "Luxury Salon", "Interior Design"])
    limits: dict[str, Any] = Field(default_factory=dict)
    status: str = Field(default="active")
    total_runs: int = Field(default=0)
    total_qualified_leads: int = Field(default=0)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class CampaignCreate(BaseModel):
    name: str = Field(..., min_length=1, description="Campaign name")
    goal: Optional[str] = Field(default=None)
    locations: Optional[list[str]] = Field(default=None)
    verticals: Optional[list[str]] = Field(default=None)
    limits: Optional[dict[str, Any]] = Field(default=None)


class CampaignListResponse(BaseModel):
    items: list[CampaignRecord] = Field(default_factory=list)
    total: int = 0


__all__ = [
    "CampaignRecord",
    "CampaignCreate",
    "CampaignListResponse",
    "ResearchRunStatus",
    "LeadResearchStatus",
    "LeadResearchPriority",
    "LeadOutreachStatus",
    "ResearchRunCreate",
    "ResearchRunRecord",
    "LeadPersistenceRecord",
    "SpecialistReportSection",
    "LeadReportMetadata",
    "LeadReportResponse",
    "LeadListResponse",
    "ResearchRunListResponse",
]
