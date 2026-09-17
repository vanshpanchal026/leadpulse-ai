"""Outreach Orchestrator Service for LeadPulse AI V2 Phase 7.

Coordinates the end-to-end outreach drafting pipeline:
Lead Intelligence (Candidate / LeadAnalysis)
      ↓
Outreach Agent (Grounded Drafting)
      ↓
Deterministic Validator (Strict Rules & Invariants)
      ↓ (if invalid: bounded regeneration up to 2 retries)
Approval Boundary (Awaiting Human Approval)
      ↓
Human Action (Approve, Reject, Edit, Regenerate)
      ↓
READY FOR FUTURE SENDING (NO AUTOMATIC EXTERNAL MESSAGING)

CRITICAL INVARIANTS:
1. Approval does NOT send messages (no WhatsApp, Instagram DM, email).
2. Human approval CANNOT bypass the deterministic validator.
3. Edited messages MUST be revalidated before approval.
4. Bounded regeneration: maximum 2 attempts, then status='rejected'.
5. Low-confidence leads produce conservative, non-hallucinated drafts.
"""

from datetime import datetime, timezone
import logging
import time
import uuid
from typing import Any, Optional

from app.schemas.agent import AgentRunRequest, AgentRunResponse, TokenUsage
from app.schemas.evidence import Evidence
from app.schemas.lead_analysis import LeadAnalysis
from app.schemas.opportunity import normalize_service_name
from app.schemas.outreach import (
    ApprovalStatus,
    DraftStatus,
    OutreachDraft,
    OutreachDraftRequest,
    OutreachRecord,
    OutreachValidationResult,
)
from app.services.agent_runner import AgentRunnerService, get_agent_runner
from app.services.outreach_validator import validate_outreach
from app.agents.outreach_agent import (
    build_low_evidence_outreach_draft,
    build_safe_fallback_draft,
    format_outreach_prompt,
)

logger = logging.getLogger("ai_worker.services.outreach_orchestrator")

MAX_REGENERATION_ATTEMPTS = 2
MIN_CONFIDENCE_THRESHOLD = 0.25


def _combine_token_usage(base: TokenUsage, new: Optional[TokenUsage]) -> TokenUsage:
    """Safely aggregate token usage metrics."""
    if not new:
        return base
    return TokenUsage(
        prompt_tokens=base.prompt_tokens + new.prompt_tokens,
        completion_tokens=base.completion_tokens + new.completion_tokens,
        total_tokens=base.total_tokens + new.total_tokens,
    )


