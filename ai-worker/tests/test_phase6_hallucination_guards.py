"""LeadPulse AI V2 — Phase 6 Mandatory Negative Anti-Hallucination Guardrail Tests.

Specifically asserts the 12 mandatory negative tests defined in Phase 6 requirements:
1. Missing Ads data -> no invented ad spend.
2. Missing ROAS -> no invented ROAS.
3. Missing review text -> no invented review sentiment.
4. Website unavailable -> no claim that website is bad.
5. Booking path unknown -> must remain unknown.
6. Specialist failure -> final status becomes partial, not fabricated.
7. Empty evidence -> low confidence / no fabricated opportunity.
8. Unsupported service -> rejected.
9. Opportunity score remains within 0–100.
10. Confidence remains within 0–1.
11. LLM cannot inject arbitrary services outside business profile.
12. LLM cannot turn unknown into observed.
"""

import pytest
from pydantic import ValidationError

from app.schemas.evidence import (
    Evidence,
    LeadTriageResult,
    WebsiteAnalysisResult,
    AdsAnalysisResult,
    MapsAnalysisResult,
    SpecialistResearchAggregate,
)
from app.schemas.opportunity import OpportunityResult, APPROVED_SERVICES
from app.schemas.lead_analysis import LeadAnalysis
from app.agents.specialists.website_agent import build_unavailable_website_result
from app.agents.specialists.ads_agent import build_no_ads_result, build_unavailable_ads_result
from app.agents.specialists.maps_agent import build_unavailable_maps_result
from app.services.deterministic_pipeline import NormalizedCandidate
from app.services.opportunity_scorer import calculate_opportunity_score
from app.services.opportunity_orchestrator import OpportunityOrchestratorService


def _candidate_helper(
    business_name: str = "Test Dental Care",
    score: int = 8,
    has_ads: bool = False,
    website: str = None,
) -> NormalizedCandidate:
    return NormalizedCandidate(
        business_name=business_name,
        business_type="Dental Clinic",
        source_platform="google_maps",
        source_url="https://maps.google.com/?cid=12345",
        website_url=website,
        scorecard_score=score,
        priority_tier="high" if score >= 4 else "skip",
        has_active_ads=has_ads,
        rating=4.5,
        review_count=30,
        friction_points=[],
    )


