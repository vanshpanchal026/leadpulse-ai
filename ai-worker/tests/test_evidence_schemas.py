"""Unit tests for Phase 5 Evidence, Triage, and Specialist Output Schemas."""

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
from app.schemas.agent import TokenUsage


class TestEvidenceSchema:
    """Validation tests for the foundational Evidence model."""

    def test_valid_observed_evidence(self):
        ev = Evidence(
            finding="Observed online booking button via Calendly",
            source="website",
            evidence="Anchor tag with href='https://calendly.com/dr-smith'",
            confidence=0.95,
            classification="observed"
        )
        assert ev.finding == "Observed online booking button via Calendly"
        assert ev.source == "website"
        assert ev.confidence == 0.95
        assert ev.classification == "observed"

    def test_valid_inferred_evidence(self):
        ev = Evidence(
            finding="Manual intake process likely causing lead drop-off",
            source="reddit",
            evidence="Owner posted: 'I get 20 DMs a day on WhatsApp and lose track of half of them'",
            confidence=0.8,
            classification="inferred"
        )
        assert ev.classification == "inferred"

    def test_confidence_boundary_enforcement(self):
        # Confidence must be between 0.0 and 1.0
        with pytest.raises(ValidationError):
            Evidence(
                finding="Some finding",
                source="website",
                evidence="Evidence text",
                confidence=1.05,  # > 1.0
                classification="observed"
            )

        with pytest.raises(ValidationError):
            Evidence(
                finding="Some finding",
                source="website",
                evidence="Evidence text",
                confidence=-0.1,  # < 0.0
                classification="observed"
            )

    def test_empty_finding_or_evidence_rejected(self):
        with pytest.raises(ValidationError):
            Evidence(
                finding="",
                source="maps",
                evidence="some evidence",
                confidence=0.5,
                classification="observed"
            )

        with pytest.raises(ValidationError):
            Evidence(
                finding="some finding",
                source="maps",
                evidence="   ",
                confidence=0.5,
                classification="observed"
            )

    def test_classification_normalization(self):
        ev = Evidence(
            finding="Review count is 142",
            source="maps",
            evidence="user_ratings_total: 142",
            confidence=1.0,
            classification="OBSERVED"  # Upper case should normalize
        )
        assert ev.classification == "observed"


class TestLeadTriageResultSchema:
    """Validation tests for the LeadTriageResult schema."""

    def test_valid_qualified_triage_result(self):
        res = LeadTriageResult(
            qualified=True,
            priority="high",
            reason="High-ticket aesthetic clinic with active ads and demonstrable booking friction",
            research_agents=["website", "ads", "maps"]
        )
        assert res.qualified is True
        assert res.priority == "high"
        assert "website" in res.research_agents
        assert "ads" in res.research_agents
        assert "maps" in res.research_agents

    def test_priority_normalization_and_synonyms(self):
        res = LeadTriageResult(
            qualified=True,
            priority="IMMEDIATE",  # Synonym mapped to 'high'
            reason="Urgent prospect",
            research_agents=["website"]
        )
        assert res.priority == "high"

        res_skip = LeadTriageResult(
            qualified=False,
            priority="skip",  # Synonym mapped to 'low'
            reason="Freelancer post",
            research_agents=[]
        )
        assert res_skip.priority == "low"

    def test_deduplicates_and_validates_research_agents(self):
        res = LeadTriageResult(
            qualified=True,
            priority="medium",
            reason="Valid clinic",
            research_agents=["website", "website", "ads", "invalid_agent"]
        )
        assert res.research_agents == ["website", "ads"]


class TestWebsiteAnalysisResultSchema:
    """Validation tests for Website Specialist output schema."""

    def test_valid_website_result(self):
        res = WebsiteAnalysisResult(
            status="available",
            findings=["Clear header CTA", "WhatsApp floating button present"],
            evidence=[
                Evidence(
                    finding="WhatsApp button",
                    source="website",
                    evidence="wa.me link in footer",
                    confidence=0.9,
                    classification="observed"
                )
            ],
            confidence=0.85,
            limitations=[],
            has_booking_system=True,
            has_whatsapp_cta=True,
            primary_cta="Book Consultation"
        )
        assert res.status == "available"
        assert res.has_booking_system is True
        assert res.has_whatsapp_cta is True

    def test_anti_hallucination_rejects_observed_features_when_unavailable(self):
        # Cannot report has_booking_system=True if website was unavailable
        with pytest.raises(ValidationError, match="Anti-hallucination guard"):
            WebsiteAnalysisResult(
                status="unavailable",
                findings=["Website down"],
                confidence=0.1,
                has_booking_system=True,  # Contradiction!
            )

        with pytest.raises(ValidationError, match="Anti-hallucination guard"):
            WebsiteAnalysisResult(
                status="error",
                findings=["HTTP 500"],
                confidence=0.1,
                has_whatsapp_cta=True,  # Contradiction!
            )


class TestAdsAnalysisResultSchema:
    """Validation tests for Ads Specialist output schema."""

    def test_valid_ads_result(self):
        res = AdsAnalysisResult(
            status="active_ads",
            findings=["Running smile makeover promo"],
            evidence=[
                Evidence(
                    finding="Active smile makeover campaign",
                    source="ads",
                    evidence="Creative text: '50% off dental implants this month'",
                    confidence=0.95,
                    classification="observed"
                )
            ],
            confidence=0.9,
            limitations=[],
            active_ad_count=2,
            ad_themes=["implant discount", "cosmetic smile"],
            observed_ctas=["Book Now"]
        )
        assert res.status == "active_ads"
        assert res.active_ad_count == 2

    def test_anti_hallucination_forbids_fabricated_metrics(self):
        # Agents cannot populate forbidden performance metrics
        with pytest.raises(ValidationError, match="Anti-hallucination guard"):
            AdsAnalysisResult(
                status="active_ads",
                findings=["Running ads"],
                confidence=0.9,
                ad_spend="$5000/month",  # FORBIDDEN!
            )

        with pytest.raises(ValidationError, match="Anti-hallucination guard"):
            AdsAnalysisResult(
                status="active_ads",
                findings=["Running ads"],
                confidence=0.9,
                roas="4.2x",  # FORBIDDEN!
            )


