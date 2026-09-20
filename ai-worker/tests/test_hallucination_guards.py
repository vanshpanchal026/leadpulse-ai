"""Negative tests specifically verifying anti-hallucination guardrails and schema invariants.

Mandatory negative test suite asserting:
1. Website unavailable -> website_status = "unavailable" (NOT "poor website" or "bad booking system").
2. Ad spend / performance unavailable -> unknown / None (NOT "high ad spend", "$5000/mo", or fabricated ROAS).
3. Review text unavailable -> review sentiment = "unknown" / None (NOT "customers complain about wait times").
4. Observed vs Inferred vs Unknown classification discipline.
"""

import pytest
from pydantic import ValidationError

from app.schemas.evidence import (
    Evidence,
    WebsiteAnalysisResult,
    AdsAnalysisResult,
    MapsAnalysisResult,
)
from app.agents.specialists.website_agent import (
    build_no_website_result,
    build_unavailable_website_result,
)
from app.agents.specialists.ads_agent import build_no_ads_result
from app.agents.specialists.maps_agent import build_unavailable_maps_result


class TestWebsiteHallucinationGuards:
    """Negative tests asserting website absence does not fabricate quality critiques."""

    def test_unavailable_website_does_not_infer_poor_website(self):
        res = build_unavailable_website_result(
            url="https://unreachable-domain-12345.com",
            error_reason="Connection timed out after 5.0s"
        )
        assert res.status == "unavailable"
        assert res.has_booking_system is None
        assert res.has_whatsapp_cta is None
        assert res.primary_cta is None

        # Assert no negative claims about business or website quality exist in findings
        for finding in res.findings:
            lower = finding.lower()
            assert "poor website" not in lower
            assert "bad website" not in lower
            assert "broken booking" not in lower
            assert "bad booking system" not in lower
            assert "unprofessional" not in lower

    def test_schema_rejects_observed_features_on_unavailable_website(self):
        # A model or agent cannot emit has_booking_system=True when status='unavailable'
        with pytest.raises(ValidationError):
            WebsiteAnalysisResult(
                status="unavailable",
                findings=["Site was down"],
                confidence=0.1,
                has_booking_system=True  # Hallucination!
            )

        with pytest.raises(ValidationError):
            WebsiteAnalysisResult(
                status="unavailable",
                findings=["Site unreachable"],
                confidence=0.1,
                has_whatsapp_cta=True  # Hallucination!
            )

    def test_no_website_does_not_infer_poor_website(self):
        res = build_no_website_result("No website URL provided")
        assert res.status == "no_website"
        assert res.has_booking_system is None
        assert res.has_whatsapp_cta is None
        assert res.primary_cta is None
        assert len(res.friction_points) == 0

        for finding in res.findings:
            lower = finding.lower()
            assert "poor website" not in lower
            assert "bad website" not in lower
            assert "broken booking" not in lower
            assert "slow" not in lower

    def test_schema_rejects_observed_features_on_no_website(self):
        # A model cannot report observed booking, whatsapp, cta or friction when status='no_website'
        with pytest.raises(ValidationError):
            WebsiteAnalysisResult(
                status="no_website",
                findings=["No website URL provided"],
                confidence=0.1,
                has_booking_system=True  # Hallucination!
            )

        with pytest.raises(ValidationError):
            WebsiteAnalysisResult(
                status="no_website",
                findings=["No website URL provided"],
                confidence=0.1,
                has_whatsapp_cta=True  # Hallucination!
            )

        with pytest.raises(ValidationError):
            WebsiteAnalysisResult(
                status="no_website",
                findings=["No website URL provided"],
                confidence=0.1,
                primary_cta="Book Now"  # Hallucination!
            )

        with pytest.raises(ValidationError):
            WebsiteAnalysisResult(
                status="no_website",
                findings=["No website URL provided"],
                confidence=0.1,
                friction_points=["Slow load speed"]  # Hallucination!
            )

    def test_outreach_rejects_slow_site_pitch_when_no_website(self):
        from app.services.outreach_validator import validate_outreach
        from app.schemas.lead_analysis import LeadAnalysis

        evidence = [
            Evidence(
                source="website",
                finding="No website exists or was provided for this business",
                evidence="Candidate data lacked website URL",
                confidence=0.9,
                classification="observed",
            )
        ]
        la = LeadAnalysis(
            business_name="Apex Smile Clinic",
            qualification_status="qualified",
            priority="high",
            prospect_score=8.0,
            opportunity_score=80.0,
            primary_problem="Business lacks a website and online presence to capture local search inquiries",
            recommended_service="website_development",
            why_this_service="Building an online presence captures prospective patients searching online",
            evidence=evidence,
            confidence=0.9,
            research_status="complete",
            limitations=["No website available for this business record"],
        )

        # Hallucinated pitch claiming the website is slow when none exists
        bad_msg = (
            "I noticed your website is slow to load for mobile patients in Gurgaon. "
            "Speeding up your site could help book more dental appointments."
        )
        result = validate_outreach(
            message=bad_msg,
            service="website_development",
            evidence=evidence,
            lead_analysis=la,
        )
        assert result.valid is False
        assert result.unsupported_claim_detected is True
        assert any("no website" in r.lower() or "slow" in r.lower() for r in result.reasons)


