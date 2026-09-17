"""Unit tests for the Opportunity Agent."""

import pytest
from app.agents.opportunity_agent import (
    create_opportunity_agent,
    build_opportunity_agent_instructions,
    build_low_evidence_opportunity_result,
)
from app.schemas.opportunity import OpportunityResult, APPROVED_SERVICES
from app.services.deterministic_pipeline import NormalizedCandidate


class TestOpportunityAgent:
    """Validation tests for the Opportunity Agent creation, instructions, and fallbacks."""

    def test_create_opportunity_agent_factory(self):
        agent = create_opportunity_agent()
        assert agent.name == "LeadPulseOpportunityAgent"
        assert agent.output_type == OpportunityResult

    def test_instructions_contain_all_canonical_services(self):
        instructions = build_opportunity_agent_instructions()
        for service_id in APPROVED_SERVICES.keys():
            assert service_id in instructions

    def test_instructions_contain_anti_hallucination_rules(self):
        instructions = build_opportunity_agent_instructions()
        assert "NEVER convert an unknown into an observed fact" in instructions
        assert "FORBIDDEN METRICS" in instructions
        assert "WEBSITE INTEGRITY" in instructions
        assert "REVIEW INTEGRITY" in instructions
        assert "LOW EVIDENCE" in instructions

    def test_build_low_evidence_opportunity_result_zero_tokens(self):
        candidate = NormalizedCandidate(
            business_name="Obscure Freelancer",
            business_type="Services",
            source_platform="reddit",
            source_url="https://reddit.com/r/test",
            scorecard_score=2,
            priority_tier="skip",
        )
        res = build_low_evidence_opportunity_result(candidate, "No digital presence found")
        assert isinstance(res, OpportunityResult)
        assert res.opportunity_score <= 20.0
        assert res.confidence == 0.10
        assert res.recommended_service == "business_automation"
        assert len(res.evidence) == 0
