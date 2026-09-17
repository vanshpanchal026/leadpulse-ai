"""Controlled Google Maps Scraper Tool.

Wraps Apify actor: compass/crawler-google-places.
Reuses existing V1 parameters, enforces strict parameter bounds,
executes campaign limit checks, and returns typed results.
"""

import logging
from typing import Any, Optional, Union

from app.tools.apify.schemas import GoogleMapsInput, GoogleMapsOutput, ApifyToolError, ApifyToolException, BusinessDetailsInput
from app.tools.apify.budget import CampaignBudgetTracker
from app.tools.apify.client import ApifyRestClient
from app.schemas.search import ToolExecutionBlocked

logger = logging.getLogger("ai_worker.tools.apify.google_maps")

ACTOR_ID = "compass/crawler-google-places"


async def search_google_maps(
    input_data: GoogleMapsInput,
    budget_tracker: Optional[CampaignBudgetTracker] = None,
    client: Optional[ApifyRestClient] = None,
) -> Union[GoogleMapsOutput, ToolExecutionBlocked, ApifyToolError]:
    """Execute controlled Google Maps discovery for target businesses.

    Args:
        input_data: Validated GoogleMapsInput specifying query, location, and max_results.
        budget_tracker: Optional campaign budget tracker to enforce execution limits.
        client: Optional ApifyRestClient instance.

    Returns:
        GoogleMapsOutput on success, ToolExecutionBlocked if campaign limit reached,
        or ApifyToolError on actor/network failure.
    """
    # 1. Enforce Campaign Budget Limits
    if budget_tracker is not None:
        blocked_biz = budget_tracker.check_businesses_per_query_budget(input_data.max_results)
        if blocked_biz is not None:
            logger.warning(
                "Google Maps search blocked: businesses per query limit exceeded (%d > %d)",
                input_data.max_results,
                budget_tracker.limits.max_businesses_per_query
            )
            return blocked_biz

        blocked = budget_tracker.acquire_query_slot()
        if blocked is not None:
            logger.warning("Google Maps search blocked: query budget exhausted")
            return blocked

        blocked_call = budget_tracker.acquire_call_slot()
        if blocked_call is not None:
            budget_tracker.release_query_slot(executed=False)
            logger.warning("Google Maps search blocked: apify call budget exhausted")
            return blocked_call

    # 2. Build actor input strictly conforming to V1 specifications
    loc_clean = input_data.location.strip()
    query_clean = input_data.query.strip()
    if loc_clean.lower() in query_clean.lower():
        search_query = query_clean
    else:
        search_query = f"{query_clean} {loc_clean}".strip()

    bounded_max = min(max(1, input_data.max_results), 30)

    actor_input = {
        "searchStringsArray": [search_query],
        "maxCrawledPlacesPerSearch": bounded_max,
        "language": "en",
        "scrapeWebSocialMedia": True,
        "scrapePlaceDetails": True,
        "skipClosedPlaces": True,
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
            "Google Maps tool completed successfully for '%s' (%s items discovered)",
            search_query,
            len(raw_items)
        )

        return GoogleMapsOutput(
            query=input_data.query,
            location=input_data.location,
            total_found=len(raw_items),
            items=raw_items,
            actor_run_id=run_id
        )

    except ApifyToolException as err:
        logger.error("Google Maps tool execution failed: %s", err.message)
        return err.to_error_model()
    finally:
        if budget_tracker is not None:
            budget_tracker.release_query_slot(executed=call_executed)
            budget_tracker.release_call_slot(executed=call_executed)


async def get_business_details(
    input_data: BusinessDetailsInput,
    budget_tracker: Optional[CampaignBudgetTracker] = None,
    client: Optional[ApifyRestClient] = None,
) -> Union[dict[str, Any], ToolExecutionBlocked, ApifyToolError]:
    """Execute Apify compass/crawler-google-places for specific place details."""
    if budget_tracker is not None:
        blocked_call = budget_tracker.acquire_call_slot()
        if blocked_call is not None:
            logger.warning("Google Maps business details blocked: apify call budget exhausted")
            return blocked_call

    actor_input = {
        "startUrls": [{"url": f"https://www.google.com/maps/place/?q=place_id:{input_data.place_id}"}],
        "maxCrawledPlacesPerSearch": 1,
        "language": "en",
        "scrapeWebSocialMedia": True,
        "scrapePlaceDetails": True,
        "skipClosedPlaces": True,
    }

    apify_client = client or ApifyRestClient()
    call_executed = False

    try:
        raw_items, run_id = await apify_client.call_actor(
            actor_id=ACTOR_ID,
            actor_input=actor_input,
            timeout_secs=120,
            max_items=1
        )
        call_executed = True

        logger.info(
            "Google Maps details completed successfully for place_id '%s'",
            input_data.place_id
        )

        return raw_items[0] if raw_items else {}

    except ApifyToolException as err:
        logger.error("Google Maps details execution failed: %s", err.message)
        return err.to_error_model()
    finally:
        if budget_tracker is not None:
            budget_tracker.release_call_slot(executed=call_executed)


__all__ = ["search_google_maps", "get_business_details"]
