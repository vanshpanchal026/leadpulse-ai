"""Deterministic Normalization, Pre-Filter, Deduplication & Scorecard Pipeline.

Faithfully ports and centralizes the V1 deterministic logic from:
- lib/scorecard.ts (10-point prospect scorecard & priority tiers)
- lib/pre-filter.ts (Reddit Stage 2 Triage obvious-reject vs. candidate evaluation)
- app/api/scraper/google-maps/route.ts (Phone normalization & Instagram extraction)
- app/api/scraper/meta-ads/route.ts (Business name normalization & Meta extraction)

Strict architectural rule:
Zero LLM calls are permitted in this module. All calculations, parsing,
filtering, and deduplication must be 100% pure and deterministic.
"""

import json
import math
import re
from typing import Any, Literal, Optional
import unicodedata
from urllib.parse import urlparse
from pydantic import BaseModel, ConfigDict, Field


PriorityTier = Literal["immediate", "high", "medium", "skip"]
SourcePlatform = Literal["google_maps", "reddit", "meta_ads"]


class ScorecardResult(BaseModel):
    """Result of the deterministic 10-point prospect scorecard evaluation."""
    model_config = ConfigDict(frozen=True)

    score: int = Field(..., ge=0, le=10, description="Deterministic score 0-10")
    priority: PriorityTier = Field(..., description="Priority classification tier")
    friction_points: list[str] = Field(default_factory=list, description="Identified operational friction points")


class PreFilterResult(BaseModel):
    """Result of Reddit Stage 2 Triage pre-filter."""
    model_config = ConfigDict(frozen=True)

    is_candidate: bool = Field(..., description="True if post should proceed to qualification")
    reject_reason: Optional[str] = Field(default=None, description="Reason if rejected")
    matched_keyword: Optional[str] = Field(default=None, description="Matched signal keyword")


class NormalizedCandidate(BaseModel):
    """Unified, normalized prospect candidate ready for lead evaluation and scoring."""
    model_config = ConfigDict(frozen=True)

    business_name: str
    business_type: str
    source_platform: SourcePlatform
    source_url: str
    phone_number: Optional[str] = None
    website_url: Optional[str] = None
    instagram_url: Optional[str] = None
    address: Optional[str] = None
    rating: float = 0.0
    review_count: int = 0
    has_active_ads: bool = False
    friction_points: list[str] = Field(default_factory=list)
    scorecard_score: int = 0
    priority_tier: PriorityTier = "skip"
    raw_metadata: dict[str, Any] = Field(default_factory=dict)


HIGH_TICKET_KEYWORDS: list[str] = [
    "dental",
    "dentist",
    "implant",
    "clinic",
    "hair transplant",
    "hair restoration",
    "interior",
    "interior designer",
    "salon",
    "luxury salon",
    "med spa",
    "medspa",
    "aesthetic",
    "aesthetics",
    "dermatolog",
    "cosmetic",
    "plastic surg",
]

OBVIOUS_REJECT_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("for_hire_tag", re.compile(r"\[for\s*hire\]|\bfor\s*hire\b", re.IGNORECASE)),
    ("hire_me", re.compile(r"\bhire me\b|\bavailable for hire\b|\bopen for work\b", re.IGNORECASE)),
    ("portfolio_pitch", re.compile(r"\bportfolio\s*:\s*https?://", re.IGNORECASE)),
    ("offering_services", re.compile(r"\bi offer (development|design|seo|marketing|services)\b", re.IGNORECASE)),
    ("developer_pitch", re.compile(r"\b(freelance web developer available|experienced developer looking for)\b", re.IGNORECASE)),
    ("weekly_thread", re.compile(r"\b(weekly|monthly)\s+(roundup|megathread|discussion|digest|showcase)\b", re.IGNORECASE)),
    ("security_report", re.compile(r"\bsecurity\s+report\b", re.IGNORECASE)),
    ("this_weeks_top", re.compile(r"this week's top", re.IGNORECASE)),
    ("rules_announcement", re.compile(r"\b(rules and guidelines|moderator post|sub update|megathread)\b", re.IGNORECASE)),
    ("deleted_or_removed", re.compile(r"^(\[removed\]|\[deleted\])$", re.IGNORECASE)),
]

