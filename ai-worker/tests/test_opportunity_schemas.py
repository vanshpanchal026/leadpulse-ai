"""Unit tests for Phase 6 Opportunity and Lead Analysis Schemas."""

import pytest
from pydantic import ValidationError

from app.schemas.evidence import Evidence
from app.schemas.opportunity import (
    APPROVED_SERVICES,
    SERVICE_ALIAS_MAP,
    normalize_service_name,
    OpportunityResult,
)
from app.schemas.lead_analysis import LeadAnalysis


class TestOpportunityResultSchema:
    """Validation tests for the OpportunityResult schema."""

    def test_valid_opportunity_result(self):
        opp = OpportunityResult(
            opportunity_score=85.0,
            primary_problem="Active Meta Ads running without instant WhatsApp lead capture",
            recommended_service="whatsapp_automation",
            why_this_service="Deploying WhatsApp automation captures high-intent ad clicks instantly 24/7.",
            evidence=[
                Evidence(
                    finding="Active Meta Ads promoting dental implants",
                    source="ads",
                    evidence="Observed ad creative: 'Specialist dental implants Gurgaon'",
                    confidence=0.9,
                    classification="observed"
                )
            ],
            confidence=0.85
        )
        assert opp.opportunity_score == 85.0
        assert opp.recommended_service == "whatsapp_automation"
        assert opp.confidence == 0.85
        assert len(opp.evidence) == 1

    @pytest.mark.parametrize("service_id", list(APPROVED_SERVICES.keys()))
    def test_all_approved_canonical_services_accepted(self, service_id: str):
        opp = OpportunityResult(
            opportunity_score=70.0,
            primary_problem="Bottleneck identified",
            recommended_service=service_id,
            why_this_service="Rationale provided",
            evidence=[],
            confidence=0.75
        )
        assert opp.recommended_service == service_id

    @pytest.mark.parametrize("alias,expected_id", [
        ("website development", "website_development"),
        ("Website Development & Redesign", "website_development"),
        ("AI Agents & Custom Assistants", "ai_agents"),
        ("WhatsApp Automation", "whatsapp_automation"),
        ("WhatsApp Lead & Inquiry Automation", "whatsapp_automation"),
        ("Speed-to-lead automation", "lead_automation"),
        ("Booking Automation", "booking_automation"),
        ("CRM/workflow automation", "crm_workflow_automation"),
        ("business automation", "business_automation"),
    ])
    def test_service_aliases_normalized_correctly(self, alias: str, expected_id: str):
        opp = OpportunityResult(
            opportunity_score=75.0,
            primary_problem="Problem",
            recommended_service=alias,
            why_this_service="Rationale",
            evidence=[],
            confidence=0.8
        )
        assert opp.recommended_service == expected_id

    @pytest.mark.parametrize("invalid_service", [
        "seo_optimization",
        "cold_email_outreach",
        "social_media_marketing",
        "crypto_trading",
        "pay_per_click_management",
        "logo_design",
        "content_writing",
    ])
    def test_unapproved_services_strictly_rejected(self, invalid_service: str):
        with pytest.raises(ValidationError) as excinfo:
            OpportunityResult(
                opportunity_score=80.0,
                primary_problem="Problem",
                recommended_service=invalid_service,
                why_this_service="Rationale",
                evidence=[],
                confidence=0.8
            )
        assert "not an approved LeadPulse business profile service" in str(excinfo.value)

    @pytest.mark.parametrize("score", [-5.0, 105.0, 100.1, -0.01])
    def test_opportunity_score_bounds_enforced(self, score: float):
        with pytest.raises(ValidationError):
            OpportunityResult(
                opportunity_score=score,
                primary_problem="Problem",
                recommended_service="website_development",
                why_this_service="Rationale",
                evidence=[],
                confidence=0.8
            )

    @pytest.mark.parametrize("conf", [-0.1, 1.05, 2.0, -1.0])
    def test_confidence_bounds_enforced(self, conf: float):
        with pytest.raises(ValidationError):
            OpportunityResult(
                opportunity_score=70.0,
                primary_problem="Problem",
                recommended_service="website_development",
                why_this_service="Rationale",
                evidence=[],
                confidence=conf
            )


class TestLeadAnalysisSchema:
    """Validation tests for the LeadAnalysis schema."""

    def test_valid_lead_analysis_complete(self):
        lead = LeadAnalysis(
            business_name="Apex Dental",
            qualification_status="qualified",
            priority="high",
            prospect_score=9.0,
            opportunity_score=88.5,
            primary_problem="Paid ad traffic leaking due to missing automated booking",
            recommended_service="booking_automation",
            why_this_service="Automated calendar booking captures patients directly from ads.",
            evidence=[
                Evidence(
                    finding="Active ads without booking flow",
                    source="website",
                    evidence="No calendar or booking links on landing page",
                    confidence=0.9,
                    classification="observed"
                )
            ],
            confidence=0.88,
            research_status="complete",
            limitations=[]
        )
        assert lead.business_name == "Apex Dental"
        assert lead.priority == "high"
        assert lead.research_status == "complete"
        assert lead.prospect_score == 9.0

    def test_partial_research_status_requires_limitations(self):
        # research_status='partial' without limitations must fail validation
        with pytest.raises(ValidationError) as excinfo:
            LeadAnalysis(
                business_name="Dr. Smile Clinic",
                qualification_status="qualified",
                priority="medium",
                prospect_score=7.0,
                opportunity_score=60.0,
                primary_problem="Website has friction",
                recommended_service="website_development",
                why_this_service="Redesign improves conversions.",
                evidence=[],
                confidence=0.6,
                research_status="partial",
                limitations=[]  # Hallucination / incomplete record!
            )
        assert "research_status='partial' strictly requires explicit limitations" in str(excinfo.value)

    def test_partial_research_status_with_valid_limitations_passes(self):
        lead = LeadAnalysis(
            business_name="Dr. Smile Clinic",
            qualification_status="qualified",
            priority="medium",
            prospect_score=7.0,
            opportunity_score=60.0,
            primary_problem="Website has friction",
            recommended_service="website_development",
            why_this_service="Redesign improves conversions.",
            evidence=[],
            confidence=0.6,
            research_status="partial",
            limitations=["Ads research unavailable due to worker timeout (60s)"]
        )
        assert lead.research_status == "partial"
        assert len(lead.limitations) == 1

    def test_priority_normalization(self):
        lead = LeadAnalysis(
            business_name="Test Business",
            qualification_status="qualified",
            priority="IMMEDIATE",  # Should normalize to high
            prospect_score=8.0,
            opportunity_score=75.0,
            primary_problem="Problem",
            recommended_service="ai_agents",
            why_this_service="Why",
            evidence=[],
            confidence=0.8,
            research_status="complete",
            limitations=[]
        )
        assert lead.priority == "high"

        lead_skip = LeadAnalysis(
            business_name="Test Business 2",
            qualification_status="disqualified",
            priority="skip",  # Should normalize to low
            prospect_score=2.0,
            opportunity_score=10.0,
            primary_problem="Problem",
            recommended_service="business_automation",
            why_this_service="Why",
            evidence=[],
            confidence=0.1,
            research_status="failed",
            limitations=["Candidate disqualified"]
        )
        assert lead_skip.priority == "low"
