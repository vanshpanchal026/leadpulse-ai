"""Deterministic Outreach Validator for LeadPulse AI V2 Phase 7.

Enforces zero-LLM anti-spam, length, sentence structure, canonical service,
placeholder, and hallucination / unsupported claim boundaries.

INVARIANTS:
1. 100% deterministic and reproducible: identical inputs produce identical results.
2. Zero LLM dependencies: all checks are pure Python regex / string inspection.
3. Length strictly <= 300 characters.
4. Sentence count strictly between 2 and 3 sentences.
5. Case-insensitive banned phrase rejection ("We help", "Hop on a call", etc.).
6. Placeholder rejection ({name}, [company], YOUR BUSINESS, etc.).
7. Canonical approved service enforcement.
8. Unsupported causal, financial, ROAS, and fake-proof claim rejection.
9. Spam formatting and excessive punctuation rejection.
"""

import re
from typing import Optional
from app.schemas.evidence import Evidence
from app.schemas.lead_analysis import LeadAnalysis
from app.schemas.opportunity import APPROVED_SERVICES, SERVICE_ALIAS_MAP, normalize_service_name
from app.schemas.outreach import OutreachValidationResult

MAX_CHARACTER_LIMIT = 300
MIN_SENTENCES = 2
MAX_SENTENCES = 3

BANNED_PHRASES = [
    "we help",
    "we specialize",
    "game-changer",
    "game changer",
    "leverage",
    "hop on a call",
    "book a demo",
    # Obvious sales spam / urgency
    "act now",
    "limited time",
    "don't miss out",
    "urgent",
    "offer ends",
    "last chance",
    # Fake scarcity
    "spots are limited",
    "spots left",
    "limited spots",
    # Guaranteed results
    "guaranteed",
    "guarantee",
    "100% guaranteed",
    "risk free",
    "risk-free",
]

BANNED_PHRASE_REGEXES = [
    (r"\bwe(?:'ve|\s+have|\s+are)?\s+(?:help|helped|helping|helps)\b", "we help"),
    (r"\bwe(?:'ve|\s+have|\s+are)?\s+(?:specialize|specialized|specializing|specializes)\b", "we specialize"),
    (r"\bgame\s*[- ]\s*changer\b", "game-changer"),
    (r"\bleverag(?:e|es|ed|ing)\b", "leverage"),
    (r"\b(?:hop|jump)\s+on\s+(?:a\s+)?(?:quick\s+|short\s+|15-?min(?:ute)?\s+)?call\b", "hop on a call"),
    (r"\bbook\s+(?:a\s+)?(?:free\s+|quick\s+)?demo\b", "book a demo"),
    (r"\bact\s+now\b", "act now"),
    (r"\blimited\s+time\b", "limited time"),
    (r"\bdon'?t\s+miss\s+out\b", "don't miss out"),
    (r"\burgent\b", "urgent"),
    (r"\boffer\s+ends\b", "offer ends"),
    (r"\blast\s+chance\b", "last chance"),
    (r"\bspots\s+(?:are\s+)?limited\b", "spots are limited"),
    (r"\b(?:only\s+)?\d+\s+spots?\s+left\b", "only X spots left"),
    (r"\bspots?\s+left\b", "spots left"),
    (r"\blimited\s+spots?\b", "limited spots"),
    (r"\b(?:100%\s+)?guaranteed?\b", "guaranteed"),
    (r"\brisk\s*[- ]\s*free\b", "risk-free"),
]

PLACEHOLDER_PATTERNS = [
    r"\{[a-zA-Z0-9_\s\-\.]+\}",          # {name}, {company}, {business}
    r"\[[a-zA-Z0-9_\s\-\.]+\]",          # [name], [company], [insert name]
    r"<[a-zA-Z0-9_\s\-\.]+>",            # <name>, <business>
    r"\bYOUR BUSINESS\b",
    r"\bYOUR COMPANY\b",
    r"\bINSERT NAME\b",
    r"\bINSERT BUSINESS\b",
    r"\bINSERT CLIENT\b",
    r"\bINSERT COMPANY\b",
    r"\bREPLACE THIS\b",
]