CANDIDATE_SIGNALS: list[tuple[str, re.Pattern]] = [
    ("missed_calls", re.compile(r"\bmissed (calls|inquiries|clients|leads)\b", re.IGNORECASE)),
    ("after_hours", re.compile(r"\bafter hours|after-hours|outside business hours|overnight messages\b", re.IGNORECASE)),
    ("message_overload", re.compile(r"\b(too many messages|drowning in dms|overwhelmed with messages|inbox chaos)\b", re.IGNORECASE)),
    ("scheduling_friction", re.compile(r"\b(double booking|scheduling friction|calendar sync|booking chaos|calendly issue)\b", re.IGNORECASE)),
    ("lead_followup", re.compile(r"\b(lead capture|lost leads|following up|intake process|customer drop-off)\b", re.IGNORECASE)),
    ("whatsapp_friction", re.compile(r"\b(whatsapp business|whatsapp messages|route texts|customer texts)\b", re.IGNORECASE)),
    ("manual_operations", re.compile(r"\b(manual data entry|copying to spreadsheet|crm update|automating inquiries)\b", re.IGNORECASE)),
]

PRIORITY_BUSINESS_SUBREDDITS: set[str] = {
    "smallbusiness",
    "smallbusinessowners",
    "restaurantowners",
    "realtors",
    "shopify",
    "entrepreneur",
    "localbusiness",
}

NAME_SUFFIXES: list[str] = [
    "pvt ltd",
    "private limited",
    "pvt",
    "ltd",
    "llp",
    "llc",
    "inc",
    "corp",
    "corporation",
    "clinic",
    "clinics",
    "dental",
    "dentistry",
    "hospital",
    "hospitals",
    "centre",
    "center",
    "care",
    "healthcare",
    "studio",
    "solutions",
    "services",
    "salon",
    "spa",
]


def normalize_phone_number(raw_phone: Optional[str]) -> Optional[str]:
    """Normalize phone numbers to standard E.164 format (+91 for Indian numbers).

    Strict port of normalizePhoneNumber from app/api/scraper/google-maps/route.ts,
    with robust support for Unicode/regional numerals (Devanagari, Arabic, fullwidth).
    """
    if not raw_phone or not isinstance(raw_phone, str):
        return None

    # Convert any regional/unicode decimal numerals to ASCII 0-9 digits
    # Handles Devanagari (९->9), Eastern Arabic (٩->9), fullwidth (９->9), etc.
    chars = []
    for ch in raw_phone.strip():
        if ch == "+":
            chars.append("+")
        elif ch.isdecimal():
            try:
                chars.append(str(unicodedata.decimal(ch)))
            except (ValueError, TypeError):
                pass
        elif ch in "0123456789":
            chars.append(ch)

    cleaned = "".join(chars)
    if not cleaned:
        return None

    if cleaned.startswith("00"):
        cleaned = "+" + cleaned[2:]

    if not cleaned.startswith("+"):
        if cleaned.startswith("0") and len(cleaned) == 11:
            cleaned = cleaned[1:]

        if len(cleaned) == 10:
            cleaned = f"+91{cleaned}"
        elif len(cleaned) == 12 and cleaned.startswith("91"):
            cleaned = f"+{cleaned}"
        else:
            cleaned = f"+{cleaned}"

    # Strip redundant leading zero after +91 country code (e.g. +9109810123456 -> +919810123456)
    if cleaned.startswith("+910") and len(cleaned) in (13, 14):
        cleaned = "+91" + cleaned[4:]

    digits_only = re.sub(r"[^0-9]", "", cleaned)
    if len(digits_only) < 7 or len(digits_only) > 15:
        return None

    # Strict E.164 sanity pattern: + followed by non-zero digit and 6-14 ASCII digits
    if not re.match(r"^\+[1-9][0-9]{6,14}$", cleaned):
        return None

    return cleaned


