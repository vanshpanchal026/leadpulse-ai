"""Unit tests for Phase 5 specialist agent definitions and deterministic fallbacks."""

import pytest

from app.schemas.evidence import (
    LeadTriageResult,
    WebsiteAnalysisResult,
    AdsAnalysisResult,
    MapsAnalysisResult,
)
from app.services.deterministic_pipeline import NormalizedCandidate
from app.agents.specialists.triage_agent import (
    triage_candidate_deterministic,
    create_lead_triage_agent,
)
from app.agents.specialists.website_agent import (
    build_unavailable_website_result,
    create_website_specialist_agent,
)
from app.agents.specialists.ads_agent import (
    build_no_ads_result,
    build_unavailable_ads_result,
    create_ads_specialist_agent,
)
from app.agents.specialists.maps_agent import (
    build_unavailable_maps_result,
    create_maps_specialist_agent,
)


class TestTriageDeterministicFastPath:
    """Tests asserting deterministic triage skips low-score candidates without LLM tokens."""

    def test_low_score_candidate_rejected_immediately(self):
        candidate = NormalizedCandidate(
            business_name="Joe Hardware Store",
            business_type="Hardware Store",
            source_platform="google_maps",
            source_url="https://maps.google.com/hardware",
            scorecard_score=2,  # Low score (<4)
            priority_tier="skip"
        )
        triage = triage_candidate_deterministic(candidate)
        assert triage is not None
        assert triage.qualified is False
        assert triage.priority == "low"
        assert triage.research_agents == []
        assert "below the qualification threshold" in triage.reason

    def test_skip_tier_candidate_rejected_immediately(self):
        candidate = NormalizedCandidate(
            business_name="Freelance Web Dev",
            business_type="Web Developer",
            source_platform="reddit",
            source_url="https://reddit.com/r/forhire",
            scorecard_score=3,
            priority_tier="skip"
        )
        triage = triage_candidate_deterministic(candidate)
        assert triage is not None
        assert triage.qualified is False
        assert triage.research_agents == []

    def test_qualified_candidate_passes_to_llm(self):
        candidate = NormalizedCandidate(
            business_name="Aura Aesthetic Clinic",
            business_type="Dermatology & Laser Clinic",
            source_platform="google_maps",
            source_url="https://maps.google.com/aura",
            scorecard_score=9,  # High score (>=4)
            priority_tier="immediate",
            website_url="https://auraclinic.in",
            has_active_ads=True,
            rating=4.8,
            review_count=120
        )
        # Should return None, indicating candidate qualifies to be evaluated by the LLM agent
        triage = triage_candidate_deterministic(candidate)
        assert triage is None


class TestSpecialistAgentDefinitions:
    """Tests asserting specialist agent instantiation and instructions."""

    def test_create_lead_triage_agent(self):
        agent = create_lead_triage_agent()
        assert agent.name == "LeadPulseSpecialistTriageAgent"
        assert agent.output_type == LeadTriageResult
        assert "ANTI-HALLUCINATION INVARIANTS" in agent.instructions
        assert "LeadTriageResult" in agent.instructions

    def test_create_website_specialist_agent(self):
        agent = create_website_specialist_agent()
        assert agent.name == "LeadPulseWebsiteSpecialistAgent"
        assert agent.output_type == WebsiteAnalysisResult
        assert "ANTI-HALLUCINATION RULES" in agent.instructions
        assert "WebsiteAnalysisResult" in agent.instructions

    def test_create_ads_specialist_agent(self):
        agent = create_ads_specialist_agent()
        assert agent.name == "LeadPulseAdsSpecialistAgent"
        assert agent.output_type == AdsAnalysisResult
        assert "NEVER INVENT OR ESTIMATE: ad spend" in agent.instructions
        assert "AdsAnalysisResult" in agent.instructions

    def test_create_maps_specialist_agent(self):
        agent = create_maps_specialist_agent()
        assert agent.name == "LeadPulseMapsSpecialistAgent"
        assert agent.output_type == MapsAnalysisResult
        assert "NEVER FABRICATE REVIEW SENTIMENT" in agent.instructions
        assert "MapsAnalysisResult" in agent.instructions


class TestDeterministicFallbacks:
    """Tests asserting zero-token deterministic fallbacks for edge cases."""

    def test_build_unavailable_website_result(self):
        res = build_unavailable_website_result("https://unreachable-dental.com", "Connection timed out")
        assert res.status == "unavailable"
        assert res.has_booking_system is None
        assert res.has_whatsapp_cta is None
        assert res.primary_cta is None
        assert len(res.friction_points) == 0
        assert len(res.evidence) == 1
        assert res.evidence[0].classification == "observed"
        # Invariant: No negative quality claims about website design
        assert "bad" not in res.findings[0].lower()
        assert "poor" not in res.findings[0].lower()

    def test_build_no_ads_result(self):
        res = build_no_ads_result("Apex Clinic")
        assert res.status == "no_ads"
        assert res.active_ad_count == 0
        assert res.ad_spend is None
        assert res.roas is None
        assert len(res.evidence) == 1

    def test_build_unavailable_maps_result(self):
        res = build_unavailable_maps_result("Apex Clinic")
        assert res.status == "unavailable"
        assert res.rating is None
        assert res.review_count is None
        assert res.review_sentiment is None

    def test_build_unavailable_ads_result(self):
        res = build_unavailable_ads_result("Apex Clinic", "Model timed out", status="error")
        assert res.status == "error"
        assert res.active_ad_count is None
        assert res.confidence == 0.0
        assert "timed out" in res.findings[0]
        assert len(res.evidence) == 1
        assert res.evidence[0].classification == "unknown"

    def test_build_unavailable_website_result_error(self):
        res = build_unavailable_website_result("https://myclinic.com", "Model timed out", status="error")
        assert res.status == "error"
        assert res.confidence == 0.1
        assert "timed out" in res.findings[0]
        assert res.has_booking_system is None
        assert res.primary_cta is None
