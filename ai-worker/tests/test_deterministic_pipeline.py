"""Unit tests for deterministic post-processing pipeline.

Validates:
- Phone number normalization (E.164, Indian mobile numbers, stripping noise)
- Instagram URL validation & extraction
- Website URL validation (rejecting WhatsApp/Facebook redirects)
- Business name normalization (stripping legal & clinic suffixes)
- High-ticket niche keyword detection
- Friction points detection
- Deterministic 10-point prospect scorecard calculation
- Reddit Stage 2 Triage pre-filter (obvious rejects vs candidates)
- Deduplication across source URL, phone number, and normalized business name
"""

import pytest
from app.services.deterministic_pipeline import (
    normalize_phone_number,
    extract_instagram_url,
    is_valid_instagram_url,
    is_valid_website_url,
    normalize_business_name,
    is_high_ticket_niche,
    detect_friction_points,
    calculate_prospect_score,
    evaluate_reddit_pre_filter,
    normalize_google_maps_item,
    normalize_meta_ads_item,
    normalize_reddit_item,
    deduplicate_candidates,
    NormalizedCandidate,
)


class TestPhoneNormalization:
    """Tests for phone number normalization."""

    def test_standard_indian_10_digit(self):
        assert normalize_phone_number("9810123456") == "+919810123456"

    def test_indian_with_leading_zero(self):
        assert normalize_phone_number("09810123456") == "+919810123456"

    def test_indian_with_91_prefix(self):
        assert normalize_phone_number("919810123456") == "+919810123456"

    def test_international_double_zero(self):
        assert normalize_phone_number("00919810123456") == "+919810123456"

    def test_formatted_with_dashes_and_spaces(self):
        assert normalize_phone_number("+91 (981) 012-3456") == "+919810123456"

    def test_indian_with_plus_91_and_leading_zero(self):
        assert normalize_phone_number("+91 09810123456") == "+919810123456"
        assert normalize_phone_number("+91-011-26543210") == "+911126543210"

    def test_regional_devanagari_and_arabic_numerals(self):
        # Devanagari numerals: ९८१०१२३४५६ -> +919810123456
        assert normalize_phone_number("\u096f\u096e\u0967\u0966\u0967\u0968\u0969\u096a\u096b\u096c") == "+919810123456"
        # Arabic-Indic numerals: ٩٨١٠١٢٣٤٥٦ -> +919810123456
        assert normalize_phone_number("\u0669\u0668\u0661\u0660\u0661\u0662\u0663\u0664\u0665\u0666") == "+919810123456"
        # Fullwidth digits: ９８１０１２３４５６ -> +919810123456
        assert normalize_phone_number("\uff19\uff18\uff11\uff10\uff11\uff12\uff13\uff14\uff15\uff16") == "+919810123456"

    def test_invalid_too_short(self):
        assert normalize_phone_number("12345") is None

    def test_invalid_too_long(self):
        assert normalize_phone_number("123456789012345678") is None

    def test_empty_or_none(self):
        assert normalize_phone_number(None) is None
        assert normalize_phone_number("") is None
        assert normalize_phone_number("   ") is None


class TestInstagramValidation:
    """Tests for Instagram URL/handle validation and extraction."""

    def test_valid_profile_urls(self):
        assert is_valid_instagram_url("https://www.instagram.com/dr_skinclinic/")
        assert is_valid_instagram_url("instagram.com/delhidentals")
        assert is_valid_instagram_url("@aesthetics_delhi")
        assert is_valid_instagram_url("delhi_clinic")

    def test_invalid_instagram_urls(self):
        assert not is_valid_instagram_url("https://instagram.com/p/B_samplepost")
        assert not is_valid_instagram_url("https://instagram.com/reel/C_samplereel")
        assert not is_valid_instagram_url("https://instagram.com/stories/dr_skinclinic")
        assert not is_valid_instagram_url("https://instagram.com/explore/tags/dental")
        assert not is_valid_instagram_url("clinic.com")
        assert not is_valid_instagram_url("dentist.in")
        assert not is_valid_instagram_url("none")
        assert not is_valid_instagram_url("null")
        assert not is_valid_instagram_url("n/a")
        assert not is_valid_instagram_url(None)
        assert not is_valid_instagram_url("")

    def test_extract_instagram_from_dict(self):
        raw = {"instagram": "https://instagram.com/derma_care"}
        assert extract_instagram_url(raw) == "https://instagram.com/derma_care"

        raw_social = {"socialMedias": ["https://facebook.com/page", "https://instagram.com/clinic_pro"]}
        assert extract_instagram_url(raw_social) == "https://instagram.com/clinic_pro"

    def test_extract_instagram_from_malformed_and_json_structures(self):
        # JSON string in snapshot
        raw_json_snap = {
            "snapshot": '{"pageProfileUri": "https://instagram.com/json_clinic", "cards": []}'
        }
        assert extract_instagram_url(raw_json_snap) == "https://instagram.com/json_clinic"

        # Root-level advertiser_page_info
        raw_adv_root = {
            "advertiser_page_info": {"instagram_username": "root_derma"}
        }
        assert extract_instagram_url(raw_adv_root) == "https://instagram.com/root_derma"

        # Instagram dict format
        raw_insta_dict = {
            "instagram": {"username": "dict_clinic"}
        }
        assert extract_instagram_url(raw_insta_dict) == "https://instagram.com/dict_clinic"


