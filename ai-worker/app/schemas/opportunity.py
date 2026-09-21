"""Opportunity Agent Output Schemas for LeadPulse AI V2.

Defines the structured output of the Opportunity Agent:
- OpportunityResult: Synthesized opportunity scoring, primary problem identification,
  canonical service recommendation from the approved business profile, rationale,
  and preserved evidence provenance.

ANTI-HALLUCINATION INVARIANTS:
- opportunity_score must be strictly bounded [0.0, 100.0]
- confidence must be strictly bounded [0.0, 1.0]
- recommended_service MUST be one of the approved business profile canonical services
- Evidence items must preserve provenance and strict classification (observed, inferred, unknown)
- Observed evidence must never use placeholder text or claim unobservable performance metrics
"""

import re
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.evidence import Evidence


APPROVED_SERVICES: dict[str, str] = {
    "website_development": "Website Development & Redesign",
    "ai_agents": "AI Agents & Custom Assistants",
    "whatsapp_automation": "WhatsApp Lead & Inquiry Automation",
    "lead_automation": "Lead Capture & Speed-to-Lead Automation",
    "booking_automation": "Frictionless Calendar & Booking Automation",
    "crm_workflow_automation": "CRM & Operational Workflow Automation",
    "business_automation": "End-to-End Business Operations Automation",
}

SERVICE_ALIAS_MAP: dict[str, str] = {
    # Website development aliases
    "website development": "website_development",
    "website development & redesign": "website_development",
    "website redesign": "website_development",
    "web development": "website_development",
    "website": "website_development",
    "web design": "website_development",
    # AI agents aliases
    "ai agents": "ai_agents",
    "ai agents & custom assistants": "ai_agents",
    "custom assistants": "ai_agents",
    "ai agent": "ai_agents",
    "ai assistant": "ai_agents",
    # WhatsApp automation aliases
    "whatsapp automation": "whatsapp_automation",
    "whatsapp lead & inquiry automation": "whatsapp_automation",
    "whatsapp lead automation": "whatsapp_automation",
    "whatsapp bot": "whatsapp_automation",
    "whatsapp chatbot": "whatsapp_automation",
    # Lead automation aliases
    "lead automation": "lead_automation",
    "lead capture & speed-to-lead automation": "lead_automation",
    "speed to lead automation": "lead_automation",
    "speed to lead": "lead_automation",
    "lead capture": "lead_automation",
    # Booking automation aliases
    "booking automation": "booking_automation",
    "frictionless calendar & booking automation": "booking_automation",
    "calendar & booking automation": "booking_automation",
    "calendar automation": "booking_automation",
    "appointment booking": "booking_automation",
    # CRM / workflow automation aliases
    "crm/workflow automation": "crm_workflow_automation",
    "crm workflow automation": "crm_workflow_automation",
    "crm & operational workflow automation": "crm_workflow_automation",
    "crm automation": "crm_workflow_automation",
    "workflow automation": "crm_workflow_automation",
    "crm": "crm_workflow_automation",
    # Business automation aliases
    "business automation": "business_automation",
    "end-to-end business operations automation": "business_automation",
    "business operations automation": "business_automation",
    "operations automation": "business_automation",
}


def normalize_service_name(v: str) -> str:
    """Normalize and validate a service string against approved canonical services.
    
    Raises ValueError if the service is not in the approved business profile.
    """
    if not isinstance(v, str) or not v.strip():
        raise ValueError("recommended_service must be a non-empty string.")

    cleaned = v.strip()
    norm = cleaned.lower().replace("-", " ").replace("_", " ")
    norm = re.sub(r"\s+", " ", norm).strip()

    # Check direct canonical ID
    id_norm = cleaned.lower().replace("-", "_").replace(" ", "_")
    if id_norm in APPROVED_SERVICES:
        return id_norm

    # Check alias map
    if norm in SERVICE_ALIAS_MAP:
        return SERVICE_ALIAS_MAP[norm]

    # Check against display titles
    for s_id, s_title in APPROVED_SERVICES.items():
        if cleaned.lower() == s_title.lower():
            return s_id

    raise ValueError(
        f"Anti-hallucination guard: Service '{v}' is not an approved LeadPulse business profile service. "
        f"Must be one of approved canonical services: {list(APPROVED_SERVICES.keys())}"
    )


class OpportunityResult(BaseModel):
    """Structured synthesis result produced by the Opportunity Agent."""
    model_config = ConfigDict(populate_by_name=True)

    opportunity_score: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Opportunity score bounded between 0.0 and 100.0"
    )
    primary_problem: str = Field(
        ...,
        min_length=1,
        description="Identified primary operational or conversion bottleneck"
    )
    recommended_service: str = Field(
        ...,
        min_length=1,
        description="Recommended canonical service from the approved business profile"
    )
    why_this_service: str = Field(
        ...,
        min_length=1,
        description="Justification explaining problem -> consequence -> service rationale"
    )
    evidence: list[Evidence] = Field(
        default_factory=list,
        description="List of grounded evidence items supporting the opportunity"
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score bounded between 0.0 and 1.0"
    )

    @field_validator("opportunity_score", mode="before")
    @classmethod
    def normalize_opportunity_score(cls, v: Any) -> float:
        if isinstance(v, str):
            try:
                v = float(v.strip())
            except ValueError:
                raise ValueError(f"Invalid opportunity_score: '{v}'")
        if not isinstance(v, (int, float)):
            raise ValueError(f"opportunity_score must be a numeric value, got {type(v)}")
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
            raise ValueError(f"confidence must be a numeric value, got {type(v)}")
        conf = float(v)
        if conf < 0.0 or conf > 1.0:
            raise ValueError(f"confidence must be between 0.0 and 1.0, got {conf}")
        return round(conf, 3)

    @field_validator("recommended_service", mode="before")
    @classmethod
    def validate_recommended_service(cls, v: Any) -> str:
        return normalize_service_name(str(v))

    @field_validator("primary_problem", "why_this_service")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Text fields cannot be empty or whitespace.")
        return v.strip()

    @model_validator(mode="after")
    def validate_anti_hallucination(self) -> "OpportunityResult":
        # 1. Bounds checks
        if not (0.0 <= self.opportunity_score <= 100.0):
            raise ValueError(f"opportunity_score {self.opportunity_score} must be between 0.0 and 100.0")
        if not (0.0 <= self.confidence <= 1.0):
            raise ValueError(f"confidence {self.confidence} must be between 0.0 and 1.0")

        # 2. Strict evidence anti-hallucination checks
        forbidden_metrics = ("roas", "ad spend", "cac", "impressions", "conversion rate")
        for ev in self.evidence:
            f_lower = ev.finding.lower()
            e_lower = ev.evidence.lower()
            if ev.classification == "observed":
                for metric in forbidden_metrics:
                    if metric in f_lower or metric in e_lower:
                        raise ValueError(
                            f"Anti-hallucination guard: Forbidden metric '{metric}' claimed in observed evidence: '{ev.finding}'."
                        )
                if any(bad in e_lower for bad in ("unknown", "none", "n/a", "not available", "unobservable", "unavailable", "nil")):
                    raise ValueError(
                        f"Anti-hallucination guard: Cannot classify evidence as 'observed' with placeholder data: '{ev.evidence}'."
                    )
        return self


__all__ = [
    "APPROVED_SERVICES",
    "SERVICE_ALIAS_MAP",
    "normalize_service_name",
    "OpportunityResult",
]
