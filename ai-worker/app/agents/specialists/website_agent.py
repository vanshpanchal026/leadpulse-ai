"""Website Specialist Agent — Analyzes publicly available website content with strict observability boundaries.

Inspects only information that was actually retrieved by the controlled website retrieval service:
- website availability
- homepage / landing-page structure
- primary CTA
- booking / contact path
- form friction
- WhatsApp / contact accessibility
- service presentation
- trust signals
- conversion friction

STRICT ANTI-HALLUCINATION INVARIANTS:
- Never claim something was observed if the website could not be accessed.
- If unavailable: status = 'unavailable'.
- Do NOT infer that the business has a bad website simply because the site could not be reached.
- Every finding must be backed by an Evidence object with classification: 'observed', 'inferred', or 'unknown'.
"""

from typing import Optional
from agents import Agent

from app.core.provider import create_configured_agent
from app.core.prompt_loader import load_prompt
from app.schemas.evidence import Evidence, WebsiteAnalysisResult


def build_no_website_result(
    reason: str = "No website URL provided in candidate data",
) -> WebsiteAnalysisResult:
    """Deterministic fallback when a business has no website URL at all.
    
    Guarantees zero hallucination without consuming model tokens:
    status is explicitly 'no_website', friction_points is empty,
    and no claims about site quality, speed, CTAs, or booking systems are made.
    """
    return WebsiteAnalysisResult(
        status="no_website",
        findings=[f"No website exists or was provided for this business: {reason}."],
        evidence=[],
        confidence=0.1,
        limitations=[f"No website available: {reason}"],
        website_url=None,
        has_booking_system=None,
        has_whatsapp_cta=None,
        primary_cta=None,
        friction_points=[],
        conversion_notes="No public website exists for conversion audit."
    )


def build_unavailable_website_result(
    url: Optional[str] = None,
    error_reason: str = "Website could not be reached or fetched",
    status: str = "unavailable"
) -> WebsiteAnalysisResult:
    """Deterministic fallback when a website is unreachable, absent, or analysis failed.
    
    Guarantees zero hallucination without consuming model tokens:
    status is explicitly 'unavailable', 'error', or 'no_website', and no negative claims about business
    quality, CTAs, or booking systems are made.
    """
    if status == "no_website" or (not url and status != "error"):
        return build_no_website_result(error_reason)

    valid_status = status if status in ("unavailable", "error") else "unavailable"
    finding_title = "Website inspection error" if valid_status == "error" else "Website unreachable or unavailable"
    evidence_list = []
    if url:
        evidence_list.append(
            Evidence(
                finding=finding_title,
                source="website",
                evidence=f"Controlled retrieval/audit attempt for '{url}' failed: {error_reason}",
                confidence=0.1,
                classification="observed"
            )
        )

    findings_msg = (
        f"Website analysis could not be completed: {error_reason}"
        if valid_status == "error"
        else "Website could not be reached; no direct observations could be made."
    )

    return WebsiteAnalysisResult(
        status=valid_status,  # type: ignore[arg-type]
        findings=[findings_msg],
        evidence=evidence_list,
        confidence=0.1,
        limitations=[f"Website inspection unavailable: {error_reason}"],
        website_url=url,
        has_booking_system=None,
        has_whatsapp_cta=None,
        primary_cta=None,
        friction_points=[],
        conversion_notes="No public website content accessible for conversion audit."
    )


def create_website_specialist_agent(model: Optional[str] = None) -> Agent:
    """Create the Website Specialist Agent enforcing WebsiteAnalysisResult structured output."""
    loaded = load_prompt("website_agent")
    if loaded:
        instructions = loaded
    else:
        instructions = (
            "You are the LeadPulse AI Website Specialist Agent.\n"
            "Your task is to analyze publicly available website information provided in the input context.\n"
            "Inspect ONLY information that was actually retrieved and is present in the context.\n\n"
            "--- OBSERVABILITY & ANTI-HALLUCINATION RULES ---\n"
            "1. Never claim something was observed if the website was not accessed or is marked unavailable or absent.\n"
            "2. If no website exists / no website URL was provided (no_website):\n"
            "   - Skip analysis entirely.\n"
            "   - Set status='no_website'.\n"
            "   - Set friction_points=[] (no friction claims, since there is no website to audit).\n"
            "   - Set has_booking_system=None, has_whatsapp_cta=None, primary_cta=None.\n"
            "   - Emit an informative finding noting that no website was provided.\n"
            "   - DO NOT make any claims about slow page speed, broken links, or poor website quality.\n"
            "3. If a website URL exists but retrieval/fetch failed or could not be reached:\n"
            "   - Set status='unavailable'.\n"
            "   - Set has_booking_system=None, has_whatsapp_cta=None, primary_cta=None.\n"
            "   - DO NOT claim the business has a 'poor website' or 'bad booking system' simply because the site could not be reached.\n"
            "4. If the website was successfully retrieved:\n"
            "   - Set status='available' (or 'partial' if truncated).\n"
            "   - Identify observed primary CTAs (e.g., 'Book Appointment', 'Call Now').\n"
            "   - Check for WhatsApp direct contact links or buttons.\n"
            "   - Identify third-party or native booking flows if clearly observed.\n"
            "   - Note specific friction points observable in the text/structure.\n"
            "5. Evidence Model:\n"
            "   - For every key finding, emit an Evidence item with source='website', bounded confidence [0.0, 1.0], "
            "     and classification strictly as 'observed', 'inferred', or 'unknown'.\n"
            "   - Observed findings must reference actual text or links seen in the retrieval summary.\n"
            "   - Inferred findings must be explicitly tagged as 'inferred'.\n"
            "   - Unknown features must never be converted into observed.\n\n"
            "Emit a structured WebsiteAnalysisResult matching the schema."
        )

    return create_configured_agent(
        name="LeadPulseWebsiteSpecialistAgent",
        instructions=instructions,
        output_type=WebsiteAnalysisResult,
        model=model
    )


__all__ = [
    "build_no_website_result",
    "build_unavailable_website_result",
    "create_website_specialist_agent",
]
