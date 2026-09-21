"""Specialist Research API routes."""

import logging
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.schemas.evidence import (
    LeadTriageResult,
    SpecialistResearchAggregate,
)
from app.schemas.profile import CampaignScope
from app.schemas.search import CampaignLimits
from app.services.deterministic_pipeline import NormalizedCandidate
from app.services.specialist_orchestrator import (
    SpecialistOrchestratorService,
    get_specialist_orchestrator,
)

logger = logging.getLogger("ai_worker.api.specialists")
router = APIRouter(prefix="/specialists", tags=["Specialist Intelligence"])


class SpecialistTriageRequest(BaseModel):
    """Payload for triaging an individual candidate."""
    candidate: NormalizedCandidate
    campaign_scope: Optional[CampaignScope] = None


class SpecialistResearchRequest(BaseModel):
    """Payload for end-to-end deep research on a candidate."""
    candidate: NormalizedCandidate
    triage_result: Optional[LeadTriageResult] = None
    campaign_scope: Optional[CampaignScope] = None
    limits: Optional[CampaignLimits] = None


@router.post(
    "/triage",
    response_model=LeadTriageResult,
    status_code=status.HTTP_200_OK,
    summary="Evaluate candidate viability and specialist routing",
    description="Deterministic pre-check followed by LLM triage to select which specialists should run."
)
async def triage_candidate_endpoint(
    request: SpecialistTriageRequest,
    orchestrator: SpecialistOrchestratorService = Depends(get_specialist_orchestrator)
) -> LeadTriageResult:
    """Triage a candidate business."""
    result, _ = await orchestrator.triage_candidate(
        candidate=request.candidate,
        campaign_scope=request.campaign_scope
    )
    return result


@router.post(
    "/research",
    response_model=SpecialistResearchAggregate,
    status_code=status.HTTP_200_OK,
    summary="Execute parallel specialist research with failure isolation",
    description="Runs Lead Triage, followed by parallel Website, Ads, and Maps specialists."
)
async def research_candidate_endpoint(
    request: SpecialistResearchRequest,
    orchestrator: SpecialistOrchestratorService = Depends(get_specialist_orchestrator)
) -> SpecialistResearchAggregate:
    """Perform parallel deep research on a candidate business."""
    return await orchestrator.research_candidate(
        candidate=request.candidate,
        triage_result=request.triage_result,
        campaign_scope=request.campaign_scope,
        limits=request.limits
    )
