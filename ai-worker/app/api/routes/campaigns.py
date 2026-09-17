"""Campaign management API routes for LeadPulse AI V2."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.persistence import (
    CampaignCreate,
    CampaignListResponse,
    CampaignRecord,
)
from app.services.persistence_service import get_persistence_service

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("", response_model=CampaignListResponse)
async def list_campaigns(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> CampaignListResponse:
    service = get_persistence_service()
    items, total = service.list_campaigns(status=status_filter, limit=limit, offset=offset)
    return CampaignListResponse(items=items, total=total)


@router.post("", response_model=CampaignRecord, status_code=status.HTTP_201_CREATED)
async def create_campaign(payload: CampaignCreate) -> CampaignRecord:
    service = get_persistence_service()
    return service.create_campaign(
        name=payload.name,
        goal=payload.goal,
        locations=payload.locations,
        verticals=payload.verticals,
        limits=payload.limits,
    )


@router.get("/{campaign_id}", response_model=CampaignRecord)
async def get_campaign(campaign_id: str) -> CampaignRecord:
    service = get_persistence_service()
    record = service.get_campaign(campaign_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaign '{campaign_id}' not found.")
    return record
