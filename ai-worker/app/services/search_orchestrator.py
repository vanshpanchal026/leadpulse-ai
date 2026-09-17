"""Search Orchestration & Execution Integration Service.

Connects the end-to-end Phase 4 pipeline:
CampaignScope / Profile
   ↓
Search Strategist Agent
   ↓
Structured SearchStrategy (Validated against Geography, ICP, and Query Bounds)
   ↓
Controlled Apify Tools (Google Maps, Meta Ads, Reddit with Budget Tracking)
   ↓
Raw Scraped Records
   ↓
Deterministic Normalization & Validation (app/services/deterministic_pipeline.py)
   ↓
Deduplication
   ↓
Deterministic 10-Point Scorecard
   ↓
Qualified Candidate Output Set
"""

import logging
from typing import Any, Optional, Union
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.profile import CampaignScope, LeadPulseProfile
from app.schemas.search import (
    SearchStrategy,
    CampaignLimits,
    ToolExecutionBlocked,
    SearchScopeValidationError,
    validate_search_strategy_scope,
    enforce_search_strategy_scope,
    filter_search_strategy_to_scope,
)
from app.tools.apify.budget import CampaignBudgetTracker
from app.tools.apify.client import ApifyRestClient
from app.tools.apify.schemas import (
    GoogleMapsInput,
    GoogleMapsOutput,
    RedditInput,
    RedditOutput,
    MetaAdsInput,
    MetaAdsOutput,
    ApifyToolError,
)
from app.tools.apify.google_maps import search_google_maps
from app.tools.apify.reddit import search_reddit
from app.tools.apify.meta_ads import search_meta_ads
from app.services.deterministic_pipeline import (
    NormalizedCandidate,
    normalize_google_maps_item,
    normalize_meta_ads_item,
    normalize_reddit_item,
    deduplicate_candidates,
)
from app.services.agent_runner import AgentRunnerService
from app.schemas.agent import AgentRunRequest

logger = logging.getLogger("ai_worker.services.search_orchestrator")


class SearchOrchestrationResult(BaseModel):
    """Complete output of the discovery and deterministic scoring pipeline."""
    model_config = ConfigDict(frozen=True)

    strategy: SearchStrategy
    candidates: list[NormalizedCandidate]
    total_raw_discovered: int
    total_duplicates_filtered: int
    execution_blocked: Optional[ToolExecutionBlocked] = None
    budget_status: dict[str, int] = Field(default_factory=dict)


