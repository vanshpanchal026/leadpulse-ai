"""Unit tests for Search Strategist agent and SearchOrchestratorService.

Validates:
- Instruction formulation enforcing geography, seed verticals, and query bounds
- Agent instantiation via create_search_strategist_agent
- SearchOrchestratorService discovery pipeline execution with mocked Apify
- Deterministic deduplication, normalization, and scorecard ranking in pipeline
- Budget exhaustion handling during orchestration
"""

import json
import pytest
import httpx
from pydantic import SecretStr

from app.schemas.profile import CampaignScope
from app.schemas.search import (
    SearchQuery,
    SearchStrategy,
    CampaignLimits,
    ToolExecutionBlocked,
)
from app.agents.search_strategist import (
    build_search_strategist_instructions,
    create_search_strategist_agent,
)
from app.core.profile import get_business_profile
from app.services.search_orchestrator import (
    SearchOrchestratorService,
    SearchOrchestrationResult,
)
from app.tools.apify.client import ApifyRestClient
from app.tools.apify.budget import CampaignBudgetTracker


class TestSearchStrategistInstructionsAndFactory:
    """Tests for Search Strategist prompt formulation and agent factory."""

    def test_default_instructions_contain_guardrails(self):
        profile = get_business_profile()
        limits = CampaignLimits(max_search_queries=4)
        instructions = build_search_strategist_instructions(profile=profile, limits=limits)

        # Invariant checks
        assert profile.identity.name in instructions
        assert "Delhi" in instructions
        assert "Gurgaon" in instructions
        assert "Noida" in instructions
        assert "Dermatology" in instructions
        assert "Dental" in instructions
        assert "DO NOT search any unauthorized cities" in instructions
        assert "4 distinct, high-intent queries" in instructions
        assert "SearchStrategy" in instructions
        assert "You MUST NOT execute shell commands" in instructions
        assert "You MUST NOT call external HTTP APIs" in instructions

    def test_campaign_scoped_instructions(self):
        profile = get_business_profile()
        campaign = CampaignScope(
            target_cities=["Noida"],
            target_verticals=["Hair Transplant"]
        )
        instructions = build_search_strategist_instructions(
            profile=profile,
            campaign_scope=campaign
        )
        assert "[Noida]" in instructions
        assert "[Hair Transplant]" in instructions

    def test_create_search_strategist_agent(self):
        agent = create_search_strategist_agent()
        assert agent.name == "LeadPulseSearchStrategist"
        assert agent.output_type is SearchStrategy
        assert len(agent.tools) == 0  # Crucial safety check: agent has zero direct tools


class TestSearchOrchestratorPipeline:
    """Tests for end-to-end execution of search strategies through tools and scoring."""

    @pytest.mark.asyncio
    async def test_execute_discovery_pipeline_success(self):
        # Mock Apify responses for 2 queries
        mock_places = [
            {
                "title": "Aesthetic Dental Care",
                "phone": "+919810123456",
                "url": "https://maps.google.com/place/dental1",
                "totalScore": 4.8,
                "reviewsCount": 75,
                "categoryName": "Dental Clinic",
                "hasActiveAds": True,
                "website": "https://aestheticdental.com",
            },
            {
                "title": "General Health Clinic",
                "phone": "+919810999999",
                "url": "https://maps.google.com/place/health1",
                "totalScore": 3.8,
                "reviewsCount": 10,
                "categoryName": "Clinic",
                "hasActiveAds": False,
            }
        ]

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json=mock_places)

        client = ApifyRestClient(token=SecretStr("mock_token"), transport=httpx.MockTransport(handler))
        orchestrator = SearchOrchestratorService(apify_client=client)

        strategy = SearchStrategy(
            research_goal="Discover high-intent dental clinics in Delhi",
            queries=[
                SearchQuery(
                    query="dental implant clinic South Delhi",
                    location="South Delhi",
                    vertical="Dental",
                    reason="High margins",
                    priority="high"
                )
            ]
        )

        limits = CampaignLimits(max_search_queries=5, max_apify_calls=5)
        tracker = CampaignBudgetTracker(limits=limits)

        result = await orchestrator.execute_discovery_pipeline(
            strategy=strategy,
            limits=limits,
            budget_tracker=tracker
        )

        assert isinstance(result, SearchOrchestrationResult)
        assert result.execution_blocked is None
        assert result.total_raw_discovered == 2
        assert len(result.candidates) == 2

        # Verify deterministic scorecard ranking (highest score first)
        top_cand = result.candidates[0]
        assert top_cand.business_name == "Aesthetic Dental Care"
        assert top_cand.scorecard_score > result.candidates[1].scorecard_score
        assert top_cand.priority_tier in ("immediate", "high")

    @pytest.mark.asyncio
    async def test_orchestrator_stops_when_budget_exhausted(self):
        # Tracker initialized with 0 queries remaining
        limits = CampaignLimits(max_search_queries=1, max_apify_calls=5)
        tracker = CampaignBudgetTracker(limits=limits)
        tracker.record_query_executed()  # Usage is now 1 (limit reached)

        client = ApifyRestClient(token=SecretStr("mock_token"))
        orchestrator = SearchOrchestratorService(apify_client=client)

        strategy = SearchStrategy(
            research_goal="Target clinics",
            queries=[
                SearchQuery(
                    query="skin clinic Delhi",
                    location="Delhi",
                    vertical="Dermatology",
                    reason="Test",
                    priority="high"
                )
            ]
        )

        result = await orchestrator.execute_discovery_pipeline(
            strategy=strategy,
            limits=limits,
            budget_tracker=tracker
        )

        assert result.execution_blocked is not None
        assert result.execution_blocked.blocked is True
        assert result.execution_blocked.limit_name == "max_search_queries"
        assert len(result.candidates) == 0

    @pytest.mark.asyncio
    async def test_orchestrator_execute_meta_ads_pipeline(self):
        mock_ads = [
            {
                "pageName": "Delhi Aesthetics Clinic",
                "adArchiveID": "111222333",
                "adCreativeBody": "Laser treatment offers. Call +919810123456",
                "linkUrl": "https://delhiaesthetics.com"
            }
        ]

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json=mock_ads)

        client = ApifyRestClient(token=SecretStr("mock_token"), transport=httpx.MockTransport(handler))
        orchestrator = SearchOrchestratorService(apify_client=client)

        candidates, blocked, status = await orchestrator.execute_meta_ads_pipeline(
            search_terms=["Aesthetics Clinic Delhi"]
        )

        assert blocked is None
        assert len(candidates) == 1
        assert candidates[0].business_name == "Delhi Aesthetics Clinic"
        assert candidates[0].has_active_ads is True
        assert candidates[0].source_platform == "meta_ads"

    @pytest.mark.asyncio
    async def test_orchestrator_execute_reddit_pipeline(self):
        mock_posts = [
            {
                "title": "Struggling with missed calls after hours in clinic",
                "body": "Patients call when we are closed and we lose appointments.",
                "subreddit": "smallbusiness",
                "url": "https://reddit.com/r/smallbusiness/1",
            }
        ]

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json=mock_posts)

        client = ApifyRestClient(token=SecretStr("mock_token"), transport=httpx.MockTransport(handler))
        orchestrator = SearchOrchestratorService(apify_client=client)

        candidates, blocked, status = await orchestrator.execute_reddit_pipeline(
            subreddits=["smallbusiness"],
            keywords=["missed calls"]
        )

        assert blocked is None
        assert len(candidates) == 1
        assert candidates[0].source_platform == "reddit"
