"""Typed schemas for controlled Apify tool interfaces.

Enforces strict input validation, bounded outputs, and structured errors.
Zero credentials or sensitive auth details are exposed in these schemas.
"""

from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ApifyToolError(BaseModel):
    """Structured error returned when an Apify tool operation fails."""
    model_config = ConfigDict(frozen=True)

    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Sanitized human-readable error description")
    retryable: bool = Field(default=False, description="Whether the operation may succeed on retry")
    details: Optional[dict[str, Any]] = Field(default=None, description="Optional diagnostic context")


class ApifyToolException(Exception):
    """Exception raised internally by Apify client when actor execution fails."""

    def __init__(
        self,
        code: str,
        message: str,
        retryable: bool = False,
        details: Optional[dict[str, Any]] = None
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.details = details

    def to_error_model(self) -> ApifyToolError:
        return ApifyToolError(
            code=self.code,
            message=self.message,
            retryable=self.retryable,
            details=self.details
        )


class GoogleMapsInput(BaseModel):
    """Controlled parameters for Google Maps place discovery."""
    model_config = ConfigDict(frozen=True, extra="forbid")

    query: str = Field(..., min_length=1, description="Search query string (e.g. 'skin clinic', 'dental implant')")
    location: str = Field(..., min_length=1, description="Target location/city (e.g. 'South Delhi', 'Gurgaon')")
    max_results: int = Field(
        default=15,
        ge=1,
        le=30,
        description="Maximum places to crawl (strictly bounded between 1 and 30)"
    )

    @field_validator("query", "location")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Parameter cannot be empty or whitespace only")
        return trimmed


class GoogleMapsOutput(BaseModel):
    """Structured output returned from Google Maps place scraping."""
    model_config = ConfigDict(frozen=True)

    query: str
    location: str
    total_found: int
    items: list[dict[str, Any]] = Field(default_factory=list)
    actor_run_id: Optional[str] = None


class RedditInput(BaseModel):
    """Controlled parameters for Reddit community discussion discovery."""
    model_config = ConfigDict(frozen=True, extra="forbid")

    subreddits: list[str] = Field(
        default_factory=lambda: [
            "smallbusiness",
            "smallbusinessowners",
            "restaurantowners",
            "realtors",
            "shopify"
        ],
        description="Target business subreddits"
    )
    keywords: list[str] = Field(
        default_factory=lambda: [
            "missed calls",
            "after hours",
            "too many messages",
            "double booking",
            "scheduling"
        ],
        description="Operational friction keywords"
    )
    max_posts: int = Field(
        default=20,
        ge=5,
        le=30,
        description="Maximum posts to scrape (strictly bounded between 5 and 30)"
    )

    @field_validator("subreddits", "keywords")
    @classmethod
    def validate_string_lists(cls, v: list[str]) -> list[str]:
        cleaned = [item.strip() for item in v if item.strip()]
        if not cleaned:
            raise ValueError("List cannot be empty")
        return cleaned


class RedditOutput(BaseModel):
    """Structured output returned from Reddit post discovery."""
    model_config = ConfigDict(frozen=True)

    total_fetched: int
    candidates_passed_filter: int
    rejected_by_filter: int
    items: list[dict[str, Any]] = Field(default_factory=list)
    actor_run_id: Optional[str] = None


class MetaAdsInput(BaseModel):
    """Controlled parameters for Meta Ad Library scraping."""
    model_config = ConfigDict(frozen=True, extra="forbid")

    search_query: str = Field(..., min_length=2, description="Target commercial keyword/brand query")
    country_code: str = Field(default="IN", min_length=2, max_length=2, description="Two-letter ISO country code")
    max_ads: int = Field(
        default=10,
        ge=1,
        le=30,
        description="Maximum active ads to retrieve (strictly bounded between 1 and 30)"
    )

    @field_validator("search_query")
    @classmethod
    def validate_search_query(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("search_query cannot be empty")
        return trimmed

    @field_validator("country_code")
    @classmethod
    def validate_country_code(cls, v: str) -> str:
        trimmed = v.strip().upper()
        if len(trimmed) != 2:
            raise ValueError("country_code must be a 2-letter ISO code")
        return trimmed


class MetaAdsOutput(BaseModel):
    """Structured output returned from Meta Ads scraping."""
    model_config = ConfigDict(frozen=True)

    search_query: str
    country_code: str
    total_found: int
    items: list[dict[str, Any]] = Field(default_factory=list)
    actor_run_id: Optional[str] = None


class BusinessDetailsInput(BaseModel):
    """Controlled parameters for Google Maps business details fetching."""
    model_config = ConfigDict(frozen=True, extra="forbid")

    place_id: str = Field(..., description="Google Places ID")


class RedditPostInput(BaseModel):
    """Controlled parameters for Reddit post fetching."""
    model_config = ConfigDict(frozen=True, extra="forbid")

    url: str = Field(..., description="Reddit post URL")


class BusinessAdsInput(BaseModel):
    """Controlled parameters for Meta Ads business ads fetching."""
    model_config = ConfigDict(frozen=True, extra="forbid")

    page_id: str = Field(..., description="Facebook page URL or ID")


__all__ = [
    "ApifyToolError",
    "ApifyToolException",
    "GoogleMapsInput",
    "GoogleMapsOutput",
    "RedditInput",
    "RedditOutput",
    "MetaAdsInput",
    "MetaAdsOutput",
    "BusinessDetailsInput",
    "RedditPostInput",
    "BusinessAdsInput",
]