class SearchOrchestratorService:
    """Service orchestrating strategy formulation through tool execution and scoring."""

    def __init__(
        self,
        agent_runner: Optional[AgentRunnerService] = None,
        apify_client: Optional[ApifyRestClient] = None,
    ):
        self.runner = agent_runner or AgentRunnerService()
        self.client = apify_client or ApifyRestClient()

    async def generate_strategy(
        self,
        campaign_scope: Optional[CampaignScope] = None,
        limits: Optional[CampaignLimits] = None,
        research_goal: Optional[str] = None,
        profile: Optional[LeadPulseProfile] = None,
    ) -> SearchStrategy:
        """Formulate a validated SearchStrategy using the Search Strategist agent."""
        active_limits = limits or CampaignLimits()
        goal = research_goal or (
            "Discover high-ticket aesthetic clinics, cosmetic dentists, and luxury salons "
            "with active appointment demand and potential booking friction."
        )

        context_data: dict[str, Any] = {
            "limits": active_limits.model_dump(),
        }
        if campaign_scope:
            context_data["campaign_scope"] = campaign_scope.model_dump()

        prompt = (
            f"Formulate a search strategy for the following campaign goal: '{goal}'. "
            f"Produce strictly compliant queries within authorized geography and seed verticals."
        )

        logger.info("Requesting search strategy formulation from Search Strategist agent...")
        response = await self.runner.execute(
            AgentRunRequest(
                prompt=prompt,
                agent_type="search_strategist",
                context=context_data,
                timeout_seconds=60.0
            )
        )

        if not response.success:
            raise RuntimeError(f"Search Strategist agent failed: {response.error}")

        # Parse output into SearchStrategy
        raw_output = response.output
        if isinstance(raw_output, SearchStrategy):
            strategy = raw_output
        elif isinstance(raw_output, dict):
            strategy = SearchStrategy(**raw_output)
        else:
            raise ValueError(f"Unexpected agent output format: {type(raw_output)}")

        # Enforce scope guardrails strictly
        violations = validate_search_strategy_scope(
            strategy=strategy,
            campaign_scope=campaign_scope,
            limits=active_limits,
            profile=profile
        )

        if violations:
            logger.warning(
                "Search Strategist emitted %d scope violations. Filtering to compliant queries.",
                len(violations)
            )
            strategy = filter_search_strategy_to_scope(
                strategy=strategy,
                campaign_scope=campaign_scope,
                limits=active_limits,
                profile=profile
            )

        return strategy

    async def execute_discovery_pipeline(
        self,
        strategy: SearchStrategy,
        campaign_scope: Optional[CampaignScope] = None,
        limits: Optional[CampaignLimits] = None,
        budget_tracker: Optional[CampaignBudgetTracker] = None,
        existing_urls: Optional[set[str]] = None,
        existing_phones: Optional[set[str]] = None,
        existing_names: Optional[set[str]] = None,
        existing_websites: Optional[set[str]] = None,
    ) -> SearchOrchestrationResult:
        """Execute strategy queries through controlled Apify tools and deterministic scoring.

        Args:
            strategy: Validated SearchStrategy.
            campaign_scope: Optional campaign scoping boundaries.
            limits: Campaign limits.
            budget_tracker: Budget tracking instance.
            existing_urls: Set of previously discovered source URLs for deduplication.
            existing_phones: Set of previously discovered phones for deduplication.
            existing_names: Set of previously discovered business names.
            existing_websites: Set of previously discovered official websites.

        Returns:
            SearchOrchestrationResult containing ranked candidates and audit metadata.
        """
        active_limits = limits or CampaignLimits()
        tracker = budget_tracker or CampaignBudgetTracker(limits=active_limits)

        raw_discovered_items: list[dict[str, Any]] = []
        blocked_reason: Optional[ToolExecutionBlocked] = None

        # Execute queries through controlled Google Maps tool
        for query_item in strategy.queries:
            # Check budget before triggering tool
            blocked = tracker.check_query_budget()
            if blocked is not None:
                logger.warning("Discovery pipeline stopped: %s", blocked.reason)
                blocked_reason = blocked
                break

            blocked_call = tracker.check_apify_call_budget()
            if blocked_call is not None:
                logger.warning("Discovery pipeline stopped: %s", blocked_call.reason)
                blocked_reason = blocked_call
                break

            blocked_collection = tracker.check_businesses_collected_budget()
            if blocked_collection is not None:
                logger.warning("Discovery pipeline stopped: %s", blocked_collection.reason)
                blocked_reason = blocked_collection
                break

            tool_input = GoogleMapsInput(
                query=query_item.query,
                location=query_item.location,
                max_results=active_limits.max_businesses_per_query
            )

            result = await search_google_maps(
                input_data=tool_input,
                budget_tracker=tracker,
                client=self.client
            )

            if isinstance(result, ToolExecutionBlocked):
                blocked_reason = result
                break

            if isinstance(result, ApifyToolError):
                logger.error("Query '%s' failed in Apify tool: %s", query_item.query, result.message)
                continue

            if isinstance(result, GoogleMapsOutput):
                raw_discovered_items.extend(result.items)

        # Deterministic Normalization
        normalized_candidates: list[NormalizedCandidate] = []
        for raw_item in raw_discovered_items:
            candidate = normalize_google_maps_item(raw_item)
            if candidate is not None:
                normalized_candidates.append(candidate)

        # Deterministic Deduplication
        deduped_candidates, duplicates_count = deduplicate_candidates(
            candidates=normalized_candidates,
            existing_urls=existing_urls,
            existing_phones=existing_phones,
            existing_names=existing_names,
            existing_websites=existing_websites
        )

        # Sort candidates deterministically by scorecard score descending
        deduped_candidates.sort(key=lambda c: c.scorecard_score, reverse=True)

        return SearchOrchestrationResult(
            strategy=strategy,
            candidates=deduped_candidates,
            total_raw_discovered=len(raw_discovered_items),
            total_duplicates_filtered=duplicates_count,
            execution_blocked=blocked_reason,
            budget_status=tracker.get_status()
        )

    async def execute_meta_ads_pipeline(
        self,
        search_terms: list[str],
        country_code: str = "IN",
        limits: Optional[CampaignLimits] = None,
        budget_tracker: Optional[CampaignBudgetTracker] = None,
        existing_urls: Optional[set[str]] = None,
        existing_phones: Optional[set[str]] = None,
        existing_names: Optional[set[str]] = None,
        existing_websites: Optional[set[str]] = None,
    ) -> tuple[list[NormalizedCandidate], Optional[ToolExecutionBlocked], dict[str, Any]]:
        """Execute Meta Ads scraping and return normalized, scored, and deduplicated candidates."""
        active_limits = limits or CampaignLimits()
        tracker = budget_tracker or CampaignBudgetTracker(limits=active_limits)

        raw_discovered: list[dict[str, Any]] = []
        blocked_reason: Optional[ToolExecutionBlocked] = None

        for term in search_terms:
            blocked_call = tracker.check_apify_call_budget()
            if blocked_call is not None:
                blocked_reason = blocked_call
                break

            blocked_collection = tracker.check_businesses_collected_budget()
            if blocked_collection is not None:
                blocked_reason = blocked_collection
                break

            inp = MetaAdsInput(
                search_query=term,
                country_code=country_code,
                max_ads=active_limits.max_businesses_per_query
            )
            res = await search_meta_ads(inp, budget_tracker=tracker, client=self.client)

            if isinstance(res, ToolExecutionBlocked):
                blocked_reason = res
                break
            if isinstance(res, ApifyToolError):
                logger.error("Meta Ads query '%s' failed: %s", term, res.message)
                continue
            if isinstance(res, MetaAdsOutput):
                raw_discovered.extend(res.items)

        normalized: list[NormalizedCandidate] = []
        for item in raw_discovered:
            cand = normalize_meta_ads_item(item)
            if cand is not None:
                normalized.append(cand)

        deduped, _ = deduplicate_candidates(
            candidates=normalized,
            existing_urls=existing_urls,
            existing_phones=existing_phones,
            existing_names=existing_names,
            existing_websites=existing_websites
        )
        deduped.sort(key=lambda c: c.scorecard_score, reverse=True)
        return deduped, blocked_reason, tracker.get_status()

    async def execute_reddit_pipeline(
        self,
        subreddits: list[str],
        keywords: list[str],
        limits: Optional[CampaignLimits] = None,
        budget_tracker: Optional[CampaignBudgetTracker] = None,
        existing_urls: Optional[set[str]] = None,
        existing_phones: Optional[set[str]] = None,
        existing_names: Optional[set[str]] = None,
        existing_websites: Optional[set[str]] = None,
    ) -> tuple[list[NormalizedCandidate], Optional[ToolExecutionBlocked], dict[str, Any]]:
        """Execute Reddit scraping with Stage 2 triage and return normalized candidates."""
        active_limits = limits or CampaignLimits()
        tracker = budget_tracker or CampaignBudgetTracker(limits=active_limits)

        blocked_call = tracker.check_apify_call_budget()
        if blocked_call is not None:
            return [], blocked_call, tracker.get_status()

        inp = RedditInput(
            subreddits=subreddits,
            keywords=keywords,
            max_posts=min(30, max(5, active_limits.max_businesses_per_query))
        )
        res = await search_reddit(inp, budget_tracker=tracker, client=self.client)

        if isinstance(res, ToolExecutionBlocked):
            return [], res, tracker.get_status()
        if isinstance(res, ApifyToolError):
            logger.error("Reddit search failed: %s", res.message)
            return [], None, tracker.get_status()

        raw_candidates = res.items if isinstance(res, RedditOutput) else []
        normalized: list[NormalizedCandidate] = []
        for post in raw_candidates:
            cand = normalize_reddit_item(post)
            if cand is not None:
                normalized.append(cand)

        deduped, _ = deduplicate_candidates(
            candidates=normalized,
            existing_urls=existing_urls,
            existing_phones=existing_phones,
            existing_names=existing_names,
            existing_websites=existing_websites
        )
        deduped.sort(key=lambda c: c.scorecard_score, reverse=True)
        return deduped, None, tracker.get_status()


__all__ = [
    "SearchOrchestrationResult",
    "SearchOrchestratorService",
]
