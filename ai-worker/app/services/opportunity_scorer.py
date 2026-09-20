"""Deterministic Opportunity Scorer for LeadPulse AI V2.

Provides transparent, reproducible opportunity scoring, confidence estimation,
and deterministic service recommendation hints grounded strictly in verified signals.

SCORING INVARIANTS:
1. 100% deterministic and reproducible: identical inputs produce identical scores.
2. Zero LLM dependencies: all math and signal detections are pure Python.
3. opportunity_score is strictly clamped to [0.0, 100.0].
4. confidence is strictly clamped to [0.0, 1.0].
5. Anti-hallucination: only signals present in candidate and specialist outputs are scored.
6. Low-evidence candidates produce appropriately low scores and low confidence.
"""

from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.evidence import (
    SpecialistResearchAggregate,
    WebsiteAnalysisResult,
    AdsAnalysisResult,
    MapsAnalysisResult,
)
from app.schemas.opportunity import APPROVED_SERVICES
from app.services.deterministic_pipeline import (
    NormalizedCandidate,
    HIGH_TICKET_KEYWORDS,
)


class OpportunityScoreBreakdown(BaseModel):
    """Detailed transparent breakdown of the deterministic opportunity calculation."""
    model_config = ConfigDict(frozen=True)

    opportunity_score: float = Field(..., ge=0.0, le=100.0, description="Overall opportunity score [0-100]")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence in the assessment [0.0-1.0]")
    primary_problem: str = Field(..., description="Deterministic primary problem summary")
    recommended_service: str = Field(..., description="Approved canonical service recommendation")
    why_this_service: str = Field(..., description="Deterministic justification for the recommendation")
    research_status: Literal["complete", "partial", "failed"] = Field(..., description="Research completeness")
    limitations: list[str] = Field(default_factory=list, description="Data limitations and missing sources")
    scoring_components: dict[str, float] = Field(default_factory=dict, description="Point contributions by category")
    detected_frictions: list[str] = Field(default_factory=list, description="Identified friction points")