def extract_instagram_url(raw: dict[str, Any]) -> Optional[str]:
    """Extract Instagram URL or handle from raw Apify place or ad record, handling malformed/JSON data."""
    if not isinstance(raw, dict):
        return None

    if raw.get("instagram") and isinstance(raw["instagram"], str):
        return raw["instagram"]
    if isinstance(raw.get("instagram"), dict):
        insta_dict = raw["instagram"]
        if insta_dict.get("url") and isinstance(insta_dict["url"], str):
            return insta_dict["url"]
        if insta_dict.get("username") and isinstance(insta_dict["username"], str):
            return f"https://instagram.com/{insta_dict['username']}"

    if raw.get("instagramUrl") and isinstance(raw["instagramUrl"], str):
        return raw["instagramUrl"]
    if raw.get("instagram_url") and isinstance(raw["instagram_url"], str):
        return raw["instagram_url"]

    snapshot = raw.get("snapshot")
    if isinstance(snapshot, str):
        try:
            snapshot = json.loads(snapshot)
        except Exception:
            snapshot = None

    if isinstance(snapshot, dict):
        uri = snapshot.get("pageProfileUri")
        if uri and "instagram.com/" in str(uri):
            return str(uri)
        extra = snapshot.get("extraLinks")
        if isinstance(extra, list):
            for l in extra:
                if isinstance(l, str) and "instagram.com/" in l:
                    return l
        cards = snapshot.get("cards")
        if isinstance(cards, list):
            for card in cards:
                if isinstance(card, dict):
                    card_url = card.get("linkUrl") or card.get("link_url")
                    if isinstance(card_url, str) and "instagram.com/" in card_url:
                        return card_url

    ad_details = raw.get("ad_details")
    if isinstance(ad_details, str):
        try:
            ad_details = json.loads(ad_details)
        except Exception:
            ad_details = None

    adv = None
    if isinstance(ad_details, dict):
        adv = ad_details.get("advertiser_page_info")
    if adv is None:
        adv = raw.get("advertiser_page_info")
    if isinstance(adv, str):
        try:
            adv = json.loads(adv)
        except Exception:
            adv = None

    if isinstance(adv, dict):
        if adv.get("instagram_url") and isinstance(adv["instagram_url"], str):
            return str(adv["instagram_url"])
        if adv.get("instagram_username") and isinstance(adv["instagram_username"], str):
            return f"https://instagram.com/{adv['instagram_username']}"

    socials = raw.get("socialMedias")
    if isinstance(socials, list):
        for s in socials:
            if isinstance(s, str) and "instagram.com/" in s:
                return s
    elif isinstance(socials, dict):
        if socials.get("instagram") and isinstance(socials["instagram"], str):
            return str(socials["instagram"])

    return None


RESERVED_INSTAGRAM_PATHS: set[str] = {
    "p", "reel", "reels", "stories", "tv", "explore", "accounts", "direct", "share", "developer"
}


def is_valid_instagram_url(url: Optional[str]) -> bool:
    """Validate whether a given URL or handle looks like a legitimate Instagram presence."""
    if not url or not isinstance(url, str):
        return False
    trimmed = url.strip().lower()
    if not trimmed or trimmed in {"none", "n/a", "null"}:
        return False

    if "instagram.com/" in trimmed:
        part = trimmed.split("instagram.com/")[1]
        token = re.split(r"[/?#]", part)[0]
        return bool(token and len(token) > 1 and token not in RESERVED_INSTAGRAM_PATHS)

    if trimmed.startswith("@") and len(trimmed) > 2:
        return True

    # Reject plain website domains passed without scheme (e.g. "clinic.com", "dentist.in")
    if any(trimmed.endswith(tld) for tld in [".com", ".org", ".net", ".in", ".co", ".io", ".gov", ".edu", ".ai"]):
        return False

    return len(trimmed) > 2 and " " not in trimmed and "/" not in trimmed


def is_valid_website_url(url: Optional[str]) -> bool:
    """Validate whether a given string is a valid website URL (filtering out WhatsApp & social links)."""
    if not url or not isinstance(url, str):
        return False
    trimmed = url.strip().lower()
    if not trimmed or trimmed in {"none", "n/a", "null"}:
        return False

    if any(blocked in trimmed for blocked in [
        "wa.me",
        "whatsapp.com",
        "api.whatsapp.com",
        "fb.me",
        "facebook.com"
    ]):
        return False

    target = trimmed if trimmed.startswith("http") else f"https://{trimmed}"
    try:
        parsed = urlparse(target)
        return bool(parsed.hostname and "." in parsed.hostname)
    except Exception:
        return False


