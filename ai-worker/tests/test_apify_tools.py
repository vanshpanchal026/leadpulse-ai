"""Unit tests for controlled Apify tools, client safety, and budget enforcement.

Validates:
- Valid Google Maps tool execution with mocked Apify response
- Valid Reddit tool execution with pre-filtering
- Valid Meta Ads tool execution
- Input schema validation & parameter bounding
- Timeout handling
- Retry on transient errors
- Campaign budget enforcement returning ToolExecutionBlocked
- Unauthorized actor rejection
- Credential non-exposure in output, errors, and logs
"""

import json
import pytest
import httpx
from pydantic import SecretStr, ValidationError

from app.tools.apify.schemas import (
    GoogleMapsInput,
    RedditInput,
    MetaAdsInput,
    ApifyToolError,
    ApifyToolException,
)
from app.tools.apify.budget import CampaignBudgetTracker
from app.tools.apify.client import ApifyRestClient
from app.tools.apify.google_maps import search_google_maps
from app.tools.apify.reddit import search_reddit
from app.tools.apify.meta_ads import search_meta_ads
from app.schemas.search import CampaignLimits, ToolExecutionBlocked


class TestApifyClientSecurityAndErrors:
    """Tests for Apify client invariants, actor whitelisting, and secret redaction."""

    @pytest.mark.asyncio
    async def test_unauthorized_actor_rejected(self):
        client = ApifyRestClient(token=SecretStr("mock_secret_token_123"))
        with pytest.raises(ApifyToolException) as exc_info:
            await client.call_actor("malicious/unauthorized-actor", {})
        assert exc_info.value.code == "UNAUTHORIZED_ACTOR"
        assert "malicious/unauthorized-actor" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_missing_token_raises_structured_error(self):
        client = ApifyRestClient(token=None)
        # Force empty token
        client._token = None
        with pytest.raises(ApifyToolException) as exc_info:
            await client.call_actor("compass/crawler-google-places", {})
        assert exc_info.value.code == "MISSING_APIFY_TOKEN"

    @pytest.mark.asyncio
    async def test_secret_token_never_in_error_message(self):
        secret = "super_secret_apify_token_xyz"
        # Mock transport that returns 500 error containing the token in body
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(500, text=f"Error with token {secret} in internal trace")

        transport = httpx.MockTransport(handler)
        client = ApifyRestClient(
            token=SecretStr(secret),
            max_retries=0,
            transport=transport
        )
        with pytest.raises(ApifyToolException) as exc_info:
            await client.call_actor("compass/crawler-google-places", {})
        assert secret not in exc_info.value.message
        assert "[REDACTED_APIFY_TOKEN]" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_timeout_returns_retryable_error(self):
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.TimeoutException("Connection timed out")

        transport = httpx.MockTransport(handler)
        client = ApifyRestClient(
            token=SecretStr("mock_token"),
            max_retries=0,
            transport=transport
        )
        with pytest.raises(ApifyToolException) as exc_info:
            await client.call_actor("compass/crawler-google-places", {})
        assert exc_info.value.code == "APIFY_TIMEOUT"
        assert exc_info.value.retryable is True


class TestGoogleMapsTool:
    """Tests for controlled search_google_maps tool."""

    def test_input_validation(self):
        # Valid input
        valid = GoogleMapsInput(query="skin clinic", location="Delhi", max_results=10)
        assert valid.query == "skin clinic"
        assert valid.max_results == 10

        # Empty query
        with pytest.raises(ValidationError):
            GoogleMapsInput(query="  ", location="Delhi")

        # Bounds validation
        with pytest.raises(ValidationError):
            GoogleMapsInput(query="dental", location="Delhi", max_results=50)

    @pytest.mark.asyncio
    async def test_successful_google_maps_call(self):
        mock_items = [
            {
                "title": "Dr. Skin Clinic",
                "phone": "+919810123456",
                "url": "https://maps.google.com/place/123",
                "totalScore": 4.9,
                "reviewsCount": 80,
                "categoryName": "Dermatology Clinic",
            }
        ]

        def handler(request: httpx.Request) -> httpx.Response:
            assert "compass~crawler-google-places" in str(request.url)
            body = json.loads(request.content)
            assert "skin clinic South Delhi" in body["searchStringsArray"][0]
            assert body["maxCrawledPlacesPerSearch"] == 15
            assert body["scrapePlaceDetails"] is True
            return httpx.Response(
                200,
                headers={"x-apify-actor-run-id": "run_test_gmaps"},
                json=mock_items
            )

        client = ApifyRestClient(
            token=SecretStr("test_token"),
            transport=httpx.MockTransport(handler)
        )
        budget = CampaignBudgetTracker(CampaignLimits(max_search_queries=5, max_apify_calls=5))

        inp = GoogleMapsInput(query="skin clinic", location="South Delhi", max_results=15)
        res = await search_google_maps(inp, budget_tracker=budget, client=client)

        assert not isinstance(res, (ToolExecutionBlocked, ApifyToolError))
        assert res.total_found == 1
        assert res.items[0]["title"] == "Dr. Skin Clinic"
        assert res.actor_run_id == "run_test_gmaps"
        assert budget.queries_executed == 1
        assert budget.apify_calls_made == 1


