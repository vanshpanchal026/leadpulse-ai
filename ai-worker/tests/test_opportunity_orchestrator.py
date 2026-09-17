"""Unit tests for the Opportunity Orchestrator Service."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.schemas.agent import AgentRunResponse, TokenUsage
from app.schemas.evidence import (
    Evidence,
    LeadTriageResult,
    WebsiteAnalysisResult,
    AdsAnalysisResult,
    MapsAnalysisResult,
    SpecialistResearchAggregate,
)
from app.schemas.opportunity import OpportunityResult
from app.schemas.lead_analysis import LeadAnalysis
from app.services.deterministic_pipeline import NormalizedCandidate
from app.services.opportunity_orchestrator import (
    OpportunityPipelineResult,
    OpportunityOrchestratorService,
)


def _make_candidate(score: int = 8, tier: str = "high") -> NormalizedCandidate:
    return NormalizedCandidate(
        business_name="Radiant Smile Clinic",
        business_type="Cosmetic Dentistry",
        source_platform="google_maps",
        source_url="https://maps.google.com/?cid=999",
        website_url="https://radiantsmile.com",
        scorecard_score=score,
        priority_tier=tier,  # type: ignore[arg-type]
        has_active_ads=True,
        rating=4.7,
        review_count=85,
        friction_points=["Manual WhatsApp booking"],
    )


class TestOpportunityOrchestrator:
    """Tests verifying orchestration, fast-path, and failure isolation."""

    @pytest.mark.asyncio
    async def test_disqualified_candidate_fast_path_zero_tokens(self):
        mock_runner = MagicMock()
        mock_runner.execute = AsyncMock()

        orchestrator = OpportunityOrchestratorService(agent_runner=mock_runner)
        disqualified_cand = _make_candidate(score=2, tier="skip")

        aggregate = SpecialistResearchAggregate(
            business_name=disqualified_cand.business_name,
            triage_result=LeadTriageResult(qualified=False, priority="low", reason="Low score", research_agents=[]),
            execution_status={"triage": "rejected"}
        )

        result = await orchestrator.analyze_opportunity(
            candidate=disqualified_cand,
            specialist_aggregate=aggregate
        )

        assert isinstance(result, OpportunityPipelineResult)
        assert result.lead_analysis.qualification_status == "disqualified"
        assert result.lead_analysis.priority == "low"
        # Invariant: Runner was never called for disqualified candidate
        mock_runner.execute.assert_not_called()
        assert result.token_usage.total_tokens == 0

    @pytest.mark.asyncio
    async def test_qualified_candidate_synthesis_flow(self):
        cand = _make_candidate(score=8, tier="high")
        aggregate = SpecialistResearchAggregate(
            business_name=cand.business_name,
            triage_result=LeadTriageResult(qualified=True, priority="high", reason="Qualified", research_agents=["website", "ads"]),
            website_analysis=WebsiteAnalysisResult(status="available", has_booking_system=False, has_whatsapp_cta=True, confidence=0.9),
            ads_analysis=AdsAnalysisResult(status="active_ads", active_ad_count=2, confidence=0.85),
            aggregated_evidence=[
                Evidence(finding="Active ads running", source="ads", evidence="2 ads active", confidence=0.9, classification="observed")
            ],
            execution_status={"website": "success", "ads": "success"}
        )

        mock_opp_result = OpportunityResult(
            opportunity_score=85.0,
            primary_problem="Inbound paid traffic lacks self-serve appointment booking",
            recommended_service="booking_automation",
            why_this_service="Automated calendar booking converts ad clicks directly into booked consultations.",
            evidence=aggregate.aggregated_evidence,
            confidence=0.88,
        )

        mock_lead_analysis = LeadAnalysis(
            business_name=cand.business_name,
            qualification_status="qualified",
            priority="high",
            prospect_score=8.0,
            opportunity_score=85.0,
            primary_problem="Inbound paid traffic lacks self-serve appointment booking",
            recommended_service="booking_automation",
            why_this_service="Automated calendar booking converts ad clicks directly into booked consultations.",
            evidence=aggregate.aggregated_evidence,
            confidence=0.88,
            research_status="complete",
            limitations=[],
        )

        mock_runner = MagicMock()
        mock_runner.execute = AsyncMock(side_effect=[
            AgentRunResponse(
                success=True,
                output=mock_opp_result,
                agent_type="opportunity",
                execution_time_ms=500.0,
                token_usage=TokenUsage(prompt_tokens=400, completion_tokens=150, total_tokens=550)
            ),
            AgentRunResponse(
                success=True,
                output=mock_lead_analysis,
                agent_type="lead_analyst",
                execution_time_ms=450.0,
                token_usage=TokenUsage(prompt_tokens=350, completion_tokens=120, total_tokens=470)
            ),
        ])

        orchestrator = OpportunityOrchestratorService(agent_runner=mock_runner)
        res = await orchestrator.analyze_opportunity(candidate=cand, specialist_aggregate=aggregate)

        assert res.lead_analysis.business_name == cand.business_name
        assert res.lead_analysis.recommended_service == "booking_automation"
        assert res.lead_analysis.opportunity_score == 85.0
        assert res.token_usage.total_tokens == 1020  # 550 + 470
        assert mock_runner.execute.call_count == 2

    @pytest.mark.asyncio
    async def test_opportunity_agent_failure_isolation_uses_fallback(self):
        cand = _make_candidate(score=8, tier="high")
        aggregate = SpecialistResearchAggregate(
            business_name=cand.business_name,
            triage_result=LeadTriageResult(qualified=True, priority="high", reason="Qualified", research_agents=["website"]),
            website_analysis=WebsiteAnalysisResult(status="available", confidence=0.8),
            execution_status={"website": "success"}
        )

        # Opportunity agent fails, Lead Analyst succeeds
        mock_runner = MagicMock()
        mock_runner.execute = AsyncMock(side_effect=[
            AgentRunResponse(
                success=False,
                output=None,
                agent_type="opportunity",
                error="Timeout calling LLM gateway",
                execution_time_ms=60000.0,
                token_usage=TokenUsage(prompt_tokens=0, completion_tokens=0, total_tokens=0)
            ),
            AgentRunResponse(
                success=True,
                output=LeadAnalysis(
                    business_name=cand.business_name,
                    qualification_status="qualified",
                    priority="high",
                    prospect_score=8.0,
                    opportunity_score=60.0,
                    primary_problem="Website optimization opportunity",
                    recommended_service="website_development",
                    why_this_service="Website upgrade needed.",
                    evidence=[],
                    confidence=0.6,
                    research_status="partial",
                    limitations=["Opportunity Agent timed out"],
                ),
                agent_type="lead_analyst",
                execution_time_ms=400.0,
                token_usage=TokenUsage(prompt_tokens=200, completion_tokens=80, total_tokens=280)
            ),
        ])

        orchestrator = OpportunityOrchestratorService(agent_runner=mock_runner)
        res = await orchestrator.analyze_opportunity(candidate=cand, specialist_aggregate=aggregate)

        # Invariant: Pipeline did not crash; fallback deterministic score was used
        assert res.opportunity_result is not None
        assert res.lead_analysis is not None
        assert res.lead_analysis.opportunity_score > 0

    @pytest.mark.asyncio
    async def test_lead_analyst_failure_isolation_uses_fallback_and_records_limitation(self):
        cand = _make_candidate(score=8, tier="high")
        aggregate = SpecialistResearchAggregate(
            business_name=cand.business_name,
            triage_result=LeadTriageResult(qualified=True, priority="high", reason="Qualified", research_agents=["website"]),
            website_analysis=WebsiteAnalysisResult(status="available", confidence=0.8),
            execution_status={"website": "success"}
        )

        mock_opp_result = OpportunityResult(
            opportunity_score=80.0,
            primary_problem="Website optimization",
            recommended_service="website_development",
            why_this_service="Improve site",
            evidence=[],
            confidence=0.8,
        )

        # Opportunity succeeds, Lead Analyst throws exception
        mock_runner = MagicMock()
        mock_runner.execute = AsyncMock(side_effect=[
            AgentRunResponse(
                success=True,
                output=mock_opp_result,
                agent_type="opportunity",
                execution_time_ms=500.0,
                token_usage=TokenUsage(prompt_tokens=100, completion_tokens=50, total_tokens=150)
            ),
            Exception("Gateway 504 Gateway Timeout"),
        ])

        orchestrator = OpportunityOrchestratorService(agent_runner=mock_runner)
        res = await orchestrator.analyze_opportunity(candidate=cand, specialist_aggregate=aggregate)

        assert res.lead_analysis is not None
        assert res.lead_analysis.research_status == "partial"
        assert any("lead analyst" in lim.lower() for lim in res.lead_analysis.limitations)

    @pytest.mark.asyncio
    async def test_blocked_specialist_status_causes_partial_research_status_in_final_lead(self):
        cand = _make_candidate(score=8, tier="high")
        aggregate = SpecialistResearchAggregate(
            business_name=cand.business_name,
            triage_result=LeadTriageResult(qualified=True, priority="high", reason="Qualified", research_agents=["website", "ads"]),
            website_analysis=WebsiteAnalysisResult(status="available", confidence=0.8),
            execution_status={"website": "success", "ads": "blocked_by_campaign_limits"}
        )

        mock_opp_result = OpportunityResult(
            opportunity_score=75.0,
            primary_problem="Website optimization",
            recommended_service="website_development",
            why_this_service="Improve site",
            evidence=[],
            confidence=0.7,
        )
        mock_lead_analysis = LeadAnalysis(
            business_name=cand.business_name,
            qualification_status="qualified",
            priority="high",
            prospect_score=8.0,
            opportunity_score=75.0,
            primary_problem="Website optimization",
            recommended_service="website_development",
            why_this_service="Improve site",
            evidence=[],
            confidence=0.7,
            research_status="complete",  # agent might mistakenly output 'complete'
            limitations=[],
        )

        mock_runner = MagicMock()
        mock_runner.execute = AsyncMock(side_effect=[
            AgentRunResponse(success=True, output=mock_opp_result, agent_type="opportunity", execution_time_ms=100.0),
            AgentRunResponse(success=True, output=mock_lead_analysis, agent_type="lead_analyst", execution_time_ms=100.0),
        ])

        orchestrator = OpportunityOrchestratorService(agent_runner=mock_runner)
        res = await orchestrator.analyze_opportunity(candidate=cand, specialist_aggregate=aggregate)

        # Invariant: blocked specialist must force research_status to 'partial'
        assert res.lead_analysis.research_status == "partial"
        assert any("ads" in lim.lower() and "blocked" in lim.lower() for lim in res.lead_analysis.limitations)

