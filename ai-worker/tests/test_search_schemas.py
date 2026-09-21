"""Unit tests for search strategy schemas and campaign scope boundaries.

Validates:
- Valid SearchQuery and SearchStrategy instantiation
- Rejection of empty query/location/reason
- Internal duplicate query detection in SearchStrategy
- Geographic boundaries validation (allowed vs unauthorized locations)
- Seed vertical restrictions validation (allowed vs unauthorized verticals)
- Query count limits enforcement
- filter_search_strategy_to_scope functionality
- CampaignLimits bounds and ToolExecutionBlocked structured representation
"""

import pytest
from pydantic import ValidationError
from app.schemas.search import (
    SearchQuery,
    SearchStrategy,
    CampaignLimits,
    ToolExecutionBlocked,
    SearchScopeValidationError,
    validate_search_strategy_scope,
    enforce_search_strategy_scope,
    filter_search_strategy_to_scope,
)
from app.utils.error_handlers import WorkerError
from app.schemas.profile import CampaignScope


class TestSearchQuerySchema:
    """Tests for SearchQuery schema validation."""

    def test_valid_search_query(self):
        sq = SearchQuery(
            query="skin clinic in South Delhi",
            location="South Delhi",
            vertical="Dermatology",
            reason="High cosmetic treatment demand with strong patient LTV",
            priority="high"
        )
        assert sq.query == "skin clinic in South Delhi"
        assert sq.location == "South Delhi"
        assert sq.vertical == "Dermatology"
        assert sq.priority == "high"

    def test_empty_query_rejected(self):
        with pytest.raises(ValidationError):
            SearchQuery(
                query="   ",
                location="Delhi",
                reason="Testing",
                priority="high"
            )

    def test_empty_location_rejected(self):
        with pytest.raises(ValidationError):
            SearchQuery(
                query="dental clinic",
                location="",
                reason="Testing",
                priority="medium"
            )

    def test_empty_reason_rejected(self):
        with pytest.raises(ValidationError):
            SearchQuery(
                query="dental clinic",
                location="Delhi",
                reason="",
                priority="medium"
            )

    def test_invalid_priority_rejected(self):
        with pytest.raises(ValidationError):
            SearchQuery(
                query="dental clinic",
                location="Delhi",
                reason="Valid reason",
                priority="urgent"  # Only high, medium, low allowed
            )


class TestSearchStrategySchema:
    """Tests for SearchStrategy schema validation."""

    def test_valid_search_strategy(self):
        strategy = SearchStrategy(
            research_goal="Discover high-ticket cosmetic dermatology and dental clinics in Delhi NCR",
            queries=[
                SearchQuery(
                    query="dermatology clinic South Delhi",
                    location="South Delhi",
                    vertical="Dermatology",
                    reason="Targeting clinics with high-ticket aesthetic procedures",
                    priority="high"
                ),
                SearchQuery(
                    query="dental implant clinic Gurgaon",
                    location="Gurgaon",
                    vertical="Dental",
                    reason="Dental implants have high margins and appointment booking friction",
                    priority="medium"
                )
            ]
        )
        assert len(strategy.queries) == 2
        assert "cosmetic dermatology" in strategy.research_goal

    def test_empty_queries_list_rejected(self):
        with pytest.raises(ValidationError):
            SearchStrategy(
                research_goal="No queries",
                queries=[]
            )

    def test_duplicate_query_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            SearchStrategy(
                research_goal="Goal",
                queries=[
                    SearchQuery(
                        query="dental clinic Delhi",
                        location="Delhi",
                        vertical="Dental",
                        reason="Reason 1",
                        priority="high"
                    ),
                    SearchQuery(
                        query="dental clinic delhi",  # case-insensitive duplicate
                        location="Delhi",
                        vertical="Dental",
                        reason="Reason 2",
                        priority="medium"
                    ),
                ]
            )
        assert "Duplicate queries detected" in str(exc_info.value)


