"""Research Runs API routes for LeadPulse AI V2 Phase 8.

Exposes clean endpoints for campaign research run tracking:
- GET /research-runs: List research runs with filtering & pagination
- POST /research-runs: Initialize a new research run record
- GET /research-runs/{run_id}: Get research run status, metrics, and errors
"""

import logging
from typing import Any, Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status

from app.schemas.persistence import (
    ResearchRunCreate,
    ResearchRunListResponse,
    ResearchRunRecord,
)
from app.services.persistence_service import get_persistence_service
from app.schemas.profile import CampaignScope
from app.schemas.search import CampaignLimits
from app.schemas.outreach import OutreachDraftRequest
from app.tools.apify.budget import CampaignBudgetTracker
from app.core.profile import get_business_profile
from app.services.search_orchestrator import SearchOrchestratorService
from app.services.specialist_orchestrator import SpecialistOrchestratorService
from app.services.opportunity_orchestrator import OpportunityOrchestratorService
from app.services.outreach_orchestrator import OutreachOrchestratorService

router = APIRouter(prefix="/research-runs", tags=["research-runs"])


async def _execute_research_run(run_id: str, configuration: dict[str, Any]) -> None:
    """Execute the full autonomous research pipeline for a campaign run."""
    service = get_persistence_service()
    logger = logging.getLogger("leadpulse.pipeline")
    
    try:
        # Load profile and build campaign scope from configuration
        profile = get_business_profile()
        dry_run = configuration.get("dry_run", False)
        
        campaign_scope = CampaignScope(
            name=configuration.get("campaign_name", "research-run"),
            campaign_name=configuration.get("campaign_name", "research-run"),
            target_cities=configuration.get("locations", profile.geography.allowed_cities),
            target_verticals=configuration.get("verticals", [v for v in profile.verticals.seed_verticals]),
        )
        
        limits = CampaignLimits(
            max_search_queries=int(configuration.get("max_queries", 4)),
            max_businesses_per_query=int(configuration.get("max_businesses_per_query", 15)),
            max_apify_calls=int(configuration.get("max_apify_calls", 6)),
            max_deep_research_leads=int(configuration.get("lead_limit", 10)),
        )
        
        budget_tracker = CampaignBudgetTracker(limits)
        total_tokens = 0
        
        # ===== STAGE 1: Search Strategy =====
        search_orch = SearchOrchestratorService()
        strategy = await search_orch.generate_strategy(
            campaign_scope=campaign_scope,
            limits=limits,
            research_goal=configuration.get("goal"),
            profile=profile,
        )
        service.update_run_counters(run_id=run_id, queries_generated=len(strategy.queries), tool_calls=1)
        
        # ===== STAGE 2: Discovery (Apify) =====
        if dry_run:
            # Use sample candidates for testing without Apify cost
            from app.services.deterministic_pipeline import NormalizedCandidate
            candidates = [NormalizedCandidate(
                business_name=f"Test Clinic {i+1}",
                business_type="Dermatology",
                source_platform="google_maps",
                source_url=f"https://maps.google.com/test-{i+1}",
                phone_number=f"+9198765432{i:02d}",
                website_url=f"https://testclinic{i+1}.com",
                rating=4.5,
                review_count=100,
                has_active_ads=True,
                scorecard_score=8,
                priority_tier="immediate",
            ) for i in range(min(3, limits.max_deep_research_leads))]
            discovery_result = None
        else:
            discovery_result = await search_orch.execute_discovery_pipeline(
                strategy=strategy,
                campaign_scope=campaign_scope,
                limits=limits,
                budget_tracker=budget_tracker,
            )
            candidates = discovery_result.candidates
            service.update_run_counters(
                run_id=run_id,
                businesses_found=discovery_result.total_raw_discovered,
                businesses_filtered=discovery_result.total_duplicates_filtered,
                apify_calls=budget_tracker.get_status().get("apify_calls_executed", 0),
            )
        
        if not candidates:
            service.complete_research_run(run_id=run_id, status="completed")
            return
        
        # ===== STAGE 3: Triage + Specialist Research =====
        specialist_orch = SpecialistOrchestratorService()
        opp_orch = OpportunityOrchestratorService(specialist_orchestrator=specialist_orch)
        outreach_orch = OutreachOrchestratorService()
        
        qualified_count = 0
        researched_count = 0
        triaged_count = 0
        errors_list = []
        
        research_limit = limits.max_deep_research_leads
        
        for candidate in candidates:
            if researched_count >= research_limit:
                break
            
            try:
                # Triage
                triage_result, triage_tokens = await specialist_orch.triage_candidate(
                    candidate=candidate,
                    campaign_scope=campaign_scope,
                    budget_tracker=budget_tracker,
                )
                triaged_count += 1
                if triage_tokens:
                    total_tokens += triage_tokens.total_tokens
                
                if not triage_result.qualified:
                    continue
                
                # Full pipeline: specialists + opportunity + lead analysis
                opp_result = await opp_orch.analyze_opportunity(
                    candidate=candidate,
                    campaign_scope=campaign_scope,
                    limits=limits,
                )
                researched_count += 1
                total_tokens += opp_result.token_usage.total_tokens
                
                # Persist research results
                lead_record = service.persist_research_cycle(
                    candidate_data=candidate.model_dump(),
                    specialist_results=opp_result.specialist_aggregate.model_dump() if opp_result.specialist_aggregate else None,
                    opportunity_result=opp_result.opportunity_result.model_dump() if opp_result.opportunity_result else None,
                    lead_analysis=opp_result.lead_analysis.model_dump() if opp_result.lead_analysis else None,
                    token_usage=opp_result.token_usage.model_dump() if opp_result.token_usage else None,
                    research_run_id=run_id,
                )
                
                # Generate outreach for qualified leads
                if opp_result.lead_analysis.qualification_status == "qualified" and opp_result.lead_analysis.opportunity_score >= 40.0:
                    qualified_count += 1
                    try:
                        outreach_request = OutreachDraftRequest(
                            lead_id=lead_record.id,
                            business_name=candidate.business_name,
                            lead_analysis=opp_result.lead_analysis,
                            primary_problem=opp_result.lead_analysis.primary_problem,
                            recommended_service=opp_result.lead_analysis.recommended_service,
                            why_this_service=opp_result.lead_analysis.why_this_service,
                            evidence=opp_result.lead_analysis.evidence,
                            confidence=opp_result.lead_analysis.confidence,
                            opportunity_score=opp_result.lead_analysis.opportunity_score,
                        )
                        outreach_record = await outreach_orch.generate_outreach(outreach_request)
                        total_tokens += outreach_record.token_usage.get("total_tokens", 0) if isinstance(outreach_record.token_usage, dict) else 0
                        
                        # Update persistence with outreach
                        service.persist_research_cycle(
                            candidate_data=candidate.model_dump(),
                            outreach_record=outreach_record.model_dump(),
                            research_run_id=run_id,
                        )
                    except Exception as outreach_err:
                        logger.warning(f"Outreach generation failed for {candidate.business_name}: {outreach_err}")
                        errors_list.append({"stage": "outreach", "business": candidate.business_name, "error": str(outreach_err)})
                
                # Update counters after each candidate
                service.update_run_counters(
                    run_id=run_id,
                    businesses_triaged=triaged_count,
                    businesses_researched=researched_count,
                    qualified_leads=qualified_count,
                    total_tokens=total_tokens,
                    tool_calls=researched_count * 4,  # ~4 tool calls per researched candidate
                )
                
            except Exception as candidate_err:
                logger.error(f"Pipeline error for {candidate.business_name}: {candidate_err}")
                errors_list.append({"stage": "research", "business": candidate.business_name, "error": str(candidate_err)})
                # Store error but continue with next candidate
                service.update_run_counters(run_id=run_id, add_error={"business": candidate.business_name, "error": str(candidate_err)})
        
        # ===== STAGE 4: Completion =====
        final_status = "completed" if not errors_list else "partial"
        service.complete_research_run(run_id=run_id, status=final_status)
        
    except Exception as exc:
        logger.error(f"Research run {run_id} failed: {exc}")
        try:
            service.update_run_counters(run_id=run_id, add_error={"stage": "pipeline", "error": str(exc)})
            service.complete_research_run(run_id=run_id, status="failed")
        except Exception:
            pass


