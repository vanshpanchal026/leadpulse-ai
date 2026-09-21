"""Campaign Budget & Tool Execution Boundary Tracker.

Enforces deterministic campaign-level limits:
- max_search_queries
- max_businesses_per_query
- max_apify_calls

If any limit is reached, execution is halted immediately and a structured
ToolExecutionBlocked instance is returned.
"""

import threading
from typing import Any, Optional
from app.schemas.search import CampaignLimits, ToolExecutionBlocked


class CampaignBudgetTracker:
    """Thread-safe execution tracker enforcing campaign limits across tool calls."""

    def __init__(self, limits: Optional[CampaignLimits] = None):
        self.limits = limits or CampaignLimits()
        self.queries_executed: int = 0
        self.queries_reserved: int = 0
        self.businesses_collected: int = 0
        self.apify_calls_made: int = 0
        self.apify_calls_reserved: int = 0
        self.deep_research_leads_executed: int = 0
        self.deep_research_leads_reserved: int = 0
        self._lock = threading.Lock()

    def check_query_budget(self) -> Optional[ToolExecutionBlocked]:
        """Check if an additional search query is permitted under campaign limits."""
        with self._lock:
            total = self.queries_executed + self.queries_reserved
            if total >= self.limits.max_search_queries:
                return ToolExecutionBlocked(
                    reason=(
                        f"Campaign query limit reached ({total}/"
                        f"{self.limits.max_search_queries}). Additional queries are blocked."
                    ),
                    limit_name="max_search_queries",
                    limit_value=self.limits.max_search_queries,
                    current_usage=total
                )
            return None

    def check_apify_call_budget(self) -> Optional[ToolExecutionBlocked]:
        """Check if an additional Apify actor call is permitted under campaign limits."""
        with self._lock:
            total = self.apify_calls_made + self.apify_calls_reserved
            if total >= self.limits.max_apify_calls:
                return ToolExecutionBlocked(
                    reason=(
                        f"Campaign Apify call limit reached ({total}/"
                        f"{self.limits.max_apify_calls}). Further actor runs are blocked."
                    ),
                    limit_name="max_apify_calls",
                    limit_value=self.limits.max_apify_calls,
                    current_usage=total
                )
            return None

    def check_businesses_per_query_budget(self, requested: int) -> Optional[ToolExecutionBlocked]:
        """Check if requested business count per query exceeds the campaign limit."""
        with self._lock:
            if requested > self.limits.max_businesses_per_query:
                return ToolExecutionBlocked(
                    reason=(
                        f"Requested businesses per query ({requested}) exceeds campaign limit "
                        f"of {self.limits.max_businesses_per_query}. Additional places are blocked."
                    ),
                    limit_name="max_businesses_per_query",
                    limit_value=self.limits.max_businesses_per_query,
                    current_usage=requested
                )
            return None

    def acquire_query_slot(self) -> Optional[ToolExecutionBlocked]:
        """Atomically check and reserve a query execution slot to prevent TOCTOU race conditions."""
        with self._lock:
            total = self.queries_executed + self.queries_reserved
            if total >= self.limits.max_search_queries:
                return ToolExecutionBlocked(
                    reason=(
                        f"Campaign query limit reached ({total}/"
                        f"{self.limits.max_search_queries}). Additional queries are blocked."
                    ),
                    limit_name="max_search_queries",
                    limit_value=self.limits.max_search_queries,
                    current_usage=total
                )
            self.queries_reserved += 1
            return None

    def release_query_slot(self, executed: bool = True) -> None:
        """Release a reserved query slot, recording completion if executed."""
        with self._lock:
            if self.queries_reserved > 0:
                self.queries_reserved -= 1
            if executed:
                self.queries_executed += 1

    def acquire_call_slot(self) -> Optional[ToolExecutionBlocked]:
        """Atomically check and reserve an Apify actor call slot to prevent TOCTOU race conditions."""
        with self._lock:
            total = self.apify_calls_made + self.apify_calls_reserved
            if total >= self.limits.max_apify_calls:
                return ToolExecutionBlocked(
                    reason=(
                        f"Campaign Apify call limit reached ({total}/"
                        f"{self.limits.max_apify_calls}). Further actor runs are blocked."
                    ),
                    limit_name="max_apify_calls",
                    limit_value=self.limits.max_apify_calls,
                    current_usage=total
                )
            self.apify_calls_reserved += 1
            return None

    def release_call_slot(self, executed: bool = True) -> None:
        """Release a reserved call slot, recording completion if executed."""
        with self._lock:
            if self.apify_calls_reserved > 0:
                self.apify_calls_reserved -= 1
            if executed:
                self.apify_calls_made += 1

    def record_query_executed(self) -> None:
        """Record the execution of a search query."""
        with self._lock:
            self.queries_executed += 1

    def record_apify_call(self) -> None:
        """Record the invocation of an Apify actor."""
        with self._lock:
            self.apify_calls_made += 1

    def record_businesses_collected(self, count: int) -> None:
        """Record discovered places/businesses."""
        with self._lock:
            self.businesses_collected += count

    def check_businesses_collected_budget(self) -> Optional[ToolExecutionBlocked]:
        """Check if total businesses collected has reached or exceeded campaign limits."""
        with self._lock:
            if self.businesses_collected >= self.limits.max_businesses_collected:
                return ToolExecutionBlocked(
                    reason=(
                        f"Campaign business collection limit reached ({self.businesses_collected}/"
                        f"{self.limits.max_businesses_collected}). Further discovery is blocked."
                    ),
                    limit_name="max_businesses_collected",
                    limit_value=self.limits.max_businesses_collected,
                    current_usage=self.businesses_collected
                )
            return None

    def check_deep_research_budget(self) -> Optional[ToolExecutionBlocked]:
        """Check if an additional lead is permitted for deep specialist research under campaign limits."""
        with self._lock:
            total = self.deep_research_leads_executed + self.deep_research_leads_reserved
            if total >= self.limits.max_deep_research_leads:
                return ToolExecutionBlocked(
                    reason=(
                        f"Campaign deep research lead limit reached ({total}/"
                        f"{self.limits.max_deep_research_leads}). Further specialist research is blocked."
                    ),
                    limit_name="max_deep_research_leads",
                    limit_value=self.limits.max_deep_research_leads,
                    current_usage=total
                )
            return None

    def acquire_deep_research_slot(self) -> Optional[ToolExecutionBlocked]:
        """Atomically check and reserve a deep research execution slot."""
        with self._lock:
            total = self.deep_research_leads_executed + self.deep_research_leads_reserved
            if total >= self.limits.max_deep_research_leads:
                return ToolExecutionBlocked(
                    reason=(
                        f"Campaign deep research lead limit reached ({total}/"
                        f"{self.limits.max_deep_research_leads}). Further specialist research is blocked."
                    ),
                    limit_name="max_deep_research_leads",
                    limit_value=self.limits.max_deep_research_leads,
                    current_usage=total
                )
            self.deep_research_leads_reserved += 1
            return None

    def release_deep_research_slot(self, executed: bool = True) -> None:
        """Release a reserved deep research slot, incrementing executed count if successful."""
        with self._lock:
            if self.deep_research_leads_reserved > 0:
                self.deep_research_leads_reserved -= 1
            if executed:
                self.deep_research_leads_executed += 1

    def get_status(self) -> dict[str, Any]:
        """Retrieve current usage accounting."""
        with self._lock:
            return {
                "queries_executed": self.queries_executed,
                "queries_reserved": self.queries_reserved,
                "max_search_queries": self.limits.max_search_queries,
                "apify_calls_made": self.apify_calls_made,
                "apify_calls_reserved": self.apify_calls_reserved,
                "max_apify_calls": self.limits.max_apify_calls,
                "businesses_collected": self.businesses_collected,
                "max_businesses_collected": self.limits.max_businesses_collected,
                "max_businesses_per_query": self.limits.max_businesses_per_query,
                "deep_research_leads_executed": self.deep_research_leads_executed,
                "deep_research_leads_reserved": self.deep_research_leads_reserved,
                "max_deep_research_leads": self.limits.max_deep_research_leads,
                "max_cost_usd": self.limits.max_cost_usd,
            }


__all__ = ["CampaignBudgetTracker"]
