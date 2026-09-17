"""LeadPulse AI V2 — Phase 4 Live Integration Test Suite.

Proves the complete end-to-end integration:
Campaign Scope / Profile
   ↓
Search Strategist Agent (Live Upstream LLM Provider via OpenAI Agents SDK)
   ↓
Structured SearchStrategy (output_type=SearchStrategy, validated against Geography/ICP)
   ↓
Controlled Apify Tools (Google Maps, Reddit, Meta Ads)
   ↓
Deterministic Normalization & Pre-Filter
   ↓
Deduplication
   ↓
Deterministic 10-Point Scorecard
   ↓
Qualified Candidate Output Set
"""

import sys
import unittest
from pathlib import Path
from dotenv import load_dotenv
import httpx
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr

# Add project root and ai-worker to sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_AI_WORKER_DIR = _PROJECT_ROOT / "ai-worker"
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))
if str(_AI_WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(_AI_WORKER_DIR))

from app.core.config import get_settings
from app.core.provider import close_provider, init_provider
from app.main import app
from app.schemas.profile import CampaignScope
from app.schemas.search import (
    SearchQuery,
    SearchStrategy,
    CampaignLimits,
    ToolExecutionBlocked,
    validate_search_strategy_scope,
    enforce_search_strategy_scope,
)
from app.tools.apify.schemas import GoogleMapsInput, GoogleMapsOutput
from app.tools.apify.client import ApifyRestClient
from app.tools.apify.budget import CampaignBudgetTracker
from app.tools.apify.google_maps import search_google_maps
from app.services.deterministic_pipeline import (
    normalize_google_maps_item,
    deduplicate_candidates,
    calculate_prospect_score,
)
from app.services.search_orchestrator import SearchOrchestratorService