class OutreachOrchestratorService:
    """Service orchestrating outreach generation, validation, regeneration, and human approval."""

    def __init__(self, agent_runner: Optional[AgentRunnerService] = None):
        self._runner = agent_runner
        self._store: dict[str, OutreachRecord] = {}

    @property
    def runner(self) -> AgentRunnerService:
        if self._runner is not None:
            return self._runner
        return get_agent_runner()

    async def generate_outreach(self, request: OutreachDraftRequest) -> OutreachRecord:
        """Generate, deterministically validate, and record an outreach draft with bounded retry."""
        start_time = time.perf_counter()
        lead_id = request.lead_id or f"lead_{uuid.uuid4().hex[:10]}"
        biz_name = request.business_name.strip()
        total_tokens = TokenUsage()

        # 1. Resolve lead intelligence fields
        if request.lead_analysis:
            la = request.lead_analysis
            primary_problem = la.primary_problem
            recommended_service = la.recommended_service
            why_this_service = la.why_this_service
            evidence = la.evidence or request.evidence
            confidence = la.confidence
            opp_score = la.opportunity_score
        else:
            primary_problem = request.primary_problem or "Operational friction in lead response"
            try:
                recommended_service = normalize_service_name(request.recommended_service or "business_automation")
            except Exception:
                recommended_service = "business_automation"
            why_this_service = request.why_this_service or "Automation streamlines prospect intake"
            evidence = request.evidence
            confidence = request.confidence if request.confidence is not None else 0.8
            opp_score = request.opportunity_score if request.opportunity_score is not None else 50.0

        # 2. Low-confidence or empty evidence guard: produce conservative fallback without LLM tokens
        has_grounding = len(evidence) > 0 or (request.lead_analysis and request.lead_analysis.research_status != "failed")
        if confidence < MIN_CONFIDENCE_THRESHOLD or not has_grounding:
            logger.info("Lead '%s' has low confidence (%.2f) or zero evidence; using conservative draft", biz_name, confidence)
            draft = build_low_evidence_outreach_draft(
                business_name=biz_name,
                service=recommended_service,
                reason="Low confidence or insufficient grounded evidence",
            )
            validation = validate_outreach(
                message=draft.message,
                service=draft.service,
                evidence=evidence,
                lead_analysis=request.lead_analysis,
            )
            record = OutreachRecord(
                lead_id=lead_id,
                business_name=biz_name,
                opportunity_score=opp_score,
                primary_problem=primary_problem,
                recommended_service=recommended_service,
                confidence=confidence,
                evidence=evidence,
                draft=draft,
                validation=validation,
                approval_status="rejected",
                lifecycle_status="rejected",
                regeneration_count=0,
                token_usage=total_tokens,
            )
            self._store[lead_id] = record
            self._sync_to_persistence(record)
            return record

        # 3. Initial generation via Outreach Agent
        prompt = format_outreach_prompt(
            business_name=biz_name,
            primary_problem=primary_problem,
            recommended_service=recommended_service,
            why_this_service=why_this_service,
            evidence=evidence,
            confidence=confidence,
            opportunity_score=opp_score,
            public_context=request.public_context,
        )

        req = AgentRunRequest(
            prompt=prompt,
            agent_type="outreach",
            timeout_seconds=60.0,
        )

        try:
            resp = await self.runner.execute(req)
            total_tokens = _combine_token_usage(total_tokens, resp.token_usage)
        except Exception as exc:
            logger.warning("Outreach agent execution error for '%s': %s", biz_name, exc)
            resp = AgentRunResponse(
                success=False,
                output=None,
                agent_type="outreach",
                error=str(exc),
                execution_time_ms=0.0,
            )

        if resp.success and isinstance(resp.output, OutreachDraft):
            draft = resp.output
        elif resp.success and isinstance(resp.output, dict):
            draft = OutreachDraft.model_validate(resp.output)
        else:
            logger.warning("Outreach agent failed for '%s': %s", biz_name, resp.error)
            draft = build_safe_fallback_draft(
                business_name=biz_name,
                service=recommended_service,
                reason=f"Agent execution failure: {resp.error}",
            )
            draft.status = "draft"

        # 4. Deterministic validation
        validation = validate_outreach(
            message=draft.message,
            service=draft.service,
            evidence=evidence,
            lead_analysis=request.lead_analysis,
        )

        # 5. Bounded regeneration loop (up to MAX_REGENERATION_ATTEMPTS)
        regeneration_count = 0
        while not validation.valid and regeneration_count < MAX_REGENERATION_ATTEMPTS:
            regeneration_count += 1
            logger.info(
                "Draft for '%s' failed validation (attempt %d/%d): %s. Re-prompting...",
                biz_name,
                regeneration_count,
                MAX_REGENERATION_ATTEMPTS,
                validation.reasons,
            )

            regen_prompt = format_outreach_prompt(
                business_name=biz_name,
                primary_problem=primary_problem,
                recommended_service=recommended_service,
                why_this_service=why_this_service,
                evidence=evidence,
                confidence=confidence,
                opportunity_score=opp_score,
                public_context=request.public_context,
                feedback=validation.reasons,
            )

            regen_req = AgentRunRequest(
                prompt=regen_prompt,
                agent_type="outreach",
                timeout_seconds=60.0,
            )

            try:
                regen_resp = await self.runner.execute(regen_req)
                total_tokens = _combine_token_usage(total_tokens, regen_resp.token_usage)
            except Exception as exc:
                logger.warning("Outreach agent regen execution error for '%s': %s", biz_name, exc)
                regen_resp = AgentRunResponse(
                    success=False,
                    output=None,
                    agent_type="outreach",
                    error=str(exc),
                    execution_time_ms=0.0,
                )

            if regen_resp.success and isinstance(regen_resp.output, OutreachDraft):
                candidate_draft = regen_resp.output
            elif regen_resp.success and isinstance(regen_resp.output, dict):
                candidate_draft = OutreachDraft.model_validate(regen_resp.output)
            else:
                candidate_draft = draft

            # Re-validate candidate draft
            candidate_validation = validate_outreach(
                message=candidate_draft.message,
                service=candidate_draft.service,
                evidence=evidence,
                lead_analysis=request.lead_analysis,
            )

            draft = candidate_draft
            validation = candidate_validation
            if validation.valid:
                logger.info("Regenerated draft for '%s' passed validation on attempt %d", biz_name, regeneration_count)
                break

        # 6. Fallback if still invalid after maximum regeneration attempts
        fallback_applied = False
        if not validation.valid:
            fallback_applied = True
            logger.warning(
                "Draft for '%s' remained invalid after %d regeneration attempts. "
                "Falling back to safe verified template flagged for manual review.",
                biz_name,
                MAX_REGENERATION_ATTEMPTS,
            )
            failed_validation_reasons = list(validation.reasons)
            fallback_reason = f"Regeneration exceeded max attempts ({MAX_REGENERATION_ATTEMPTS}). Flagged for manual review: {'; '.join(failed_validation_reasons)}"
            draft = build_safe_fallback_draft(
                business_name=biz_name,
                service=recommended_service,
                reason=fallback_reason,
            )
            # Re-validate safe template
            validation = validate_outreach(
                message=draft.message,
                service=draft.service,
                evidence=evidence,
                lead_analysis=request.lead_analysis,
            )
            # Mark validation as invalid due to regeneration exhaustion and preserve failure context
            validation.valid = False
            validation.reasons = [fallback_reason] + failed_validation_reasons
            validation.errors = list(validation.reasons)
            draft.validation_reasons = list(validation.reasons)

        # 7. Update draft status and reasons
        draft.character_count = len(draft.message)
        if not fallback_applied:
            draft.validation_reasons = validation.reasons

        if validation.valid and not fallback_applied and draft.status != "rejected":
            draft.status = "draft"
            approval_status: ApprovalStatus = "awaiting_human_approval"
            lifecycle_status = "awaiting_human_approval"
        else:
            # Low-evidence or fallback templates flagged for manual review remain rejected until edited
            approval_status: ApprovalStatus = "rejected"
            lifecycle_status = "rejected"

        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.info(
            "Outreach processing completed for '%s' in %.2f ms (valid=%s, regens=%d, tokens=%d)",
            biz_name,
            duration_ms,
            validation.valid,
            regeneration_count,
            total_tokens.total_tokens,
        )

        record = OutreachRecord(
            lead_id=lead_id,
            business_name=biz_name,
            opportunity_score=opp_score,
            primary_problem=primary_problem,
            recommended_service=draft.service,
            confidence=draft.confidence,
            evidence=draft.evidence_used or evidence,
            draft=draft,
            validation=validation,
            approval_status=approval_status,
            lifecycle_status=lifecycle_status,
            regeneration_count=regeneration_count,
            token_usage=total_tokens,
        )
        self._store[lead_id] = record
        self._sync_to_persistence(record)
        return record

    def _sync_to_persistence(self, record: OutreachRecord) -> None:
        """Durable sync to persistence service for restart and refresh survivability."""
        try:
            from app.services.persistence_service import get_persistence_service
            ps = get_persistence_service()
            ps.upsert_lead({
                "id": record.lead_id,
                "business_name": record.business_name,
                "source_url": f"https://local.lead/{record.lead_id}",
                "recommended_service": record.recommended_service,
                "opportunity_score": record.opportunity_score,
                "primary_problem": record.primary_problem,
                "confidence_score": record.confidence,
                "evidence": [e.model_dump() if hasattr(e, "model_dump") else e for e in record.evidence],
                "outreach_draft": record.model_dump(),
                "outreach_status": record.approval_status,
            })
        except Exception as exc:
            logger.debug("Outreach persistence sync notice: %s", exc)

    def approve_outreach(
        self,
        lead_id: str,
        approved_by: str = "human_operator",
        notes: Optional[str] = None,
    ) -> OutreachRecord:
        """Human approval boundary. Marks draft as approved ONLY if valid.
        
        HARD BOUNDARY: This method strictly changes status. It NEVER sends any WhatsApp,
        email, or external message.
        """
        self._ensure_lead_loaded(lead_id)
        if lead_id not in self._store:
            raise KeyError(f"Outreach record with lead_id '{lead_id}' not found.")

        record = self._store[lead_id]

        # Invariant: Validator CANNOT be bypassed by approval!
        if not record.validation or not record.validation.valid or record.draft.status == "rejected":
            reasons_str = "; ".join(record.validation.reasons) if record.validation else "Unvalidated"
            raise ValueError(
                f"Cannot approve invalid or rejected outreach draft. "
                f"Validation reasons: {reasons_str}"
            )

        record.approval_status = "approved"
        record.lifecycle_status = "approved"
        record.updated_at = datetime.now(timezone.utc).isoformat()
        self._sync_to_persistence(record)
        logger.info("Lead '%s' (ID: %s) outreach approved by %s. Ready for future sending.", record.business_name, lead_id, approved_by)
        return record

    def reject_outreach(self, lead_id: str, reason: Optional[str] = None) -> OutreachRecord:
        """Mark outreach record as explicitly rejected by human reviewer."""
        self._ensure_lead_loaded(lead_id)
        if lead_id not in self._store:
            raise KeyError(f"Outreach record with lead_id '{lead_id}' not found.")

        record = self._store[lead_id]
        record.approval_status = "rejected"
        record.lifecycle_status = "rejected"
        record.draft.status = "rejected"
        if reason:
            record.validation.reasons.append(f"Human rejection: {reason}")
            record.validation.errors.append(f"Human rejection: {reason}")
        record.updated_at = datetime.now(timezone.utc).isoformat()
        self._sync_to_persistence(record)
        logger.info("Lead '%s' (ID: %s) outreach rejected by human reviewer (reason: %s)", record.business_name, lead_id, reason)
        return record

    def edit_outreach(self, lead_id: str, new_message: str, service: Optional[str] = None) -> OutreachRecord:
        """Edit outreach message.
        
        INVARIANT: Edited messages MUST BE VALIDATED AGAIN.
        Human editing never bypasses deterministic validation.
        """
        self._ensure_lead_loaded(lead_id)
        if lead_id not in self._store:
            raise KeyError(f"Outreach record with lead_id '{lead_id}' not found.")

        record = self._store[lead_id]
        target_service = service or record.draft.service
        try:
            norm_service = normalize_service_name(target_service)
        except Exception:
            norm_service = target_service

        # Re-run deterministic validator on edited text
        validation = validate_outreach(
            message=new_message,
            service=norm_service,
            evidence=record.evidence,
        )

        record.draft.message = new_message.strip()
        record.draft.service = norm_service
        record.draft.character_count = len(new_message.strip())
        record.draft.sentence_count = validation.sentence_count
        record.draft.validation_reasons = validation.reasons
        record.draft.status = "draft" if validation.valid else "rejected"
        record.validation = validation
        # Set approval status based on validity: invalid edits are marked rejected
        record.approval_status = "awaiting_human_approval" if validation.valid else "rejected"
        record.lifecycle_status = "awaiting_human_approval" if validation.valid else "rejected"
        record.updated_at = datetime.now(timezone.utc).isoformat()
        self._sync_to_persistence(record)

        logger.info(
            "Lead '%s' outreach edited (valid=%s, reasons=%s)",
            record.business_name,
            validation.valid,
            validation.reasons,
        )
        return record

    def dispatch_outreach(self, lead_id: str) -> None:
        """Attempt to dispatch outreach message.
        
        HARD ARCHITECTURAL BOUNDARY:
        1. Attempted auto-send without human approval is strictly blocked (raises PermissionError).
        2. In Phase 7, external messaging is strictly disabled (raises NotImplementedError).
        """
        self._ensure_lead_loaded(lead_id)
        if lead_id not in self._store:
            raise KeyError(f"Outreach record with lead_id '{lead_id}' not found.")

        record = self._store[lead_id]
        if record.approval_status != "approved":
            raise PermissionError(
                f"Auto-send blocked: Outreach for lead '{lead_id}' has not received human approval "
                f"(current approval_status: '{record.approval_status}')."
            )

        raise NotImplementedError(
            "External messaging is strictly disabled in Phase 7. Human approval only stages the draft."
        )

    def _ensure_lead_loaded(self, lead_id: str) -> None:
        """Ensure an outreach record is loaded from persistence into in-memory store if needed."""
        if lead_id not in self._store:
            try:
                from app.services.persistence_service import get_persistence_service
                ps = get_persistence_service()
                lead = ps.get_lead(lead_id)
                if lead and lead.outreach_draft:
                    rec = OutreachRecord.model_validate(lead.outreach_draft)
                    self._store[lead_id] = rec
            except Exception as exc:
                logger.debug("Could not load lead '%s' from persistence: %s", lead_id, exc)

    def get_outreach(self, lead_id: str) -> Optional[OutreachRecord]:
        """Retrieve outreach record by lead_id."""
        self._ensure_lead_loaded(lead_id)
        return self._store.get(lead_id)

    def list_outreach(self) -> list[OutreachRecord]:
        """List all outreach records across memory and durable persistence."""
        records = dict(self._store)
        try:
            from app.services.persistence_service import get_persistence_service
            ps = get_persistence_service()
            leads, _ = ps.list_leads(limit=200)
            for l in leads:
                if l.id not in records and l.outreach_draft:
                    try:
                        rec = OutreachRecord.model_validate(l.outreach_draft)
                        records[l.id] = rec
                    except Exception:
                        pass
        except Exception:
            pass
        return list(records.values())

    def save_record(self, record: OutreachRecord) -> None:
        """Save a record directly to the controlled store and persistence."""
        self._store[record.lead_id] = record
        self._sync_to_persistence(record)


_global_outreach_orchestrator: Optional[OutreachOrchestratorService] = None


def get_outreach_orchestrator() -> OutreachOrchestratorService:
    """Retrieve or initialize singleton OutreachOrchestratorService."""
    global _global_outreach_orchestrator
    if _global_outreach_orchestrator is None:
        _global_outreach_orchestrator = OutreachOrchestratorService()
    return _global_outreach_orchestrator


__all__ = [
    "MAX_REGENERATION_ATTEMPTS",
    "MIN_CONFIDENCE_THRESHOLD",
    "OutreachOrchestratorService",
    "get_outreach_orchestrator",
]
