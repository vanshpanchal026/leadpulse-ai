"""Opportunity and Lead Analysis API Routes for LeadPulse AI V2."""

import logging
import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.agent import TokenUsage
from app.schemas.profile import CampaignScope
from app.schemas.search import CampaignLimits
from app.schemas.evidence import SpecialistResearchAggregate
from app.schemas.opportunity import OpportunityResult
from app.schemas.lead_analysis import LeadAnalysis
from app.services.deterministic_pipeline import NormalizedCandidate
from app.services.opportunity_orchestrator import (
    OpportunityPipelineResult,
    OpportunityOrchestratorService,
    get_opportunity_orchestrator,
)

logger = logging.getLogger("ai_worker.api.opportunities")
router = APIRouter(prefix="/opportunities", tags=["Opportunity Intelligence & Lead Analysis"])


class OpportunityAnalyzeRequest(BaseModel):
    """Payload for analyzing opportunity and synthesizing final lead intelligence."""
    candidate: NormalizedCandidate
    specialist_aggregate: Optional[SpecialistResearchAggregate] = None
    campaign_scope: Optional[CampaignScope] = None
    limits: Optional[CampaignLimits] = None
    timeout_seconds: Optional[float] = Field(default=120.0, ge=5.0, le=300.0)


class OpportunityAnalyzeResponse(BaseModel):
    """Structured response from the Phase 6 synthesis pipeline."""
    model_config = ConfigDict(populate_by_name=True)

    success: bool = True
    lead_analysis: Optional[LeadAnalysis] = None
    opportunity_result: Optional[OpportunityResult] = None
    specialist_aggregate: Optional[SpecialistResearchAggregate] = None
    token_usage: Optional[TokenUsage] = None
    execution_time_ms: float = 0.0
    error: Optional[str] = None


@router.post(
    "/analyze",
    response_model=OpportunityAnalyzeResponse,
    status_code=status.HTTP_200_OK,
    summary="Synthesize specialist evidence into ranked opportunity and structured final lead",
    description=(
        "Consumes candidate data and optional specialist aggregate. "
        "Executes Opportunity Agent to identify core bottleneck and recommend canonical service, "
        "followed by Lead Analyst to produce structured LeadAnalysis with failure isolation."
    )
)
async def analyze_opportunity_endpoint(
    request: OpportunityAnalyzeRequest,
    orchestrator: OpportunityOrchestratorService = Depends(get_opportunity_orchestrator)
) -> OpportunityAnalyzeResponse:
    """Analyze a candidate and produce structured LeadAnalysis."""
    start_time = time.perf_counter()
    try:
        pipeline_result: OpportunityPipelineResult = await orchestrator.analyze_opportunity(
            candidate=request.candidate,
            specialist_aggregate=request.specialist_aggregate,
            campaign_scope=request.campaign_scope,
            limits=request.limits,
            timeout_seconds=request.timeout_seconds or 120.0,
        )

        return OpportunityAnalyzeResponse(
            success=True,
            lead_analysis=pipeline_result.lead_analysis,
            opportunity_result=pipeline_result.opportunity_result,
            specialist_aggregate=pipeline_result.specialist_aggregate,
            token_usage=pipeline_result.token_usage,
            execution_time_ms=pipeline_result.execution_time_ms,
            error=None,
        )
    except Exception as exc:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.error("Error analyzing opportunity for '%s': %s", request.candidate.business_name, exc, exc_info=True)
        return OpportunityAnalyzeResponse(
            success=False,
            lead_analysis=None,
            opportunity_result=None,
            specialist_aggregate=request.specialist_aggregate,
            token_usage=None,
            execution_time_ms=round(duration_ms, 2),
            error=f"Opportunity analysis error: {str(exc)}",
        )


__all__ = [
    "router",
    "OpportunityAnalyzeRequest",
    "OpportunityAnalyzeResponse",
]