# Mechanically detectable unsupported claims (causal, financial, ROAS, fake proof)
UNSUPPORTED_CLAIM_PATTERNS = [
    (r"\b(?:your\s+)?ads\s+(?:aren't|are\s+not)\s+converting\b", "Unsupported claim: 'ads aren't converting'"),
    (r"\byour\s+roas\s+is\s+poor\b|\bpoor\s+roas\b", "Unsupported claim: 'ROAS is poor'"),
    (r"\bwasting\s+(?:ad|advertising)\s+spend\b", "Unsupported claim: 'wasting ad spend'"),
    (r"\blosing\s+(?:money|cash)\s+on\s+ads\b", "Unsupported claim: 'losing money on ads'"),
    (r"\blosing\s+(?:₹|\$|rs\.?|inr|usd)?\s*[\d,]+", "Unsupported revenue claim: 'losing ₹/$/amount'"),
    (r"\b(?:increase|boost|grow)\s+revenue\s+by\b", "Unsupported revenue guarantee"),
    (r"\b(?:increase|boost|grow)\s+.*?\s+by\s+\d+%\b", "Unsupported percentage increase promise"),
    (r"\b\d+%\s*(?:increase|boost|growth|higher|more)\b", "Unsupported percentage increase promise"),
    (r"\b\d+x\s+(?:more|leads|revenue|conversions|bookings|roi)\b", "Unsupported multiplier claim"),
    (r"\b(?:we\s+(?:have\s+)?)?worked\s+with\s+\d+\+?\s+(?:clinics?|clients?|businesses?|practices?|companies?)\b", "Fake social proof: 'worked with X+ clients'"),
    (r"\b(?:served|helped)\s+\d+\+?\s+(?:clinics?|clients?|businesses?|practices?|companies?)\b", "Fake social proof: 'helped/served X+ clients'"),
    (r"\b\d+\+\s+(?:clinics?|clients?|businesses?|practices?|companies?)\b", "Fake social proof: 'X+ clients/businesses'"),
    (r"\bwe\s+generated\s+\d+\s+(?:leads|bookings|clients|sales)\b", "Unsupported testimonial: 'we generated X leads'"),
    (r"\bour\s+clients\s+(?:get|see|achieve|average)\b", "Unsupported social proof: 'our clients get/see'"),
    (r"\bwe\s+(?:increased|boosted)\s+revenue\b", "Unsupported agency claim: 'we increased revenue'"),
    (r"\b(?:your\s+)?website\s+is\s+(?:costing|losing)\s+you\s+(?:customers|leads|sales)\b", "Unsupported causal claim: 'website is costing/losing you customers/leads'"),
    (r"\b(?:your\s+)?(?:website|site)\s+is\s+slow\b|\bslow\s+(?:website|site|loading)\b|\b(?:website|site)\s+takes?\s+(?:too\s+)?long\s+to\s+load\b|\bfix\s+your\s+(?:slow\s+)?site\b", "Unsupported site performance claim: 'slow website'"),
    (r"\bcompetitors\s+are\s+outperforming\s+you\b", "Unsupported competitive claim: 'competitors are outperforming you'"),
    (r"\bguaranteed\s+(?:results|leads|sales|growth|revenue)\b", "Unsupported guarantee claim"),
]

EXCESSIVE_PUNCTUATION_PATTERN = r"(!{2,}|\?{2,}|\${2,}|₹{2,}|!\?|\?!|%{2,})"


def count_sentences(text: str) -> int:
    """Count complete grammatical sentences deterministically.
    
    Protects against splitting on:
    - Honorifics/abbreviations: Dr., Mr., Ms., Prof., etc.
    - Decimals/ratings: 4.8, 4.9, 1.5
    - Ellipses: ...
    - Web domain extensions: .com, .org, etc.
    """
    if not text or not text.strip():
        return 0

    t = text.strip()
    # Mask common honorifics and abbreviations
    t = re.sub(r"\b(dr|mr|mrs|ms|prof|vs|eg|ie|etc)\.", r"\1<DOT>", t, flags=re.IGNORECASE)
    # Mask web domain extensions (e.g. apex.com, example.org)
    t = re.sub(r"\b([a-zA-Z0-9-]+)\.(com|org|net|in|io|co|ai|uk|de|ca)\b", r"\1<DOT>\2", t, flags=re.IGNORECASE)
    # Mask numbers and ratings (e.g. 4.8, 10.5)
    t = re.sub(r"(\d+)\.(\d+)", r"\1<DOT>\2", t)
    # Mask ellipses
    t = re.sub(r"\.{2,}", "<ELLIPSIS>", t)

    # Split by standard sentence terminators (. ! ?) followed by whitespace or end of string
    chunks = re.split(r"[.!?]+(?:\s+|$)", t)
    sentences = [c.strip() for c in chunks if c.strip()]
    return len(sentences)


