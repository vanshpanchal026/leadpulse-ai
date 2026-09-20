"""Opportunity Agent — Synthesizes specialist evidence into ranked business opportunities.

Consumes strictly structured outputs from Phase 5 specialists and deterministic candidate data.
Synthesizes multi-source evidence, identifies the primary business bottleneck, recommends
an approved service from the LeadPulse business profile, and calculates opportunity scores
with bounded confidence.

STRICT ANTI-HALLUCINATION INVARIANTS:
1. Must NOT create new factual claims.
2. Every factual finding must trace back to candidate data or specialist evidence.
3. Strict classification: OBSERVED (direct data), INFERRED (logical deduction), UNKNOWN (missing data).
4. Never convert unknown into observed.
5. Forbidden metrics: ad spend, ROAS, CAC, impressions, conversion rate must remain unknown.
6. Forbidden claims: No review sentiment without actual customer reviews; no claiming bad website if unavailable.
7. Services must strictly belong to the approved canonical business profile.
"""

from __future__ import annotations
from typing import Optional, TYPE_CHECKING
from agents import Agent

from app.core.provider import create_configured_agent
from app.core.prompt_loader import load_prompt
from app.schemas.evidence import Evidence
from app.schemas.opportunity import OpportunityResult, APPROVED_SERVICES

if TYPE_CHECKING:
    from app.services.deterministic_pipeline import NormalizedCandidate


def build_low_evidence_opportunity_result(
    candidate: NormalizedCandidate,
    reason: str = "Insufficient observable signals to identify consulting opportunity",
) -> OpportunityResult:
    """Deterministic fallback for low-evidence or disqualified candidates.
    
    Guarantees zero model hallucination and consumes zero LLM tokens:
    opportunity_score and confidence are bounded and low, no services are forced,
    and no false factual claims are made.
    """
    sc = candidate.scorecard_score
    score = min(20.0, max(0.0, float(sc) * 2.0))
    return OpportunityResult(
        opportunity_score=round(score, 1),
        primary_problem=f"Insufficient verified data: {reason}",
        recommended_service="business_automation",
        why_this_service="Candidate data lacked sufficient observable digital channels to establish a targeted consulting opportunity.",
        evidence=[],
        confidence=0.10,
    )


def build_opportunity_agent_instructions() -> str:
    """Construct system instructions for the Opportunity Agent enforcing strict evidence discipline."""
    services_list = "\n".join([f"- '{k}': {v}" for k, v in APPROVED_SERVICES.items()])
    
    loaded = load_prompt("opportunity_agent", services_list=services_list)
    if loaded:
        return loaded
        
    return (
        "You are the LeadPulse AI Opportunity Agent.\n"
        "Your task is to analyze candidate data and verified specialist research outputs to identify "
        "the strongest consulting opportunity, determine the primary bottleneck, and recommend the most "
        "appropriate service.\n\n"
        "--- APPROVED SERVICES (STRICT ENFORCEMENT) ---\n"
        "You may ONLY recommend one of the following 7 approved canonical services:\n"
        f"{services_list}\n\n"
        "Do NOT recommend any service outside this list (e.g. SEO, cold emailing, graphic design, social media marketing).\n\n"
        "--- EVIDENCE DISCIPLINE & ANTI-HALLUCINATION RULES ---\n"
        "1. You must NOT invent or assume new facts. Every finding must trace directly to the candidate summary or specialist outputs.\n"
        "2. Evidence Classification:\n"
        "   - 'observed': Directly observed facts (e.g., 'Website lacks booking system', 'Running active Meta Ads').\n"
        "   - 'inferred': Logical deduction from observed facts (e.g., 'Running ads without WhatsApp likely causes after-hours lead drop-off').\n"
        "   - 'unknown': Unobserved or missing data.\n"
        "3. NEVER convert an unknown into an observed fact. Never convert an inference into a claimed fact.\n"
        "4. FORBIDDEN METRICS: NEVER invent or claim ad spend, ROAS, CAC, conversion rate, impressions, or revenue.\n"
        "5. WEBSITE INTEGRITY & STATUS DISTINCTION:\n"
        "   - If website status == 'no_website' (or business has no website_url):\n"
        "     * The recommended pitch angle and primary problem MUST be about missed digital presence / getting found in search (e.g. establishing an online storefront to capture local search inquiries).\n"
        "     * NEVER claim the business has a 'slow website', 'poor page speed', 'broken booking system', or 'bad navigation' when status is 'no_website' (since there is no website to audit).\n"
        "   - If website status == 'unavailable':\n"
        "     * The pitch angle should focus on site unreachability / downtime / failure to load (e.g. losing visitors because the site cannot be reached).\n"
        "     * DO NOT fabricate details about page design or speed when the site could not be fetched.\n"
        "   - If website status == 'partial' or 'available' with real verified friction evidence:\n"
        "     * The pitch angle should address specific observed friction points (e.g. slow load speed, missing CTA, missing booking/WhatsApp flow).\n"
        "6. REVIEW INTEGRITY: Do NOT fabricate customer sentiment unless verbatim review text was provided.\n"
        "7. LOW EVIDENCE: If data is thin or missing, output a low opportunity_score (0-20), low confidence (0.1-0.3), and state the data gap.\n\n"
        "--- SERVICE RECOMMENDATION LOGIC ---\n"
        "You must explain the 4-step chain in 'why_this_service':\n"
        "1. Observed Problem: What specific gap or friction exists? (When status is 'no_website', missed search presence / lack of website; when 'unavailable', site unreachability; when 'available'/'partial', observed friction).\n"
        "2. Business Consequence: What is the financial or operational impact?\n"
        "3. Recommended Service: Which canonical service solves it?\n"
        "4. Solution Value: Why does this service solve the bottleneck?\n\n"
        "--- OUTPUT CONSTRAINTS & FORMAT INVARIANT ---\n"
        "1. opportunity_score must be between 0.0 and 100.0.\n"
        "2. confidence must be between 0.0 and 1.0.\n"
        "3. You must ALWAYS emit a valid JSON object matching the OpportunityResult schema.\n"
        "4. Never output plain conversational text, apologies, or explanations outside the JSON."
    )


def create_opportunity_agent(model: Optional[str] = None) -> Agent:
    """Create the configured Opportunity Agent instance."""
    return create_configured_agent(
        name="LeadPulseOpportunityAgent",
        instructions=build_opportunity_agent_instructions(),
        output_type=OpportunityResult,
        model=model,
    )


__all__ = [
    "build_low_evidence_opportunity_result",
    "build_opportunity_agent_instructions",
    "create_opportunity_agent",
]