class TestMapsAnalysisResultSchema:
    """Validation tests for Maps Specialist output schema."""

    def test_valid_maps_result(self):
        res = MapsAnalysisResult(
            status="verified",
            findings=["Verified dental clinic with 4.8 rating"],
            evidence=[
                Evidence(
                    finding="High Google rating",
                    source="maps",
                    evidence="Rating: 4.8 across 140 reviews",
                    confidence=1.0,
                    classification="observed"
                )
            ],
            confidence=0.95,
            limitations=[],
            business_category="Dental clinic",
            rating=4.8,
            review_count=140,
            address="Sector 29, Gurgaon",
            website_present=True,
            review_sentiment="unknown"  # No review text provided, explicitly unknown
        )
        assert res.status == "verified"
        assert res.rating == 4.8
        assert res.review_sentiment == "unknown"


class TestSpecialistResearchAggregate:
    """Validation tests for complete multi-specialist research aggregate."""

    def test_aggregate_assembly(self):
        triage = LeadTriageResult(
            qualified=True,
            priority="high",
            reason="High ticket dental clinic with ads",
            research_agents=["website", "ads", "maps"]
        )
        site_ev = Evidence(
            finding="Calendly booking flow",
            source="website",
            evidence="calendly.com link",
            confidence=0.9,
            classification="observed"
        )
        site_res = WebsiteAnalysisResult(
            status="available",
            findings=["Online booking present"],
            evidence=[site_ev],
            confidence=0.9,
            has_booking_system=True
        )
        ads_ev = Evidence(
            finding="Active Invisalign ad",
            source="ads",
            evidence="Creative: Invisalign Consultation",
            confidence=0.95,
            classification="observed"
        )
        ads_res = AdsAnalysisResult(
            status="active_ads",
            findings=["Invisalign campaign"],
            evidence=[ads_ev],
            confidence=0.95,
            active_ad_count=1
        )
        aggregate = SpecialistResearchAggregate(
            business_name="Apex Dental Care",
            source_platform="google_maps",
            triage_result=triage,
            website_analysis=site_res,
            ads_analysis=ads_res,
            maps_analysis=None,
            aggregated_evidence=[site_ev, ads_ev],
            execution_status={"website": "success", "ads": "success", "maps": "timeout"},
            execution_time_ms=1240.5,
            token_usage=TokenUsage(prompt_tokens=800, completion_tokens=150, total_tokens=950)
        )
        assert aggregate.business_name == "Apex Dental Care"
        assert len(aggregate.aggregated_evidence) == 2
        assert aggregate.execution_status["maps"] == "timeout"
        assert aggregate.token_usage.total_tokens == 950

    def test_evidence_rejects_placeholder_text_for_observed_classification(self):
        # Invariant: Unknown must never be converted into observed
        with pytest.raises(ValidationError, match="Observed findings require actual supporting data"):
            Evidence(
                finding="Has booking system",
                source="website",
                evidence="unknown",
                confidence=0.8,
                classification="observed"
            )

        with pytest.raises(ValidationError, match="Observed findings require actual supporting data"):
            Evidence(
                finding="Has booking system",
                source="website",
                evidence="None",
                confidence=0.8,
                classification="observed"
            )

        with pytest.raises(ValidationError, match="Observed findings require actual supporting data"):
            Evidence(
                finding="Has booking system",
                source="website",
                evidence="N/A",
                confidence=0.8,
                classification="observed"
            )

    def test_website_schema_rejects_primary_cta_when_unavailable(self):
        with pytest.raises(ValidationError, match="Cannot report primary_cta"):
            WebsiteAnalysisResult(
                status="unavailable",
                findings=["Site down"],
                confidence=0.1,
                primary_cta="Book Consultation"
            )

    def test_website_schema_rejects_inferring_poor_quality_when_unavailable(self):
        with pytest.raises(ValidationError, match="Cannot infer poor website quality"):
            WebsiteAnalysisResult(
                status="unavailable",
                findings=["Business has a poor website"],
                confidence=0.1
            )

    def test_ads_schema_rejects_forbidden_revenue_and_performance(self):
        with pytest.raises(ValidationError, match="Forbidden metric 'revenue'"):
            AdsAnalysisResult(
                status="active_ads",
                findings=["Running ads"],
                confidence=0.9,
                revenue="$100,000"
            )

        with pytest.raises(ValidationError, match="Forbidden metric 'campaign_performance'"):
            AdsAnalysisResult(
                status="active_ads",
                findings=["Running ads"],
                confidence=0.9,
                campaign_performance="High conversion rate"
            )

    def test_maps_schema_rejects_fabricated_sentiment_without_reviews(self):
        with pytest.raises(ValidationError, match="Cannot report review_sentiment"):
            MapsAnalysisResult(
                status="verified",
                findings=["Verified clinic"],
                confidence=0.9,
                review_sentiment="Customers complain of long wait times",
                reviews_provided=False
            )

    def test_maps_schema_rejects_highly_rated_claim_without_numeric_rating(self):
        with pytest.raises(ValidationError, match="Cannot claim 'Highly rated dental clinic' without actual numeric rating"):
            MapsAnalysisResult(
                status="verified",
                findings=["Highly rated dental clinic"],
                confidence=0.9,
                rating=None
            )