@router.get("", response_model=ResearchRunListResponse)
async def list_research_runs(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (running, completed, etc.)"),
    campaign_id: Optional[str] = Query(None, description="Filter by associated campaign ID"),
    limit: int = Query(50, ge=1, le=200, description="Page size limit"),
    offset: int = Query(0, ge=0, description="Page offset"),
) -> ResearchRunListResponse:
    """Retrieve paginated research runs with optional status or campaign filtering."""
    service = get_persistence_service()
    items, total = service.list_research_runs(
        status=status_filter,
        campaign_id=campaign_id,
        limit=limit,
        offset=offset,
    )
    return ResearchRunListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("", response_model=ResearchRunRecord, status_code=status.HTTP_201_CREATED)
async def create_research_run(
    payload: ResearchRunCreate,
    background_tasks: BackgroundTasks,
) -> ResearchRunRecord:
    """Initialize a new research run and optionally trigger background execution."""
    service = get_persistence_service()
    record = service.create_research_run(
        campaign_id=payload.campaign_id,
        configuration=payload.configuration,
        run_id=payload.run_id,
    )
    if payload.configuration and (payload.configuration.get("execute") or payload.configuration.get("auto_execute")):
        background_tasks.add_task(_execute_research_run, record.run_id, payload.configuration)
    return record



@router.get("/{run_id}", response_model=ResearchRunRecord)
async def get_research_run(run_id: str) -> ResearchRunRecord:
    """Retrieve a single research run by run_id."""
    service = get_persistence_service()
    record = service.get_research_run(run_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Research run with ID '{run_id}' not found.",
        )
    return record


@router.delete("/{run_id}", status_code=status.HTTP_200_OK)
async def delete_research_run(run_id: str) -> dict[str, Any]:
    """Delete a research run by run_id."""
    service = get_persistence_service()
    deleted = service.delete_research_run(run_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Research run with ID '{run_id}' not found.",
        )
    return {"success": True, "deleted_run_id": run_id}

