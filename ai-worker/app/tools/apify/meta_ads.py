"""Controlled Meta Ads Scraper Tool.

Wraps Apify actor: apify/facebook-ads-scraper.
Reuses existing V1 parameters, enforces strict parameter bounds,
executes campaign limit checks, and returns typed active ad records.
"""

import logging
from typing import Any, Optional, Union
from urllib.parse import quote_plus

from app.tools.apify.schemas import MetaAdsInput, MetaAdsOutput, ApifyToolError, ApifyToolException, BusinessAdsInput
from app.tools.apify.budget import CampaignBudgetTracker
from app.tools.apify.client import ApifyRestClient
from app.schemas.search import ToolExecutionBlocked

logger = logging.getLogger("ai_worker.tools.apify.meta_ads")

ACTOR_ID = "apify/facebook-ads-scraper"


async def search_meta_ads(
    input_data: MetaAdsInput,
    budget_tracker: Optional[CampaignBudgetTracker] = None,
    client: Optional[ApifyRestClient] = None,
) -> Union[MetaAdsOutput, ToolExecutionBlocked, ApifyToolError]:
    """Execute controlled Meta Ad Library discovery for active paid campaigns.

    Args:
        input_data: Validated MetaAdsInput specifying search_query, country_code, and max_ads.
        budget_tracker: Optional campaign budget tracker to enforce execution limits.
        client: Optional ApifyRestClient instance.

    Returns:
        MetaAdsOutput on success, ToolExecutionBlocked if campaign limit reached,
        or ApifyToolError on actor/network failure.
    """
    # 1. Enforce Campaign Budget Limits
    if budget_tracker is not None:
        blocked_biz = budget_tracker.check_businesses_per_query_budget(input_data.max_ads)
        if blocked_biz is not None:
            logger.warning(
                "Meta Ads search blocked: businesses per query limit exceeded (%d > %d)",
                input_data.max_ads,
                budget_tracker.limits.max_businesses_per_query
            )
            return blocked_biz

        blocked = budget_tracker.acquire_query_slot()
        if blocked is not None:
            logger.warning("Meta Ads search blocked: query budget exhausted")
            return blocked

        blocked_call = budget_tracker.acquire_call_slot()
        if blocked_call is not None:
            budget_tracker.release_query_slot(executed=False)
            logger.warning("Meta Ads search blocked: apify call budget exhausted")
            return blocked_call

    # 2. Build actor input strictly conforming to V1 specifications
    clean_query = input_data.search_query.strip()
    clean_country = input_data.country_code.strip().upper()
    q_enc = quote_plus(clean_query)
    bounded_max = min(max(1, input_data.max_ads), 30)

    ad_library_url = (
        f"https://www.facebook.com/ads/library/?"
        f"active_status=active&ad_type=all&country={clean_country}&"
        f"q={q_enc}&search_type=keyword_unordered&media_type=all"
    )

    actor_input = {
        "startUrls": [{"url": ad_library_url}],
        "searchTerms": [clean_query],
        "countryCode": clean_country,
        "adActiveStatus": "ACTIVE",
        "activeStatus": "active",
        "resultsLimit": bounded_max,
        "maxItems": bounded_max,
        "includeAboutPage": True,
        "isDetailsPerAd": True,
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

        # 4. Account consumption in budget tracker
        if budget_tracker is not None:
            budget_tracker.record_businesses_collected(len(raw_items))

        logger.info(
            "Meta Ads tool completed successfully for '%s' (%s ads discovered)",
            clean_query,
            len(raw_items)
        )

        return MetaAdsOutput(
            search_query=clean_query,
            country_code=clean_country,
            total_found=len(raw_items),
            items=raw_items,
            actor_run_id=run_id
        )

    except ApifyToolException as err:
        logger.error("Meta Ads tool execution failed: %s", err.message)
        return err.to_error_model()
    finally:
        if budget_tracker is not None:
            budget_tracker.release_query_slot(executed=call_executed)
            budget_tracker.release_call_slot(executed=call_executed)


async def get_business_ads(
    input_data: BusinessAdsInput,
    budget_tracker: Optional[CampaignBudgetTracker] = None,
    client: Optional[ApifyRestClient] = None,
) -> Union[list[dict[str, Any]], ToolExecutionBlocked, ApifyToolError]:
    """Execute Apify facebook-ads-scraper for a specific page."""
    if budget_tracker is not None:
        blocked_call = budget_tracker.acquire_call_slot()
        if blocked_call is not None:
            logger.warning("Meta Ads business ads blocked: apify call budget exhausted")
            return blocked_call

    actor_input = {
        "startUrls": [{"url": input_data.page_id}],
        "adActiveStatus": "ACTIVE",
        "activeStatus": "active",
        "isDetailsPerAd": True,
    }

    apify_client = client or ApifyRestClient()
    call_executed = False

    try:
        raw_items, run_id = await apify_client.call_actor(
            actor_id=ACTOR_ID,
            actor_input=actor_input,
            timeout_secs=120,
        )
        call_executed = True
        return raw_items

    except ApifyToolException as err:
        logger.error("Meta Ads business ads execution failed: %s", err.message)
        return err.to_error_model()
    finally:
        if budget_tracker is not None:
            budget_tracker.release_call_slot(executed=call_executed)


__all__ = ["search_meta_ads", "get_business_ads"]
