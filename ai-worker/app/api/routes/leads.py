"""Leads API routes for LeadPulse AI V2 Phase 8.

Exposes clean endpoints for Phase 9 React dashboard:
- GET /leads: Paginated lead records with filtering
- GET /leads/{lead_id}: Single lead intelligence record
- GET /leads/{lead_id}/report: Complete business report matching canonical contract
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.persistence import (
    LeadListResponse,
    LeadPersistenceRecord,
    LeadReportResponse,
)
from app.services.persistence_service import get_persistence_service

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("", response_model=LeadListResponse)
async def list_leads(
    status: Optional[str] = Query(None, description="Filter by V1 status (new, pitch_sent, etc.)"),
    research_status: Optional[str] = Query(None, description="Filter by research status (complete, partial, pending, failed)"),
    research_run_id: Optional[str] = Query(None, description="Filter by associated research run ID"),
    limit: int = Query(50, ge=1, le=200, description="Page size limit"),
    offset: int = Query(0, ge=0, description="Page offset"),
) -> LeadListResponse:
    """Retrieve paginated leads with optional status or research run filtering."""
    service = get_persistence_service()
    items, total = service.list_leads(
        status=status,
        research_status=research_status,
        research_run_id=research_run_id,
        limit=limit,
        offset=offset,
    )
    return LeadListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/{lead_id}/report", response_model=LeadReportResponse)
async def get_lead_report(lead_id: str) -> LeadReportResponse:
    """Retrieve the complete, structured business intelligence report contract for Phase 9 React dashboard."""
    service = get_persistence_service()
    report = service.get_lead_report(lead_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business report for lead '{lead_id}' not found.",
        )
    return report


@router.get("/{lead_id}", response_model=LeadPersistenceRecord)
async def get_lead(lead_id: str) -> LeadPersistenceRecord:
    """Retrieve a single lead record by lead_id."""
    service = get_persistence_service()
    lead = service.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead record with ID '{lead_id}' not found.",
        )
    return lead
