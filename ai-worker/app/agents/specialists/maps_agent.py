"""Maps Specialist Agent — Analyzes Google Maps / Local Profile intelligence with sentiment fabrication guards.

Inspects only observable local presence data from Google Maps records:
- business category and verification status
- rating (0.0 to 5.0) and review count
- listed services
- location and address
- contact channels (phone, website, Instagram)
- positioning signals

STRICT ANTI-HALLUCINATION INVARIANTS:
- NEVER fabricate review sentiment or customer complaints unless actual customer review text was provided in the context.
- If review text is absent, review_sentiment MUST be None or 'unknown'.
- NEVER claim a business is 'highly rated' or 'poorly rated' without the actual numeric rating and review count.
- Missing fields must remain None or unknown; do not invent operating hours, owner names, or complaints.
"""

from typing import Optional
from agents import Agent

from app.core.provider import create_configured_agent
from app.core.prompt_loader import load_prompt
from app.schemas.evidence import Evidence, MapsAnalysisResult


def build_unavailable_maps_result(
    business_name: Optional[str] = None,
    reason: str = "No Google Maps or local business profile data was found in discovery records.",
    status: str = "unavailable"
) -> MapsAnalysisResult:
    """Deterministic result when a business has no Google Maps record, or profile analysis failed/timed out."""
    valid_status = status if status in ("unavailable", "error") else "unavailable"
    evidence = [
        Evidence(
            finding="Local business profile unavailable",
            source="maps",
            evidence=f"Google Maps data for '{business_name or 'candidate'}' could not be evaluated: {reason}",
            confidence=0.0,
            classification="unknown"
        )
    ]
    return MapsAnalysisResult(
        status=valid_status,  # type: ignore[arg-type]
        findings=[f"Local business profile analysis unavailable: {reason}"],
        evidence=evidence,
        confidence=0.0,
        limitations=[f"Local profile signals could not be verified: {reason}"],
        business_category=None,
        rating=None,
        review_count=None,
        address=None,
        phone=None,
        website_present=None,
        instagram_present=None,
        services=[],
        review_sentiment=None,
        reviews_provided=False
    )


def create_maps_specialist_agent(model: Optional[str] = None) -> Agent:
    """Create the Google Maps Specialist Agent enforcing MapsAnalysisResult structured output."""
    loaded = load_prompt("maps_agent")
    if loaded:
        instructions = loaded
    else:
        instructions = (
            "You are the LeadPulse AI Google Maps & Local Profile Specialist Agent.\n"
        "Your task is to analyze observable local presence signals from Google Maps records.\n"
        "Inspect ONLY information that is present in the provided Google Maps data.\n\n"
        "--- STRICT ANTI-HALLUCINATION INVARIANTS ---\n"
        "1. NEVER FABRICATE REVIEW SENTIMENT: Do not invent customer complaints, satisfaction claims, "
        "   or operational issues (e.g. 'customers complain of long wait times') UNLESS actual review text "
        "   was provided in the prompt context. If review text is absent, review_sentiment MUST remain None or 'unknown'.\n"
        "2. RATING INTEGRITY: Never claim a business is 'highly rated' or 'poorly rated' without referencing the "
        "   actual numeric rating (e.g., 4.8) and review count (e.g., 120 reviews). If rating is 0.0 or review count is 0, "
        "   explicitly note that it is unrated or has zero reviews.\n"
        "3. OBSERVABLE SIGNALS ONLY:\n"
        "   - Business category (e.g. 'Dental clinic', 'Dermatologist').\n"
        "   - Address and geographic location.\n"
        "   - Phone number and contact accessibility.\n"
        "   - Presence of linked website or Instagram profile.\n"
        "   - Observable listed services.\n"
        "4. Evidence Model:\n"
        "   - For every key finding, emit an Evidence item with source='maps', bounded confidence [0.0, 1.0], "
        "     and classification strictly as 'observed', 'inferred', or 'unknown'.\n"
        "   - Observed profile facts must reference exact data from the profile.\n"
        "   - Unknown attributes must never be converted into observed.\n\n"
        "Emit a structured MapsAnalysisResult matching the schema."
    )

    return create_configured_agent(
        name="LeadPulseMapsSpecialistAgent",
        instructions=instructions,
        output_type=MapsAnalysisResult,
        model=model
    )


__all__ = [
    "build_unavailable_maps_result",
    "create_maps_specialist_agent",
]