def normalize_business_name(raw_name: Optional[str]) -> str:
    """Normalize business names for deduplication by stripping punctuation and common legal/clinic suffixes."""
    if not raw_name or not isinstance(raw_name, str):
        return ""

    normalized = raw_name.lower().strip()
    normalized = re.sub(r"[-_/\\|&+,]", " ", normalized)
    normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    normalized = re.sub(r"^the\s+", "", normalized)

    base_name = normalized
    for suffix in NAME_SUFFIXES:
        normalized = re.sub(rf"\b{re.escape(suffix)}\b", " ", normalized, flags=re.IGNORECASE)

    res = re.sub(r"\s+", " ", normalized).strip()
    if not res:
        # Fallback if stripping suffixes reduced name to empty (e.g. "Dental Clinic" -> "dental clinic", "The Care Hospital" -> "care hospital")
        return base_name
    return res


def is_high_ticket_niche(data: dict[str, Any]) -> bool:
    """Evaluate whether the candidate operates in a high-ticket service vertical."""
    searchable_parts = [
        str(data.get("business_type") or ""),
        str(data.get("business_name") or ""),
        str(data.get("title") or ""),
        str(data.get("subreddit_or_handle") or ""),
        str(data.get("body_text") or ""),
    ]
    searchable_text = " ".join(searchable_parts).lower()
    return any(kw in searchable_text for kw in HIGH_TICKET_KEYWORDS)


def detect_friction_points(data: dict[str, Any]) -> list[str]:
    """Deterministic detection of operational and conversion friction points."""
    pre_audited = data.get("audit_friction_points")
    if isinstance(pre_audited, list) and pre_audited:
        return list(dict.fromkeys(str(p).strip() for p in pre_audited if str(p).strip()))

    friction: list[str] = []
    has_website = is_valid_website_url(data.get("website_url"))
    raw_reviews = data.get("review_count")
    review_count = int(raw_reviews) if isinstance(raw_reviews, (int, float)) else 0

    if not has_website:
        friction.append("Missing official website for capturing direct inbound appointments")
    else:
        combined = f"{data.get('body_text') or ''} {data.get('identified_problem') or ''}".lower()
        if "whatsapp" not in combined and "wa.me" not in combined:
            friction.append("No direct 1-click WhatsApp booking button or inquiry widget on website")

    if review_count >= 50:
        friction.append(f"High offline review volume ({review_count} reviews) without 24/7 automated inquiry capture")

    return friction


def calculate_prospect_score(data: dict[str, Any]) -> ScorecardResult:
    """Calculate the pure, deterministic 10-point prospect scorecard.

    Scorecard Breakdown:
    1. Active Meta / Google Ads (+3 pts)
    2. Google Review count >= 50 (+2 pts)
    3. Verified Instagram handle / URL present (+1 pt)
    4. Official Website listed (+1 pt)
    5. Friction points detected (+2 pts)
    6. High-ticket vertical (+1 pt)
    Total possible: 10 points.

    Priority Tiers:
    - 8-10 points: 'immediate'
    - 6-7 points: 'high'
    - 4-5 points: 'medium'
    - 0-3 points: 'skip'
    """
    score = 0
    friction = detect_friction_points(data)

    # 1. Active Ads (+3)
    if data.get("has_active_ads") is True:
        score += 3

    # 2. Review Count >= 50 (+2)
    raw_reviews = data.get("review_count")
    review_count = int(raw_reviews) if isinstance(raw_reviews, (int, float)) else 0
    if review_count >= 50:
        score += 2

    # 3. Instagram Presence (+1)
    if is_valid_instagram_url(data.get("instagram_url")):
        score += 1

    # 4. Website Listed (+1)
    if is_valid_website_url(data.get("website_url")):
        score += 1

    # 5. Friction Points (+2)
    if len(friction) > 0:
        score += 2

    # 6. High-Ticket Vertical (+1)
    if is_high_ticket_niche(data):
        score += 1

    normalized_score = min(10, max(0, score))

    if normalized_score >= 8:
        priority: PriorityTier = "immediate"
    elif normalized_score >= 6:
        priority = "high"
    elif normalized_score >= 4:
        priority = "medium"
    else:
        priority = "skip"

    return ScorecardResult(
        score=normalized_score,
        priority=priority,
        friction_points=friction
    )


