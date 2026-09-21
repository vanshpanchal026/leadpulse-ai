"""Controlled Reddit Scraper Tool.

Wraps Apify actor: trudax/reddit-scraper-lite.
Reuses existing V1 parameters, enforces strict parameter bounds,
executes campaign limit checks, and runs deterministic pre-filtering.
"""

import logging
import math
from typing import Any, Optional, Union
from urllib.parse import quote_plus

from app.tools.apify.schemas import RedditInput, RedditOutput, ApifyToolError, ApifyToolException, RedditPostInput
from app.tools.apify.budget import CampaignBudgetTracker
from app.tools.apify.client import ApifyRestClient
from app.schemas.search import ToolExecutionBlocked
from app.services.deterministic_pipeline import evaluate_reddit_pre_filter

logger = logging.getLogger("ai_worker.tools.apify.reddit")

ACTOR_ID = "trudax/reddit-scraper-lite"


async def search_reddit(
    input_data: RedditInput,
    budget_tracker: Optional[CampaignBudgetTracker] = None,
    client: Optional[ApifyRestClient] = None,
) -> Union[RedditOutput, ToolExecutionBlocked, ApifyToolError]:
    """Execute controlled Reddit scraping for operational business pain.

    Args:
        input_data: Validated RedditInput specifying subreddits, keywords, and max_posts.
        budget_tracker: Optional campaign budget tracker to enforce execution limits.
        client: Optional ApifyRestClient instance.

    Returns:
        RedditOutput on success, ToolExecutionBlocked if campaign limit reached,
        or ApifyToolError on actor/network failure.
    """
    # 1. Enforce Campaign Budget Limits
    if budget_tracker is not None:
        blocked_biz = budget_tracker.check_businesses_per_query_budget(input_data.max_posts)
        if blocked_biz is not None:
            logger.warning(
                "Reddit search blocked: businesses per query limit exceeded (%d > %d)",
                input_data.max_posts,
                budget_tracker.limits.max_businesses_per_query
            )
            return blocked_biz

        blocked = budget_tracker.acquire_query_slot()
        if blocked is not None:
            logger.warning("Reddit search blocked: query budget exhausted")
            return blocked

        blocked_call = budget_tracker.acquire_call_slot()
        if blocked_call is not None:
            budget_tracker.release_query_slot(executed=False)
            logger.warning("Reddit search blocked: apify call budget exhausted")
            return blocked_call

    # 2. Build actor input strictly conforming to V1 specifications
    start_urls: list[dict[str, Any]] = []
    for sub in input_data.subreddits:
        for kw in input_data.keywords:
            q_enc = quote_plus(kw.strip())
            url = f"https://www.reddit.com/r/{sub.strip()}/search/?q={q_enc}&sort=new&restrict_sr=1"
            start_urls.append({
                "url": url,
                "userData": {"subreddit": sub.strip(), "keyword": kw.strip()}
            })

    selected_start_urls = start_urls[:30]
    bounded_max = min(max(5, input_data.max_posts), 30)
    posts_per_url = max(1, math.ceil(bounded_max / max(1, len(selected_start_urls))))

    actor_input = {
        "startUrls": selected_start_urls,
        "skipComments": True,
        "includeMediaLinks": False,
        "maxPostCount": posts_per_url,
        "maxItems": bounded_max,
        "sort": "new",
        "proxy": {"useApifyProxy": True},
    }

    # 3. Execute via Apify REST client
    apify_client = client or ApifyRestClient()
    call_executed = False

    try:
        raw_items, run_id = await apify_client.call_actor(
            actor_id=ACTOR_ID,
            actor_input=actor_input,
            timeout_secs=120,
            max_items=bounded_max
        )
        call_executed = True

        # 4. Deterministic Pre-Filtering (Stage 2 Triage)
        candidate_items: list[dict[str, Any]] = []
        rejected_count = 0

        for item in raw_items:
            filter_res = evaluate_reddit_pre_filter(item)
            if filter_res.is_candidate:
                enriched_item = dict(item)
                enriched_item["_pre_filter_keyword"] = filter_res.matched_keyword
                candidate_items.append(enriched_item)
            else:
                rejected_count += 1

        # 5. Account consumption in budget tracker
        if budget_tracker is not None:
            budget_tracker.record_businesses_collected(len(candidate_items))

        logger.info(
            "Reddit tool completed successfully: %s total fetched, %s candidates, %s rejected",
            len(raw_items),
            len(candidate_items),
            rejected_count
        )

        return RedditOutput(
            total_fetched=len(raw_items),
            candidates_passed_filter=len(candidate_items),
            rejected_by_filter=rejected_count,
            items=candidate_items,
            actor_run_id=run_id
        )

    except ApifyToolException as err:
        logger.error("Reddit tool execution failed: %s", err.message)
        return err.to_error_model()
    finally:
        if budget_tracker is not None:
            budget_tracker.release_query_slot(executed=call_executed)
            budget_tracker.release_call_slot(executed=call_executed)


async def get_reddit_post(
    input_data: RedditPostInput,
    budget_tracker: Optional[CampaignBudgetTracker] = None,
    client: Optional[ApifyRestClient] = None,
) -> Union[dict[str, Any], ToolExecutionBlocked, ApifyToolError]:
    """Execute Apify trudax/reddit-scraper-lite for a specific post."""
    if budget_tracker is not None:
        blocked_call = budget_tracker.acquire_call_slot()
        if blocked_call is not None:
            logger.warning("Reddit post blocked: apify call budget exhausted")
            return blocked_call

    actor_input = {
        "startUrls": [{"url": input_data.url}],
        "maxItems": 1,
    }

    apify_client = client or ApifyRestClient()
    call_executed = False

    try:
        raw_items, run_id = await apify_client.call_actor(
            actor_id=ACTOR_ID,
            actor_input=actor_input,
            timeout_secs=60,
            max_items=1
        )
        call_executed = True
        return raw_items[0] if raw_items else {}

    except ApifyToolException as err:
        logger.error("Reddit post execution failed: %s", err.message)
        return err.to_error_model()
    finally:
        if budget_tracker is not None:
            budget_tracker.release_call_slot(executed=call_executed)


__all__ = ["search_reddit", "get_reddit_post"]
