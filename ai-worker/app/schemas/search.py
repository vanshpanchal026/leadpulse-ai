"""Search Strategy Schemas & Campaign Guardrails for LeadPulse AI V2.

Defines strictly typed Pydantic models for:
- SearchQuery
- SearchStrategy
- CampaignLimits
- ToolExecutionBlocked
- Scope validation functions enforcing geography, ICP verticals, and query boundaries.
"""

import re
from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.profile import CampaignScope, LeadPulseProfile
from app.utils.error_handlers import SearchScopeValidationError


class SearchQuery(BaseModel):
    """Individual search query formulated by the Search Strategist."""
    model_config = ConfigDict(frozen=True, extra="forbid")

    query: str = Field(..., description="Target search query string")
    location: str = Field(..., description="Target geographical location (e.g. Delhi, South Delhi, Gurgaon)")
    vertical: Optional[str] = Field(default=None, description="Commercial service vertical when applicable")
    reason: str = Field(..., description="Strategic hypothesis explaining why this query targets qualified businesses")
    priority: Literal["high", "medium", "low"] = Field(
        default="medium",
        description="Execution priority tier"
    )

    @field_validator("query", "location", "reason")
    @classmethod
    def validate_non_empty_strings(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Query, location, and reason cannot be empty")
        return trimmed

    @field_validator("vertical")
    @classmethod
    def validate_vertical(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            trimmed = v.strip()
            if not trimmed:
                return None
            return trimmed
        return None


class SearchStrategy(BaseModel):
    """Structured search strategy produced by the Search Strategist agent."""
    model_config = ConfigDict(frozen=True, extra="forbid")

    research_goal: str = Field(..., description="High-level objective and ICP targeting thesis for this campaign run")
    queries: list[SearchQuery] = Field(..., min_length=1, description="Bounded list of prioritized search queries")

    @field_validator("research_goal")
    @classmethod
    def validate_goal(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("research_goal cannot be empty")
        return trimmed

    @field_validator("queries")
    @classmethod
    def validate_queries_non_empty(cls, v: list[SearchQuery]) -> list[SearchQuery]:
        if not v:
            raise ValueError("SearchStrategy must contain at least one SearchQuery")
        return v

    @model_validator(mode="after")
    def validate_no_duplicate_queries(self) -> "SearchStrategy":
        """Deterministic check ensuring zero duplicate queries within the strategy."""
        seen = set()
        duplicates = []
        for q in self.queries:
            key = q.query.strip().lower()
            if key in seen:
                duplicates.append(q.query)
            seen.add(key)

        if duplicates:
            raise ValueError(f"Duplicate queries detected in search strategy: {duplicates}")
        return self


class CampaignLimits(BaseModel):
    """Deterministic campaign-level boundaries and budget enforcement caps."""
    model_config = ConfigDict(frozen=True)

    max_search_queries: int = Field(
        default=5,
        ge=1,
        le=30,
        description="Maximum search queries permitted per strategy"
    )
    max_businesses_per_query: int = Field(
        default=15,
        ge=1,
        le=50,
        description="Maximum places/businesses scraped per query"
    )
    max_apify_calls: int = Field(
        default=10,
        ge=0,
        le=100,
        description="Maximum Apify actor invocations permitted per campaign"
    )
    max_businesses_collected: int = Field(
        default=50,
        ge=1,
        le=500,
        description="Maximum total places/businesses collected across campaign runs"
    )
    max_cost_usd: float = Field(
        default=2.0,
        ge=0.0,
        le=50.0,
        description="Maximum estimated campaign spend limit in USD"
    )
    max_deep_research_leads: int = Field(
        default=10,
        ge=1,
        le=100,
        description="Maximum candidate leads allowed to undergo deep specialist research"
    )


class ToolExecutionBlocked(BaseModel):
    """Structured result returned when a tool call is deterministically blocked by campaign limits."""
    model_config = ConfigDict(frozen=True)

    blocked: bool = Field(default=True, description="Always True when execution is blocked")
    reason: str = Field(..., description="Human-readable explanation of why execution was blocked")
    limit_name: str = Field(..., description="Name of the exceeded campaign limit")
    limit_value: int = Field(..., description="Authorized threshold value for this limit")
    current_usage: int = Field(..., description="Current consumption count when blocked")


GENERIC_LOCATION_MODIFIERS: set[str] = {
    "south", "north", "west", "east", "central", "new", "old", "near", "greater", "upper", "lower", "city"
}

VERTICAL_SYNONYMS: dict[str, set[str]] = {
    "dermatology": {
        "dermatology", "dermatologist", "derma", "skin", "skincare", "skin care",
        "cosmetic", "cosmetics", "cosmetology", "cosmetologist", "aesthetic", "aesthetics", "plastic surgery"
    },
    "dental": {
        "dental", "dentist", "dentistry", "implant", "implants", "orthodontic", "orthodontics", "teeth", "oral"
    },
    "hair transplant": {
        "hair transplant", "hair restoration", "trichology", "trichologist", "hair clinic", "hair loss"
    },
    "med spa": {
        "med spa", "medspa", "medical spa", "wellness", "aesthetic clinic"
    },
    "luxury salon": {
        "luxury salon", "salon", "beauty salon", "hair salon", "beauty parlour", "beauty parlor"
    },
    "interior design": {
        "interior design", "interior designer", "interior decoration", "interior decorator", "home decor", "architecture"
    },
}

DISALLOWED_VERTICAL_PREFIXES: set[str] = {
    "pet", "dog", "cat", "animal", "car", "auto", "vehicle"
}

DISALLOWED_VERTICAL_FRAGMENTS: set[str] = {
    "spa", "hair", "design", "care", "studio", "services", "store", "shop", "transplant"
}


def _singularize(word: str) -> str:
    """Normalize simple English plural word forms to singular."""
    if word.endswith("ies") and len(word) > 4:
        return word[:-3] + "y"
    if word.endswith("es") and len(word) > 3 and word[-3] in ("s", "x", "z", "c", "h"):
        return word[:-2]
    if word.endswith("s") and len(word) > 3 and not word.endswith("ss"):
        return word[:-1]
    return word


def is_location_in_scope(location: str, allowed_locations_raw: list[str]) -> bool:
    """Evaluate whether a query location strictly complies with authorized campaign geography.

    Enforces:
    - Minimum length threshold to reject fragments (e.g. 'del', 'no', 'i')
    - Whole-phrase / word-boundary matches to prevent cross-geographic leakage (e.g. 'South Africa' from 'South Delhi')
    - Rejection of generic modifier words acting alone (e.g. 'South', 'New')
    - Containment direction: Sub-districts cannot be bypassed by querying parent metro if restricted to sub-district
    """
    if not location or not isinstance(location, str):
        return False

    loc_clean = location.strip().lower()
    if len(loc_clean) < 3 or loc_clean in GENERIC_LOCATION_MODIFIERS:
        return False

    for raw in allowed_locations_raw:
        target = raw.strip().lower()
        if not target:
            continue
        if loc_clean == target:
            return True
        # Whole-phrase / boundary match: target location occurs in loc_clean as a full phrase/word
        if re.search(r"(?:\b|_)" + re.escape(target) + r"(?:\b|_)", loc_clean):
            return True
        # loc_clean occurs as a full phrase/word in target (e.g. 'delhi' in 'delhi ncr')
        if loc_clean not in GENERIC_LOCATION_MODIFIERS:
            if re.search(r"(?:\b|_)" + re.escape(loc_clean) + r"(?:\b|_)", target):
                # If target has a restrictive modifier (e.g. 'south' in 'south delhi') that loc_clean lacks,
                # then loc_clean ('delhi') is too broad for the restricted sub-region target.
                target_words = set(re.findall(r"\w+", target))
                loc_words = set(re.findall(r"\w+", loc_clean))
                target_modifiers = target_words & GENERIC_LOCATION_MODIFIERS
                if not (target_modifiers - loc_words):
                    return True

    return False


def is_vertical_in_scope(vertical: Optional[str], allowed_verticals_raw: list[str]) -> bool:
    """Evaluate whether a query vertical strictly complies with authorized campaign verticals.

    Enforces:
    - Minimum length threshold
    - Synonym family expansion for high-ticket clinic categories (e.g. 'dentist' for 'dental')
    - Plural/singular normalization for robust matching
    - Boundary-aware phrasing to reject cross-industry false positives (e.g. 'Car Spa' from 'Med Spa', 'Pet Hair' from 'Hair Transplant')
    - Disallows generic fragments matching independently
    - Disallows non-human/non-target prefixes (e.g. 'Pet Salon', 'Dog Grooming')
    """
    if vertical is None:
        return True
    if not isinstance(vertical, str):
        return False

    vert_clean = vertical.strip().lower()
    if len(vert_clean) < 3 or vert_clean in DISALLOWED_VERTICAL_FRAGMENTS:
        return False

    vert_words = set(re.findall(r"\w+", vert_clean))
    vert_singular_words = {_singularize(w) for w in vert_words}
    if vert_words & DISALLOWED_VERTICAL_PREFIXES or vert_singular_words & DISALLOWED_VERTICAL_PREFIXES:
        return False

    vert_singular = " ".join(_singularize(w) for w in re.findall(r"\w+", vert_clean))
    variants = {vert_clean, vert_singular}

    for raw in allowed_verticals_raw:
        target = raw.strip().lower()
        if not target:
            continue
        target_singular = " ".join(_singularize(w) for w in re.findall(r"\w+", target))
        target_variants = {target, target_singular}

        # Check exact matches across plural/singular forms
        if variants & target_variants:
            return True

        # Check synonym families
        if target in VERTICAL_SYNONYMS:
            for syn in VERTICAL_SYNONYMS[target]:
                syn_singular = " ".join(_singularize(w) for w in re.findall(r"\w+", syn))
                syn_variants = {syn, syn_singular}
                for s in syn_variants:
                    for v in variants:
                        if s == v or re.search(r"(?:\b|_)" + re.escape(s) + r"(?:\b|_)", v):
                            return True

        # Check whole-word / phrase match
        for v in variants:
            for t in target_variants:
                if re.search(r"(?:\b|_)" + re.escape(t) + r"(?:\b|_)", v):
                    return True
                if v not in DISALLOWED_VERTICAL_FRAGMENTS:
                    if re.search(r"(?:\b|_)" + re.escape(v) + r"(?:\b|_)", t):
                        return True

    return False


def validate_search_strategy_scope(
    strategy: SearchStrategy,
    campaign_scope: Optional[CampaignScope] = None,
    limits: Optional[CampaignLimits] = None,
    profile: Optional[LeadPulseProfile] = None,
) -> list[str]:
    """Validate a SearchStrategy strictly against campaign geography, verticals, and query limits.

    Returns:
        list[str]: List of violation error messages. Empty if fully compliant.
    """
    violations: list[str] = []
    if profile is None:
        from app.core.profile import get_business_profile
        active_profile = get_business_profile()
    else:
        active_profile = profile
    active_limits = limits or CampaignLimits()

    # 1. Enforce query count limit
    if len(strategy.queries) > active_limits.max_search_queries:
        violations.append(
            f"Query count ({len(strategy.queries)}) exceeds maximum permitted limit "
            f"of {active_limits.max_search_queries} queries."
        )

    # 2. Determine allowed locations
    # Priority: CampaignScope target_cities -> Profile primary_region + allowed_cities + seed_micro_markets
    if campaign_scope and campaign_scope.target_cities:
        allowed_locations_raw = campaign_scope.target_cities
    else:
        allowed_locations_raw = (
            ([active_profile.geography.primary_region] if active_profile.geography.primary_region else [])
            + active_profile.geography.allowed_cities
            + active_profile.geography.seed_micro_markets
        )

    # 3. Determine allowed verticals
    # Priority: CampaignScope target_verticals -> Profile seed_verticals
    if campaign_scope and campaign_scope.target_verticals:
        allowed_verticals_raw = campaign_scope.target_verticals
    else:
        allowed_verticals_raw = active_profile.verticals.seed_verticals

    # 4. Validate each query
    for idx, q in enumerate(strategy.queries):
        if not is_location_in_scope(q.location, allowed_locations_raw):
            violations.append(
                f"Query #{idx + 1} ('{q.query}') specifies unauthorized location '{q.location}'. "
                f"Allowed locations are: {allowed_locations_raw}."
            )

        if q.vertical is not None and not is_vertical_in_scope(q.vertical, allowed_verticals_raw):
            violations.append(
                f"Query #{idx + 1} ('{q.query}') specifies unauthorized vertical '{q.vertical}'. "
                f"Allowed seed verticals are: {allowed_verticals_raw}."
            )

    return violations


def enforce_search_strategy_scope(
    strategy: SearchStrategy,
    campaign_scope: Optional[CampaignScope] = None,
    limits: Optional[CampaignLimits] = None,
    profile: Optional[LeadPulseProfile] = None,
) -> SearchStrategy:
    """Validate SearchStrategy and raise SearchScopeValidationError if violations are found."""
    violations = validate_search_strategy_scope(
        strategy=strategy,
        campaign_scope=campaign_scope,
        limits=limits,
        profile=profile
    )
    if violations:
        raise SearchScopeValidationError(
            f"Search strategy violates campaign scope constraints ({len(violations)} errors): "
            + "; ".join(violations),
            violations=violations
        )
    return strategy


def filter_search_strategy_to_scope(
    strategy: SearchStrategy,
    campaign_scope: Optional[CampaignScope] = None,
    limits: Optional[CampaignLimits] = None,
    profile: Optional[LeadPulseProfile] = None,
) -> SearchStrategy:
    """Filter queries in a SearchStrategy to strictly include only compliant queries up to max limits."""
    if profile is None:
        from app.core.profile import get_business_profile
        active_profile = get_business_profile()
    else:
        active_profile = profile
    active_limits = limits or CampaignLimits()

    if campaign_scope and campaign_scope.target_cities:
        allowed_locations = campaign_scope.target_cities
    else:
        allowed_locations = (
            ([active_profile.geography.primary_region] if active_profile.geography.primary_region else [])
            + active_profile.geography.allowed_cities
            + active_profile.geography.seed_micro_markets
        )

    if campaign_scope and campaign_scope.target_verticals:
        allowed_verticals = campaign_scope.target_verticals
    else:
        allowed_verticals = active_profile.verticals.seed_verticals

    compliant_queries: list[SearchQuery] = []
    seen_queries = set()

    for q in strategy.queries:
        query_key = q.query.strip().lower()
        if query_key in seen_queries:
            continue

        if not is_location_in_scope(q.location, allowed_locations):
            continue

        if q.vertical is not None and not is_vertical_in_scope(q.vertical, allowed_verticals):
            continue

        seen_queries.add(query_key)
        compliant_queries.append(q)

        if len(compliant_queries) >= active_limits.max_search_queries:
            break

    if not compliant_queries:
        raise SearchScopeValidationError(
            "No queries in the search strategy complied with the campaign scope boundaries."
        )

    return SearchStrategy(
        research_goal=strategy.research_goal,
        queries=compliant_queries
    )


__all__ = [
    "SearchQuery",
    "SearchStrategy",
    "CampaignLimits",
    "ToolExecutionBlocked",
    "SearchScopeValidationError",
    "is_location_in_scope",
    "is_vertical_in_scope",
    "validate_search_strategy_scope",
    "enforce_search_strategy_scope",
    "filter_search_strategy_to_scope",
]