class TestPhase4LiveIntegration(unittest.IsolatedAsyncioTestCase):
    """End-to-end integration test suite verifying Phase 4 Search Strategist & Controlled Apify Tools."""

    async def asyncSetUp(self):
        load_dotenv(dotenv_path=_PROJECT_ROOT / ".env")
        self.settings = get_settings()
        init_provider(self.settings)
        self.transport = ASGITransport(app=app)
        self.client = AsyncClient(transport=self.transport, base_url="http://localhost:8000")

    async def asyncTearDown(self):
        await self.client.aclose()
        await close_provider()

    async def test_01_search_strategist_agent_live_execution(self):
        """Verify Search Strategist generates a valid, structured SearchStrategy via live LLM."""
        prompt = (
            "Formulate 3 strategic search queries to discover high-ticket aesthetic clinics "
            "and cosmetic dental clinics in Delhi NCR. Ensure queries stay within authorized geography."
        )
        response = await self.client.post(
            "/api/v1/run",
            json={
                "prompt": prompt,
                "agent_type": "search_strategist",
                "timeout_seconds": 120.0
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"], f"Agent execution failed: {data.get('error')}")
        self.assertEqual(data["agent_type"], "search_strategist")

        output = data["output"]
        self.assertIsInstance(output, dict)
        self.assertIn("research_goal", output)
        self.assertIn("queries", output)
        self.assertGreaterEqual(len(output["queries"]), 1)

        # Re-parse into validated Pydantic model
        strategy = SearchStrategy(**output)
        self.assertTrue(len(strategy.queries) >= 1)

        # Enforce scope guardrails (Delhi NCR default)
        violations = validate_search_strategy_scope(strategy)
        self.assertEqual(
            violations,
            [],
            f"Search Strategist emitted out-of-scope queries: {violations}"
        )

    async def test_02_campaign_geography_guardrails_live(self):
        """Verify Search Strategist respects restricted CampaignScope (Gurgaon only)."""
        campaign = CampaignScope(
            target_cities=["Gurgaon"],
            target_verticals=["Hair Transplant", "Dermatology"]
        )
        prompt = (
            "Formulate 2 search queries for a restricted campaign targeting clinics in Gurgaon only. "
            "Do NOT include any queries outside Gurgaon."
        )
        response = await self.client.post(
            "/api/v1/run",
            json={
                "prompt": prompt,
                "agent_type": "search_strategist",
                "context": {
                    "campaign_scope": campaign.model_dump(),
                    "limits": {"max_search_queries": 3}
                },
                "timeout_seconds": 120.0
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])

        strategy = SearchStrategy(**data["output"])
        self.assertLessEqual(len(strategy.queries), 3)

        # Enforce scope against Gurgaon campaign
        violations = validate_search_strategy_scope(strategy, campaign_scope=campaign)
        self.assertEqual(violations, [], f"Scope violations in restricted campaign: {violations}")

        for q in strategy.queries:
            self.assertIn("gurgaon", q.location.lower())

    async def test_03_end_to_end_orchestration_pipeline_mocked_apify(self):
        """Verify the complete pipeline: Strategy -> Controlled Tool -> Normalization -> Deduplication -> Scorecard."""
        # 1. Provide structured SearchStrategy
        strategy = SearchStrategy(
            research_goal="Discover premium dental clinics in South Delhi",
            queries=[
                SearchQuery(
                    query="dental implant clinic South Delhi",
                    location="South Delhi",
                    vertical="Dental",
                    reason="High margins per implant procedure",
                    priority="high"
                )
            ]
        )

        # 2. Mock Apify Google Maps response with realistic place items
        mock_places = [
            {
                "title": "Delhi Dental Aesthetics",
                "phone": "+919810123456",
                "url": "https://maps.google.com/place/deldent",
                "totalScore": 4.9,
                "reviewsCount": 85,
                "categoryName": "Dental Clinic",
                "hasActiveAds": True,
                "website": "https://delhidentalaesthetics.com",
                "instagram": "https://instagram.com/delhidentals",
                "address": "Greater Kailash 1, South Delhi",
            },
            {
                # Duplicate place by phone number
                "title": "Delhi Dental Branch 2",
                "phone": "+919810123456",
                "url": "https://maps.google.com/place/deldent_branch",
                "totalScore": 4.5,
                "reviewsCount": 30,
                "categoryName": "Dental Clinic",
            },
            {
                "title": "South Delhi Smile Studio",
                "phone": "09810987654",
                "url": "https://maps.google.com/place/smile_studio",
                "totalScore": 4.7,
                "reviewsCount": 55,
                "categoryName": "Dental Clinic",
                "hasActiveAds": False,
                "website": "https://smilestudio.in",
                "address": "Saket, South Delhi",
            }
        ]

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json=mock_places)

        client = ApifyRestClient(token=SecretStr("mock_token"), transport=httpx.MockTransport(handler))
        orchestrator = SearchOrchestratorService(apify_client=client)

        limits = CampaignLimits(max_search_queries=5, max_apify_calls=5)
        tracker = CampaignBudgetTracker(limits=limits)

        # 3. Execute discovery pipeline
        result = await orchestrator.execute_discovery_pipeline(
            strategy=strategy,
            limits=limits,
            budget_tracker=tracker
        )

        # 4. Verify candidate set and deterministic deduplication
        self.assertIsNone(result.execution_blocked)
        self.assertEqual(result.total_raw_discovered, 3)
        self.assertEqual(result.total_duplicates_filtered, 1)  # 1 duplicate phone filtered
        self.assertEqual(len(result.candidates), 2)

        # Top candidate must be Delhi Dental Aesthetics with high prospect score
        top = result.candidates[0]
        self.assertEqual(top.business_name, "Delhi Dental Aesthetics")
        self.assertEqual(top.phone_number, "+919810123456")
        self.assertTrue(top.has_active_ads)
        self.assertGreaterEqual(top.scorecard_score, 8)
        self.assertEqual(top.priority_tier, "immediate")

        # Second candidate
        second = result.candidates[1]
        self.assertEqual(second.business_name, "South Delhi Smile Studio")
        self.assertEqual(second.phone_number, "+919810987654")

    async def test_04_campaign_budget_exhaustion_blocks_execution(self):
        """Verify ToolExecutionBlocked is returned deterministically when campaign limits are exhausted."""
        limits = CampaignLimits(max_search_queries=1, max_apify_calls=1)
        tracker = CampaignBudgetTracker(limits=limits)

        # First call succeeds
        tracker.record_query_executed()
        tracker.record_apify_call()

        # Second call is blocked
        blocked = tracker.check_query_budget()
        self.assertIsNotNone(blocked)
        self.assertTrue(blocked.blocked)
        self.assertEqual(blocked.limit_name, "max_search_queries")

        tool_input = GoogleMapsInput(query="hair clinic", location="Delhi")
        res = await search_google_maps(tool_input, budget_tracker=tracker)
        self.assertIsInstance(res, ToolExecutionBlocked)
        self.assertEqual(res.limit_name, "max_search_queries")

    async def test_05_credential_safety_invariant(self):
        """Verify API keys and Apify tokens never appear in outputs, errors, or serialized data."""
        token_val = self.settings.APIFY_API_TOKEN.get_secret_value() if self.settings.APIFY_API_TOKEN else None
        ai_key_val = self.settings.AI_API_KEY.get_secret_value()

        response = await self.client.post(
            "/api/v1/run",
            json={
                "prompt": "Formulate 2 search queries for clinic discovery.",
                "agent_type": "search_strategist",
                "timeout_seconds": 120.0
            }
        )
        self.assertEqual(response.status_code, 200)
        raw_text = response.text

        # Verify neither token is ever present in the HTTP response
        self.assertNotIn(ai_key_val, raw_text)
        if token_val:
            self.assertNotIn(token_val, raw_text)
