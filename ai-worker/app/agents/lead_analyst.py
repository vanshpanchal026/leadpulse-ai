"""Lead Analyst Agent — Final intelligence synthesizer for LeadPulse AI V2.

Consumes:
- Normalized candidate data
- Deterministic scorecard results
- Lead triage evaluation
- Specialist research aggregate
- Opportunity result

Produces:
- LeadAnalysis: Structured final lead record with qualification status,
  priority, prospect and opportunity scores, primary problem, canonical service
  recommendation, research completion status, and explicit limitations.

STRICT AGENT BOUNDARIES:
- NO tool execution (no web requests, no Apify, no database access, no shell).
- Pure synthesis agent.
- If a specialist failed, research_status MUST be 'partial' and limitations MUST be preserved.
- The Lead Analyst must NEVER fabricate or assume findings from failed specialists.
"""

from __future__ import annotations
from typing import Literal, Optional, TYPE_CHECKING
from agents import Agent

from app.core.provider import create_configured_agent
from app.core.prompt_loader import load_prompt
from app.schemas.evidence import LeadTriageResult, SpecialistResearchAggregate
from app.schemas.opportunity import OpportunityResult, APPROVED_SERVICES
from app.schemas.lead_analysis import LeadAnalysis

if TYPE_CHECKING:
    from app.services.deterministic_pipeline import NormalizedCandidate


def build_fallback_lead_analysis(
    candidate: NormalizedCandidate,
    triage_result: Optional[LeadTriageResult] = None,
    opportunity_result: Optional[OpportunityResult] = None,
    research_status: Literal["complete", "partial", "failed"] = "failed",
    limitations: Optional[list[str]] = None,
    reason: str = "Fallback evaluation generated due to pipeline constraints",
) -> LeadAnalysis:
    """Deterministic fallback builder for disqualified, low-evidence, or failed executions.
    
    Consumes zero LLM tokens and guarantees complete schema conformance without hallucinations.
    """
    is_qualified = bool(
        triage_result
        and triage_result.qualified
        and candidate.scorecard_score >= 4
        and candidate.priority_tier != "skip"
    )
    qual_status = "qualified" if is_qualified else "disqualified"
    priority = triage_result.priority if (is_qualified and triage_result) else "low"
    sc_score = float(candidate.scorecard_score)
    opp_score = opportunity_result.opportunity_score if opportunity_result else min(20.0, sc_score * 2.0)
    conf = opportunity_result.confidence if opportunity_result else 0.10
    prob = opportunity_result.primary_problem if opportunity_result else f"Evaluation limited: {reason}"
    serv = opportunity_result.recommended_service if opportunity_result else "business_automation"
    why = opportunity_result.why_this_service if opportunity_result else f"Data constraints: {reason}"
    ev = opportunity_result.evidence if opportunity_result else []
    lims = list(limitations) if limitations else [reason]

    return LeadAnalysis(
        business_name=candidate.business_name,
        qualification_status=qual_status,
        priority=priority,  # type: ignore[arg-type]
        prospect_score=sc_score,
        opportunity_score=round(opp_score, 1),
        primary_problem=prob,
        recommended_service=serv,
        why_this_service=why,
        evidence=ev,
        confidence=round(conf, 3),
        research_status=research_status,
        limitations=lims,
    )


def build_lead_analyst_instructions() -> str:
    """Construct system instructions for the Lead Analyst agent."""
    services_list = "\n".join([f"- '{k}': {v}" for k, v in APPROVED_SERVICES.items()])
    
    loaded = load_prompt("lead_analyst", services_list=services_list)
    if loaded:
        return loaded
        
    return (
        "You are the LeadPulse AI Lead Analyst.\n"
        "You are the final intelligence synthesizer. Your task is to review all evidence from the prospecting "
        "pipeline and synthesize a final structured LeadAnalysis record.\n\n"
        "--- OPERATIONAL BOUNDARIES ---\n"
        "1. You are a pure synthesis agent. You do NOT have any external tools, web search, or database access.\n"
        "2. You consume ONLY the candidate data, triage results, specialist findings, and opportunity synthesis.\n\n"
        "--- APPROVED SERVICES ---\n"
        "The recommended_service MUST be one of the 7 approved canonical services:\n"
        f"{services_list}\n\n"
        "--- RESEARCH COMPLETION & PARTIAL FAILURE DISCIPLINE ---\n"
        "Evaluate the research execution status carefully:\n"
        "- If all requested specialist investigations succeeded: research_status='complete'.\n"
        "- If any specialist timed out, encountered an error, or was unavailable while some data exists: "
        "  research_status MUST be 'partial', and you MUST record the specific limitation in 'limitations'.\n"
        "- If all research failed or candidate could not be analyzed: research_status='failed'.\n\n"
        "CRITICAL ANTI-HALLUCINATION RULE FOR FAILED SPECIALISTS:\n"
        "You must NEVER assume or fabricate findings from an unavailable specialist.\n"
        "Example: If Ads research failed or was unavailable, NEVER claim 'the business is spending heavily on ads'. "
        "State plainly: 'Ads research was unavailable, so advertising activity could not be verified.'\n\n"
        "--- SCORING & QUALIFICATION CONSTRAINTS ---\n"
        "- qualification_status: 'qualified' or 'disqualified'.\n"
        "- priority: 'high', 'medium', or 'low'.\n"
        "- prospect_score: Grounded in candidate scorecard score.\n"
        "- opportunity_score: Bounded [0.0, 100.0].\n"
        "- confidence: Bounded [0.0, 1.0].\n"
        "- limitations: Explicit list of missing data sources, timeouts, or unobservable factors.\n"
        "- You must ALWAYS emit a valid JSON object matching the LeadAnalysis schema.\n"
        "- Never output plain conversational text, apologies, or explanations outside the JSON."
    )


def create_lead_analyst_agent(model: Optional[str] = None) -> Agent:
    """Create the configured Lead Analyst Agent instance."""
    return create_configured_agent(
        name="LeadPulseLeadAnalyst",
        instructions=build_lead_analyst_instructions(),
        output_type=LeadAnalysis,
        model=model,
    )


__all__ = [
    "build_fallback_lead_analysis",
    "build_lead_analyst_instructions",
    "create_lead_analyst_agent",
]