class TestWebsiteValidation:
    """Tests for website URL validation."""

    def test_valid_websites(self):
        assert is_valid_website_url("https://skinclinicdelhi.com")
        assert is_valid_website_url("http://dentistgurgaon.in/services")
        assert is_valid_website_url("drguptaskin.co.in")

    def test_reject_whatsapp_and_facebook(self):
        assert not is_valid_website_url("https://wa.me/919810123456")
        assert not is_valid_website_url("https://api.whatsapp.com/send?phone=919810123456")
        assert not is_valid_website_url("https://facebook.com/myclinic")
        assert not is_valid_website_url("https://fb.me/myclinic")

    def test_reject_invalid_strings(self):
        assert not is_valid_website_url("none")
        assert not is_valid_website_url("n/a")
        assert not is_valid_website_url("invalid-domain-without-tld")
        assert not is_valid_website_url(None)


class TestBusinessNameNormalization:
    """Tests for business name normalization."""

    def test_strips_legal_suffixes(self):
        assert normalize_business_name("Apex Dental Clinic Pvt Ltd") == "apex"
        assert normalize_business_name("The Derma Care Solutions LLP") == "derma"
        assert normalize_business_name("Glow Luxury Salon & Spa") == "glow luxury"

    def test_handles_punctuation(self):
        assert normalize_business_name("Dr. Batra's - Hair Transplant Centre") == "dr batra s hair transplant"

    def test_all_suffix_name_fallback(self):
        assert normalize_business_name("Dental Clinic") == "dental clinic"
        assert normalize_business_name("The Care Hospital") == "care hospital"


class TestHighTicketAndScorecard:
    """Tests for 10-point prospect scorecard and friction point detection."""

    def test_high_ticket_niche_detection(self):
        assert is_high_ticket_niche({"business_type": "Dermatology Clinic"})
        assert is_high_ticket_niche({"business_name": "Delhi Dental Aesthetics"})
        assert is_high_ticket_niche({"title": "Hair Transplant Surgeon in Gurgaon"})
        assert not is_high_ticket_niche({"business_type": "Grocery Store"})

    def test_friction_point_detection(self):
        # Missing website
        friction = detect_friction_points({"website_url": None, "review_count": 60})
        assert "Missing official website for capturing direct inbound appointments" in friction
        assert any("High offline review volume (60 reviews)" in f for f in friction)

        # Has website without WhatsApp
        friction_with_site = detect_friction_points({
            "website_url": "https://delhiderma.com",
            "body_text": "Welcome to our clinic. Call us at 123456."
        })
        assert "No direct 1-click WhatsApp booking button or inquiry widget on website" in friction_with_site

    def test_prospect_scorecard_calculation(self):
        # Full immediate lead:
        # Active ads (+3) + reviews >= 50 (+2) + IG (+1) + website (+1) + friction (+2) + high ticket (+1) = 10 pts
        lead_data = {
            "business_name": "Apex Skin Clinic",
            "business_type": "Dermatology",
            "has_active_ads": True,
            "review_count": 85,
            "instagram_url": "https://instagram.com/apexskin",
            "website_url": "https://apexskin.com",
            "body_text": "Contact us via form."
        }
        res = calculate_prospect_score(lead_data)
        assert res.score == 10
        assert res.priority == "immediate"

        # Low lead without ads, low reviews, no friction detected
        lead_data_low = {
            "business_name": "Corner Bookstore",
            "business_type": "Retail",
            "has_active_ads": False,
            "review_count": 10,
            "website_url": "https://cornerbooks.com",
            "body_text": "Chat on WhatsApp wa.me/12345",
        }
        res_low = calculate_prospect_score(lead_data_low)
        assert res_low.score == 1  # only website listed
        assert res_low.priority == "skip"


