"""Opportunity Orchestrator Service — Coordinates Opportunity Agent and Lead Analyst synthesis.

Pipeline:
Candidate (+ Optional Specialist Aggregate)
    │
    ▼ (if aggregate not provided)
Specialist Orchestrator (Lead Triage + Parallel Specialists)
    │
    ▼
Deterministic Scorer (Pure baseline opportunity score + service hint)
    │
    ▼
Opportunity Agent (Multi-source evidence synthesis + problem/service reasoning)
    │
    ▼
Lead Analyst (Final intelligence synthesis + research completeness validation)
    │
    ▼
LeadAnalysis (Structured final lead record with failure isolation and token accounting)

INVARIANTS:
- Failure isolation: Failure in Opportunity Agent or Lead Analyst falls back gracefully
  without throwing unhandled 500 errors.
- Token optimization: Strips large HTML strings, compacts payloads, passes only relevant data.
- Token accounting: Aggregates real token usage from provider metadata across all steps.
- Security: Zero tool calls, zero shell, zero network access granted to synthesis agents.
"""

import json
import logging
import time
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.agent import AgentRunRequest, TokenUsage
from app.schemas.profile import CampaignScope
from app.schemas.search import CampaignLimits
from app.schemas.evidence import (
    Evidence,
    LeadTriageResult,
    SpecialistResearchAggregate,
)
from app.schemas.opportunity import OpportunityResult, normalize_service_name
from app.schemas.lead_analysis import LeadAnalysis
from app.services.deterministic_pipeline import NormalizedCandidate
from app.services.agent_runner import AgentRunnerService, get_agent_runner
from app.services.specialist_orchestrator import (
    SpecialistOrchestratorService,
    get_specialist_orchestrator,
    _combine_token_usage,
)
from app.services.opportunity_scorer import (
    OpportunityScoreBreakdown,
    calculate_opportunity_score,
)
from app.agents.opportunity_agent import build_low_evidence_opportunity_result
from app.agents.lead_analyst import build_fallback_lead_analysis

logger = logging.getLogger("ai_worker.services.opportunity_orchestrator")


class OpportunityPipelineResult(BaseModel):
    """Complete structured output from the Phase 6 synthesis pipeline."""
    model_config = ConfigDict(populate_by_name=True)

    lead_analysis: LeadAnalysis
    opportunity_result: OpportunityResult
    specialist_aggregate: SpecialistResearchAggregate
    token_usage: TokenUsage
    execution_time_ms: float = Field(default=0.0, ge=0.0)


