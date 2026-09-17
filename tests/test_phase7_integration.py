"""LeadPulse AI V2 — Phase 7 Live Integration Test Suite.

Proves the complete Phase 7 outreach drafting & human approval pipeline:
Lead Intelligence (LeadAnalysis)
          ↓
Outreach Agent (Live Upstream LLM via OpenAI Agents SDK)
          ↓
Deterministic Validator (Strict Non-LLM Boundaries)
          ↓
Human Approval Queue (State Transition)
          ↓
READY FOR FUTURE SENDING (HARD ARCHITECTURAL BOUNDARY: NO SENDING)

Verifies:
- Live Outreach Agent execution and schema conformance
- POST /api/v1/outreach/draft generation, validation, and queue placement
- POST /api/v1/outreach/{lead_id}/edit re-validates message with deterministic validator
- POST /api/v1/outreach/{lead_id}/approve human approval state transition
- POST /api/v1/outreach/{lead_id}/reject rejection state transition
- Approval strictly blocked when draft is invalid (400 Bad Request)
- Hard boundary: external_send_executed is False, no WhatsApp/external calls made
- Strict credential non-leakage invariant
"""

import os
import sys
import unittest
from pathlib import Path
from dotenv import load_dotenv
import httpx
from httpx import ASGITransport, AsyncClient

# Add project root and ai-worker to sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_AI_WORKER_DIR = _PROJECT_ROOT / "ai-worker"
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))
if str(_AI_WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(_AI_WORKER_DIR))

from app.core.config import get_settings
from app.core.provider import close_provider, init_provider
from app.main import app
from app.schemas.evidence import Evidence
from app.schemas.opportunity import APPROVED_SERVICES
from app.schemas.outreach import (
    ApprovalStatus,
    OutreachDraft,
    OutreachRecord,
    OutreachValidationResult,
)


