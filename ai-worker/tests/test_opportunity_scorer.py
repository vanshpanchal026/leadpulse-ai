"""Unit tests for the Deterministic Opportunity Scorer."""

import pytest

from app.schemas.evidence import (
    Evidence,
    LeadTriageResult,
    WebsiteAnalysisResult,
    AdsAnalysisResult,
    MapsAnalysisResult,
    SpecialistResearchAggregate,
)
from app.services.deterministic_pipeline import NormalizedCandidate
from app.services.opportunity_scorer import (
    OpportunityScoreBreakdown,
    calculate_opportunity_score,
)


def _make_candidate(
    business_name: str = "Elite Aesthetic Clinic",
    business_type: str = "Cosmetic Surgery & Dermatology",
    source_platform: str = "google_maps",
    website_url: str = "https://eliteaesthetic.com",
    scorecard_score: int = 8,
    priority_tier: str = "immediate",
    has_active_ads: bool = True,
    rating: float = 4.8,
    review_count: int = 125,
    friction_points: list[str] = None,
) -> NormalizedCandidate:
    return NormalizedCandidate(
        business_name=business_name,
        business_type=business_type,
        source_platform=source_platform,  # type: ignore[arg-type]
        source_url="https://maps.google.com/?cid=123",
        website_url=website_url,
        scorecard_score=scorecard_score,
        priority_tier=priority_tier,  # type: ignore[arg-type]
        has_active_ads=has_active_ads,
        rating=rating,
        review_count=review_count,
        friction_points=friction_points or ["Slow intake response", "Manual appointment scheduling"],
    )