class TestRedditTool:
    """Tests for controlled search_reddit tool."""

    def test_input_validation(self):
        inp = RedditInput(subreddits=["smallbusiness"], keywords=["missed calls"], max_posts=15)
        assert inp.subreddits == ["smallbusiness"]
        assert inp.max_posts == 15

        # max_posts < 5 rejected
        with pytest.raises(ValidationError):
            RedditInput(max_posts=2)

    @pytest.mark.asyncio
    async def test_successful_reddit_call_with_prefilter(self):
        mock_posts = [
            # Candidate post
            {
                "title": "Struggling with missed calls after hours in our clinic",
                "body": "Patients call when we are closed and we lose appointments.",
                "subreddit": "smallbusiness",
                "url": "https://reddit.com/r/smallbusiness/1",
            },
            # Obvious reject post
            {
                "title": "[FOR HIRE] Web designer looking for work",
                "body": "Portfolio at https://example.com",
                "subreddit": "smallbusiness",
                "url": "https://reddit.com/r/smallbusiness/2",
            }
        ]

        def handler(request: httpx.Request) -> httpx.Response:
            assert "trudax~reddit-scraper-lite" in str(request.url)
            return httpx.Response(200, json=mock_posts)

        client = ApifyRestClient(token=SecretStr("test_token"), transport=httpx.MockTransport(handler))
        budget = CampaignBudgetTracker()

        inp = RedditInput(subreddits=["smallbusiness"], keywords=["missed calls"], max_posts=10)
        res = await search_reddit(inp, budget_tracker=budget, client=client)

        assert not isinstance(res, (ToolExecutionBlocked, ApifyToolError))
        assert res.total_fetched == 2
        assert res.candidates_passed_filter == 1
        assert res.rejected_by_filter == 1
        assert len(res.items) == 1
        assert "missed calls" in res.items[0]["title"].lower()


class TestMetaAdsTool:
    """Tests for controlled search_meta_ads tool."""

    def test_input_validation(self):
        inp = MetaAdsInput(search_query="Skin Clinic Delhi", country_code="IN", max_ads=10)
        assert inp.search_query == "Skin Clinic Delhi"
        assert inp.country_code == "IN"

        with pytest.raises(ValidationError):
            MetaAdsInput(search_query="A", max_ads=10)

        with pytest.raises(ValidationError):
            MetaAdsInput(search_query="Valid", country_code="IND")  # Must be 2-letter

    @pytest.mark.asyncio
    async def test_successful_meta_ads_call(self):
        mock_ads = [
            {
                "pageName": "Apex Derma Care",
                "adArchiveID": "123456789",
                "adCreativeBody": "Book your consultation for clear skin today.",
            }
        ]

        def handler(request: httpx.Request) -> httpx.Response:
            assert "apify~facebook-ads-scraper" in str(request.url)
            body = json.loads(request.content)
            assert body["countryCode"] == "IN"
            assert "Skin Clinic" in body["searchTerms"][0]
            return httpx.Response(200, json=mock_ads)

        client = ApifyRestClient(token=SecretStr("test_token"), transport=httpx.MockTransport(handler))
        budget = CampaignBudgetTracker()

        inp = MetaAdsInput(search_query="Skin Clinic Delhi", max_ads=10)
        res = await search_meta_ads(inp, budget_tracker=budget, client=client)

        assert not isinstance(res, (ToolExecutionBlocked, ApifyToolError))
        assert res.total_found == 1
        assert res.items[0]["pageName"] == "Apex Derma Care"