def evaluate_reddit_pre_filter(post: dict[str, Any]) -> PreFilterResult:
    """Evaluate whether a raw scraped Reddit post is an obvious reject or a valid candidate."""
    title = str(post.get("title") or "").strip()
    body = str(post.get("body") or post.get("selftext") or "").strip()
    full_text = f"{title} {body}".strip()
    raw_sub = str(post.get("subreddit") or "").lower().strip()
    sub = re.sub(r"^/?r/", "", raw_sub).strip("/ ")

    if len(full_text) < 30:
        return PreFilterResult(
            is_candidate=False,
            reject_reason=f"Content too short ({len(full_text)} chars), insufficient context."
        )

    for name, regex in OBVIOUS_REJECT_PATTERNS:
        if regex.search(title) or regex.search(full_text):
            return PreFilterResult(
                is_candidate=False,
                reject_reason=f"Matched obvious reject pattern: {name}"
            )

    matched_signal: Optional[str] = None
    for name, regex in CANDIDATE_SIGNALS:
        if regex.search(full_text):
            matched_signal = name
            break

    is_prio_sub = sub in PRIORITY_BUSINESS_SUBREDDITS
    if matched_signal or is_prio_sub:
        return PreFilterResult(
            is_candidate=True,
            matched_keyword=matched_signal or "general_business_inquiry"
        )

    return PreFilterResult(
        is_candidate=False,
        reject_reason=f"Outside target niche: No operational friction signals in r/{sub or 'unknown'}."
    )


def normalize_google_maps_item(raw: dict[str, Any], has_active_ads_override: bool = False) -> Optional[NormalizedCandidate]:
    """Normalize a raw Apify compass/crawler-google-places item."""
    business_name = (raw.get("title") or raw.get("name") or raw.get("businessName") or "").strip()
    if not business_name:
        return None

    source_url = (
        raw.get("url")
        or raw.get("placeUrl")
        or raw.get("googleMapsUrl")
        or (f"https://www.google.com/maps/place/?q=place_id:{raw.get('placeId')}" if raw.get("placeId") else "")
    ).strip()

    normalized_phone = normalize_phone_number(
        raw.get("phone") or raw.get("phoneNumber") or raw.get("phoneUnformatted")
    )

    raw_website = (
        raw.get("website")
        or raw.get("websiteUrl")
        or (raw.get("url") if raw.get("url") and "google.com/maps" not in raw["url"] else None)
    )
    website_url = str(raw_website).strip() if raw_website else None

    instagram_url = extract_instagram_url(raw)
    address = (raw.get("address") or raw.get("fullAddress") or raw.get("street") or "").strip() or None

    rating_val = raw.get("totalScore") or raw.get("rating") or raw.get("reviewsScore") or 0.0
    try:
        rating = float(rating_val)
    except (ValueError, TypeError):
        rating = 0.0

    reviews_val = raw.get("reviewsCount") or raw.get("review_count") or raw.get("userRatingsTotal") or 0
    try:
        review_count = int(reviews_val)
    except (ValueError, TypeError):
        review_count = 0

    business_type = (
        raw.get("categoryName")
        or (raw.get("categories")[0] if isinstance(raw.get("categories"), list) and raw.get("categories") else None)
        or raw.get("businessType")
        or "Local Service"
    ).strip()

    has_active_ads = bool(
        raw.get("hasActiveAds")
        or raw.get("has_active_ads")
        or has_active_ads_override
    )

    data_for_scoring = {
        "business_name": business_name,
        "business_type": business_type,
        "source_url": source_url,
        "phone_number": normalized_phone,
        "website_url": website_url,
        "instagram_url": instagram_url,
        "address": address,
        "rating": rating,
        "review_count": review_count,
        "has_active_ads": has_active_ads,
    }

    scorecard = calculate_prospect_score(data_for_scoring)

    return NormalizedCandidate(
        business_name=business_name,
        business_type=business_type,
        source_platform="google_maps",
        source_url=source_url or f"https://www.google.com/maps/search/?api=1&query={business_name}",
        phone_number=normalized_phone,
        website_url=website_url,
        instagram_url=instagram_url,
        address=address,
        rating=rating,
        review_count=review_count,
        has_active_ads=has_active_ads,
        friction_points=scorecard.friction_points,
        scorecard_score=scorecard.score,
        priority_tier=scorecard.priority,
        raw_metadata=raw
    )