def validate_outreach(
    message: str,
    service: str,
    evidence: Optional[list[Evidence]] = None,
    lead_analysis: Optional[LeadAnalysis] = None,
    require_evidence: bool = False,
) -> OutreachValidationResult:
    """Deterministically validate an outreach message draft against all Phase 7 invariants."""
    reasons: list[str] = []
    banned_phrase_found = False
    unsupported_claim_detected = False
    placeholder_detected = False
    unsupported_service = False

    cleaned_msg = (message or "").strip()
    char_len = len(cleaned_msg)
    sent_count = count_sentences(cleaned_msg)

    # 1. Empty message
    if not cleaned_msg:
        return OutreachValidationResult(
            valid=False,
            errors=["Outreach message is empty or whitespace."],
            reasons=["Outreach message is empty or whitespace."],
            character_count=0,
            sentence_count=0,
            detected_service=None,
            banned_phrase_found=False,
            unsupported_claim_detected=False,
            placeholder_detected=False,
            unsupported_service=False,
        )

    # 2. Length check (maximum 300 characters)
    if char_len > MAX_CHARACTER_LIMIT:
        reasons.append(f"Message exceeds maximum length of {MAX_CHARACTER_LIMIT} characters ({char_len} chars).")

    # 3. Sentence count (strictly 2 to 3 sentences)
    if sent_count < MIN_SENTENCES:
        reasons.append(f"Message must contain at least {MIN_SENTENCES} sentences (found {sent_count}).")
    elif sent_count > MAX_SENTENCES:
        reasons.append(f"Message must not exceed {MAX_SENTENCES} sentences (found {sent_count}).")

    # 4. Canonical approved service validation
    canonical_service = None
    try:
        canonical_service = normalize_service_name(service)
    except Exception:
        unsupported_service = True
        reasons.append(f"Service '{service}' is not in the approved LeadPulse business profile canonical services.")

    # 5. Banned phrases (case-insensitive literal & regex stem checks)
    msg_lower = cleaned_msg.lower()
    for phrase in BANNED_PHRASES:
        pattern = r"\b" + re.escape(phrase) + r"\b"
        if re.search(pattern, msg_lower):
            banned_phrase_found = True
            reason_msg = f"Contains prohibited sales/agency phrase: '{phrase}'."
            if reason_msg not in reasons:
                reasons.append(reason_msg)

    for regex_pat, phrase_label in BANNED_PHRASE_REGEXES:
        if re.search(regex_pat, msg_lower):
            banned_phrase_found = True
            reason_msg = f"Contains prohibited sales/agency phrase: '{phrase_label}'."
            if reason_msg not in reasons:
                reasons.append(reason_msg)

    # 6. Placeholder detection
    for pattern in PLACEHOLDER_PATTERNS:
        match = re.search(pattern, cleaned_msg, flags=re.IGNORECASE)
        if match:
            placeholder_detected = True
            reasons.append(f"Contains unpopulated placeholder pattern: '{match.group(0)}'.")

    # 7. Unsupported claims / Hallucination detection
    # Build text corpus of supported facts from evidence and lead_analysis
    corpus_items: list[str] = []
    if evidence:
        for ev in evidence:
            corpus_items.append(f"{ev.finding} {ev.evidence}".lower())
    if lead_analysis:
        corpus_items.append(lead_analysis.primary_problem.lower())
        corpus_items.append(lead_analysis.why_this_service.lower())
        for ev in lead_analysis.evidence:
            corpus_items.append(f"{ev.finding} {ev.evidence}".lower())
    full_evidence_corpus = " ".join(corpus_items)

    for pat, desc in UNSUPPORTED_CLAIM_PATTERNS:
        match = re.search(pat, msg_lower)
        if match:
            # Check if this specific fact was explicitly observed in the evidence corpus
            matched_text = match.group(0)
            if matched_text not in full_evidence_corpus:
                unsupported_claim_detected = True
                reasons.append(f"{desc}: '{matched_text}'.")

    # Anti-hallucination: Reject site critique or slow-speed pitch when business has no website
    has_no_website = (
        "no website" in full_evidence_corpus
        or "no_website" in full_evidence_corpus
        or (lead_analysis and any("no website" in lim.lower() for lim in lead_analysis.limitations))
        or (lead_analysis and "no website" in lead_analysis.primary_problem.lower())
    )
    if has_no_website:
        slow_site_match = re.search(
            r"\b(?:slow\s+(?:site|website|load|loading)|(?:site|website)\s+is\s+slow|(?:site|website)\s+loads?\s+slowly|fix\s+your\s+(?:slow\s+)?site|slow\s+loading|(?:your\s+)?website\s+(?:speed|performance))\b",
            msg_lower,
        )
        if slow_site_match:
            unsupported_claim_detected = True
            reason_str = f"Hallucinated claim on non-existent website: '{slow_site_match.group(0)}' (business has no website)."
            if reason_str not in reasons:
                reasons.append(reason_str)

    # 8. Excessive punctuation / Spam formatting (consecutive or 3+ total exclamation marks)
    if re.search(EXCESSIVE_PUNCTUATION_PATTERN, cleaned_msg) or cleaned_msg.count("!") >= 3:
        reasons.append("Contains excessive spam punctuation or promotional symbols (e.g. !!!, ???, $$$).")

    # 9. Optional strict zero-evidence enforcement
    if require_evidence and not evidence and not lead_analysis:
        reasons.append("Draft rejected: zero grounded evidence provided.")

    is_valid = len(reasons) == 0

    return OutreachValidationResult(
        valid=is_valid,
        errors=list(reasons),
        reasons=list(reasons),
        character_count=char_len,
        sentence_count=sent_count,
        detected_service=canonical_service,
        banned_phrase_found=banned_phrase_found,
        unsupported_claim_detected=unsupported_claim_detected,
        placeholder_detected=placeholder_detected,
        unsupported_service=unsupported_service,
    )


__all__ = [
    "MAX_CHARACTER_LIMIT",
    "MIN_SENTENCES",
    "MAX_SENTENCES",
    "BANNED_PHRASES",
    "PLACEHOLDER_PATTERNS",
    "UNSUPPORTED_CLAIM_PATTERNS",
    "count_sentences",
    "validate_outreach",
]
