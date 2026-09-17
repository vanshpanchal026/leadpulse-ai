"""Unit tests for Specialist Orchestrator service — Parallel execution, failure isolation, and budget tracking."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.schemas.evidence import (
    Evidence,
    LeadTriageResult,
    WebsiteAnalysisResult,
    AdsAnalysisResult,
    MapsAnalysisResult,
    SpecialistResearchAggregate,
)
from app.schemas.agent import AgentRunResponse, TokenUsage
from app.schemas.search import CampaignLimits
from app.services.deterministic_pipeline import NormalizedCandidate
from app.services.specialist_orchestrator import SpecialistOrchestratorService
from app.services.website_fetcher import WebsiteFetchResult
from app.tools.apify.budget import CampaignBudgetTracker


@pytest.fixture
def sample_candidate() -> NormalizedCandidate:
    return NormalizedCandidate(
        business_name="Luxe Aesthetic Studio",
        business_type="Aesthetic Clinic",
        source_platform="google_maps",
        source_url="https://maps.google.com/luxe",
        scorecard_score=9,
        priority_tier="immediate",
        website_url="https://luxeaesthetic.com",
        has_active_ads=True,
        rating=4.9,
        review_count=85,
        address="DLF Phase 5, Gurgaon",
        phone_number="+919876543210",
        raw_metadata={
            "category": "Aesthetic Clinic",
            "ad_creative_text": "Get 30% off laser facial rejuvenation this weekend",
            "headline": "Special Glow Weekend Offer",
            "cta_text": "Send WhatsApp Message",
            "ad_count": 1,
        }
    )


class TestSpecialistOrchestratorTriage:
    """Tests asserting triage execution and deterministic fast-path."""

    @pytest.mark.asyncio
    async def test_triage_candidate_deterministic_fast_path(self):
        orchestrator = SpecialistOrchestratorService()
        low_score_candidate = NormalizedCandidate(
            business_name="Small Local Plumber",
            business_type="Plumbing",
            source_platform="google_maps",
            source_url="https://maps.google.com/plumber",
            scorecard_score=1,
            priority_tier="skip"
        )
        result, tokens = await orchestrator.triage_candidate(low_score_candidate)
        assert result.qualified is False
        assert result.priority == "low"
        assert result.research_agents == []
        assert tokens.total_tokens == 0

    @pytest.mark.asyncio
    async def test_triage_candidate_llm_execution(self, sample_candidate):
        mock_runner = AsyncMock()
        mock_runner.execute.return_value = AgentRunResponse(
            success=True,
            output={
                "qualified": True,
                "priority": "high",
                "reason": "Premier clinic with active ads and website",
                "research_agents": ["website", "ads", "maps"]
            },
            agent_type="lead_triage",
            execution_time_ms=500.0,
            token_usage=TokenUsage(prompt_tokens=400, completion_tokens=50, total_tokens=450)
        )

        orchestrator = SpecialistOrchestratorService(agent_runner=mock_runner)
        result, tokens = await orchestrator.triage_candidate(sample_candidate)
        assert result.qualified is True
        assert result.priority == "high"
        assert result.research_agents == ["website", "ads", "maps"]
        assert tokens.total_tokens == 450


class TestSpecialistOrchestratorExecution:
    """Tests asserting parallel execution and failure isolation."""

    @pytest.mark.asyncio
    async def test_parallel_execution_all_specialists_succeed(self, sample_candidate):
        mock_fetcher = AsyncMock()
        mock_fetcher.fetch.return_value = WebsiteFetchResult(
            success=True,
            url="https://luxeaesthetic.com",
            status_code=200,
            title="Luxe Aesthetic Studio",
            text_summary="World class laser skin rejuvenation",
            observed_ctas=["Book Appointment", "WhatsApp Us"],
            has_booking_system=True,
            has_whatsapp_cta=True,
        )

        mock_runner = AsyncMock()

        def mock_execute_side_effect(req):
            if req.agent_type == "lead_triage":
                return AgentRunResponse(
                    success=True,
                    output={
                        "qualified": True,
                        "priority": "high",
                        "reason": "High-ticket aesthetic prospect",
                        "research_agents": ["website", "ads", "maps"]
                    },
                    agent_type="lead_triage",
                    execution_time_ms=300.0,
                    token_usage=TokenUsage(prompt_tokens=300, completion_tokens=40, total_tokens=340)
                )
            elif req.agent_type == "website_specialist":
                return AgentRunResponse(
                    success=True,
                    output=WebsiteAnalysisResult(
                        status="available",
                        findings=["Seamless appointment booking"],
                        evidence=[
                            Evidence(
                                finding="Booking button present",
                                source="website",
                                evidence="Calendly CTA button",
                                confidence=0.95,
                                classification="observed"
                            )
                        ],
                        confidence=0.9,
                        has_booking_system=True,
                        has_whatsapp_cta=True,
                        primary_cta="Book Appointment"
                    ),
                    agent_type="website_specialist",
                    execution_time_ms=400.0,
                    token_usage=TokenUsage(prompt_tokens=500, completion_tokens=80, total_tokens=580)
                )
            elif req.agent_type == "ads_specialist":
                return AgentRunResponse(
                    success=True,
                    output=AdsAnalysisResult(
                        status="active_ads",
                        findings=["Active laser facial promotion"],
                        evidence=[
                            Evidence(
                                finding="Active promo campaign",
                                source="ads",
                                evidence="Creative: 30% off laser facial",
                                confidence=0.95,
                                classification="observed"
                            )
                        ],
                        confidence=0.95,
                        active_ad_count=1,
                        ad_themes=["laser promo"],
                        observed_ctas=["Send WhatsApp Message"]
                    ),
                    agent_type="ads_specialist",
                    execution_time_ms=350.0,
                    token_usage=TokenUsage(prompt_tokens=350, completion_tokens=60, total_tokens=410)
                )
            elif req.agent_type == "maps_specialist":
                return AgentRunResponse(
                    success=True,
                    output=MapsAnalysisResult(
                        status="verified",
                        findings=["Strong local profile with 4.9 rating"],
                        evidence=[
                            Evidence(
                                finding="Verified clinic rating",
                                source="maps",
                                evidence="4.9 rating across 85 reviews",
                                confidence=1.0,
                                classification="observed"
                            )
                        ],
                        confidence=0.95,
                        business_category="Aesthetic Clinic",
                        rating=4.9,
                        review_count=85,
                        address="DLF Phase 5, Gurgaon"
                    ),
                    agent_type="maps_specialist",
                    execution_time_ms=320.0,
                    token_usage=TokenUsage(prompt_tokens=320, completion_tokens=50, total_tokens=370)
                )

        mock_runner.execute.side_effect = mock_execute_side_effect

        orchestrator = SpecialistOrchestratorService(agent_runner=mock_runner, website_fetcher=mock_fetcher)
        aggregate = await orchestrator.research_candidate(sample_candidate)

        assert aggregate.business_name == "Luxe Aesthetic Studio"
        assert aggregate.website_analysis is not None
        assert aggregate.website_analysis.status == "available"
        assert aggregate.ads_analysis is not None
        assert aggregate.ads_analysis.status == "active_ads"
        assert aggregate.maps_analysis is not None
        assert aggregate.maps_analysis.status == "verified"
        assert aggregate.execution_status["website"] == "success"
        assert aggregate.execution_status["ads"] == "success"
        assert aggregate.execution_status["maps"] == "success"
        assert len(aggregate.aggregated_evidence) == 3
        assert aggregate.token_usage.total_tokens == (340 + 580 + 410 + 370)

    @pytest.mark.asyncio
    async def test_failure_isolation_one_specialist_fails(self, sample_candidate):
        """CRITICAL: If Ads specialist times out or fails, Website and Maps must still succeed."""
        mock_fetcher = AsyncMock()
        mock_fetcher.fetch.return_value = WebsiteFetchResult(
            success=True,
            url="https://luxeaesthetic.com",
            status_code=200,
            text_summary="World class laser skin rejuvenation",
            observed_ctas=["Book Appointment"],
            has_booking_system=True
        )

        mock_runner = AsyncMock()

        def mock_execute_side_effect(req):
            if req.agent_type == "lead_triage":
                return AgentRunResponse(
                    success=True,
                    output={
                        "qualified": True,
                        "priority": "high",
                        "reason": "Test triage",
                        "research_agents": ["website", "ads", "maps"]
                    },
                    agent_type="lead_triage",
                    execution_time_ms=200.0,
                    token_usage=TokenUsage(prompt_tokens=200, completion_tokens=20, total_tokens=220)
                )
            elif req.agent_type == "website_specialist":
                return AgentRunResponse(
                    success=True,
                    output=WebsiteAnalysisResult(
                        status="available",
                        findings=["Website up"],
                        evidence=[],
                        confidence=0.8
                    ),
                    agent_type="website_specialist",
                    execution_time_ms=250.0,
                    token_usage=TokenUsage(prompt_tokens=200, completion_tokens=30, total_tokens=230)
                )
            elif req.agent_type == "ads_specialist":
                # ADS SPECIALIST FAILS / TIMES OUT!
                return AgentRunResponse(
                    success=False,
                    output=None,
                    error="Upstream model gateway timed out after 60s",
                    agent_type="ads_specialist",
                    execution_time_ms=60000.0
                )
            elif req.agent_type == "maps_specialist":
                return AgentRunResponse(
                    success=True,
                    output=MapsAnalysisResult(
                        status="verified",
                        findings=["Maps verified"],
                        evidence=[],
                        confidence=0.9
                    ),
                    agent_type="maps_specialist",
                    execution_time_ms=200.0,
                    token_usage=TokenUsage(prompt_tokens=200, completion_tokens=20, total_tokens=220)
                )

        mock_runner.execute.side_effect = mock_execute_side_effect

        orchestrator = SpecialistOrchestratorService(agent_runner=mock_runner, website_fetcher=mock_fetcher)
        aggregate = await orchestrator.research_candidate(sample_candidate)

        # Invariant: Overall result is still usable, website and maps are preserved
        assert aggregate.website_analysis is not None
        assert aggregate.website_analysis.status == "available"
        assert aggregate.maps_analysis is not None
        assert aggregate.maps_analysis.status == "verified"
        # Ads specialist gracefully fell back without fabricating "no_ads"
        assert aggregate.ads_analysis is not None
        assert aggregate.ads_analysis.status in ("unavailable", "error")
        assert aggregate.ads_analysis.active_ad_count is None
        assert "agent_error" in aggregate.execution_status["ads"]
        assert aggregate.execution_status["website"] == "success"
        assert aggregate.execution_status["maps"] == "success"

    @pytest.mark.asyncio
    async def test_campaign_deep_research_budget_exhaustion(self, sample_candidate):
        """Verify CampaignBudgetTracker stops deep research when limit is reached."""
        limits = CampaignLimits(max_deep_research_leads=1)
        tracker = CampaignBudgetTracker(limits=limits)
        tracker.deep_research_leads_executed = 1

        mock_runner = AsyncMock()
        mock_runner.execute.return_value = AgentRunResponse(
            success=True,
            output=LeadTriageResult(
                qualified=True,
                priority="high",
                reason="High-ticket clinic",
                research_agents=["website", "ads"]
            ),
            agent_type="lead_triage",
            execution_time_ms=100.0,
            token_usage=TokenUsage(prompt_tokens=100, completion_tokens=20, total_tokens=120)
        )
        orchestrator = SpecialistOrchestratorService(agent_runner=mock_runner)
        aggregate = await orchestrator.research_candidate(
            candidate=sample_candidate,
            limits=limits,
            budget_tracker=tracker
        )

        # Triage correctly identifies lead as qualified, but specialist research is blocked
        assert aggregate.triage_result.qualified is True
        assert aggregate.execution_status["budget"] == "blocked"
        assert aggregate.website_analysis is None
        assert aggregate.ads_analysis is None
        assert aggregate.maps_analysis is None
        assert tracker.deep_research_leads_executed == 1