def normalize_meta_ads_item(raw: dict[str, Any]) -> Optional[NormalizedCandidate]:
    """Normalize a raw Apify apify/facebook-ads-scraper record into a NormalizedCandidate."""
    if not isinstance(raw, dict):
        return None

    business_name = (
        raw.get("pageName")
        or raw.get("pageTitle")
        or raw.get("businessName")
        or raw.get("publisherName")
        or raw.get("title")
        or ""
    ).strip()

    snapshot = raw.get("snapshot")
    if isinstance(snapshot, str):
        try:
            snapshot = json.loads(snapshot)
        except Exception:
            snapshot = None

    if not business_name and isinstance(snapshot, dict):
        business_name = str(snapshot.get("pageName") or "").strip()

    if not business_name:
        return None

    raw_dest = (
        raw.get("linkUrl")
        or raw.get("link_url")
        or raw.get("website")
        or raw.get("websiteUrl")
    )
    if not raw_dest and isinstance(snapshot, dict):
        raw_dest = snapshot.get("linkUrl")
        if not raw_dest and isinstance(snapshot.get("cards"), list) and snapshot["cards"]:
            first_card = snapshot["cards"][0]
            if isinstance(first_card, dict):
                raw_dest = first_card.get("linkUrl")

    website_url = None
    phone_from_url = None
    if raw_dest and isinstance(raw_dest, str):
        dest_clean = raw_dest.strip()
        if "wa.me/" in dest_clean or "whatsapp.com" in dest_clean:
            match = re.search(r"(?:wa\.me/|phone=)(\+?\d+)", dest_clean)
            if match:
                phone_from_url = normalize_phone_number(match.group(1))
        elif is_valid_website_url(dest_clean):
            website_url = dest_clean

    instagram_url = extract_instagram_url(raw)

    raw_phone = raw.get("phone") or raw.get("phoneNumber") or phone_from_url
    ad_copy = str(raw.get("adCreativeBody") or raw.get("body") or "")
    if isinstance(snapshot, dict) and not ad_copy:
        body_obj = snapshot.get("body")
        if isinstance(body_obj, dict):
            ad_copy = str(body_obj.get("text") or "")
        elif isinstance(body_obj, str):
            ad_copy = body_obj

    if not raw_phone and ad_copy:
        phone_match = re.search(r"(?:\+91|0)?[6-9]\d{4}\s?\d{5}", ad_copy)
        if phone_match:
            raw_phone = phone_match.group(0)

    normalized_phone = normalize_phone_number(raw_phone)

    ad_id = raw.get("adArchiveID") or raw.get("adArchiveId") or raw.get("adId") or raw.get("id")
    source_url = (
        raw.get("url")
        or raw.get("adSnapshotUrl")
        or (f"https://www.facebook.com/ads/library/?id={ad_id}" if ad_id else "")
        or f"https://www.facebook.com/ads/library/?q={business_name}"
    ).strip()

    business_type = str(raw.get("category") or raw.get("business_type") or "Local Service").strip()

    data_for_scoring = {
        "business_name": business_name,
        "business_type": business_type,
        "source_url": source_url,
        "phone_number": normalized_phone,
        "website_url": website_url,
        "instagram_url": instagram_url,
        "rating": 0.0,
        "review_count": 0,
        "has_active_ads": True,
        "body_text": ad_copy,
    }

    scorecard = calculate_prospect_score(data_for_scoring)

    return NormalizedCandidate(
        business_name=business_name,
        business_type=business_type,
        source_platform="meta_ads",
        source_url=source_url,
        phone_number=normalized_phone,
        website_url=website_url,
        instagram_url=instagram_url,
        address=raw.get("address"),
        rating=0.0,
        review_count=0,
        has_active_ads=True,
        friction_points=scorecard.friction_points,
        scorecard_score=scorecard.score,
        priority_tier=scorecard.priority,
        raw_metadata=raw
    )


