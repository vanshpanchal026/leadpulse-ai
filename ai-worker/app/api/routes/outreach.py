"""Outreach and Human Approval API Routes for LeadPulse AI V2 Phase 7.

Endpoints:
- POST /api/v1/outreach/draft: Generate and deterministically validate outreach draft.
- GET  /api/v1/outreach: List all outreach records awaiting review or processed.
- GET  /api/v1/outreach/{lead_id}: Retrieve single outreach record.
- POST /api/v1/outreach/{lead_id}/approve: Set state to 'approved' (DOES NOT SEND MESSAGES).
- POST /api/v1/outreach/{lead_id}/reject: Set state to 'rejected'.
- POST /api/v1/outreach/{lead_id}/edit: Edit outreach message (triggers deterministic re-validation).
- POST /api/v1/outreach/{lead_id}/regenerate: Re-generate draft with bounded retry.

STRICT INVARIANTS:
1. Approval does NOT send any WhatsApp, SMS, email, or DM.
2. Approval CANNOT bypass deterministic validation.
3. Edited messages MUST be revalidated.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.outreach import (
    ApprovalStatus,
    OutreachApproveRequest,
    OutreachDraftRequest,
    OutreachEditRequest,
    OutreachRecord,
    OutreachRejectRequest,
)
from app.services.outreach_orchestrator import (
    OutreachOrchestratorService,
    get_outreach_orchestrator,
)

logger = logging.getLogger("ai_worker.api.outreach")
router = APIRouter(prefix="/outreach", tags=["Outreach & Human Approval Boundary"])


class OutreachActionResponse(BaseModel):
    """Response returned upon outreach generation, edit, or approval state transition."""
    model_config = ConfigDict(populate_by_name=True)

    success: bool = True
    record: OutreachRecord
    message: str = "Outreach processed successfully."
    external_send_executed: bool = Field(
        default=False,
        description="HARD BOUNDARY: Always false. No external communication is performed."
    )


@router.post(
    "/draft",
    response_model=OutreachActionResponse,
    summary="Generate and validate outreach draft",
    description="Invokes Outreach Agent, runs deterministic validator, applies bounded regeneration if invalid, and places into human approval queue."
)
async def generate_draft(
    request: OutreachDraftRequest,
    orchestrator: OutreachOrchestratorService = Depends(get_outreach_orchestrator),
) -> OutreachActionResponse:
    """Generate and deterministically validate outreach draft."""
    try:
        record = await orchestrator.generate_outreach(request)
        return OutreachActionResponse(
            success=True,
            record=record,
            message="Outreach draft generated and awaiting human review.",
            external_send_executed=False,
        )
    except Exception as exc:
        logger.error("Failed to generate outreach for '%s': %s", request.business_name, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Outreach generation failed: {str(exc)}",
        )


@router.get(
    "",
    response_model=list[OutreachRecord],
    summary="List all outreach records",
    description="Returns all outreach records currently in the approval queue."
)
async def list_outreach_records(
    orchestrator: OutreachOrchestratorService = Depends(get_outreach_orchestrator),
) -> list[OutreachRecord]:
    """Retrieve all outreach records in the approval queue."""
    return orchestrator.list_outreach()


@router.get(
    "/{lead_id}",
    response_model=OutreachRecord,
    summary="Get single outreach record",
    description="Retrieve outreach record by lead_id."
)
async def get_outreach_record(
    lead_id: str,
    orchestrator: OutreachOrchestratorService = Depends(get_outreach_orchestrator),
) -> OutreachRecord:
    """Retrieve outreach record by lead identifier."""
    record = orchestrator.get_outreach(lead_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Outreach record with lead_id '{lead_id}' not found.",
        )
    return record


@router.post(
    "/{lead_id}/approve",
    response_model=OutreachActionResponse,
    summary="Approve outreach draft (Human Approval Boundary)",
    description="Applies human approval to a validated outreach draft. DOES NOT send WhatsApp or any message."
)
async def approve_outreach_draft(
    lead_id: str,
    payload: Optional[OutreachApproveRequest] = None,
    orchestrator: OutreachOrchestratorService = Depends(get_outreach_orchestrator),
) -> OutreachActionResponse:
    """Approve outreach draft. Mandatory human approval boundary."""
    try:
        approved_by = payload.approved_by if payload else "human_operator"
        notes = payload.notes if payload else None
        record = orchestrator.approve_outreach(lead_id, approved_by=approved_by, notes=notes)
        return OutreachActionResponse(
            success=True,
            record=record,
            message="Outreach draft human-approved. Ready for future sending (no external message was sent).",
            external_send_executed=False,
        )
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.error("Approval failed for '%s': %s", lead_id, exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post(
    "/{lead_id}/reject",
    response_model=OutreachActionResponse,
    summary="Reject outreach draft",
    description="Marks draft as rejected by human operator."
)
async def reject_outreach_draft(
    lead_id: str,
    payload: Optional[OutreachRejectRequest] = None,
    orchestrator: OutreachOrchestratorService = Depends(get_outreach_orchestrator),
) -> OutreachActionResponse:
    """Reject outreach draft."""
    try:
        reason = payload.reason if payload else None
        record = orchestrator.reject_outreach(lead_id, reason=reason)
        return OutreachActionResponse(
            success=True,
            record=record,
            message="Outreach draft rejected by operator.",
            external_send_executed=False,
        )
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Rejection failed for '%s': %s", lead_id, exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post(
    "/{lead_id}/edit",
    response_model=OutreachActionResponse,
    summary="Edit outreach draft (Re-validates message)",
    description="Updates draft message and deterministically re-validates all rules."
)
async def edit_outreach_draft(
    lead_id: str,
    payload: OutreachEditRequest,
    orchestrator: OutreachOrchestratorService = Depends(get_outreach_orchestrator),
) -> OutreachActionResponse:
    """Edit outreach draft text. Human editing never bypasses deterministic validation."""
    try:
        record = orchestrator.edit_outreach(lead_id, new_message=payload.message, service=payload.service)
        status_note = "Valid" if record.validation.valid else f"Invalid ({', '.join(record.validation.reasons)})"
        return OutreachActionResponse(
            success=True,
            record=record,
            message=f"Outreach draft edited and re-validated. Status: {status_note}.",
            external_send_executed=False,
        )
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Edit failed for '%s': %s", lead_id, exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post(
    "/{lead_id}/regenerate",
    response_model=OutreachActionResponse,
    summary="Regenerate outreach draft",
    description="Regenerates draft using Outreach Agent with bounded retry policy."
)
async def regenerate_outreach_draft(
    lead_id: str,
    orchestrator: OutreachOrchestratorService = Depends(get_outreach_orchestrator),
) -> OutreachActionResponse:
    """Regenerate draft for existing lead record."""
    record = orchestrator.get_outreach(lead_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Outreach record with lead_id '{lead_id}' not found.",
        )

    req = OutreachDraftRequest(
        lead_id=lead_id,
        business_name=record.business_name,
        primary_problem=record.primary_problem,
        recommended_service=record.recommended_service,
        confidence=record.confidence,
        opportunity_score=record.opportunity_score,
        evidence=record.evidence,
    )

    new_record = await orchestrator.generate_outreach(req)
    return OutreachActionResponse(
        success=True,
        record=new_record,
        message="Outreach draft regenerated and re-validated.",
        external_send_executed=False,
    )
