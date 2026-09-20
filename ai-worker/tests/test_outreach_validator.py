"""Unit tests for the Deterministic Outreach Validator."""

import pytest
from app.schemas.evidence import Evidence
from app.services.outreach_validator import (
    validate_outreach,
    count_sentences,
    MAX_CHARACTER_LIMIT,
)


class TestOutreachValidator:
    """Test suite asserting strict deterministic anti-spam and quality validation."""

    def test_valid_draft_passes_all_checks(self):
        msg = (
            "I noticed Radiant Dental has a strong 4.9 rating on Google with over 100 patient reviews. "
            "However, prospective clients visiting from your Instagram ads cannot book appointments online. "
            "Adding direct calendar scheduling could capture those after-hours inquiries."
        )
        res = validate_outreach(msg, service="booking_automation")
        assert res.valid is True
        assert res.character_count <= MAX_CHARACTER_LIMIT
        assert res.sentence_count == 3
        assert len(res.reasons) == 0
        assert res.banned_phrase_found is False
        assert res.placeholder_detected is False
        assert res.unsupported_service is False

    def test_sentence_counter_handles_honorifics_and_decimals(self):
        text = "I checked Dr. Smith's practice and noticed a 4.8 star rating on Google Maps. However, the site lacks a WhatsApp chat CTA."
        # Dr. and 4.8 must not create false sentence splits
        count = count_sentences(text)
        assert count == 2

    def test_rejection_when_exceeding_character_limit(self):
        # 301 characters of valid English sentences
        msg = (
            "I noticed your aesthetic clinic is running active paid promotional campaigns across Instagram and Facebook. "
            "However, visitors who land on your website cannot easily schedule their consultations online after business hours. "
            "Implementing automated booking could help capture more client inquiries every day!"
        )
        assert len(msg) > 300
        res = validate_outreach(msg, service="booking_automation")
        assert res.valid is False
        assert any("exceeds maximum length" in r for r in res.reasons)

    def test_rejection_single_sentence(self):
        msg = "We build high converting websites for modern aesthetic clinics across Delhi."
        res = validate_outreach(msg, service="website_development")
        assert res.valid is False
        assert res.sentence_count == 1
        assert any("at least 2 sentences" in r for r in res.reasons)

    def test_rejection_four_or_more_sentences(self):
        msg = "I noticed your clinic online. You have great patient reviews. But there is no online booking. We can fix that for you."
        res = validate_outreach(msg, service="booking_automation")
        assert res.valid is False
        assert res.sentence_count >= 4
        assert any("must not exceed 3 sentences" in r for r in res.reasons)

    def test_rejection_empty_message(self):
        res = validate_outreach("   ", service="website_development")
        assert res.valid is False
        assert any("empty" in r for r in res.reasons)

    @pytest.mark.parametrize("banned_phrase", [
        "We help",
        "we help",
        "WE HELP",
        "We specialize",
        "Game-changer",
        "game changer",
        "Leverage",
        "Hop on a call",
        "hop on a call",
        "Book a demo",
        "Act now",
        "Guaranteed",
        "100% guaranteed",
        "spots are limited",
    ])
    def test_rejection_banned_phrases_case_insensitive(self, banned_phrase):
        msg = f"I reviewed your clinic profile. {banned_phrase} by automating your patient appointments."
        res = validate_outreach(msg, service="booking_automation")
        assert res.valid is False
        assert res.banned_phrase_found is True
        assert any(banned_phrase.lower() in r.lower() for r in res.reasons)

    @pytest.mark.parametrize("placeholder", [
        "{name}",
        "{company}",
        "{business}",
        "[name]",
        "[company]",
        "[INSERT NAME]",
        "<business>",
        "YOUR BUSINESS",
        "YOUR COMPANY",
        "INSERT NAME",
    ])
    def test_rejection_placeholders(self, placeholder):
        msg = f"I noticed {placeholder} has strong reviews on Google. Adding WhatsApp chat could streamline inquiries."
        res = validate_outreach(msg, service="whatsapp_automation")
        assert res.valid is False
        assert res.placeholder_detected is True
        assert any("placeholder" in r.lower() for r in res.reasons)

    def test_rejection_unsupported_service(self):
        msg = "I saw your clinic website. We can optimize your Google ranking and build backlinks."
        res = validate_outreach(msg, service="seo_optimization")
        assert res.valid is False
        assert res.unsupported_service is True
        assert any("not in the approved" in r for r in res.reasons)

    def test_rejection_unsupported_revenue_claim(self):
        msg = "I noticed your clinic runs ads. You are losing ₹50,000 every month due to dropped calls."
        res = validate_outreach(msg, service="whatsapp_automation")
        assert res.valid is False
        assert res.unsupported_claim_detected is True
        assert any("Unsupported revenue claim" in r for r in res.reasons)

    def test_rejection_unsupported_ad_performance_claim(self):
        msg = "I noticed your active Meta campaigns. Your ads aren't converting because of a slow response."
        res = validate_outreach(msg, service="whatsapp_automation")
        assert res.valid is False
        assert res.unsupported_claim_detected is True
        assert any("ads aren't converting" in r for r in res.reasons)

    def test_rejection_unsupported_roas_claim(self):
        msg = "I saw your sponsored posts online. Your ROAS is poor without automated speed to lead."
        res = validate_outreach(msg, service="lead_automation")
        assert res.valid is False
        assert res.unsupported_claim_detected is True
        assert any("ROAS is poor" in r for r in res.reasons)

    def test_rejection_unsupported_website_causal_claim(self):
        msg = "I checked your homepage today. Your website is costing you customers every day."
        res = validate_outreach(msg, service="website_development")
        assert res.valid is False
        assert res.unsupported_claim_detected is True
        assert any("website is costing" in r for r in res.reasons)

    def test_rejection_unsupported_testimonial_and_fake_proof(self):
        msg = "I noticed your clinic's patient traffic. We generated 100 leads for dental clinics last month."
        res = validate_outreach(msg, service="lead_automation")
        assert res.valid is False
        assert res.unsupported_claim_detected is True

    def test_rejection_excessive_spam_punctuation(self):
        msg = "I saw your clinic on Google Maps!!! Adding automated WhatsApp chat could double your leads???"
        res = validate_outreach(msg, service="whatsapp_automation")
        assert res.valid is False
        assert any("excessive spam punctuation" in r for r in res.reasons)

    def test_rejection_slow_website_pitch_when_no_website(self):
        evidence = [
            Evidence(
                source="website",
                finding="No website exists or was provided for this business",
                evidence="no website url in candidate data",
                confidence=0.9,
                classification="observed",
            )
        ]
        msg = "I noticed your clinic in Gurgaon. Your website is slow to load and losing clients."
        res = validate_outreach(msg, service="website_development", evidence=evidence)
        assert res.valid is False
        assert res.unsupported_claim_detected is True
        assert any("no website" in r.lower() or "slow" in r.lower() for r in res.reasons)
