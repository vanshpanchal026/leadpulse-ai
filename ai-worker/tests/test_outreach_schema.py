"""Unit tests for Phase 7 Outreach Schemas."""

import pytest
from pydantic import ValidationError

from app.schemas.evidence import Evidence
from app.schemas.outreach import (
    ApprovalStatus,
    OutreachDraft,
    OutreachValidationResult,
    OutreachRecord,
    OutreachDraftRequest,
    OutreachEditRequest,
    OutreachApproveRequest,
    OutreachRejectRequest,
)


class TestOutreachSchemas:
    """Test suite for Phase 7 Pydantic schemas."""

    def test_outreach_draft_valid_construction(self):
        draft = OutreachDraft(
            message="I noticed your clinic runs active Instagram promotions. However, there is no direct WhatsApp chat link on your landing page. Adding one could capture after-hours inquiries.",
            service="whatsapp_automation",
            evidence_used=[
                Evidence(
                    finding="Active promotions on Instagram",
                    source="ads",
                    evidence="2 active ad sets",
                    confidence=0.9,
                    classification="observed"
                )
            ],
            confidence=0.88,
            status="draft",
            validation_reasons=[]
        )
        assert draft.service == "whatsapp_automation"
        assert draft.status == "draft"
        assert draft.confidence == 0.88
        assert len(draft.evidence_used) == 1

    def test_outreach_draft_service_normalization(self):
        draft = OutreachDraft(
            message="Your business has active ads but no online scheduling. Adding self-serve booking helps convert visitors.",
            service="booking automation",  # Alias format
            confidence=0.85,
            status="draft"
        )
        assert draft.service == "booking_automation"

    def test_outreach_draft_unsupported_service_raises_validation_error(self):
        with pytest.raises(ValidationError) as excinfo:
            OutreachDraft(
                message="We offer great SEO services for your clinic.",
                service="seo_optimization",  # Not in canonical list
                confidence=0.8,
                status="draft"
            )
        assert "not an approved LeadPulse business profile service" in str(excinfo.value)

    def test_outreach_draft_empty_message_rejected(self):
        with pytest.raises(ValidationError):
            OutreachDraft(
                message="   ",
                service="website_development",
                confidence=0.8,
                status="draft"
            )

    def test_outreach_draft_confidence_bounds(self):
        with pytest.raises(ValidationError):
            OutreachDraft(
                message="Valid test draft message.",
                service="website_development",
                confidence=1.5,  # > 1.0
                status="draft"
            )
        with pytest.raises(ValidationError):
            OutreachDraft(
                message="Valid test draft message.",
                service="website_development",
                confidence=-0.1,  # < 0.0
                status="draft"
            )

    def test_outreach_validation_result_fields(self):
        res = OutreachValidationResult(
            valid=True,
            reasons=[],
            character_count=210,
            sentence_count=3,
            banned_phrase_found=False,
            unsupported_claim_detected=False,
            placeholder_detected=False,
            unsupported_service=False
        )
        assert res.valid is True
        assert res.character_count == 210
        assert res.sentence_count == 3
        assert res.banned_phrase_found is False

    def test_outreach_record_initial_state(self):
        draft = OutreachDraft(
            message="Notice your clinic lacks instant booking. Self-serve scheduling allows patients to book 24/7.",
            service="booking_automation",
            confidence=0.8,
            status="draft"
        )
        val = OutreachValidationResult(
            valid=True,
            reasons=[],
            character_count=101,
            sentence_count=2,
            banned_phrase_found=False,
            unsupported_claim_detected=False,
            placeholder_detected=False,
            unsupported_service=False
        )
        rec = OutreachRecord(
            lead_id="lead_12345",
            business_name="Radiant Skin Clinic",
            opportunity_score=85.0,
            primary_problem="No self-serve booking",
            recommended_service="booking_automation",
            confidence=0.8,
            draft=draft,
            validation=val,
            approval_status="awaiting_human_approval"
        )
        assert rec.approval_status == "awaiting_human_approval"
        assert rec.draft.status == "draft"
        assert rec.regeneration_count == 0

    def test_outreach_edit_request(self):
        req = OutreachEditRequest(
            message="Updated conversational draft message here. It is short and clear.",
            service="website_development"
        )
        assert req.message.startswith("Updated")
        assert req.service == "website_development"
