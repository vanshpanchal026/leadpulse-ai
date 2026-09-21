"""Campaign and budget tools."""
from typing import Optional, Any
from app.tools.apify.budget import CampaignBudgetTracker
from app.core.profile import get_business_profile as _get_profile
from app.schemas.profile import CampaignScope, LeadPulseProfile

def get_search_budget(budget_tracker: CampaignBudgetTracker) -> dict[str, Any]:
    """Retrieve current usage accounting."""
    return budget_tracker.get_status()

def get_current_campaign() -> Optional[CampaignScope]:
    """Get active campaign scope."""
    profile = _get_profile()
    return getattr(profile, "active_campaign", None)

def get_business_profile() -> LeadPulseProfile:
    """Re-exports from core.profile."""
    return _get_profile()

__all__ = ["get_search_budget", "get_current_campaign", "get_business_profile"]