class TestAdsHallucinationGuards:
    """Negative tests asserting zero metric fabrication in advertising intelligence."""

    def test_no_ads_candidate_produces_zero_metrics(self):
        res = build_no_ads_result(business_name="Test Clinic")
        assert res.status == "no_ads"
        assert res.active_ad_count == 0
        assert res.ad_spend is None
        assert res.roas is None
        assert res.conversion_rate is None
        assert res.cac is None
        assert res.impressions is None

        for finding in res.findings:
            lower = finding.lower()
            assert "high ad spend" not in lower
            assert "low roas" not in lower
            assert "$" not in lower

    @pytest.mark.parametrize("forbidden_field,fabricated_val", [
        ("ad_spend", "$5000/month"),
        ("ad_spend", "1000 USD"),
        ("roas", "3.5x"),
        ("roas", "400%"),
        ("conversion_rate", "2.8%"),
        ("cac", "$120 per lead"),
        ("impressions", "50,000"),
    ])
    def test_schema_strictly_rejects_fabricated_performance_metrics(
        self, forbidden_field: str, fabricated_val: str
    ):
        kwargs = {
            "status": "active_ads",
            "findings": ["Active promotions observed"],
            "confidence": 0.8,
            forbidden_field: fabricated_val
        }
        with pytest.raises(ValidationError, match="Anti-hallucination guard"):
            AdsAnalysisResult(**kwargs)


class TestMapsHallucinationGuards:
    """Negative tests asserting zero sentiment fabrication without review text."""

    def test_unavailable_maps_produces_unknown_sentiment(self):
        res = build_unavailable_maps_result(business_name="Test Clinic")
        assert res.status == "unavailable"
        assert res.rating is None
        assert res.review_count is None
        assert res.review_sentiment is None

        for finding in res.findings:
            lower = finding.lower()
            assert "customers complain" not in lower
            assert "long wait times" not in lower
            assert "rude staff" not in lower
            assert "highly rated" not in lower
            assert "poorly rated" not in lower

    def test_maps_result_without_reviews_keeps_sentiment_unknown(self):
        res = MapsAnalysisResult(
            status="verified",
            findings=["Verified location with 4.8 rating"],
            evidence=[
                Evidence(
                    finding="Verified rating",
                    source="maps",
                    evidence="Rating: 4.8, Reviews: 100",
                    confidence=1.0,
                    classification="observed"
                )
            ],
            confidence=0.9,
            rating=4.8,
            review_count=100,
            review_sentiment="unknown"  # Explicitly unknown since no review body was provided
        )
        assert res.review_sentiment == "unknown"