class OpportunityOrchestratorService:
    """Service coordinating end-to-end Opportunity and Lead Analyst intelligence synthesis."""

    def __init__(
        self,
        agent_runner: Optional[AgentRunnerService] = None,
        specialist_orchestrator: Optional[SpecialistOrchestratorService] = None,
    ):
        self.runner = agent_runner or get_agent_runner()
        self.specialists = specialist_orchestrator or get_specialist_orchestrator()

    async def analyze_opportunity(
        self,
        candidate: NormalizedCandidate,
        specialist_aggregate: Optional[SpecialistResearchAggregate] = None,
        campaign_scope: Optional[CampaignScope] = None,
        limits: Optional[CampaignLimits] = None,
        timeout_seconds: float = 120.0,
    ) -> OpportunityPipelineResult:
        """Execute the complete Phase 6 synthesis pipeline for a candidate."""
        start_time = time.perf_counter()
        total_tokens = TokenUsage(prompt_tokens=0, completion_tokens=0, total_tokens=0)

        # -----------------------------------------------------------------
        # 1. Specialist Research: Use provided aggregate or run specialists
        # -----------------------------------------------------------------
        aggregate: SpecialistResearchAggregate
        if specialist_aggregate is not None:
            aggregate = specialist_aggregate
            if aggregate.token_usage:
                total_tokens = _combine_token_usage(total_tokens, aggregate.token_usage)
        else:
            logger.info("Executing Phase 5 specialist research for '%s'", candidate.business_name)
            aggregate = await self.specialists.research_candidate(
                candidate=candidate,
                campaign_scope=campaign_scope,
                limits=limits,
            )
            if aggregate.token_usage:
                total_tokens = _combine_token_usage(total_tokens, aggregate.token_usage)

        # -----------------------------------------------------------------
        # 2. Deterministic Baseline Scoring
        # -----------------------------------------------------------------
        det_score: OpportunityScoreBreakdown = calculate_opportunity_score(
            candidate=candidate,
            aggregate=aggregate,
        )

        # -----------------------------------------------------------------
        # 3. Disqualification Fast-Path: Zero Token LLM Spend on low-value leads
        # -----------------------------------------------------------------
        triage_res = aggregate.triage_result
        if not triage_res.qualified or candidate.scorecard_score < 4 or candidate.priority_tier == "skip":
            logger.info(
                "Candidate '%s' disqualified at triage (qualified=%s, score=%d); emitting deterministic fallback",
                candidate.business_name,
                triage_res.qualified,
                candidate.scorecard_score,
            )
            opp_res = build_low_evidence_opportunity_result(
                candidate=candidate,
                reason=triage_res.reason or "Candidate disqualified by triage rules",
            )
            lead_analysis = build_fallback_lead_analysis(
                candidate=candidate,
                triage_result=triage_res,
                opportunity_result=opp_res,
                research_status=det_score.research_status,
                limitations=det_score.limitations or ["Candidate disqualified before deep synthesis"],
                reason=triage_res.reason,
            )
            duration_ms = (time.perf_counter() - start_time) * 1000
            lead_analysis.execution_time_ms = round(duration_ms, 2)
            lead_analysis.token_usage = total_tokens

            return OpportunityPipelineResult(
                lead_analysis=lead_analysis,
                opportunity_result=opp_res,
                specialist_aggregate=aggregate,
                token_usage=total_tokens,
                execution_time_ms=round(duration_ms, 2),
            )

        # -----------------------------------------------------------------
        # 4. Compact Context Preparation for Opportunity Agent (Token-Optimized)
        # -----------------------------------------------------------------
        compact_evidence = []
        for ev in aggregate.aggregated_evidence:
            compact_evidence.append({
                "source": ev.source,
                "finding": ev.finding,
                "evidence": ev.evidence[:300],
                "confidence": ev.confidence,
                "classification": ev.classification,
            })

        website_summary = None
        if aggregate.website_analysis:
            website_summary = {
                "status": aggregate.website_analysis.status,
                "has_booking_system": aggregate.website_analysis.has_booking_system,
                "has_whatsapp_cta": aggregate.website_analysis.has_whatsapp_cta,
                "primary_cta": aggregate.website_analysis.primary_cta,
                "friction_points": aggregate.website_analysis.friction_points,
                "findings": aggregate.website_analysis.findings[:4],
            }

        ads_summary = None
        if aggregate.ads_analysis:
            ads_summary = {
                "status": aggregate.ads_analysis.status,
                "active_ad_count": aggregate.ads_analysis.active_ad_count,
                "ad_themes": aggregate.ads_analysis.ad_themes[:3],
                "observed_ctas": aggregate.ads_analysis.observed_ctas[:3],
                "funnel_friction": aggregate.ads_analysis.funnel_friction[:3],
            }

        maps_summary = None
        if aggregate.maps_analysis:
            maps_summary = {
                "status": aggregate.maps_analysis.status,
                "rating": aggregate.maps_analysis.rating,
                "review_count": aggregate.maps_analysis.review_count,
                "business_category": aggregate.maps_analysis.business_category,
                "website_present": aggregate.maps_analysis.website_present,
                "phone": aggregate.maps_analysis.phone,
            }

        candidate_summary = {
            "business_name": candidate.business_name,
            "business_type": candidate.business_type,
            "source_platform": candidate.source_platform,
            "scorecard_score": candidate.scorecard_score,
            "priority_tier": candidate.priority_tier,
            "rating": candidate.rating,
            "review_count": candidate.review_count,
            "has_active_ads": candidate.has_active_ads,
            "friction_points": candidate.friction_points,
        }

        deterministic_hints = {
            "baseline_opportunity_score": det_score.opportunity_score,
            "suggested_service": det_score.recommended_service,
            "detected_frictions": det_score.detected_frictions,
            "scoring_components": det_score.scoring_components,
        }

        opportunity_prompt = (
            f"Analyze verified intelligence for prospective business '{candidate.business_name}':\n\n"
            f"Candidate Overview:\n{json.dumps(candidate_summary, indent=2)}\n\n"
            f"Specialist Research Findings:\n"
            f"- Website Audit: {json.dumps(website_summary, indent=2)}\n"
            f"- Meta Ads Audit: {json.dumps(ads_summary, indent=2)}\n"
            f"- Maps Audit: {json.dumps(maps_summary, indent=2)}\n\n"
            f"Preserved Evidence Items:\n{json.dumps(compact_evidence, indent=2)}\n\n"
            f"Deterministic Scoring Reference:\n{json.dumps(deterministic_hints, indent=2)}\n\n"
            "Synthesize this intelligence into a structured OpportunityResult:\n"
            "1. Identify the primary operational problem or bottleneck.\n"
            "2. Recommend the most appropriate service strictly from the 7 approved profile services.\n"
            "3. In 'why_this_service', detail the chain: Problem -> Impact -> Service -> Solution.\n"
            "4. Return an opportunity_score bounded between 0.0 and 100.0 (aligned with deterministic signals).\n"
            "5. Return confidence bounded between 0.0 and 1.0.\n"
            "6. Ground findings in verified evidence with source and classification (observed, inferred, unknown)."
        )

        # -----------------------------------------------------------------
        # 5. Execute Opportunity Agent with Failure Isolation
        # -----------------------------------------------------------------
        synthesis_partial = False
        combined_limitations: list[str] = list(det_score.limitations)
        opp_result: OpportunityResult
        try:
            opp_req = AgentRunRequest(
                prompt=opportunity_prompt,
                agent_type="opportunity",
                timeout_seconds=min(timeout_seconds, 120.0),
            )
            opp_resp = await self.runner.execute(opp_req)
            if opp_resp.token_usage:
                total_tokens = _combine_token_usage(total_tokens, opp_resp.token_usage)

            if opp_resp.success and opp_resp.output:
                out = opp_resp.output
                if isinstance(out, OpportunityResult):
                    opp_result = out
                elif isinstance(out, dict):
                    opp_result = OpportunityResult.model_validate(out)
                else:
                    logger.warning("Unrecognized Opportunity Agent output type: %s", type(out))
                    synthesis_partial = True
                    lim_msg = "Opportunity Agent output format invalid; using deterministic baseline."
                    if lim_msg not in combined_limitations:
                        combined_limitations.append(lim_msg)
                    opp_result = OpportunityResult(
                        opportunity_score=det_score.opportunity_score,
                        primary_problem=det_score.primary_problem,
                        recommended_service=det_score.recommended_service,
                        why_this_service=det_score.why_this_service,
                        evidence=aggregate.aggregated_evidence,
                        confidence=min(0.40, det_score.confidence),
                    )
            else:
                logger.warning("Opportunity Agent run failed: %s; using deterministic fallback", opp_resp.error)
                synthesis_partial = True
                lim_msg = f"Opportunity Agent synthesis unavailable ({opp_resp.error}); using deterministic baseline."
                if lim_msg not in combined_limitations:
                    combined_limitations.append(lim_msg)
                opp_result = OpportunityResult(
                    opportunity_score=det_score.opportunity_score,
                    primary_problem=det_score.primary_problem,
                    recommended_service=det_score.recommended_service,
                    why_this_service=det_score.why_this_service,
                    evidence=aggregate.aggregated_evidence,
                    confidence=min(0.40, det_score.confidence),
                )
        except Exception as exc:
            logger.error("Opportunity Agent threw exception: %s; using deterministic fallback", exc, exc_info=True)
            synthesis_partial = True
            lim_msg = f"Opportunity Agent synthesis exception ({str(exc)}); using deterministic baseline."
            if lim_msg not in combined_limitations:
                combined_limitations.append(lim_msg)
            opp_result = OpportunityResult(
                opportunity_score=det_score.opportunity_score,
                primary_problem=det_score.primary_problem,
                recommended_service=det_score.recommended_service,
                why_this_service=det_score.why_this_service,
                evidence=aggregate.aggregated_evidence,
                confidence=min(0.40, det_score.confidence),
            )

        # -----------------------------------------------------------------
        # 6. Execute Lead Analyst with Failure Isolation
        # -----------------------------------------------------------------
        lead_analyst_payload = {
            "business_name": candidate.business_name,
            "prospect_score": float(candidate.scorecard_score),
            "priority": triage_res.priority,
            "triage_decision": {
                "qualified": triage_res.qualified,
                "priority": triage_res.priority,
                "reason": triage_res.reason,
                "research_agents": triage_res.research_agents,
            },
            "specialist_execution_status": aggregate.execution_status,
            "known_limitations": combined_limitations,
            "opportunity_result": {
                "opportunity_score": opp_result.opportunity_score,
                "primary_problem": opp_result.primary_problem,
                "recommended_service": opp_result.recommended_service,
                "why_this_service": opp_result.why_this_service,
                "confidence": opp_result.confidence,
            },
        }

        lead_analyst_prompt = (
            f"You are the LeadPulse Lead Analyst synthesizing final intelligence for '{candidate.business_name}':\n"
            f"{json.dumps(lead_analyst_payload, indent=2)}\n\n"
            "Evaluate research completeness and emit a structured LeadAnalysis record:\n"
            "- qualification_status: 'qualified' or 'disqualified'\n"
            "- priority: 'high', 'medium', or 'low'\n"
            "- prospect_score: float matching candidate scorecard score\n"
            "- opportunity_score: float matching synthesized opportunity score\n"
            "- primary_problem: concise summary of the core friction\n"
            "- recommended_service: approved canonical service\n"
            "- why_this_service: value proposition rationale\n"
            "- research_status: 'complete' if all specialists succeeded; 'partial' if any specialist failed/timed out; 'failed' if all failed\n"
            "- limitations: list all unobservable aspects, timeouts, or data gaps\n"
            "- confidence: overall confidence score [0.0, 1.0]"
        )

        final_lead: LeadAnalysis
        try:
            analyst_req = AgentRunRequest(
                prompt=lead_analyst_prompt,
                agent_type="lead_analyst",
                timeout_seconds=min(timeout_seconds, 120.0),
            )
            analyst_resp = await self.runner.execute(analyst_req)
            if analyst_resp.token_usage:
                total_tokens = _combine_token_usage(total_tokens, analyst_resp.token_usage)

            if analyst_resp.success and analyst_resp.output:
                out = analyst_resp.output
                if isinstance(out, LeadAnalysis):
                    final_lead = out
                elif isinstance(out, dict):
                    final_lead = LeadAnalysis.model_validate(out)
                else:
                    logger.warning("Unrecognized Lead Analyst output format: %s; using deterministic fallback", type(out))
                    synthesis_partial = True
                    lim_msg = "Lead Analyst emitted unparseable format; using deterministic fallback."
                    if lim_msg not in combined_limitations:
                        combined_limitations.append(lim_msg)
                    fallback_status = "partial" if det_score.research_status in ("complete", "partial") else "failed"
                    final_lead = build_fallback_lead_analysis(
                        candidate=candidate,
                        triage_result=triage_res,
                        opportunity_result=opp_result,
                        research_status=fallback_status,
                        limitations=combined_limitations,
                    )
            else:
                logger.warning("Lead Analyst run failed: %s; using fallback", analyst_resp.error)
                synthesis_partial = True
                lim_msg = f"Lead Analyst agent error: {analyst_resp.error}"
                if lim_msg not in combined_limitations:
                    combined_limitations.append(lim_msg)
                fallback_status = "partial" if det_score.research_status in ("complete", "partial") else "failed"
                final_lead = build_fallback_lead_analysis(
                    candidate=candidate,
                    triage_result=triage_res,
                    opportunity_result=opp_result,
                    research_status=fallback_status,
                    limitations=combined_limitations,
                )
        except Exception as exc:
            logger.error("Lead Analyst threw exception: %s; using fallback", exc, exc_info=True)
            synthesis_partial = True
            lim_msg = f"Lead Analyst exception: {str(exc)}"
            if lim_msg not in combined_limitations:
                combined_limitations.append(lim_msg)
            fallback_status = "partial" if det_score.research_status in ("complete", "partial") else "failed"
            final_lead = build_fallback_lead_analysis(
                candidate=candidate,
                triage_result=triage_res,
                opportunity_result=opp_result,
                research_status=fallback_status,
                limitations=combined_limitations,
            )

        # -----------------------------------------------------------------
        # 7. Post-Synthesis Invariant Validation & Metadata Attachment
        # -----------------------------------------------------------------
        duration_ms = (time.perf_counter() - start_time) * 1000
        final_lead.execution_time_ms = round(duration_ms, 2)
        final_lead.token_usage = total_tokens

        # If any specialist failed or campaign blocked, or synthesis was degraded, ensure research_status is not 'complete'
        any_specialist_failed = any(
            "fail" in s or "error" in s or "exception" in s or "timeout" in s or "block" in s
            for s in aggregate.execution_status.values()
        )
        if any_specialist_failed or synthesis_partial:
            if final_lead.research_status == "complete":
                final_lead.research_status = "partial"
            for k, v in aggregate.execution_status.items():
                if "fail" in v or "error" in v or "exception" in v or "timeout" in v or "block" in v:
                    lim_text = f"{k.capitalize()} research unavailable: {v}"
                    if lim_text not in final_lead.limitations:
                        final_lead.limitations.append(lim_text)
            for lim in combined_limitations:
                if lim not in final_lead.limitations:
                    final_lead.limitations.append(lim)

        # Ensure evidence list from specialist aggregate is preserved
        if not final_lead.evidence and opp_result.evidence:
            final_lead.evidence = list(opp_result.evidence)
        elif not final_lead.evidence and aggregate.aggregated_evidence:
            final_lead.evidence = list(aggregate.aggregated_evidence)

        logger.info(
            "Phase 6 opportunity analysis completed for '%s' in %.2f ms (tokens: %d, opp_score: %.1f, status: %s)",
            candidate.business_name,
            duration_ms,
            total_tokens.total_tokens,
            final_lead.opportunity_score,
            final_lead.research_status,
        )

        return OpportunityPipelineResult(
            lead_analysis=final_lead,
            opportunity_result=opp_result,
            specialist_aggregate=aggregate,
            token_usage=total_tokens,
            execution_time_ms=round(duration_ms, 2),
        )


_opportunity_orchestrator_instance: Optional[OpportunityOrchestratorService] = None


def get_opportunity_orchestrator() -> OpportunityOrchestratorService:
    """Retrieve singleton OpportunityOrchestratorService."""
    global _opportunity_orchestrator_instance
    if _opportunity_orchestrator_instance is None:
        _opportunity_orchestrator_instance = OpportunityOrchestratorService()
    return _opportunity_orchestrator_instance


__all__ = [
    "OpportunityPipelineResult",
    "OpportunityOrchestratorService",
    "get_opportunity_orchestrator",
]