class TestPhase6MandatoryNegativeGuards:
    """The 12 mandatory negative anti-hallucination tests for Phase 6."""

    # -------------------------------------------------------------------------
    # 1. Missing Ads data -> no invented ad spend
    # -------------------------------------------------------------------------
    def test_01_missing_ads_data_no_invented_ad_spend(self):
        """When Meta Ads data is absent or unavailable, ad spend must remain None and never invented."""
        ads_res = build_no_ads_result(business_name="Test Clinic")
        assert ads_res.ad_spend is None
        assert ads_res.status == "no_ads"

        # Attempting to populate ad_spend on AdsAnalysisResult must fail
        with pytest.raises(ValidationError):
            AdsAnalysisResult(
                status="no_ads",
                confidence=0.8,
                ad_spend="$5000/month"  # Forbidden metric fabrication!
            )

        # OpportunityResult evidence must also reject fabricated ad spend claims in observed evidence
        with pytest.raises(ValidationError):
            OpportunityResult(
                opportunity_score=70.0,
                primary_problem="Problem",
                recommended_service="lead_automation",
                why_this_service="Why",
                evidence=[
                    Evidence(
                        finding="Client has high ad spend",
                        source="ads",
                        evidence="Estimated ad spend $10,000/mo",  # Hallucinated!
                        confidence=0.9,
                        classification="observed"
                    )
                ],
                confidence=0.75
            )

    # -------------------------------------------------------------------------
    # 2. Missing ROAS -> no invented ROAS
    # -------------------------------------------------------------------------
    def test_02_missing_roas_no_invented_roas(self):
        """ROAS data does not exist in public ad scrapers; inventing ROAS is strictly prohibited."""
        with pytest.raises(ValidationError):
            AdsAnalysisResult(
                status="active_ads",
                confidence=0.8,
                roas="4.2x"  # Forbidden metric fabrication!
            )

        with pytest.raises(ValidationError):
            OpportunityResult(
                opportunity_score=65.0,
                primary_problem="Problem",
                recommended_service="lead_automation",
                why_this_service="Why",
                evidence=[
                    Evidence(
                        finding="Poor ROAS observed",
                        source="ads",
                        evidence="Observed ROAS: 1.2x",  # Forbidden metric!
                        confidence=0.8,
                        classification="observed"
                    )
                ],
                confidence=0.7
            )

    # -------------------------------------------------------------------------
    # 3. Missing review text -> no invented review sentiment
    # -------------------------------------------------------------------------
    def test_03_missing_review_text_no_invented_review_sentiment(self):
        """When customer review text is absent, review_sentiment must remain None or unknown."""
        maps_res = build_unavailable_maps_result(business_name="Test Business", reason="No reviews scraped")
        assert maps_res.review_sentiment is None
        assert maps_res.reviews_provided is False

        # Attempting to supply review sentiment without reviews_provided=True raises ValidationError
        with pytest.raises(ValidationError) as excinfo:
            MapsAnalysisResult(
                status="verified",
                rating=4.5,
                review_count=50,
                confidence=0.8,
                reviews_provided=False,
                review_sentiment="Customers complain about long waiting times"  # Hallucinated!
            )
        assert "Cannot report review_sentiment" in str(excinfo.value)

    # -------------------------------------------------------------------------
    # 4. Website unavailable -> no claim that website is bad
    # -------------------------------------------------------------------------
    def test_04_website_unavailable_no_claim_website_is_bad(self):
        """When a website cannot be reached, the system must not infer that the website quality is poor."""
        web_res = build_unavailable_website_result(
            url="https://unreachable-clinic-site.com",
            error_reason="Connection timed out after 6.0s",
            status="unavailable"
        )
        assert web_res.status == "unavailable"
        assert web_res.has_booking_system is None
        assert web_res.has_whatsapp_cta is None
        assert web_res.primary_cta is None

        for text in web_res.findings + web_res.limitations:
            lower = text.lower()
            assert "poor website" not in lower
            assert "bad website" not in lower
            assert "unprofessional" not in lower
            assert "broken booking" not in lower

    # -------------------------------------------------------------------------
    # 5. Booking path unknown -> must remain unknown
    # -------------------------------------------------------------------------
    def test_05_booking_path_unknown_must_remain_unknown(self):
        """If a website was not reachable, has_booking_system cannot be claimed as True."""
        with pytest.raises(ValidationError) as excinfo:
            WebsiteAnalysisResult(
                status="unavailable",
                confidence=0.1,
                has_booking_system=True  # Hallucination: site was never loaded!
            )
        assert "Cannot report has_booking_system=True when website is unavailable" in str(excinfo.value)

    # -------------------------------------------------------------------------
    # 6. Specialist failure -> final status becomes partial, not fabricated
    # -------------------------------------------------------------------------
    def test_06_specialist_failure_final_status_becomes_partial_not_fabricated(self):
        """When one specialist fails, research_status MUST be 'partial' with explicit limitation."""
        cand = _candidate_helper(website="https://testclinic.com", has_ads=True)
        aggregate = SpecialistResearchAggregate(
            business_name=cand.business_name,
            triage_result=LeadTriageResult(qualified=True, priority="high", reason="Qualified", research_agents=["website", "ads"]),
            website_analysis=WebsiteAnalysisResult(status="available", confidence=0.85),
            ads_analysis=build_unavailable_ads_result(cand.business_name, "WorkerTimeoutError after 60.0s", status="error"),
            execution_status={"website": "success", "ads": "timeout: WorkerTimeoutError"}
        )

        breakdown = calculate_opportunity_score(cand, aggregate)
        assert breakdown.research_status == "partial"
        assert any("ads" in lim.lower() for lim in breakdown.limitations)

        # LeadAnalysis schema rejects research_status='partial' if limitations is empty
        with pytest.raises(ValidationError):
            LeadAnalysis(
                business_name=cand.business_name,
                qualification_status="qualified",
                priority="high",
                prospect_score=8.0,
                opportunity_score=75.0,
                primary_problem="Problem",
                recommended_service="website_development",
                why_this_service="Why",
                confidence=0.6,
                research_status="partial",
                limitations=[]  # Missing limitations!
            )

        # LeadAnalysis strictly rejects claiming active heavy ad spend when Ads research is unavailable
        with pytest.raises(ValidationError) as excinfo:
            LeadAnalysis(
                business_name=cand.business_name,
                qualification_status="qualified",
                priority="high",
                prospect_score=8.0,
                opportunity_score=75.0,
                primary_problem="Business is spending heavily on Meta Ads without booking",  # Fabricated claim!
                recommended_service="booking_automation",
                why_this_service="Why",
                confidence=0.6,
                research_status="partial",
                limitations=["Ads research unavailable due to timeout"]
            )
        assert "Cannot claim active or heavy ad spend when Ads research is recorded as unavailable" in str(excinfo.value)

    # -------------------------------------------------------------------------
    # 7. Empty evidence -> low confidence / no fabricated opportunity
    # -------------------------------------------------------------------------
    def test_07_empty_evidence_low_confidence_no_fabricated_opportunity(self):
        """If evidence is empty, opportunity score must be low and confidence <= 0.20."""
        empty_candidate = _candidate_helper(score=2, has_ads=False, website=None)
        breakdown = calculate_opportunity_score(empty_candidate, None)

        assert breakdown.opportunity_score <= 20.0
        assert breakdown.confidence <= 0.20
        assert breakdown.research_status == "failed"
        assert "insufficient" in breakdown.primary_problem.lower()

    # -------------------------------------------------------------------------
    # 8. Unsupported service -> rejected
    # -------------------------------------------------------------------------
    def test_08_unsupported_service_rejected(self):
        """Services outside the approved canonical business profile are strictly rejected."""
        with pytest.raises(ValidationError) as excinfo:
            OpportunityResult(
                opportunity_score=80.0,
                primary_problem="Weak online branding",
                recommended_service="search_engine_optimization",  # Not in profile!
                why_this_service="SEO improves rank.",
                evidence=[],
                confidence=0.8
            )
        assert "not an approved LeadPulse business profile service" in str(excinfo.value)

    # -------------------------------------------------------------------------
    # 9. Opportunity score remains within 0–100
    # -------------------------------------------------------------------------
    @pytest.mark.parametrize("invalid_score", [-10.0, -0.1, 100.1, 150.0, 999.0])
    def test_09_opportunity_score_remains_within_0_to_100(self, invalid_score: float):
        """Opportunity score must be bounded between 0.0 and 100.0."""
        with pytest.raises(ValidationError):
            OpportunityResult(
                opportunity_score=invalid_score,
                primary_problem="Problem",
                recommended_service="lead_automation",
                why_this_service="Why",
                confidence=0.5
            )

        with pytest.raises(ValidationError):
            LeadAnalysis(
                business_name="Test Corp",
                qualification_status="qualified",
                priority="medium",
                prospect_score=5.0,
                opportunity_score=invalid_score,
                primary_problem="Problem",
                recommended_service="lead_automation",
                why_this_service="Why",
                confidence=0.5,
                research_status="complete",
                limitations=[]
            )

    # -------------------------------------------------------------------------
    # 10. Confidence remains within 0–1
    # -------------------------------------------------------------------------
    @pytest.mark.parametrize("invalid_conf", [-0.5, -0.01, 1.01, 2.0, 10.0])
    def test_10_confidence_remains_within_0_to_1(self, invalid_conf: float):
        """Confidence score must be bounded between 0.0 and 1.0."""
        with pytest.raises(ValidationError):
            OpportunityResult(
                opportunity_score=75.0,
                primary_problem="Problem",
                recommended_service="whatsapp_automation",
                why_this_service="Why",
                confidence=invalid_conf
            )

        with pytest.raises(ValidationError):
            LeadAnalysis(
                business_name="Test Corp",
                qualification_status="qualified",
                priority="high",
                prospect_score=8.0,
                opportunity_score=80.0,
                primary_problem="Problem",
                recommended_service="whatsapp_automation",
                why_this_service="Why",
                confidence=invalid_conf,
                research_status="complete",
                limitations=[]
            )

    # -------------------------------------------------------------------------
    # 11. LLM cannot inject arbitrary services outside business profile
    # -------------------------------------------------------------------------
    @pytest.mark.parametrize("injected_service", [
        "cold_email_campaigns",
        "crypto_trading_bot",
        "drop_shipping_store",
        "tiktok_marketing",
        "pr_management",
        "telemarketing",
    ])
    def test_11_llm_cannot_inject_arbitrary_services_outside_business_profile(self, injected_service: str):
        """Arbitrary LLM-injected services fail validation and cannot enter the pipeline."""
        with pytest.raises(ValidationError) as excinfo:
            OpportunityResult(
                opportunity_score=85.0,
                primary_problem="Problem",
                recommended_service=injected_service,
                why_this_service="Why",
                confidence=0.8
            )
        assert "not an approved LeadPulse business profile service" in str(excinfo.value)

    # -------------------------------------------------------------------------
    # 12. LLM cannot turn unknown into observed
    # -------------------------------------------------------------------------
    @pytest.mark.parametrize("placeholder", ["unknown", "none", "n/a", "not available", "unavailable"])
    def test_12_llm_cannot_turn_unknown_into_observed(self, placeholder: str):
        """Evidence schema strictly rejects classification='observed' with placeholder data."""
        with pytest.raises(ValidationError) as excinfo:
            Evidence(
                finding="Online booking system status is unknown",
                source="website",
                evidence=placeholder,  # Missing/placeholder evidence!
                confidence=0.5,
                classification="observed"  # Violation!
            )
        assert "Cannot have classification='observed' with placeholder evidence" in str(excinfo.value)
