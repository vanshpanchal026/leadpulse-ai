"""Lead Triage Agent — Decides whether candidate deserves expensive specialist research.

Evaluates pre-filtered and scored candidates from the Phase 4 deterministic discovery pipeline:
- Deterministic fast-path: If candidate scorecard < 4 or priority_tier == 'skip', skips immediately without LLM tokens.
- LLM triage reasoning: Evaluates commercial viability, high-ticket niche alignment, and selects specialist agents.
- Strict anti-hallucination: Never invents missing business info, never contacts business, never makes network calls.
"""

from typing import Optional
from agents import Agent

from app.core.provider import create_configured_agent
from app.core.profile import LeadPulseProfile, get_business_profile
from app.core.prompt_loader import load_prompt
from app.schemas.evidence import LeadTriageResult
from app.services.deterministic_pipeline import NormalizedCandidate


def triage_candidate_deterministic(candidate: NormalizedCandidate) -> Optional[LeadTriageResult]:
    """Evaluate candidate through deterministic rules before consuming LLM tokens.
    
    If the candidate is clearly unqualified (score < 4 or skip tier), returns a rejected
    LeadTriageResult immediately with zero LLM consumption.
    If the candidate meets qualification criteria, returns None to proceed to LLM triage.
    """
    if candidate.scorecard_score < 4 or candidate.priority_tier == "skip":
        return LeadTriageResult(
            qualified=False,
            priority="low",
            reason=(
                f"Candidate scored {candidate.scorecard_score}/10 on deterministic scorecard, "
                f"which is below the qualification threshold (<4). Skipping expensive research."
            ),
            research_agents=[]
        )
    return None


def create_lead_triage_agent(
    model: Optional[str] = None,
    profile: Optional[LeadPulseProfile] = None
) -> Agent:
    """Create the Lead Triage Agent configured with the LeadTriageResult output schema."""
    prof = profile or get_business_profile()
    triage_context = prof.get_agent_context("triage")

    loaded = load_prompt("triage_agent", triage_context=triage_context)
    if loaded:
        instructions = loaded
    else:
        instructions = (
            "You are the LeadPulse AI Lead Triage Specialist.\n"
        "Your task is to analyze candidate businesses discovered in prospecting campaigns and determine "
        "whether they deserve expensive, in-depth research by specialist agents (Website, Ads, Maps).\n\n"
        "--- QUALIFICATION GUIDELINES ---\n"
        "1. High-Ticket Niche: Prioritize aesthetic clinics, cosmetic dentistry, dermatology, luxury salons, medspas.\n"
        "2. Commercial Maturity: Look for established presence (active ads, Google reviews, high rating, or verified location).\n"
        "3. Research Agent Selection:\n"
        "   - Include 'website' if the business has an observable website URL to audit.\n"
        "   - Include 'ads' if the business runs ads or has advertising signals in discovery metadata.\n"
        "   - Include 'maps' if the business has local profile signals (address, rating, reviews, phone) to verify.\n"
        "   - If qualified=True, include at least one relevant research agent.\n"
        "   - If qualified=False, research_agents must be an empty list [].\n\n"
        "--- STRICT ANTI-HALLUCINATION INVARIANTS ---\n"
        "- NEVER invent or fabricate missing contact details, revenue, customer sentiment, or business information.\n"
        "- Base your reasoning strictly and exclusively on the provided candidate metadata.\n"
        "- You do NOT contact the business, execute network calls, or write to any database.\n\n"
        "--- BUSINESS IDENTITY & CRITERIA ---\n"
        f"{triage_context}\n\n"
        "Emit a structured LeadTriageResult matching the schema keys: qualified, priority, reason, research_agents."
    )

    return create_configured_agent(
        name="LeadPulseSpecialistTriageAgent",
        instructions=instructions,
        output_type=LeadTriageResult,
        model=model
    )


__all__ = [
    "triage_candidate_deterministic",
    "create_lead_triage_agent",
]
