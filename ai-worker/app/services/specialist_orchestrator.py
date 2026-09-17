"""Specialist Orchestrator Service — Parallel execution, budget enforcement, and failure isolation.

Orchestrates Phase 5 deep research pipeline:
Candidate
    │
    ▼
Lead Triage (Deterministic <4 fast-path, followed by LLM Triage)
    │
    ├──── Website Specialist Agent (Controlled website retrieval + audit)
    │
    ├──── Ads Specialist Agent     (Meta Ads copy + theme audit)
    │
    └──── Maps Specialist Agent    (Google Maps profile + verification audit)
             │
             ▼
SpecialistResearchAggregate (Aggregated evidence, per-specialist failure isolation)

INVARIANTS:
- Parallel execution via asyncio.gather with return_exceptions=True
- Complete failure isolation: a failure/timeout in one specialist never aborts the other specialists
- Token optimization: each specialist receives strictly isolated, relevant context (no raw mega-payloads)
- Deterministic campaign budget enforcement: respects max_deep_research_leads
- Token usage tracking using actual provider metadata
"""

import asyncio
import json
import logging
import time
from typing import Any, Optional

from pydantic import BaseModel

from app.schemas.profile import CampaignScope
from app.schemas.search import CampaignLimits, ToolExecutionBlocked
from app.schemas.agent import AgentRunRequest, TokenUsage
from app.schemas.evidence import (
    Evidence,
    LeadTriageResult,
    WebsiteAnalysisResult,
    AdsAnalysisResult,
    MapsAnalysisResult,
    SpecialistResearchAggregate,
)
from app.services.deterministic_pipeline import NormalizedCandidate
from app.services.agent_runner import AgentRunnerService, get_agent_runner
from app.services.website_fetcher import (
    WebsiteContentFetcher,
    get_website_fetcher,
    WebsiteFetchResult,
)
from app.agents.specialists.triage_agent import triage_candidate_deterministic
from app.agents.specialists.website_agent import build_unavailable_website_result
from app.agents.specialists.ads_agent import build_no_ads_result, build_unavailable_ads_result
from app.agents.specialists.maps_agent import build_unavailable_maps_result
from app.tools.apify.budget import CampaignBudgetTracker

logger = logging.getLogger("ai_worker.services.specialist_orchestrator")


def _combine_token_usage(u1: Optional[TokenUsage], u2: Optional[TokenUsage]) -> TokenUsage:
    """Safely combine two TokenUsage instances."""
    pt = (u1.prompt_tokens if u1 else 0) + (u2.prompt_tokens if u2 else 0)
    ct = (u1.completion_tokens if u1 else 0) + (u2.completion_tokens if u2 else 0)
    tt = (u1.total_tokens if u1 else 0) + (u2.total_tokens if u2 else 0)
    if tt == 0 and (pt > 0 or ct > 0):
        tt = pt + ct
    return TokenUsage(prompt_tokens=pt, completion_tokens=ct, total_tokens=tt)


