"""Unit tests for the Lead Analyst Agent."""

import pytest
from app.agents.lead_analyst import (
    create_lead_analyst_agent,
    build_lead_analyst_instructions,
    build_fallback_lead_analysis,
)
from app.schemas.evidence import LeadTriageResult
from app.schemas.opportunity import OpportunityResult, APPROVED_SERVICES
from app.schemas.lead_analysis import LeadAnalysis
from app.services.deterministic_pipeline import NormalizedCandidate


class TestLeadAnalystAgent:
    """Validation tests for Lead Analyst Agent creation, instructions, and fallbacks."""

    def test_create_lead_analyst_factory(self):
        agent = create_lead_analyst_agent()
        assert agent.name == "LeadPulseLeadAnalyst"
        assert agent.output_type == LeadAnalysis

    def test_instructions_contain_no_tools_and_approved_services(self):
        instructions = build_lead_analyst_instructions()
        assert "You do NOT have any external tools" in instructions
        for service_id in APPROVED_SERVICES.keys():
            assert service_id in instructions
        assert "CRITICAL ANTI-HALLUCINATION RULE FOR FAILED SPECIALISTS" in instructions

    def test_build_fallback_lead_analysis_disqualified(self):
        candidate = NormalizedCandidate(
            business_name="Irrelevant Gig",
            business_type="Freelance Writer",
            source_platform="reddit",
            source_url="https://reddit.com/r/forhire",
            scorecard_score=1,
            priority_tier="skip",
        )
        triage = LeadTriageResult(qualified=False, priority="low", reason="Irrelevant prospect", research_agents=[])
        res = build_fallback_lead_analysis(
            candidate=candidate,
            triage_result=triage,
            reason="Disqualified by triage"
        )
        assert isinstance(res, LeadAnalysis)
        assert res.qualification_status == "disqualified"
        assert res.priority == "low"
        assert res.prospect_score == 1.0
        assert res.research_status == "failed"
        assert len(res.limitations) > 0

    def test_build_fallback_lead_analysis_disqualified_when_score_low_even_if_triage_true(self):
        candidate = NormalizedCandidate(
            business_name="Low Score Shop",
            business_type="Retail Store",
            source_platform="google_maps",
            source_url="https://maps.google.com/?cid=111",
            scorecard_score=2,
            priority_tier="skip",
        )
        # Even if triage claimed qualified=True, scorecard_score < 4 / priority_tier == skip must override
        triage = LeadTriageResult(qualified=True, priority="high", reason="Pre-check passed", research_agents=[])
        res = build_fallback_lead_analysis(
            candidate=candidate,
            triage_result=triage,
            reason="Low scorecard score"
        )
        assert res.qualification_status == "disqualified"
        assert res.priority == "low"

