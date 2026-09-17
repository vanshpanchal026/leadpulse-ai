"""Unit tests for Outreach Orchestrator service — Validation, bounded regeneration, and approval boundary."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.schemas.agent import AgentRunResponse, TokenUsage
from app.schemas.evidence import Evidence
from app.schemas.outreach import (
    OutreachDraft,
    OutreachDraftRequest,
    OutreachRecord,
)
from app.services.agent_runner import AgentRunnerService
from app.services.outreach_orchestrator import (
    OutreachOrchestratorService,
    MAX_REGENERATION_ATTEMPTS,
)


@pytest.fixture
def sample_request() -> OutreachDraftRequest:
    return OutreachDraftRequest(
        lead_id="lead_test_01",
        business_name="Radiant Skin Clinic",
        primary_problem="Inbound Instagram ad traffic lacks direct WhatsApp scheduling",
        recommended_service="whatsapp_automation",
        why_this_service="Allows patients to chat directly with front-desk automation",
        confidence=0.85,
        opportunity_score=80.0,
        evidence=[
            Evidence(
                finding="Active promotional ads on Instagram",
                source="ads",
                evidence="2 active ad creatives promoting laser facials",
                confidence=0.9,
                classification="observed"
            )
        ]
    )


class TestOutreachOrchestrator:
    """Test suite asserting orchestrator validation loop, retry capping, and human approval boundary."""

    @pytest.mark.asyncio
    async def test_successful_first_pass_draft_and_approval(self, sample_request):
        mock_runner = AsyncMock(spec=AgentRunnerService)
        valid_message = (
            "I noticed Radiant Skin Clinic has active promotional campaigns running on Instagram. "
            "However, prospective clients landing on your page cannot message you directly via WhatsApp. "
            "Adding automated WhatsApp chat could help capture those mobile inquiries."
        )
        mock_runner.execute.return_value = AgentRunResponse(
            success=True,
            output=OutreachDraft(
                message=valid_message,
                service="whatsapp_automation",
                confidence=0.85,
                status="draft",
                validation_reasons=[]
            ),
            agent_type="outreach",
            execution_time_ms=350.0,
            token_usage=TokenUsage(prompt_tokens=400, completion_tokens=70, total_tokens=470)
        )

        orchestrator = OutreachOrchestratorService(agent_runner=mock_runner)
        record = await orchestrator.generate_outreach(sample_request)

        # Invariants: Valid draft, awaiting human approval, 0 regenerations
        assert record.validation.valid is True
        assert record.approval_status == "awaiting_human_approval"
        assert record.regeneration_count == 0
        assert record.draft.status == "draft"

        # Human Approval Action
        approved_record = orchestrator.approve_outreach(record.lead_id, approved_by="senior_reviewer")
        assert approved_record.approval_status == "approved"

    @pytest.mark.asyncio
    async def test_bounded_regeneration_recovers_invalid_draft(self, sample_request):
        mock_runner = AsyncMock(spec=AgentRunnerService)
        # 1st attempt: Contains banned phrase "We help"
        bad_draft = OutreachDraft(
            message="We help clinics get more leads through Instagram ads. Hop on a call to learn more.",
            service="whatsapp_automation",
            confidence=0.8,
            status="draft"
        )
        # 2nd attempt: Repaired, natural, evidence-grounded
        good_draft = OutreachDraft(
            message=(
                "I noticed Radiant Skin Clinic has active campaigns on Instagram. "
                "However, there is no direct WhatsApp link on your page for quick inquiries. "
                "Adding instant messaging could help capture those visitors."
            ),
            service="whatsapp_automation",
            confidence=0.85,
            status="draft"
        )

        mock_runner.execute.side_effect = [
            AgentRunResponse(success=True, output=bad_draft, agent_type="outreach", execution_time_ms=100.0, token_usage=TokenUsage(total_tokens=200)),
            AgentRunResponse(success=True, output=good_draft, agent_type="outreach", execution_time_ms=100.0, token_usage=TokenUsage(total_tokens=250)),
        ]

        orchestrator = OutreachOrchestratorService(agent_runner=mock_runner)
        record = await orchestrator.generate_outreach(sample_request)

        # Invariant: Passed on attempt 1 of regeneration
        assert record.validation.valid is True
        assert record.approval_status == "awaiting_human_approval"
        assert record.regeneration_count == 1
        assert record.token_usage.total_tokens == 450

    @pytest.mark.asyncio
    async def test_bounded_regeneration_exhaustion_marks_rejected(self, sample_request):
        mock_runner = AsyncMock(spec=AgentRunnerService)
        # Persistent failure: always contains banned phrase
        bad_draft = OutreachDraft(
            message="We help aesthetic practices scale revenue. Hop on a call with us today.",
            service="whatsapp_automation",
            confidence=0.8,
            status="draft"
        )

        # 1 initial call + 2 retry calls = 3 total attempts
        mock_runner.execute.return_value = AgentRunResponse(
            success=True,
            output=bad_draft,
            agent_type="outreach",
            execution_time_ms=100.0,
            token_usage=TokenUsage(total_tokens=100)
        )

        orchestrator = OutreachOrchestratorService(agent_runner=mock_runner)
        record = await orchestrator.generate_outreach(sample_request)

        # Invariant: Max 2 regeneration attempts, stops loop, marked rejected
        assert mock_runner.execute.call_count == 1 + MAX_REGENERATION_ATTEMPTS
        assert record.regeneration_count == MAX_REGENERATION_ATTEMPTS
        assert record.validation.valid is False
        assert record.draft.status == "rejected"
        assert record.approval_status == "rejected"
        assert len(record.validation.reasons) > 0

    @pytest.mark.asyncio
    async def test_approval_cannot_bypass_invalid_draft(self, sample_request):
        mock_runner = AsyncMock(spec=AgentRunnerService)
        bad_draft = OutreachDraft(
            message="We help clinics scale. Book a demo today.",
            service="whatsapp_automation",
            confidence=0.8,
            status="draft"
        )
        mock_runner.execute.return_value = AgentRunResponse(
            success=True,
            output=bad_draft,
            agent_type="outreach",
            execution_time_ms=100.0
        )

        orchestrator = OutreachOrchestratorService(agent_runner=mock_runner)
        record = await orchestrator.generate_outreach(sample_request)

        # Attempting to approve an invalid draft must raise ValueError
        with pytest.raises(ValueError) as excinfo:
            orchestrator.approve_outreach(record.lead_id)
        assert "Cannot approve invalid or rejected outreach draft" in str(excinfo.value)

    @pytest.mark.asyncio
    async def test_human_edit_triggers_deterministic_revalidation(self, sample_request):
        mock_runner = AsyncMock(spec=AgentRunnerService)
        valid_message = (
            "I noticed Radiant Skin Clinic has active campaigns on Instagram. "
            "However, prospective clients cannot book online directly from your page. "
            "Adding self-serve scheduling could capture after-hours interest."
        )
        mock_runner.execute.return_value = AgentRunResponse(
            success=True,
            output=OutreachDraft(
                message=valid_message,
                service="booking_automation",
                confidence=0.85,
                status="draft"
            ),
            agent_type="outreach",
            execution_time_ms=100.0
        )

        orchestrator = OutreachOrchestratorService(agent_runner=mock_runner)
        record = await orchestrator.generate_outreach(sample_request)

        # Edit 1: Human makes valid adjustment
        edited = orchestrator.edit_outreach(
            lead_id=record.lead_id,
            new_message="I checked your clinic site. Adding a 24/7 calendar booking link could help capture after-hours patients."
        )
        assert edited.validation.valid is True
        assert edited.draft.status == "draft"

        # Edit 2: Human introduces prohibited banned phrase -> re-validation catches it!
        edited_bad = orchestrator.edit_outreach(
            lead_id=record.lead_id,
            new_message="We help aesthetic clinics grow. Hop on a call with us."
        )
        assert edited_bad.validation.valid is False
        assert edited_bad.draft.status == "rejected"
        assert edited_bad.validation.banned_phrase_found is True

        # Invariant: Invalid edited message cannot be approved
        with pytest.raises(ValueError):
            orchestrator.approve_outreach(record.lead_id)

    @pytest.mark.asyncio
    async def test_low_confidence_lead_generates_safe_rejected_draft_without_llm(self):
        mock_runner = AsyncMock(spec=AgentRunnerService)
        orchestrator = OutreachOrchestratorService(agent_runner=mock_runner)

        req = OutreachDraftRequest(
            lead_id="low_conf_lead",
            business_name="Obscure Clinic",
            confidence=0.15,  # Low confidence
            evidence=[]
        )

        record = await orchestrator.generate_outreach(req)

        # Invariant: Zero LLM calls made!
        assert mock_runner.execute.call_count == 0
        assert record.confidence == 0.15
        assert record.draft.status == "rejected"
        assert "Low-evidence fallback" in record.draft.validation_reasons[0]
