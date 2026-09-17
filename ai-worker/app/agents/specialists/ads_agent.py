"""Ads Specialist Agent — Analyzes Meta Ads intelligence with strict metric fabrication guards.

Inspects only observable advertising data from Meta Ads records:
- active ads count and existence
- offer / headline / message themes
- observable CTAs (e.g. 'Learn More', 'Send WhatsApp Message', 'Book Now')
- landing-page and website consistency
- obvious funnel friction

STRICT ANTI-HALLUCINATION INVARIANTS:
- Never invent or estimate: ad spend, ROAS, conversion rates, CAC, impressions, revenue, or campaign performance.
- If no active ads are present or data is unavailable: status = 'no_ads' or 'unavailable'.
- Findings must strictly separate: OBSERVED vs INFERRED vs UNKNOWN.
"""

from typing import Optional
from agents import Agent

from app.core.provider import create_configured_agent
from app.core.prompt_loader import load_prompt
from app.schemas.evidence import Evidence, AdsAnalysisResult


def build_no_ads_result(business_name: Optional[str] = None) -> AdsAnalysisResult:
    """Deterministic result when a business has no active ads or ad data is unavailable.
    
    Guarantees zero metric fabrication without calling the model:
    status is explicitly 'no_ads', active_ad_count=0, and all performance metrics are None.
    """
    evidence = [
        Evidence(
            finding="No active ads observed",
            source="ads",
            evidence="Meta Ads Library records indicate 0 active ad creatives for this entity.",
            confidence=0.9,
            classification="observed"
        )
    ]

    return AdsAnalysisResult(
        status="no_ads",
        findings=["No active advertising campaigns or ad creatives detected."],
        evidence=evidence,
        confidence=0.9,
        limitations=["No public ad creatives available in Meta Ads Library for creative or CTA audit."],
        active_ad_count=0,
        ad_themes=[],
        observed_ctas=[],
        ad_to_website_consistency=None,
        funnel_friction=[]
    )


def build_unavailable_ads_result(
    business_name: Optional[str] = None,
    reason: str = "Meta Ads data unavailable or analysis failed",
    status: str = "unavailable"
) -> AdsAnalysisResult:
    """Deterministic fallback when advertising analysis fails, times out, or ad data is unreachable.
    
    Guarantees zero false assertions:
    status is 'unavailable' or 'error' (NOT 'no_ads'), active_ad_count is None (NOT 0),
    preventing false claims that a business with active ads has no ads.
    """
    valid_status = status if status in ("unavailable", "error") else "unavailable"
    evidence = [
        Evidence(
            finding="Advertising intelligence unavailable",
            source="ads",
            evidence=f"Meta Ads analysis for '{business_name or 'candidate'}' could not be completed: {reason}",
            confidence=0.0,
            classification="unknown"
        )
    ]

    return AdsAnalysisResult(
        status=valid_status,  # type: ignore[arg-type]
        findings=[f"Advertising analysis unavailable: {reason}"],
        evidence=evidence,
        confidence=0.0,
        limitations=[f"Meta Ads data could not be verified: {reason}"],
        active_ad_count=None,
        ad_themes=[],
        observed_ctas=[],
        ad_to_website_consistency=None,
        funnel_friction=[]
    )


def create_ads_specialist_agent(model: Optional[str] = None) -> Agent:
    """Create the Ads Specialist Agent enforcing AdsAnalysisResult structured output."""
    loaded = load_prompt("ads_agent")
    if loaded:
        instructions = loaded
    else:
        instructions = (
            "You are the LeadPulse AI Advertising Specialist Agent.\n"
        "Your task is to analyze observable advertising signals from Meta Ads records.\n"
        "Inspect ONLY information that is present in the provided ad records.\n\n"
        "--- STRICT ANTI-HALLUCINATION INVARIANTS ---\n"
        "1. NEVER INVENT OR ESTIMATE: ad spend, budget, ROAS, conversion rate, customer acquisition cost, "
        "   impressions, clicks, click-through-rate, revenue, or campaign performance.\n"
        "   If any performance metric is not in the data, it is UNKNOWN and must remain None or omitted.\n"
        "2. If no ads are active:\n"
        "   - Set status='no_ads'.\n"
        "   - Set active_ad_count=0.\n"
        "   - Do not claim the business is failing at ads; simply report that no active ads were observed.\n"
        "3. If active ads are observed:\n"
        "   - Set status='active_ads'.\n"
        "   - Count and report observable active creatives.\n"
        "   - Extract observable messaging themes (e.g. 'smile makeover offer', 'laser discount').\n"
        "   - Identify observed CTAs (e.g. 'Send WhatsApp Message', 'Book Now').\n"
        "   - Note any obvious friction between the ad's offer and the business's intake flow.\n"
        "4. Evidence Model:\n"
        "   - For every key finding, emit an Evidence item with source='ads', bounded confidence [0.0, 1.0], "
        "     and classification strictly as 'observed', 'inferred', or 'unknown'.\n"
        "   - Observed copy must reference exact words from the ad creative.\n"
        "   - Funnel friction must be classified as 'inferred'.\n"
        "   - Unknown metrics must never be converted into observed.\n\n"
        "Emit a structured AdsAnalysisResult matching the schema."
    )

    return create_configured_agent(
        name="LeadPulseAdsSpecialistAgent",
        instructions=instructions,
        output_type=AdsAnalysisResult,
        model=model
    )


__all__ = [
    "build_no_ads_result",
    "build_unavailable_ads_result",
    "create_ads_specialist_agent",
]