class TestEvidenceClassificationInvariants:
    """Negative tests asserting strict boundaries on Evidence classifications."""

    def test_evidence_classification_cannot_be_arbitrary(self):
        with pytest.raises(ValidationError):
            Evidence(
                finding="Some claim",
                source="website",
                evidence="Supporting text",
                confidence=0.8,
                classification="assumed"  # Invalid! Must be observed, inferred, or unknown
            )

    def test_confidence_strictly_bounded(self):
        with pytest.raises(ValidationError):
            Evidence(
                finding="Some claim",
                source="website",
                evidence="Supporting text",
                confidence=1.5,  # Invalid! Max 1.0
                classification="observed"
            )

        with pytest.raises(ValidationError):
            Evidence(
                finding="Some claim",
                source="website",
                evidence="Supporting text",
                confidence=-0.01,  # Invalid! Min 0.0
                classification="observed"
            )

    def test_observed_cannot_be_empty_or_unknown_placeholder(self):
        # Section 16: "Observed != Inferred != Unknown" and Section 4: "Unknown must never be converted into observed"
        with pytest.raises(ValidationError, match="Observed findings require actual supporting data"):
            Evidence(
                finding="Observed appointment button",
                source="website",
                evidence="unknown",  # Contradiction: cannot be observed with unknown evidence
                confidence=0.8,
                classification="observed"
            )

        with pytest.raises(ValidationError, match="Observed findings require actual supporting data"):
            Evidence(
                finding="Observed appointment button",
                source="website",
                evidence="None",
                confidence=0.8,
                classification="observed"
            )

    def test_maps_strictly_rejects_complaints_without_review_text(self):
        # Section 13: "review text unavailable -> review sentiment = unknown, NOT: customers complain about..."
        with pytest.raises(ValidationError, match="Cannot report review_sentiment"):
            MapsAnalysisResult(
                status="verified",
                findings=["Verified business"],
                confidence=0.9,
                review_sentiment="Customers complain about rude front desk",
                reviews_provided=False  # No review text provided!
            )

    def test_maps_strictly_rejects_rating_claims_without_rating_number(self):
        # Section 3: "Do NOT claim a business is 'highly rated' or 'poorly rated' without the actual rating data."
        with pytest.raises(ValidationError, match="without actual numeric rating data"):
            MapsAnalysisResult(
                status="verified",
                findings=["Highly rated salon in DLF Phase 5"],
                confidence=0.9,
                rating=None  # No rating data!
            )

    def test_ads_strictly_rejects_revenue_and_campaign_performance(self):
        # Section 3: "Never invent: ad spend, ROAS, conversion rate, CAC, impressions, revenue, campaign performance"
        with pytest.raises(ValidationError, match="Forbidden metric 'revenue'"):
            AdsAnalysisResult(
                status="active_ads",
                findings=["Active ads"],
                confidence=0.9,
                revenue="50000 USD"
            )

        with pytest.raises(ValidationError, match="Forbidden metric 'campaign_performance'"):
            AdsAnalysisResult(
                status="active_ads",
                findings=["Active ads"],
                confidence=0.9,
                campaign_performance="High ROAS"
            )

    def test_website_unavailable_strictly_rejects_primary_cta_and_poor_quality_inference(self):
        # Section 3: "Do NOT infer that the business has a bad website simply because the site could not be reached."
        with pytest.raises(ValidationError, match="Cannot infer poor website quality"):
            WebsiteAnalysisResult(
                status="unavailable",
                findings=["Business has a bad website"],
                confidence=0.1
            )

        with pytest.raises(ValidationError, match="Cannot report primary_cta"):
            WebsiteAnalysisResult(
                status="unavailable",
                findings=["Site unreachable"],
                confidence=0.1,
                primary_cta="Schedule Now"
            )