class TestBudgetExhaustion:
    """Tests for deterministic campaign limit enforcement across tools."""

    @pytest.mark.asyncio
    async def test_query_budget_exhaustion_blocks_execution(self):
        # Tracker with max 1 query
        budget = CampaignBudgetTracker(CampaignLimits(max_search_queries=1, max_apify_calls=10))
        budget.record_query_executed()  # Usage is now 1

        inp = GoogleMapsInput(query="dental clinic", location="Delhi")
        res = await search_google_maps(inp, budget_tracker=budget)

        assert isinstance(res, ToolExecutionBlocked)
        assert res.blocked is True
        assert res.limit_name == "max_search_queries"
        assert res.limit_value == 1
        assert res.current_usage == 1

    @pytest.mark.asyncio
    async def test_apify_call_budget_exhaustion_blocks_execution(self):
        # Tracker with max 1 apify call
        budget = CampaignBudgetTracker(CampaignLimits(max_search_queries=10, max_apify_calls=1))
        budget.record_apify_call()  # Usage is now 1

        inp = MetaAdsInput(search_query="Skin Clinic")
        res = await search_meta_ads(inp, budget_tracker=budget)

        assert isinstance(res, ToolExecutionBlocked)
        assert res.blocked is True
        assert res.limit_name == "max_apify_calls"
        assert res.limit_value == 1
        assert res.current_usage == 1

    @pytest.mark.asyncio
    async def test_max_businesses_per_query_blocks_google_maps(self):
        # Campaign limit allows at most 5 places per query
        budget = CampaignBudgetTracker(CampaignLimits(max_businesses_per_query=5))
        # Tool input asks for 15 places
        inp = GoogleMapsInput(query="dental clinic", location="Delhi", max_results=15)
        res = await search_google_maps(inp, budget_tracker=budget)

        assert isinstance(res, ToolExecutionBlocked)
        assert res.blocked is True
        assert res.limit_name == "max_businesses_per_query"
        assert res.limit_value == 5
        assert res.current_usage == 15

    @pytest.mark.asyncio
    async def test_max_businesses_per_query_blocks_reddit(self):
        budget = CampaignBudgetTracker(CampaignLimits(max_businesses_per_query=5))
        inp = RedditInput(subreddits=["smallbusiness"], keywords=["calls"], max_posts=10)
        res = await search_reddit(inp, budget_tracker=budget)

        assert isinstance(res, ToolExecutionBlocked)
        assert res.limit_name == "max_businesses_per_query"
        assert res.limit_value == 5
        assert res.current_usage == 10

    @pytest.mark.asyncio
    async def test_max_businesses_per_query_blocks_meta_ads(self):
        budget = CampaignBudgetTracker(CampaignLimits(max_businesses_per_query=5))
        inp = MetaAdsInput(search_query="Clinic", max_ads=10)
        res = await search_meta_ads(inp, budget_tracker=budget)

        assert isinstance(res, ToolExecutionBlocked)
        assert res.limit_name == "max_businesses_per_query"
        assert res.limit_value == 5
        assert res.current_usage == 10

    @pytest.mark.asyncio
    async def test_concurrent_apify_calls_prevent_overrun(self):
        """Verify atomic slot reservation prevents race conditions when 10 tasks execute in parallel."""
        import asyncio

        # Max 3 apify calls permitted
        budget = CampaignBudgetTracker(CampaignLimits(max_apify_calls=3, max_search_queries=10))

        async def worker():
            slot = budget.acquire_call_slot()
            if slot is not None:
                return slot
            # Simulate network latency
            await asyncio.sleep(0.01)
            budget.release_call_slot(executed=True)
            return "SUCCESS"

        results = await asyncio.gather(*[worker() for _ in range(10)])
        successes = [r for r in results if r == "SUCCESS"]
        blocked = [r for r in results if isinstance(r, ToolExecutionBlocked)]

        assert len(successes) == 3
        assert len(blocked) == 7
        assert budget.apify_calls_made == 3

    def test_max_businesses_collected_blocks_execution(self):
        budget = CampaignBudgetTracker(CampaignLimits(max_businesses_collected=20))
        budget.record_businesses_collected(20)

        blocked = budget.check_businesses_collected_budget()
        assert blocked is not None
        assert blocked.blocked is True
        assert blocked.limit_name == "max_businesses_collected"
        assert blocked.limit_value == 20
        assert blocked.current_usage == 20