class TestPhase7LiveIntegration(unittest.IsolatedAsyncioTestCase):
    """Live integration tests for Phase 7 Outreach Agent and Human Approval Boundary."""

    async def asyncSetUp(self):
        load_dotenv(dotenv_path=_PROJECT_ROOT / ".env")
        self.settings = get_settings()
        init_provider(self.settings)
        self.transport = ASGITransport(app=app)
        self.client = AsyncClient(transport=self.transport, base_url="http://localhost:8000")

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_01_outreach_agent_live_execution(self):
        """Verify Outreach Agent drafts a structured, personalized OutreachDraft."""
        prompt = (
            "Draft a short outreach message for 'Elite Smile Dental Clinic':\n"
            "- Problem: Active Meta Ads drive traffic but landing page lacks online booking or WhatsApp chat.\n"
            "- Recommended Service: whatsapp_automation\n"
            "- Why: Allows high-intent ad clickers to chat with front desk 24/7.\n"
            "- Observed Evidence: 3 active Instagram ad campaigns running, zero WhatsApp CTA on website.\n"
            "- Confidence: 0.88\n"
            "Emit a valid OutreachDraft record."
        )

        response = await self.client.post(
            "/api/v1/run",
            json={
                "prompt": prompt,
                "agent_type": "outreach",
                "timeout_seconds": 120.0,
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"], f"Outreach Agent run failed: {data.get('error')}")
        self.assertEqual(data["agent_type"], "outreach")

        output = data["output"]
        self.assertIsInstance(output, dict)
        draft = OutreachDraft.model_validate(output)

        self.assertIn(draft.service, list(APPROVED_SERVICES.keys()))
        self.assertGreaterEqual(draft.confidence, 0.0)
        self.assertLessEqual(draft.confidence, 1.0)
        self.assertGreater(len(draft.message), 10)
        self.assertLessEqual(len(draft.message), 300)

    async def test_02_outreach_draft_endpoint_and_human_approval_lifecycle(self):
        """Verify full POST /api/v1/outreach/draft -> approve lifecycle."""
        draft_payload = {
            "lead_id": "test_lead_apex_001",
            "business_name": "Apex Dental Spa",
            "primary_problem": "Active paid Meta Ads lack direct WhatsApp lead capture",
            "recommended_service": "whatsapp_automation",
            "why_this_service": "Automates 24/7 lead qualification and patient intake",
            "confidence": 0.85,
            "opportunity_score": 90.0,
            "evidence": [
                {
                    "finding": "3 active Instagram ad campaigns",
                    "source": "ads",
                    "evidence": "Sponsored laser dentistry promotion",
                    "confidence": 0.95,
                    "classification": "observed"
                }
            ]
        }

        # Step A: Generate draft
        draft_resp = await self.client.post("/api/v1/outreach/draft", json=draft_payload)
        self.assertEqual(draft_resp.status_code, 200)
        draft_data = draft_resp.json()
        self.assertTrue(draft_data["success"])
        self.assertFalse(draft_data["external_send_executed"])

        record = draft_data["record"]
        self.assertEqual(record["lead_id"], "test_lead_apex_001")
        self.assertEqual(record["business_name"], "Apex Dental Spa")
        self.assertEqual(record["approval_status"], "awaiting_human_approval")
        self.assertIn("message", record["draft"])
        self.assertIn("valid", record["validation"])

        # Step B: Human Approve
        approve_resp = await self.client.post(
            "/api/v1/outreach/test_lead_apex_001/approve",
            json={"approved_by": "compliance_officer", "notes": "Verified message content"}
        )
        self.assertEqual(approve_resp.status_code, 200)
        appr_data = approve_resp.json()
        self.assertTrue(appr_data["success"])
        self.assertEqual(appr_data["record"]["approval_status"], "approved")
        self.assertFalse(appr_data["external_send_executed"])

    async def test_03_human_edit_triggers_deterministic_revalidation(self):
        """Verify editing outreach draft re-runs deterministic validator."""
        draft_payload = {
            "lead_id": "test_lead_edit_002",
            "business_name": "Metro Hair Restoration",
            "primary_problem": "Inbound clients cannot book appointments after hours",
            "recommended_service": "booking_automation",
            "why_this_service": "Streamlines self-serve consultations",
            "confidence": 0.80,
            "opportunity_score": 75.0,
            "evidence": [
                {
                    "finding": "No online calendar booking flow on website",
                    "source": "website",
                    "evidence": "Only telephone CTA present",
                    "confidence": 0.9,
                    "classification": "observed"
                }
            ]
        }

        # Create draft
        create_resp = await self.client.post("/api/v1/outreach/draft", json=draft_payload)
        self.assertEqual(create_resp.status_code, 200)

        # Edit 1: Human makes valid adjustment
        valid_edit_msg = "I noticed your clinic on Google Maps. Adding self-serve appointment booking could help capture patient inquiries after-hours."
        edit_resp1 = await self.client.post(
            "/api/v1/outreach/test_lead_edit_002/edit",
            json={"message": valid_edit_msg}
        )
        self.assertEqual(edit_resp1.status_code, 200)
        edit_data1 = edit_resp1.json()
        self.assertTrue(edit_data1["record"]["validation"]["valid"])
        self.assertEqual(edit_data1["record"]["draft"]["message"], valid_edit_msg)

        # Edit 2: Human introduces prohibited banned phrase
        bad_edit_msg = "We help hair restoration clinics grow. Hop on a call with us."
        edit_resp2 = await self.client.post(
            "/api/v1/outreach/test_lead_edit_002/edit",
            json={"message": bad_edit_msg}
        )
        self.assertEqual(edit_resp2.status_code, 200)
        edit_data2 = edit_resp2.json()
        self.assertFalse(edit_data2["record"]["validation"]["valid"])
        self.assertEqual(edit_data2["record"]["draft"]["status"], "rejected")
        self.assertTrue(edit_data2["record"]["validation"]["banned_phrase_found"])

        # Invariant: Invalid draft CANNOT be approved!
        appr_bad_resp = await self.client.post("/api/v1/outreach/test_lead_edit_002/approve")
        self.assertEqual(appr_bad_resp.status_code, 400)
        self.assertIn("Cannot approve invalid or rejected outreach draft", appr_bad_resp.json()["detail"])

    async def test_04_human_reject_endpoint(self):
        """Verify rejecting outreach draft via API."""
        draft_payload = {
            "lead_id": "test_lead_reject_003",
            "business_name": "City Dermatology",
            "primary_problem": "No WhatsApp CTA",
            "recommended_service": "whatsapp_automation",
            "confidence": 0.8,
            "evidence": []
        }

        create_resp = await self.client.post("/api/v1/outreach/draft", json=draft_payload)
        self.assertEqual(create_resp.status_code, 200)

        reject_resp = await self.client.post(
            "/api/v1/outreach/test_lead_reject_003/reject",
            json={"reason": "Business is currently not taking new marketing campaigns"}
        )
        self.assertEqual(reject_resp.status_code, 200)
        rej_data = reject_resp.json()
        self.assertEqual(rej_data["record"]["approval_status"], "rejected")

    async def test_05_credential_safety_invariant(self):
        """Verify API keys and credentials never leak in outreach draft API responses."""
        draft_payload = {
            "lead_id": "test_lead_sec_004",
            "business_name": "Luxe Skin Studio",
            "primary_problem": "Manual customer intake",
            "recommended_service": "business_automation",
            "confidence": 0.8,
            "evidence": []
        }

        response = await self.client.post("/api/v1/outreach/draft", json=draft_payload)
        self.assertEqual(response.status_code, 200)
        body = response.text

        secret_key = self.settings.AI_API_KEY.get_secret_value()
        self.assertNotIn(secret_key, body)
        self.assertNotIn("AI_API_KEY", body)
        self.assertNotIn("APIFY_TOKEN", body)


if __name__ == "__main__":
    unittest.main()