class TestScopeValidation:
    """Tests for geography, vertical, and query count boundary guardrails."""

    @pytest.fixture
    def campaign(self):
        return CampaignScope(
            target_cities=["Delhi", "Gurgaon", "Noida"],
            target_verticals=["Dermatology", "Dental", "Hair Transplant", "Med Spa"]
        )

    def test_valid_strategy_passes_scope(self, campaign):
        strategy = SearchStrategy(
            research_goal="Target clinics",
            queries=[
                SearchQuery(
                    query="skin clinic Delhi",
                    location="Delhi",
                    vertical="Dermatology",
                    reason="Valid",
                    priority="high"
                ),
                SearchQuery(
                    query="hair transplant Gurgaon",
                    location="Gurgaon",
                    vertical="Hair Transplant",
                    reason="Valid",
                    priority="high"
                )
            ]
        )
        violations = validate_search_strategy_scope(strategy, campaign_scope=campaign)
        assert violations == []
        enforced = enforce_search_strategy_scope(strategy, campaign_scope=campaign)
        assert len(enforced.queries) == 2

    def test_unauthorized_location_rejected(self, campaign):
        strategy = SearchStrategy(
            research_goal="Target clinics",
            queries=[
                SearchQuery(
                    query="dental clinic Mumbai",
                    location="Mumbai",  # Not in allowed cities!
                    vertical="Dental",
                    reason="Test Mumbai",
                    priority="high"
                )
            ]
        )
        violations = validate_search_strategy_scope(strategy, campaign_scope=campaign)
        assert len(violations) >= 1
        assert any("unauthorized location 'Mumbai'" in v for v in violations)

        with pytest.raises(SearchScopeValidationError) as exc_info:
            enforce_search_strategy_scope(strategy, campaign_scope=campaign)
        assert "unauthorized location 'Mumbai'" in str(exc_info.value)

    def test_unauthorized_vertical_rejected(self, campaign):
        strategy = SearchStrategy(
            research_goal="Target clinics",
            queries=[
                SearchQuery(
                    query="gaming store Delhi",
                    location="Delhi",
                    vertical="Gaming Store",  # Not in seed verticals!
                    reason="Test gaming",
                    priority="low"
                )
            ]
        )
        violations = validate_search_strategy_scope(strategy, campaign_scope=campaign)
        assert len(violations) >= 1
        assert any("unauthorized vertical 'Gaming Store'" in v for v in violations)

        with pytest.raises(SearchScopeValidationError):
            enforce_search_strategy_scope(strategy, campaign_scope=campaign)

    def test_exceeding_max_queries_rejected(self, campaign):
        limits = CampaignLimits(max_search_queries=2)
        strategy = SearchStrategy(
            research_goal="Target clinics",
            queries=[
                SearchQuery(query=f"query {i} Delhi", location="Delhi", vertical="Dental", reason="r", priority="low")
                for i in range(3)
            ]
        )
        violations = validate_search_strategy_scope(strategy, campaign_scope=campaign, limits=limits)
        assert any("exceeds maximum permitted limit of 2" in v for v in violations)

    def test_filter_strategy_to_scope(self, campaign):
        limits = CampaignLimits(max_search_queries=2)
        strategy = SearchStrategy(
            research_goal="Target clinics",
            queries=[
                # Valid 1
                SearchQuery(query="skin clinic Delhi", location="Delhi", vertical="Dermatology", reason="r", priority="high"),
                # Invalid location
                SearchQuery(query="dental Bangalore", location="Bangalore", vertical="Dental", reason="r", priority="low"),
                # Invalid vertical
                SearchQuery(query="restaurant Noida", location="Noida", vertical="Restaurant", reason="r", priority="low"),
                # Valid 2
                SearchQuery(query="dental clinic Gurgaon", location="Gurgaon", vertical="Dental", reason="r", priority="high"),
                # Valid 3 (would exceed limit of 2)
                SearchQuery(query="hair transplant Delhi", location="Delhi", vertical="Hair Transplant", reason="r", priority="medium"),
            ]
        )
        filtered = filter_search_strategy_to_scope(strategy, campaign_scope=campaign, limits=limits)
        assert len(filtered.queries) == 2
        assert filtered.queries[0].query == "skin clinic Delhi"
        assert filtered.queries[1].query == "dental clinic Gurgaon"

    def test_cross_geography_leakage_rejected(self):
        """Adversarial test: verify that partial word matches (e.g. 'South' in 'South Africa') cannot bypass geography."""
        restricted_campaign = CampaignScope(
            target_cities=["South Delhi", "New Delhi"],
            target_verticals=["Dermatology"]
        )
        adversarial_strategy = SearchStrategy(
            research_goal="Test leakage",
            queries=[
                # 'South Africa' contains 'South' which was previously leaked by splitting 'South Delhi'
                SearchQuery(query="skin clinic South Africa", location="South Africa", vertical="Dermatology", reason="r", priority="low"),
                # 'New York' contains 'New' which was previously leaked by splitting 'New Delhi'
                SearchQuery(query="skin clinic New York", location="New York", vertical="Dermatology", reason="r", priority="low"),
                # Single letter or fragment substring
                SearchQuery(query="skin clinic del", location="del", vertical="Dermatology", reason="r", priority="low"),
            ]
        )
        violations = validate_search_strategy_scope(adversarial_strategy, campaign_scope=restricted_campaign)
        assert len(violations) == 3
        assert any("South Africa" in v for v in violations)
        assert any("New York" in v for v in violations)
        assert any("del" in v for v in violations)

    def test_cross_vertical_leakage_rejected(self):
        """Adversarial test: verify that partial word matches (e.g. 'Spa' in 'Car Spa') cannot bypass verticals."""
        restricted_campaign = CampaignScope(
            target_cities=["Delhi"],
            target_verticals=["Med Spa", "Hair Transplant"]
        )
        adversarial_strategy = SearchStrategy(
            research_goal="Test vertical leakage",
            queries=[
                # 'Car Spa' contains 'Spa'
                SearchQuery(query="car wash Delhi", location="Delhi", vertical="Car Spa", reason="r", priority="low"),
                # 'Pet Hair Grooming' contains 'Hair'
                SearchQuery(query="pet grooming Delhi", location="Delhi", vertical="Pet Hair Grooming", reason="r", priority="low"),
                # 'art' fragment from 'dermatology'
                SearchQuery(query="art store Delhi", location="Delhi", vertical="art", reason="r", priority="low"),
            ]
        )
        violations = validate_search_strategy_scope(adversarial_strategy, campaign_scope=restricted_campaign)
        assert len(violations) == 3
        assert any("Car Spa" in v for v in violations)
        assert any("Pet Hair Grooming" in v for v in violations)
        assert any("art" in v for v in violations)

    def test_vertical_synonym_families_accepted(self, campaign):
        """Verify that legitimate clinic vertical synonyms (e.g. 'Dentist' for 'Dental') are accepted."""
        strategy = SearchStrategy(
            research_goal="Test synonyms",
            queries=[
                SearchQuery(query="dentist Delhi", location="Delhi", vertical="Dentist", reason="r", priority="high"),
                SearchQuery(query="dermatologist Gurgaon", location="Gurgaon", vertical="Dermatologist", reason="r", priority="high"),
                SearchQuery(query="medspa Noida", location="Noida", vertical="Medspa", reason="r", priority="medium"),
            ]
        )
        violations = validate_search_strategy_scope(strategy, campaign_scope=campaign)
        assert violations == []

    def test_sub_district_restriction_rejects_broad_parent_metro(self):
        """Verify that when restricted to a sub-district (e.g. 'South Delhi'), a broad query ('Delhi') is rejected."""
        restricted = CampaignScope(target_cities=["South Delhi"], target_verticals=["Dental"])
        strategy = SearchStrategy(
            research_goal="Test containment",
            queries=[
                SearchQuery(query="dental Delhi", location="Delhi", vertical="Dental", reason="Broad query", priority="high")
            ]
        )
        violations = validate_search_strategy_scope(strategy, campaign_scope=restricted)
        assert len(violations) >= 1
        assert any("unauthorized location 'Delhi'" in v for v in violations)

    def test_disallowed_vertical_prefixes_rejected(self):
        """Verify that prefixes like 'Pet' or 'Dog' in 'Pet Salon' are rejected under 'Luxury Salon'."""
        restricted = CampaignScope(target_cities=["Delhi"], target_verticals=["Luxury Salon"])
        strategy = SearchStrategy(
            research_goal="Test vertical prefixes",
            queries=[
                SearchQuery(query="pet salon Delhi", location="Delhi", vertical="Pet Salon", reason="r", priority="low"),
                SearchQuery(query="dog grooming Delhi", location="Delhi", vertical="Dog Salon", reason="r", priority="low")
            ]
        )
        violations = validate_search_strategy_scope(strategy, campaign_scope=restricted)
        assert len(violations) == 2

    def test_plural_and_lemmatized_verticals_accepted(self):
        """Verify that natural plural and lemmatized forms of seed verticals are accepted."""
        plural_strategy = SearchStrategy(
            research_goal="Test plural vertical forms",
            queries=[
                SearchQuery(query="luxury salons Delhi", location="Delhi", vertical="Salons", reason="r", priority="high"),
                SearchQuery(query="cosmetic dentists Gurgaon", location="Gurgaon", vertical="Dentists", reason="r", priority="high"),
                SearchQuery(query="skin clinics Noida", location="Noida", vertical="Skin Clinics", reason="r", priority="high"),
                SearchQuery(query="medical spas South Delhi", location="South Delhi", vertical="Medical Spas", reason="r", priority="high"),
                SearchQuery(query="interior designers Gurgaon", location="Gurgaon", vertical="Interior Designers", reason="r", priority="high"),
            ]
        )
        violations = validate_search_strategy_scope(plural_strategy)
        assert violations == []

    def test_search_scope_validation_error_hierarchy(self):
        """Verify SearchScopeValidationError is both a WorkerError and a ValueError with appropriate error_code."""
        err = SearchScopeValidationError("Test violation", violations=["out of bounds"])
        assert isinstance(err, WorkerError)
        assert isinstance(err, ValueError)
        assert err.error_code == "SEARCH_SCOPE_VALIDATION_ERROR"
        assert err.violations == ["out of bounds"]

    def test_primary_region_included_in_default_scope(self):
        """Verify that queries targeting the profile's primary_region (Delhi NCR) are accepted when no campaign scope is provided."""
        strategy = SearchStrategy(
            research_goal="Test primary region targeting",
            queries=[
                SearchQuery(query="dermatology clinics Delhi NCR", location="Delhi NCR", vertical="Dermatology", reason="r", priority="high")
            ]
        )
        violations = validate_search_strategy_scope(strategy)
        assert violations == []


class TestCampaignLimitsAndBlockedResult:
    """Tests for CampaignLimits and ToolExecutionBlocked."""

    def test_campaign_limits_defaults(self):
        limits = CampaignLimits()
        assert limits.max_search_queries == 5
        assert limits.max_businesses_per_query == 15
        assert limits.max_apify_calls == 10
        assert limits.max_businesses_collected == 50
        assert limits.max_cost_usd == 2.0

    def test_tool_execution_blocked_schema(self):
        blocked = ToolExecutionBlocked(
            reason="Campaign limit 'max_apify_calls' reached",
            limit_name="max_apify_calls",
            limit_value=10,
            current_usage=10
        )
        assert blocked.blocked is True
        assert blocked.limit_name == "max_apify_calls"
        assert blocked.limit_value == 10
        assert blocked.current_usage == 10