class SpecialistOrchestratorService:
    """Service orchestrating lead triage and parallel specialist research with failure isolation."""

    def __init__(
        self,
        agent_runner: Optional[AgentRunnerService] = None,
        website_fetcher: Optional[WebsiteContentFetcher] = None,
    ):
        self.runner = agent_runner or get_agent_runner()
        self.fetcher = website_fetcher or get_website_fetcher()

    async def triage_candidate(
        self,
        candidate: NormalizedCandidate,
        campaign_scope: Optional[CampaignScope] = None,
        budget_tracker: Optional[CampaignBudgetTracker] = None,
    ) -> tuple[LeadTriageResult, Optional[TokenUsage]]:
        """Evaluate candidate through deterministic pre-filter and LLM triage agent."""
        # 1. Deterministic Fast-Path: Disqualify low-score candidates with zero token cost
        det_result = triage_candidate_deterministic(candidate)
        if det_result is not None:
            logger.info(
                "Candidate '%s' deterministically disqualified (score=%d/10, tier=%s)",
                candidate.business_name,
                candidate.scorecard_score,
                candidate.priority_tier,
            )
            return det_result, TokenUsage(prompt_tokens=0, completion_tokens=0, total_tokens=0)

        # 2. Prepare compact prompt for the Triage Agent
        candidate_summary = {
            "business_name": candidate.business_name,
            "business_type": candidate.business_type,
            "source_platform": candidate.source_platform,
            "scorecard_score": candidate.scorecard_score,
            "priority_tier": candidate.priority_tier,
            "has_website": bool(candidate.website_url),
            "website_url": candidate.website_url,
            "has_active_ads": candidate.has_active_ads,
            "rating": candidate.rating,
            "review_count": candidate.review_count,
            "phone_present": bool(candidate.phone_number),
            "address": candidate.address,
            "observed_friction_points": candidate.friction_points,
        }

        prompt = (
            f"Evaluate prospective business candidate '{candidate.business_name}' for deep specialist research.\n"
            f"Candidate Intelligence Summary:\n{json.dumps(candidate_summary, indent=2)}\n\n"
            "Return a structured LeadTriageResult specifying:\n"
            "- qualified: bool (true if this candidate deserves deep specialist research)\n"
            "- priority: 'high', 'medium', or 'low'\n"
            "- reason: concise rationale grounded in the candidate's signals\n"
            "- research_agents: list from ['website', 'ads', 'maps'] indicating which specialists should investigate"
        )

        context_payload: dict[str, Any] = {}
        if campaign_scope:
            context_payload["campaign_scope"] = campaign_scope.model_dump()

        req = AgentRunRequest(
            prompt=prompt,
            agent_type="lead_triage",
            context=context_payload,
            timeout_seconds=60.0,
        )

        resp = await self.runner.execute(req)
        if not resp.success:
            logger.warning("Lead triage agent failed for '%s': %s", candidate.business_name, resp.error)
            # Safe fallback: disqualified due to triage failure
            return (
                LeadTriageResult(
                    qualified=False,
                    priority="low",
                    reason=f"Triage agent execution failed: {resp.error}",
                    research_agents=[]
                ),
                resp.token_usage
            )

        output_data = resp.output
        if isinstance(output_data, LeadTriageResult):
            return output_data, resp.token_usage
        elif isinstance(output_data, dict):
            return LeadTriageResult(**output_data), resp.token_usage
        else:
            return (
                LeadTriageResult(
                    qualified=False,
                    priority="low",
                    reason=f"Unrecognized triage output format: {type(output_data)}",
                    research_agents=[]
                ),
                resp.token_usage
            )

    async def _run_website_specialist(
        self, candidate: NormalizedCandidate
    ) -> tuple[WebsiteAnalysisResult, Optional[TokenUsage], str]:
        """Execute controlled website fetch and Website Specialist Agent."""
        status_label = "success"
        if not candidate.website_url:
            return build_unavailable_website_result(None, "No website URL provided in candidate data"), None, "no_url"

        # 1. Controlled HTTP fetch with SSRF guardrails
        fetch_res: WebsiteFetchResult = await self.fetcher.fetch(candidate.website_url)

        if not fetch_res.success:
            logger.info("Website fetch failed for '%s': %s", candidate.website_url, fetch_res.error)
            return (
                build_unavailable_website_result(candidate.website_url, fetch_res.error or "Fetch failed"),
                None,
                f"fetch_failed: {fetch_res.error}"
            )

        # 2. Token-optimized compact website payload
        website_payload = {
            "url": fetch_res.url,
            "status_code": fetch_res.status_code,
            "title": fetch_res.title,
            "meta_description": fetch_res.meta_description,
            "text_summary": fetch_res.text_summary[:2000],
            "observed_ctas": fetch_res.observed_ctas,
            "whatsapp_links": fetch_res.whatsapp_links,
            "phone_links": fetch_res.phone_links,
            "booking_links": fetch_res.booking_links,
            "has_booking_system": fetch_res.has_booking_system,
            "has_whatsapp_cta": fetch_res.has_whatsapp_cta,
        }

        prompt = (
            f"Analyze the following public website inspection data for business '{candidate.business_name}':\n"
            f"{json.dumps(website_payload, indent=2)}\n\n"
            "Inspect CTAs, WhatsApp accessibility, online booking flows, and friction points.\n"
            "Every finding must be backed by an Evidence item with source='website'.\n"
            "Emit a structured WebsiteAnalysisResult."
        )

        req = AgentRunRequest(
            prompt=prompt,
            agent_type="website_specialist",
            timeout_seconds=60.0,
        )

        try:
            resp = await self.runner.execute(req)
            if not resp.success:
                return (
                    build_unavailable_website_result(candidate.website_url, resp.error or "Agent failed", status="error"),
                    resp.token_usage,
                    f"agent_error: {resp.error}"
                )

            out = resp.output
            if isinstance(out, WebsiteAnalysisResult):
                return out, resp.token_usage, "success"
            elif isinstance(out, dict):
                return WebsiteAnalysisResult(**out), resp.token_usage, "success"
            else:
                return (
                    build_unavailable_website_result(candidate.website_url, "Invalid output schema", status="error"),
                    resp.token_usage,
                    "schema_error"
                )
        except Exception as exc:
            logger.error("Website specialist execution exception for '%s': %s", candidate.business_name, exc)
            return (
                build_unavailable_website_result(candidate.website_url, str(exc), status="error"),
                None,
                f"exception: {type(exc).__name__}"
            )

    async def _run_ads_specialist(
        self, candidate: NormalizedCandidate
    ) -> tuple[AdsAnalysisResult, Optional[TokenUsage], str]:
        """Execute Ads Specialist Agent on Meta Ads records with metric fabrication guards."""
        if not candidate.has_active_ads and candidate.source_platform != "meta_ads":
            return build_no_ads_result(candidate.business_name), None, "no_ads"

        # Token-optimized ads payload
        raw_meta = candidate.raw_metadata or {}
        ads_payload = {
            "business_name": candidate.business_name,
            "has_active_ads": candidate.has_active_ads,
            "source_platform": candidate.source_platform,
            "ad_creative_text": raw_meta.get("ad_creative_text") or raw_meta.get("ad_text") or raw_meta.get("body") or "",
            "ad_headline": raw_meta.get("headline") or raw_meta.get("title") or "",
            "ad_cta": raw_meta.get("cta_text") or raw_meta.get("call_to_action") or "",
            "target_url": raw_meta.get("link_url") or candidate.website_url,
            "ad_count": raw_meta.get("ad_count") or (1 if candidate.has_active_ads else 0),
        }

        prompt = (
            f"Analyze Meta Ads data for candidate '{candidate.business_name}':\n"
            f"{json.dumps(ads_payload, indent=2)}\n\n"
            "Examine observable themes, CTAs, landing-page consistency, and funnel friction.\n"
            "DO NOT INVENT ad spend, ROAS, conversion rate, or impressions. If unavailable, leave as None/Unknown.\n"
            "Emit a structured AdsAnalysisResult."
        )

        req = AgentRunRequest(
            prompt=prompt,
            agent_type="ads_specialist",
            timeout_seconds=60.0,
        )

        try:
            resp = await self.runner.execute(req)
            if not resp.success:
                return (
                    build_unavailable_ads_result(candidate.business_name, resp.error or "Agent failed", status="error"),
                    resp.token_usage,
                    f"agent_error: {resp.error}"
                )

            out = resp.output
            if isinstance(out, AdsAnalysisResult):
                return out, resp.token_usage, "success"
            elif isinstance(out, dict):
                return AdsAnalysisResult(**out), resp.token_usage, "success"
            else:
                return build_unavailable_ads_result(candidate.business_name, "Invalid output schema", status="error"), resp.token_usage, "schema_error"
        except Exception as exc:
            logger.error("Ads specialist execution exception for '%s': %s", candidate.business_name, exc)
            return (
                build_unavailable_ads_result(candidate.business_name, str(exc), status="error"),
                None,
                f"exception: {type(exc).__name__}"
            )

    async def _run_maps_specialist(
        self, candidate: NormalizedCandidate
    ) -> tuple[MapsAnalysisResult, Optional[TokenUsage], str]:
        """Execute Maps Specialist Agent on Google Maps profile with sentiment fabrication guards."""
        if candidate.rating == 0.0 and candidate.review_count == 0 and not candidate.address:
            return build_unavailable_maps_result(candidate.business_name), None, "no_maps_data"

        # Token-optimized maps payload
        raw_meta = candidate.raw_metadata or {}
        reviews_snippet = raw_meta.get("reviews") if raw_meta.get("reviews") else None
        maps_payload = {
            "business_name": candidate.business_name,
            "business_type": candidate.business_type,
            "category": raw_meta.get("category") or raw_meta.get("categoryName") or candidate.business_type,
            "rating": candidate.rating,
            "review_count": candidate.review_count,
            "address": candidate.address,
            "phone": candidate.phone_number,
            "website_present": bool(candidate.website_url),
            "instagram_present": bool(candidate.instagram_url),
            "services": raw_meta.get("services") or raw_meta.get("additionalCategories") or [],
            "reviews_text_present": bool(reviews_snippet),
            "reviews_snippet": reviews_snippet,
        }

        prompt = (
            f"Analyze Google Maps / local profile data for candidate '{candidate.business_name}':\n"
            f"{json.dumps(maps_payload, indent=2)}\n\n"
            "Verify category, rating, review count, contact channels, and positioning signals.\n"
            "DO NOT FABRICATE review sentiment or customer complaints unless actual review text is provided above.\n"
            "Emit a structured MapsAnalysisResult."
        )

        req = AgentRunRequest(
            prompt=prompt,
            agent_type="maps_specialist",
            timeout_seconds=60.0,
        )

        try:
            resp = await self.runner.execute(req)
            if not resp.success:
                return (
                    build_unavailable_maps_result(candidate.business_name, resp.error or "Agent failed", status="error"),
                    resp.token_usage,
                    f"agent_error: {resp.error}"
                )

            out = resp.output
            if isinstance(out, MapsAnalysisResult):
                return out, resp.token_usage, "success"
            elif isinstance(out, dict):
                return MapsAnalysisResult(**out), resp.token_usage, "success"
            else:
                return build_unavailable_maps_result(candidate.business_name, "Invalid output schema", status="error"), resp.token_usage, "schema_error"
        except Exception as exc:
            logger.error("Maps specialist execution exception for '%s': %s", candidate.business_name, exc)
            return (
                build_unavailable_maps_result(candidate.business_name, str(exc), status="error"),
                None,
                f"exception: {type(exc).__name__}"
            )

    async def research_candidate(
        self,
        candidate: NormalizedCandidate,
        triage_result: Optional[LeadTriageResult] = None,
        campaign_scope: Optional[CampaignScope] = None,
        limits: Optional[CampaignLimits] = None,
        budget_tracker: Optional[CampaignBudgetTracker] = None,
    ) -> SpecialistResearchAggregate:
        """Run triage and parallel specialist research with failure isolation."""
        start_time = time.perf_counter()
        tracker = budget_tracker or CampaignBudgetTracker(limits=limits)
        total_tokens = TokenUsage()
        execution_status: dict[str, str] = {}

        # 1. Lead Triage FIRST: evaluate candidate before touching deep research budget
        if triage_result is None:
            triage_res, triage_tokens = await self.triage_candidate(
                candidate=candidate,
                campaign_scope=campaign_scope,
                budget_tracker=tracker,
            )
            total_tokens = _combine_token_usage(total_tokens, triage_tokens)
            execution_status["triage"] = "qualified" if triage_res.qualified else "disqualified"
        else:
            triage_res = triage_result
            execution_status["triage"] = "provided"

        # 2. If unqualified or no specialists selected, return immediately
        # Zero deep research budget consumed!
        if not triage_res.qualified or not triage_res.research_agents:
            duration_ms = (time.perf_counter() - start_time) * 1000
            return SpecialistResearchAggregate(
                business_name=candidate.business_name,
                source_platform=candidate.source_platform,
                triage_result=triage_res,
                aggregated_evidence=[],
                execution_status=execution_status,
                execution_time_ms=round(duration_ms, 2),
                token_usage=total_tokens,
            )

        # 3. Candidate is qualified: Check and reserve deep research slot under campaign limits
        slot_blocked = tracker.acquire_deep_research_slot()
        if slot_blocked:
            logger.warning(
                "Deep specialist research blocked by campaign limits: %s",
                slot_blocked.reason,
            )
            execution_status["budget"] = "blocked"
            duration_ms = (time.perf_counter() - start_time) * 1000
            return SpecialistResearchAggregate(
                business_name=candidate.business_name,
                source_platform=candidate.source_platform,
                triage_result=triage_res,  # Accurate triage evaluation preserved!
                aggregated_evidence=[],
                execution_status=execution_status,
                execution_time_ms=round(duration_ms, 2),
                token_usage=total_tokens
            )

        try:
            # 4. Prepare concurrent specialist tasks based on triage selection
            tasks = []
            agent_keys = []

            if "website" in triage_res.research_agents:
                tasks.append(self._run_website_specialist(candidate))
                agent_keys.append("website")

            if "ads" in triage_res.research_agents:
                tasks.append(self._run_ads_specialist(candidate))
                agent_keys.append("ads")

            if "maps" in triage_res.research_agents:
                tasks.append(self._run_maps_specialist(candidate))
                agent_keys.append("maps")

            # 5. Execute in parallel with FAILURE ISOLATION
            # If one specialist fails or times out, the other specialists succeed uninterrupted
            results = await asyncio.gather(*tasks, return_exceptions=True)

            website_res: Optional[WebsiteAnalysisResult] = None
            ads_res: Optional[AdsAnalysisResult] = None
            maps_res: Optional[MapsAnalysisResult] = None
            combined_evidence: list[Evidence] = []

            for key, res in zip(agent_keys, results):
                if isinstance(res, Exception):
                    logger.error("Specialist '%s' threw unhandled exception: %s", key, res)
                    execution_status[key] = f"exception: {type(res).__name__}"
                    if key == "website":
                        website_res = build_unavailable_website_result(candidate.website_url, str(res), status="error")
                    elif key == "ads":
                        ads_res = build_unavailable_ads_result(candidate.business_name, str(res), status="error")
                    elif key == "maps":
                        maps_res = build_unavailable_maps_result(candidate.business_name, str(res), status="error")
                else:
                    analysis_result, agent_tokens, status_str = res
                    execution_status[key] = status_str
                    total_tokens = _combine_token_usage(total_tokens, agent_tokens)

                    if key == "website" and isinstance(analysis_result, WebsiteAnalysisResult):
                        website_res = analysis_result
                        combined_evidence.extend(analysis_result.evidence)
                    elif key == "ads" and isinstance(analysis_result, AdsAnalysisResult):
                        ads_res = analysis_result
                        combined_evidence.extend(analysis_result.evidence)
                    elif key == "maps" and isinstance(analysis_result, MapsAnalysisResult):
                        maps_res = analysis_result
                        combined_evidence.extend(analysis_result.evidence)

            duration_ms = (time.perf_counter() - start_time) * 1000
            tracker.release_deep_research_slot(executed=True)

            return SpecialistResearchAggregate(
                business_name=candidate.business_name,
                source_platform=candidate.source_platform,
                triage_result=triage_res,
                website_analysis=website_res,
                ads_analysis=ads_res,
                maps_analysis=maps_res,
                aggregated_evidence=combined_evidence,
                execution_status=execution_status,
                execution_time_ms=round(duration_ms, 2),
                token_usage=total_tokens,
            )

        except Exception as exc:
            tracker.release_deep_research_slot(executed=False)
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error("Unexpected error in research_candidate for '%s': %s", candidate.business_name, exc, exc_info=True)
            return SpecialistResearchAggregate(
                business_name=candidate.business_name,
                source_platform=candidate.source_platform,
                triage_result=triage_res,
                execution_status={"orchestrator": f"error: {str(exc)}"},
                execution_time_ms=round(duration_ms, 2),
                token_usage=total_tokens,
            )


_orchestrator_instance: Optional[SpecialistOrchestratorService] = None


def get_specialist_orchestrator() -> SpecialistOrchestratorService:
    """Retrieve singleton SpecialistOrchestratorService."""
    global _orchestrator_instance
    if _orchestrator_instance is None:
        _orchestrator_instance = SpecialistOrchestratorService()
    return _orchestrator_instance


__all__ = [
    "SpecialistOrchestratorService",
    "get_specialist_orchestrator",
]