def normalize_reddit_item(raw: dict[str, Any]) -> Optional[NormalizedCandidate]:
    """Normalize a raw Apify trudax/reddit-scraper-lite post into a NormalizedCandidate."""
    if not isinstance(raw, dict):
        return None

    title = str(raw.get("title") or "").strip()
    body = str(raw.get("body") or raw.get("selftext") or "").strip()
    full_text = f"{title} {body}".strip()

    filter_res = evaluate_reddit_pre_filter(raw)
    if not filter_res.is_candidate:
        return None

    subreddit = str(raw.get("subreddit") or "").strip().lower()
    business_name = title[:60] if len(title) > 5 else f"Reddit Lead (r/{subreddit})"

    source_url = (
        raw.get("url")
        or (f"https://reddit.com{raw['permalink']}" if raw.get("permalink") else "")
        or f"https://reddit.com/r/{subreddit}"
    ).strip()

    website_match = re.search(r"https?://[^\s/$.?#].[^\s]*", full_text)
    website_url = website_match.group(0) if website_match and is_valid_website_url(website_match.group(0)) else None

    phone_match = re.search(r"(?:\+91|0)?[6-9]\d{4}\s?\d{5}", full_text)
    phone_number = normalize_phone_number(phone_match.group(0)) if phone_match else None

    friction_points = [f"Reddit operational friction: {filter_res.matched_keyword or 'business inquiry'}"]
    if not website_url:
        friction_points.append("Missing official website for direct conversion")

    data_for_scoring = {
        "business_name": business_name,
        "business_type": f"r/{subreddit} Lead",
        "source_url": source_url,
        "phone_number": phone_number,
        "website_url": website_url,
        "has_active_ads": False,
        "body_text": full_text,
        "audit_friction_points": friction_points,
    }

    scorecard = calculate_prospect_score(data_for_scoring)

    return NormalizedCandidate(
        business_name=business_name,
        business_type=f"r/{subreddit} Discussion",
        source_platform="reddit",
        source_url=source_url,
        phone_number=phone_number,
        website_url=website_url,
        rating=0.0,
        review_count=0,
        has_active_ads=False,
        friction_points=friction_points,
        scorecard_score=scorecard.score,
        priority_tier=scorecard.priority,
        raw_metadata=raw
    )


def deduplicate_candidates(
    candidates: list[NormalizedCandidate],
    existing_urls: Optional[set[str]] = None,
    existing_phones: Optional[set[str]] = None,
    existing_names: Optional[set[str]] = None,
    existing_websites: Optional[set[str]] = None,
) -> tuple[list[NormalizedCandidate], int]:
    """Deduplicate a list of candidates against existing repository records and within-batch.

    Returns:
        tuple[list[NormalizedCandidate], int]: (deduplicated_candidates, duplicate_count)
    """
    tracked_urls = {u.strip().lower() for u in (existing_urls or set()) if u}
    tracked_phones = {p.strip() for p in (existing_phones or set()) if p}
    tracked_names = {normalize_business_name(n) for n in (existing_names or set()) if n and normalize_business_name(n)}
    tracked_websites = {w.strip().lower() for w in (existing_websites or set()) if w}

    deduped: list[NormalizedCandidate] = []
    duplicate_count = 0

    for cand in candidates:
        url_key = cand.source_url.strip().lower() if cand.source_url else None
        phone_key = cand.phone_number.strip() if cand.phone_number else None
        name_key = normalize_business_name(cand.business_name)
        website_key = cand.website_url.strip().lower() if cand.website_url else None

        if url_key and url_key in tracked_urls:
            duplicate_count += 1
            continue
        if phone_key and phone_key in tracked_phones:
            duplicate_count += 1
            continue
        if name_key and name_key in tracked_names:
            duplicate_count += 1
            continue
        if website_key and website_key in tracked_websites:
            duplicate_count += 1
            continue

        if url_key:
            tracked_urls.add(url_key)
        if phone_key:
            tracked_phones.add(phone_key)
        if name_key:
            tracked_names.add(name_key)
        if website_key:
            tracked_websites.add(website_key)

        deduped.append(cand)

    return deduped, duplicate_count


__all__ = [
    "ScorecardResult",
    "PreFilterResult",
    "NormalizedCandidate",
    "PriorityTier",
    "SourcePlatform",
    "HIGH_TICKET_KEYWORDS",
    "normalize_phone_number",
    "extract_instagram_url",
    "is_valid_instagram_url",
    "is_valid_website_url",
    "normalize_business_name",
    "is_high_ticket_niche",
    "detect_friction_points",
    "calculate_prospect_score",
    "evaluate_reddit_pre_filter",
    "normalize_google_maps_item",
    "normalize_meta_ads_item",
    "normalize_reddit_item",
    "deduplicate_candidates",
]