def calculate_opportunity_score(
    candidate: NormalizedCandidate,
    aggregate: Optional[SpecialistResearchAggregate] = None,
) -> OpportunityScoreBreakdown:
    """Calculate transparent, deterministic opportunity score and service recommendation.
    
    Formula:
    Total Score = (
        Commercial Maturity Points (0-25)
      + Marketing Activity Points (0-20)
      + Pain Points & Friction Points (0-35)
      + V1 Scorecard Alignment (0-20)
    ) clamped to [0.0, 100.0].
    """
    components: dict[str, float] = {}
    frictions: list[str] = []
    limitations: list[str] = []

    # -------------------------------------------------------------
    # 1. Commercial Maturity & High-Ticket Baseline (0 - 25 pts)
    # -------------------------------------------------------------
    biz_type = (candidate.business_type or "").lower()
    biz_name = (candidate.business_name or "").lower()
    is_high_ticket = any(kw in biz_type or kw in biz_name for kw in HIGH_TICKET_KEYWORDS)
    if is_high_ticket:
        components["high_ticket_vertical"] = 15.0
    else:
        components["high_ticket_vertical"] = 0.0

    # Local standing and reputation signals
    rating = candidate.rating
    review_count = candidate.review_count
    if aggregate and aggregate.maps_analysis:
        if aggregate.maps_analysis.rating is not None:
            rating = aggregate.maps_analysis.rating
        if aggregate.maps_analysis.review_count is not None:
            review_count = aggregate.maps_analysis.review_count

    if rating >= 4.5 and review_count >= 20:
        components["reputation_bonus"] = 10.0
    elif rating >= 4.0 and review_count >= 10:
        components["reputation_bonus"] = 5.0
    elif 0.0 < rating < 3.5:
        components["reputation_bonus"] = -5.0
    else:
        components["reputation_bonus"] = 0.0

    # -------------------------------------------------------------
    # 2. Marketing Activity & Advertising Spend Willingness (0 - 20 pts)
    # -------------------------------------------------------------
    has_active_ads = candidate.has_active_ads
    active_ad_count = 0
    if aggregate and aggregate.ads_analysis:
        if aggregate.ads_analysis.status == "active_ads":
            has_active_ads = True
            active_ad_count = aggregate.ads_analysis.active_ad_count or 1
        elif aggregate.ads_analysis.status == "no_ads":
            has_active_ads = False

    if has_active_ads:
        if active_ad_count >= 3:
            components["active_ads_activity"] = 20.0
        else:
            components["active_ads_activity"] = 15.0
    else:
        components["active_ads_activity"] = 0.0

    # -------------------------------------------------------------
    # 3. Pain Points & Conversion Friction (0 - 35 pts)
    # -------------------------------------------------------------
    has_website = bool(candidate.website_url)
    website_status = "unknown"
    has_booking = None
    has_whatsapp = None
    primary_cta = None

    if aggregate and aggregate.website_analysis:
        website_status = aggregate.website_analysis.status
        has_booking = aggregate.website_analysis.has_booking_system
        has_whatsapp = aggregate.website_analysis.has_whatsapp_cta
        primary_cta = aggregate.website_analysis.primary_cta
        if aggregate.website_analysis.friction_points:
            frictions.extend(aggregate.website_analysis.friction_points)

    if candidate.friction_points:
        frictions.extend(candidate.friction_points)

    # Missing digital presence / website
    if not has_website or website_status in ("unavailable", "no_website"):
        components["missing_website_friction"] = 15.0
        if website_status == "no_website" or not has_website:
            frictions.append("No website or online storefront (missed digital presence)")
        else:
            frictions.append("No accessible website or online storefront (website unreachable)")
    else:
        components["missing_website_friction"] = 0.0
        # Website exists: check booking and WhatsApp friction
        if has_booking is False:
            components["missing_booking_friction"] = 10.0
            frictions.append("No online self-serve booking system on website")
        else:
            components["missing_booking_friction"] = 0.0

        if has_whatsapp is False:
            components["missing_whatsapp_friction"] = 10.0
            frictions.append("No direct WhatsApp chat CTA for fast mobile inquiries")
        else:
            components["missing_whatsapp_friction"] = 0.0

        if not primary_cta or primary_cta.lower() in ("none", "unknown", "n/a"):
            components["weak_cta_friction"] = 5.0
            frictions.append("Missing or weak primary call-to-action on homepage")
        else:
            components["weak_cta_friction"] = 0.0

    # Compounding paid traffic waste (Ad running without conversion path)
    if has_active_ads:
        if has_whatsapp is False or has_booking is False:
            components["ad_traffic_funnel_leak"] = 10.0
            frictions.append("Running paid ads without direct WhatsApp or online booking conversion path")
        else:
            components["ad_traffic_funnel_leak"] = 0.0
    else:
        components["ad_traffic_funnel_leak"] = 0.0

    # Distinct friction points bonus
    unique_frictions = list(dict.fromkeys(frictions))
    friction_bonus = min(10.0, len(unique_frictions) * 2.0)
    components["observed_frictions_bonus"] = friction_bonus

    # Enforce category ceiling: Conversion Friction <= 35 pts
    friction_keys = [
        "missing_website_friction",
        "missing_booking_friction",
        "missing_whatsapp_friction",
        "weak_cta_friction",
        "ad_traffic_funnel_leak",
        "observed_frictions_bonus",
    ]
    raw_friction = sum(components.get(k, 0.0) for k in friction_keys)
    if raw_friction > 35.0:
        components["conversion_friction_cap_adjustment"] = -round(raw_friction - 35.0, 1)

    # -------------------------------------------------------------
    # 4. Scorecard Alignment (0 - 20 pts)
    # -------------------------------------------------------------
    sc = candidate.scorecard_score
    if sc >= 8:
        components["scorecard_score_bonus"] = 20.0
    elif sc >= 6:
        components["scorecard_score_bonus"] = 15.0
    elif sc >= 4:
        components["scorecard_score_bonus"] = 10.0
    else:
        components["scorecard_score_bonus"] = 0.0

    # -------------------------------------------------------------
    # 5. Research Completeness & Limitations
    # -------------------------------------------------------------
    research_status: Literal["complete", "partial", "failed"] = "complete"
    specialist_count = 0
    success_count = 0

    if aggregate:
        exec_status = aggregate.execution_status
        for spec_key, status_str in exec_status.items():
            specialist_count += 1
            if status_str == "success":
                success_count += 1
            elif "fail" in status_str or "error" in status_str or "exception" in status_str or "timeout" in status_str or "block" in status_str:
                limitations.append(f"{spec_key.capitalize()} research unavailable: {status_str}")
            elif status_str in ("no_url", "no_ads", "unavailable", "no_website"):
                limitations.append(f"{spec_key.capitalize()} data absent or unobservable ({status_str})")
            else:
                limitations.append(f"{spec_key.capitalize()} research ended with status: {status_str}")

        if any("exception" in s or "timeout" in s or "error" in s or "fail" in s or "block" in s for s in exec_status.values()):
            research_status = "partial" if success_count > 0 else "failed"
        elif limitations and success_count < specialist_count:
            research_status = "partial" if success_count > 0 else "failed"
        elif not aggregate.aggregated_evidence and specialist_count == 0:
            research_status = "failed"
            limitations.append("No specialist research executed.")
    else:
        research_status = "partial"
        limitations.append("Specialist research aggregate not provided; scoring derived from candidate metadata.")

    # -------------------------------------------------------------
    # 6. Low-Evidence Guard & Total Score Calculation
    # -------------------------------------------------------------
    raw_score = sum(components.values())

    # Empty evidence check: candidate has no website, no ads, no reviews
    has_meaningful_evidence = (
        has_website
        or has_active_ads
        or review_count > 0
        or (aggregate and len(aggregate.aggregated_evidence) > 0)
    )

    if not has_meaningful_evidence or candidate.priority_tier == "skip" or sc < 4:
        final_score = min(20.0, max(0.0, float(sc) * 2.0))
        confidence = 0.10
        research_status = "failed"
        insufficient_msg = "Insufficient observable signals to identify high-value operational opportunity."
        if insufficient_msg not in limitations:
            limitations.append(insufficient_msg)
        primary_problem = "Insufficient observable signals to establish commercial or automation opportunity."
        recommended_service = "business_automation"
        why_this_service = "Candidate lacks sufficient observable digital assets or active marketing channels."
    else:
        final_score = min(100.0, max(0.0, round(raw_score, 1)))

        # Confidence calculation based on evidence volume & completeness
        evidence_count = len(aggregate.aggregated_evidence) if aggregate else 0
        if research_status == "complete":
            confidence = min(0.95, max(0.70, 0.75 + (evidence_count * 0.02)))
        elif research_status == "partial":
            confidence = min(0.65, max(0.35, 0.40 + (evidence_count * 0.02)))
        else:
            confidence = 0.15

        # -------------------------------------------------------------
        # 7. Deterministic Service Recommendation Mapping
        # -------------------------------------------------------------
        if not has_website or website_status == "no_website":
            recommended_service = "website_development"
            primary_problem = "Business lacks a website and online presence, missing inbound discovery and local search traffic."
            why_this_service = (
                "Developing a modern, search-optimized web presence establishes discoverability and captures "
                "prospective clients searching for local services."
            )
        elif website_status == "unavailable":
            recommended_service = "website_development"
            primary_problem = "Business website exists but is unreachable or failing to load, losing inbound visitors."
            why_this_service = (
                "Resolving site infrastructure and deploying a reliable, high-performance web presence ensures prospective "
                "clients can access services without downtime or connection errors."
            )
        elif has_active_ads and has_whatsapp is False:
            recommended_service = "whatsapp_automation"
            primary_problem = "Active paid ad campaigns lack a direct WhatsApp conversational CTA, causing prospect drop-off."
            why_this_service = (
                "Deploying 24/7 automated WhatsApp lead capture connects paid ad clickers directly to immediate "
                "qualification, eliminating drop-off and maximizing paid campaign inquiry conversion."
            )
        elif has_active_ads and has_booking is False:
            recommended_service = "booking_automation"
            primary_problem = "Active paid advertising drives traffic without an instant online booking workflow."
            why_this_service = (
                "Implementing self-serve appointment scheduling allows high-intent prospects to book immediately, "
                "eliminating phone tag and manual scheduling delays."
            )
        elif has_booking is False:
            recommended_service = "booking_automation"
            primary_problem = "Inbound clients face friction scheduling appointments due to the absence of automated booking."
            why_this_service = (
                "Automated calendar booking and reminders streamline appointment intake and reduce front-desk overhead."
            )
        elif has_whatsapp is False:
            recommended_service = "whatsapp_automation"
            primary_problem = "Absence of instant WhatsApp messaging causes mobile prospects to abandon inquiries after-hours."
            why_this_service = (
                "WhatsApp lead automation captures inquiries 24/7, answering common questions and qualifying leads instantly."
            )
        elif any("manual" in f.lower() or "inquiry" in f.lower() for f in unique_frictions):
            recommended_service = "ai_agents"
            primary_problem = "Repetitive manual customer inquiries strain front-desk bandwidth and slow speed-to-lead."
            why_this_service = (
                "Deploying a custom AI agent automates FAQ triage and intake, ensuring rapid response times."
            )
        elif any("lead" in f.lower() or "delay" in f.lower() for f in unique_frictions):
            recommended_service = "lead_automation"
            primary_problem = "Inbound lead distribution lacks instant speed-to-lead routing."
            why_this_service = (
                "Automated webhook routing notifies staff instantly upon new inquiries, drastically increasing close rates."
            )
        elif any("crm" in f.lower() or "system" in f.lower() for f in unique_frictions):
            recommended_service = "crm_workflow_automation"
            primary_problem = "Disconnected business systems require manual data entry across disconnected software."
            why_this_service = (
                "Integrating n8n workflows syncs client data seamlessly between lead capture, calendar, and CRM."
            )
        else:
            recommended_service = "business_automation"
            primary_problem = "Operational friction across customer intake and scheduling reduces conversion efficiency."
            why_this_service = (
                "Connecting digital lead capture, calendar scheduling, and automated reminders optimizes client acquisition."
            )

    return OpportunityScoreBreakdown(
        opportunity_score=round(final_score, 1),
        confidence=round(confidence, 3),
        primary_problem=primary_problem,
        recommended_service=recommended_service,
        why_this_service=why_this_service,
        research_status=research_status,
        limitations=limitations,
        scoring_components=components,
        detected_frictions=unique_frictions,
    )


__all__ = [
    "OpportunityScoreBreakdown",
    "calculate_opportunity_score",
]