class TestOpportunityScorer:
    """Tests asserting deterministic, reproducible opportunity scoring."""

    def test_reproducible_scoring_across_repeated_runs(self):
        candidate = _make_candidate()
        aggregate = SpecialistResearchAggregate(
            business_name=candidate.business_name,
            triage_result=LeadTriageResult(
                qualified=True,
                priority="high",
                reason="High-ticket clinic",
                research_agents=["website", "ads", "maps"]
            ),
            website_analysis=WebsiteAnalysisResult(
                status="available",
                findings=["Clean site"],
                has_booking_system=False,
                has_whatsapp_cta=False,
                primary_cta="Call Us",
                confidence=0.9
            ),
            ads_analysis=AdsAnalysisResult(
                status="active_ads",
                active_ad_count=4,
                findings=["Active promotional offers"],
                confidence=0.85
            ),
            maps_analysis=MapsAnalysisResult(
                status="verified",
                rating=4.8,
                review_count=125,
                findings=["Verified clinic"],
                confidence=0.95
            ),
            aggregated_evidence=[
                Evidence(
                    finding="Active ads running",
                    source="ads",
                    evidence="4 active campaigns",
                    confidence=0.9,
                    classification="observed"
                )
            ],
            execution_status={"website": "success", "ads": "success", "maps": "success"}
        )

        res1 = calculate_opportunity_score(candidate, aggregate)
        res2 = calculate_opportunity_score(candidate, aggregate)
        res3 = calculate_opportunity_score(candidate, aggregate)

        # Invariant: EXACT reproducibility
        assert res1.opportunity_score == res2.opportunity_score == res3.opportunity_score
        assert res1.confidence == res2.confidence == res3.confidence
        assert res1.recommended_service == res2.recommended_service == res3.recommended_service
        assert res1.scoring_components == res2.scoring_components

    def test_high_ticket_and_active_ads_earn_high_opportunity(self):
        candidate = _make_candidate(
            business_type="Dental Implants & Cosmetic Dentistry",
            has_active_ads=True,
            scorecard_score=9
        )
        aggregate = SpecialistResearchAggregate(
            business_name=candidate.business_name,
            triage_result=LeadTriageResult(qualified=True, priority="high", reason="Qualified", research_agents=["website", "ads"]),
            website_analysis=WebsiteAnalysisResult(
                status="available",
                has_booking_system=False,
                has_whatsapp_cta=False,
                confidence=0.9
            ),
            ads_analysis=AdsAnalysisResult(status="active_ads", active_ad_count=5, confidence=0.9),
            aggregated_evidence=[],
            execution_status={"website": "success", "ads": "success"}
        )

        breakdown = calculate_opportunity_score(candidate, aggregate)
        # High ticket (15) + High ads (20) + Missing booking (10) + Missing WhatsApp (10)
        # + Ad leak compounding (10) + High scorecard (20) + Reputation (10)
        assert breakdown.opportunity_score >= 80.0
        assert breakdown.opportunity_score <= 100.0
        assert breakdown.scoring_components["high_ticket_vertical"] == 15.0
        assert breakdown.scoring_components["active_ads_activity"] == 20.0
        assert breakdown.scoring_components["ad_traffic_funnel_leak"] == 10.0

    def test_empty_evidence_produces_low_score_and_low_confidence(self):
        # Disqualified / zero evidence candidate
        candidate = _make_candidate(
            website_url=None,
            scorecard_score=2,
            priority_tier="skip",
            has_active_ads=False,
            rating=0.0,
            review_count=0,
            friction_points=[]
        )
        breakdown = calculate_opportunity_score(candidate, None)

        assert breakdown.opportunity_score <= 20.0
        assert breakdown.confidence <= 0.20
        assert breakdown.research_status == "failed"
        assert len(breakdown.limitations) > 0

    def test_missing_website_recommends_website_development(self):
        candidate = _make_candidate(website_url=None, scorecard_score=6, priority_tier="high")
        aggregate = SpecialistResearchAggregate(
            business_name=candidate.business_name,
            triage_result=LeadTriageResult(qualified=True, priority="medium", reason="Needs web presence", research_agents=["maps"]),
            maps_analysis=MapsAnalysisResult(status="verified", rating=4.6, review_count=45, confidence=0.9),
            execution_status={"maps": "success"}
        )
        breakdown = calculate_opportunity_score(candidate, aggregate)
        assert breakdown.recommended_service == "website_development"
        assert "website" in breakdown.primary_problem.lower()

    def test_active_ads_without_whatsapp_recommends_whatsapp_automation(self):
        candidate = _make_candidate(has_active_ads=True)
        aggregate = SpecialistResearchAggregate(
            business_name=candidate.business_name,
            triage_result=LeadTriageResult(qualified=True, priority="high", reason="Active ads", research_agents=["website", "ads"]),
            website_analysis=WebsiteAnalysisResult(
                status="available",
                has_booking_system=True,
                has_whatsapp_cta=False,
                confidence=0.85
            ),
            ads_analysis=AdsAnalysisResult(status="active_ads", active_ad_count=2, confidence=0.85),
            execution_status={"website": "success", "ads": "success"}
        )
        breakdown = calculate_opportunity_score(candidate, aggregate)
        assert breakdown.recommended_service == "whatsapp_automation"
        assert "whatsapp" in breakdown.why_this_service.lower()

    def test_specialist_partial_failure_scales_confidence_and_records_limitations(self):
        candidate = _make_candidate()
        aggregate = SpecialistResearchAggregate(
            business_name=candidate.business_name,
            triage_result=LeadTriageResult(qualified=True, priority="high", reason="Qualified", research_agents=["website", "ads", "maps"]),
            website_analysis=WebsiteAnalysisResult(status="available", confidence=0.8),
            ads_analysis=AdsAnalysisResult(status="error", findings=["Worker timeout after 60s"], confidence=0.1),
            maps_analysis=MapsAnalysisResult(status="verified", confidence=0.85),
            execution_status={"website": "success", "ads": "timeout: WorkerTimeoutError", "maps": "success"}
        )
        breakdown = calculate_opportunity_score(candidate, aggregate)
        assert breakdown.research_status == "partial"
        assert breakdown.confidence <= 0.65
        assert any("ads" in lim.lower() for lim in breakdown.limitations)

    def test_blocked_by_campaign_limits_records_limitations(self):
        candidate = _make_candidate()
        aggregate = SpecialistResearchAggregate(
            business_name=candidate.business_name,
            triage_result=LeadTriageResult(qualified=True, priority="high", reason="Qualified", research_agents=["website", "ads"]),
            website_analysis=WebsiteAnalysisResult(status="available", confidence=0.8),
            execution_status={"website": "success", "ads": "blocked_by_campaign_limits"}
        )
        breakdown = calculate_opportunity_score(candidate, aggregate)
        assert breakdown.research_status == "partial"
        assert any("ads" in lim.lower() and "blocked" in lim.lower() for lim in breakdown.limitations)

    def test_all_scoring_category_bounds_strictly_enforced(self):
        """Enforces: Commercial Maturity <= 25, Marketing Activity <= 20, Conversion Friction <= 35, Scorecard <= 20, Final <= 100."""
        candidate = _make_candidate(
            business_type="Cosmetic Surgery Clinic",
            scorecard_score=10,
            has_active_ads=True,
            rating=5.0,
            review_count=500,
            friction_points=[f"Friction point {i}" for i in range(10)]
        )
        aggregate = SpecialistResearchAggregate(
            business_name=candidate.business_name,
            triage_result=LeadTriageResult(qualified=True, priority="high", reason="High ticket", research_agents=["website", "ads", "maps"]),
            website_analysis=WebsiteAnalysisResult(
                status="available",
                has_booking_system=False,
                has_whatsapp_cta=False,
                primary_cta="None",
                friction_points=[f"Website friction {i}" for i in range(10)],
                confidence=0.9
            ),
            ads_analysis=AdsAnalysisResult(status="active_ads", active_ad_count=10, confidence=0.9),
            maps_analysis=MapsAnalysisResult(status="verified", rating=5.0, review_count=500, confidence=0.9),
            aggregated_evidence=[],
            execution_status={"website": "success", "ads": "success", "maps": "success"}
        )

        breakdown = calculate_opportunity_score(candidate, aggregate)
        comps = breakdown.scoring_components

        # 1. Commercial Maturity <= 25
        comm_maturity = comps.get("high_ticket_vertical", 0.0) + comps.get("reputation_bonus", 0.0)
        assert comm_maturity <= 25.0

        # 2. Marketing Activity <= 20
        marketing_act = comps.get("active_ads_activity", 0.0)
        assert marketing_act <= 20.0

        # 3. Conversion Friction <= 35
        friction_keys = [
            "missing_website_friction",
            "missing_booking_friction",
            "missing_whatsapp_friction",
            "weak_cta_friction",
            "ad_traffic_funnel_leak",
            "observed_frictions_bonus",
            "conversion_friction_cap_adjustment",
        ]
        total_friction = sum(comps.get(k, 0.0) for k in friction_keys)
        assert total_friction <= 35.0

        # 4. V1 Scorecard Alignment <= 20
        scorecard_align = comps.get("scorecard_score_bonus", 0.0)
        assert scorecard_align <= 20.0

        # 5. Final Opportunity Score <= 100
        assert breakdown.opportunity_score <= 100.0
        assert breakdown.opportunity_score == 100.0

    def test_pitch_angle_distinguishes_no_website_from_unavailable(self):
        # 1. Candidate with no website at all (no_website)
        cand_no_web = _make_candidate(website_url=None, scorecard_score=7)
        agg_no_web = SpecialistResearchAggregate(
            business_name=cand_no_web.business_name,
            triage_result=LeadTriageResult(qualified=True, priority="high", reason="High ticket", research_agents=["website", "ads"]),
            website_analysis=WebsiteAnalysisResult(
                status="no_website",
                findings=["No website exists"],
                confidence=0.1,
                limitations=["No website available"],
            ),
            ads_analysis=AdsAnalysisResult(status="no_ads", active_ad_count=0, confidence=0.8),
            execution_status={"website": "no_url", "ads": "success"}
        )
        score_no_web = calculate_opportunity_score(cand_no_web, agg_no_web)
        assert score_no_web.recommended_service == "website_development"
        assert "lacks a website" in score_no_web.primary_problem.lower() or "search" in score_no_web.primary_problem.lower()
        assert "search" in score_no_web.why_this_service.lower() or "discoverability" in score_no_web.why_this_service.lower()

        # 2. Candidate with existing website that failed to fetch (unavailable)
        cand_unavail = _make_candidate(website_url="https://broken-site-123.com", scorecard_score=7)
        agg_unavail = SpecialistResearchAggregate(
            business_name=cand_unavail.business_name,
            triage_result=LeadTriageResult(qualified=True, priority="high", reason="High ticket", research_agents=["website", "ads"]),
            website_analysis=WebsiteAnalysisResult(
                status="unavailable",
                findings=["Site could not be reached"],
                confidence=0.1,
                limitations=["Connection timed out"],
            ),
            ads_analysis=AdsAnalysisResult(status="no_ads", active_ad_count=0, confidence=0.8),
            execution_status={"website": "fetch_failed", "ads": "success"}
        )
        score_unavail = calculate_opportunity_score(cand_unavail, agg_unavail)
        assert score_unavail.recommended_service == "website_development"
        assert "unreachable" in score_unavail.primary_problem.lower() or "failing to load" in score_unavail.primary_problem.lower()
        assert "downtime" in score_unavail.why_this_service.lower() or "reliable" in score_unavail.why_this_service.lower()