class TestRedditPreFilter:
    """Tests for Reddit Stage 2 Triage pre-filtering."""

    def test_obvious_reject_freelancer(self):
        post = {
            "title": "[FOR HIRE] Web Developer Available for Small Businesses",
            "body": "Hi, I offer web development and SEO services. Portfolio: https://myportfolio.com",
            "subreddit": "smallbusiness"
        }
        result = evaluate_reddit_pre_filter(post)
        assert not result.is_candidate
        assert "for_hire_tag" in result.reject_reason or "portfolio" in result.reject_reason

    def test_obvious_reject_short(self):
        post = {"title": "Help", "body": "Need advice", "subreddit": "smallbusiness"}
        result = evaluate_reddit_pre_filter(post)
        assert not result.is_candidate
        assert "too short" in result.reject_reason

    def test_candidate_with_operational_friction(self):
        post = {
            "title": "Losing clients due to missed calls after hours",
            "body": "We are a dental clinic and our front desk cannot answer calls after 7 PM. Looking for ways to automate WhatsApp inquiry booking.",
            "subreddit": "smallbusinessowners"
        }
        result = evaluate_reddit_pre_filter(post)
        assert result.is_candidate
        assert result.matched_keyword in ["missed_calls", "after_hours", "whatsapp_friction"]


class TestDeduplication:
    """Tests for candidate deduplication."""

    def test_deduplicates_by_url_and_phone(self):
        cand1 = NormalizedCandidate(
            business_name="Clinic Alpha",
            business_type="Dental",
            source_platform="google_maps",
            source_url="https://maps.google.com/place/alpha",
            phone_number="+919810123456",
            rating=4.8,
            review_count=90,
            has_active_ads=True,
            scorecard_score=9,
            priority_tier="immediate"
        )
        cand2 = NormalizedCandidate(
            business_name="Clinic Alpha South",
            business_type="Dental",
            source_platform="google_maps",
            source_url="https://maps.google.com/place/alpha",  # duplicate URL
            phone_number="+919810999999",
            rating=4.5,
            review_count=50,
            has_active_ads=False,
            scorecard_score=7,
            priority_tier="high"
        )
        cand3 = NormalizedCandidate(
            business_name="Clinic Beta",
            business_type="Dental",
            source_platform="google_maps",
            source_url="https://maps.google.com/place/beta",
            phone_number="+919810123456",  # duplicate phone
            rating=4.5,
            review_count=50,
            has_active_ads=False,
            scorecard_score=7,
            priority_tier="high"
        )

        deduped, dup_count = deduplicate_candidates([cand1, cand2, cand3])
        assert len(deduped) == 1
        assert dup_count == 2
        assert deduped[0].business_name == "Clinic Alpha"

    def test_deduplicates_by_website_url(self):
        cand1 = NormalizedCandidate(
            business_name="Delhi Dental GK",
            business_type="Dental",
            source_platform="google_maps",
            source_url="https://maps.google.com/place/gk_delhi",
            website_url="https://delhidentals.com",
            phone_number="+919810111111",
            scorecard_score=8,
            priority_tier="immediate"
        )
        cand2 = NormalizedCandidate(
            business_name="Delhi Dental Ad Campaign",
            business_type="Dental",
            source_platform="meta_ads",
            source_url="https://facebook.com/ads/library/?id=123",
            website_url="https://delhidentals.com",  # Duplicate website!
            phone_number="+919810222222",
            scorecard_score=7,
            priority_tier="high"
        )

        deduped, dup_count = deduplicate_candidates([cand1, cand2])
        assert len(deduped) == 1
        assert dup_count == 1


class TestPlatformNormalizers:
    """Tests for platform-specific candidate normalizers (Meta Ads & Reddit)."""

    def test_normalize_meta_ads_item(self):
        raw_ad = {
            "pageName": "Apex Dermatology Care",
            "adArchiveID": "987654321",
            "adCreativeBody": "Book laser treatment today. Call +91 98101 23456 or WhatsApp.",
            "linkUrl": "https://apexdermacare.com",
            "snapshot": {
                "pageProfileUri": "https://instagram.com/apexdermacare"
            }
        }
        cand = normalize_meta_ads_item(raw_ad)
        assert cand is not None
        assert cand.business_name == "Apex Dermatology Care"
        assert cand.source_platform == "meta_ads"
        assert cand.has_active_ads is True
        assert cand.phone_number == "+919810123456"
        assert cand.website_url == "https://apexdermacare.com"
        assert cand.instagram_url == "https://instagram.com/apexdermacare"
        assert cand.scorecard_score == 6
        assert cand.priority_tier == "high"

    def test_normalize_reddit_item(self):
        raw_post = {
            "title": "Need help managing missed calls after hours in clinic",
            "body": "Patients call when closed. Visit https://clinicexample.com or call 09810123456.",
            "subreddit": "smallbusiness",
            "permalink": "/r/smallbusiness/comments/123/need_help"
        }
        cand = normalize_reddit_item(raw_post)
        assert cand is not None
        assert cand.source_platform == "reddit"
        assert cand.phone_number == "+919810123456"
        assert cand.website_url == "https://clinicexample.com"
        assert len(cand.friction_points) >= 1
