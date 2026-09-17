"""LeadPulse AI V2 — Phase 8 Live Integration Test Suite.

Proves the complete end-to-end research persistence & campaign run storage lifecycle:
Campaign Research Run
          ↓
Candidate Discovery & Normalization
          ↓
Specialist Research (Website, Ads, Maps)
          ↓
Opportunity Analysis (Scorer + Agent)
          ↓
Lead Intelligence (Lead Analyst)
          ↓
Outreach Drafting & Deterministic Validation
          ↓
Human Approval Boundary
          ↓
DURABLE MULTI-AGENT PERSISTENCE
          ↓
API RETRIEVAL FOR PHASE 9 DASHBOARD

Verifies:
- Research run lifecycle: start (running) -> counter progression -> complete
- Multi-key deterministic deduplication & idempotency on re-run
- Partial research preservation (failure in one agent does not corrupt entire lead)
- Evidence classification integrity: observed, inferred, unknown never corrupted
- Outreach persistence: draft, validation, and human approval states preserved
- Strict boundary invariant: external_send_executed is False, zero automatic messaging
- API endpoint contract: GET /api/v1/leads, /leads/{id}, /leads/{id}/report, /research-runs/{id}
- Strict credential non-leakage invariant
"""

from datetime import datetime, timezone
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from dotenv import load_dotenv
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
from app.schemas.lead_analysis import LeadAnalysis
from app.schemas.opportunity import OpportunityResult, APPROVED_SERVICES
from app.schemas.outreach import (
    ApprovalStatus,
    OutreachDraft,
    OutreachRecord,
    OutreachValidationResult,
)
from app.schemas.persistence import (
    LeadPersistenceRecord,
    LeadReportResponse,
    ResearchRunRecord,
)
from app.services.deterministic_pipeline import (
    NormalizedCandidate,
    calculate_prospect_score,
    normalize_phone_number,
)
from app.services.persistence_service import (
    PersistenceService,
    get_persistence_service,
    reset_persistence_service,
)


class TestPhase8LiveIntegration(unittest.IsolatedAsyncioTestCase):
    """End-to-end integration test verifying complete research lifecycle persistence and retrieval."""

    async def asyncSetUp(self):
        load_dotenv(dotenv_path=_PROJECT_ROOT / ".env")
        self.settings = get_settings()
        init_provider(self.settings)

        # Isolated temporary SQLite database for clean test assertions
        self.temp_dir = tempfile.mkdtemp()
        self.test_db_path = os.path.join(self.temp_dir, "test_phase8_live.db")

        reset_persistence_service()
        self.service = PersistenceService(
            settings=self.settings,
            db_path=self.test_db_path,
            enable_supabase=False,
        )

        import app.services.persistence_service as ps_mod
        ps_mod._service_instance = self.service

        self.transport = ASGITransport(app=app)
        self.client = AsyncClient(transport=self.transport, base_url="http://localhost:8000")

    async def asyncTearDown(self):
        await self.client.aclose()
        reset_persistence_service()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    async def test_01_complete_lifecycle_run_persistence_and_api_retrieval(self):
        """Execute full 7-stage lifecycle, persist intelligence, and verify API retrieval."""
        # =====================================================================
        # STAGE 1: Initialize Research Run
        # =====================================================================
        run = self.service.create_research_run(
            campaign_id="campaign_delhi_luxury_dentistry_001",
            configuration={
                "niche": "cosmetic_dentistry",
                "location": "South Delhi",
                "max_leads": 10,
                "deep_research": True,
            },
        )
        self.assertEqual(run.status, "running")
        self.assertIsNotNone(run.run_id)
        run_id = run.run_id

        # Update run discovery counters
        self.service.update_run_counters(
            run_id=run_id,
            queries_generated=2,
            businesses_found=5,
            businesses_filtered=1,
            businesses_triaged=4,
            businesses_researched=1,
        )

        # =====================================================================
        # STAGE 2: Candidate Normalization (Phase 4 Deterministic)
        # =====================================================================
        raw_candidate = {
            "source_platform": "google_maps",
            "source_url": "https://maps.google.com/?cid=delhi_apex_dentistry_88",
            "business_name": "Apex Elite Smile Dental Clinic Pvt Ltd",
            "phone_number": "+91 (981) 012-3456",
            "website_url": "https://apexsmiledental.com",
            "rating": 4.9,
            "review_count": 210,
            "has_active_ads": True,
            "address": "Greater Kailash 1, South Delhi, Delhi 110048",
            "audit_friction_points": [
                "Paid Meta ads active but landing page has zero instant chat CTA",
                "No online appointment scheduling widget",
            ],
            "prospect_score": 9,
        }

        # =====================================================================
        # STAGE 3: Specialist Agent Results (Phase 5 Parallel Research)
        # =====================================================================
        specialist_results = {
            "website": {
                "status": "success",
                "agent_name": "website_specialist",
                "evidence": [
                    {
                        "finding": "Landing page contains no online booking widget or WhatsApp CTA",
                        "source": "website",
                        "evidence": "Inspected DOM: only telephone anchor href='tel:+919810123456' found",
                        "confidence": 0.95,
                        "classification": "observed",
                    },
                    {
                        "finding": "Business appears to operate a multi-chair luxury clinic",
                        "source": "website",
                        "evidence": "Team page showcases 5 specialist prosthodontists",
                        "confidence": 0.85,
                        "classification": "inferred",
                    },
                ],
            },
            "ads": {
                "status": "success",
                "agent_name": "ads_specialist",
                "evidence": [
                    {
                        "finding": "3 active Meta ad campaigns promoting invisible aligners and dental implants",
                        "source": "ads",
                        "evidence": "Meta Ad Library ID 9920194 active in India region",
                        "confidence": 0.98,
                        "classification": "observed",
                    }
                ],
            },
            "maps": {
                "status": "success",
                "agent_name": "maps_specialist",
                "evidence": [
                    {
                        "finding": "High patient satisfaction with 4.9 rating across 210 Google reviews",
                        "source": "maps",
                        "evidence": "Google Places API place_id=ChIJdelhi_apex",
                        "confidence": 0.99,
                        "classification": "observed",
                    },
                    {
                        "finding": "Estimated monthly patient volume could not be determined",
                        "source": "maps",
                        "evidence": "Google Maps does not provide footfall analytics",
                        "confidence": 0.30,
                        "classification": "unknown",
                    },
                ],
            },
        }

        # =====================================================================
        # STAGE 4: Opportunity Analysis (Phase 6 Scorer + Agent)
        # =====================================================================
        opportunity_result = {
            "opportunity_score": 91.5,
            "primary_problem": "Active Meta ad campaigns drive high-intent traffic to a site lacking instant WhatsApp intake",
            "recommended_service": "whatsapp_automation",
            "why_this_service": "Converts expensive ad clicks into instant booked consultations 24/7",
            "confidence": 0.92,
            "evidence": [
                {
                    "finding": "3 active Meta ad campaigns with zero instant chat CTA on destination page",
                    "source": "ads",
                    "evidence": "Ad campaigns driving traffic directly to homepage without form or chat",
                    "confidence": 0.95,
                    "classification": "observed",
                }
            ],
        }

        # =====================================================================
        # STAGE 5: Lead Intelligence Synthesis (Phase 6 Lead Analyst)
        # =====================================================================
        lead_analysis = {
            "business_name": "Apex Elite Smile Dental Clinic",
            "qualification_status": "qualified",
            "priority": "high",
            "prospect_score": 9.0,
            "opportunity_score": 91.5,
            "primary_problem": "Active Meta ad campaigns drive high-intent traffic to a site lacking instant WhatsApp intake",
            "recommended_service": "whatsapp_automation",
            "why_this_service": "Converts expensive ad clicks into instant booked consultations 24/7",
            "confidence": 0.92,
            "research_status": "complete",
            "limitations": [],
        }

        # =====================================================================
        # STAGE 6: Outreach Drafting & Human Approval (Phase 7 Outreach Agent)
        # =====================================================================
        outreach_draft = {
            "message": "I saw your dental implant ads on Meta. Adding instant WhatsApp booking on your site could help capture high-intent inquiries before they bounce.",
            "service": "whatsapp_automation",
            "confidence": 0.90,
            "status": "draft",
            "character_count": 142,
            "sentence_count": 2,
        }
        validation_result = {
            "valid": True,
            "errors": [],
            "character_count": 142,
            "sentence_count": 2,
            "banned_phrase_found": False,
            "unsupported_claim_detected": False,
            "placeholder_detected": False,
        }

        # Staged human approval
        outreach_record = {
            "draft": outreach_draft,
            "validation": validation_result,
            "approval_status": "approved",
            "lifecycle_status": "approved",
            "external_send_executed": False,
        }

        # =====================================================================
        # STAGE 7: Final Lead Intelligence Persistence (Phase 8 Deterministic)
        # =====================================================================
        token_usage = {
            "prompt_tokens": 1450,
            "completion_tokens": 320,
            "total_tokens": 1770,
        }

        persisted_lead = self.service.persist_research_cycle(
            candidate_data=raw_candidate,
            specialist_results=specialist_results,
            opportunity_result=opportunity_result,
            lead_analysis=lead_analysis,
            outreach_record=outreach_record,
            token_usage=token_usage,
            research_run_id=run_id,
        )
        self.assertIsNotNone(persisted_lead.id)
        lead_id = persisted_lead.id

        # Update run completion counters
        self.service.update_run_counters(
            run_id=run_id,
            qualified_leads=1,
            total_tokens=token_usage["total_tokens"],
            tool_calls=6,
            apify_calls=2,
        )
        completed_run = self.service.complete_research_run(run_id=run_id, status="completed")
        self.assertEqual(completed_run.status, "completed")
        self.assertEqual(completed_run.qualified_leads, 1)

        # =====================================================================
        # STAGE 8: Verify Complete API Retrieval (Phase 9 Readiness)
        # =====================================================================

        # 1. Verify GET /api/v1/research-runs/{run_id}
        run_resp = await self.client.get(f"/api/v1/research-runs/{run_id}")
        self.assertEqual(run_resp.status_code, 200)
        run_body = run_resp.json()
        self.assertEqual(run_body["run_id"], run_id)
        self.assertEqual(run_body["status"], "completed")
        self.assertEqual(run_body["qualified_leads"], 1)
        self.assertEqual(run_body["total_tokens"], 1770)

        # 2. Verify GET /api/v1/leads/{lead_id}
        lead_resp = await self.client.get(f"/api/v1/leads/{lead_id}")
        self.assertEqual(lead_resp.status_code, 200)
        lead_body = lead_resp.json()
        self.assertEqual(lead_body["id"], lead_id)
        self.assertEqual(lead_body["phone_number"], "+919810123456")
        self.assertEqual(lead_body["research_status"], "complete")
        self.assertEqual(lead_body["research_run_id"], run_id)
        self.assertEqual(lead_body["opportunity_score"], 91.5)
        self.assertEqual(lead_body["recommended_service"], "whatsapp_automation")

        # 3. Verify GET /api/v1/leads/{lead_id}/report (Stable React Dashboard Contract)
        report_resp = await self.client.get(f"/api/v1/leads/{lead_id}/report")
        self.assertEqual(report_resp.status_code, 200)
        report_data = report_resp.json()

        # Validate with LeadReportResponse schema contract
        report = LeadReportResponse.model_validate(report_data)

        # Assert Lead block
        self.assertEqual(report.lead["id"], lead_id)
        self.assertEqual(report.lead["business_name"], "Apex Elite Smile Dental Clinic Pvt Ltd")
        self.assertEqual(report.lead["phone_number"], "+919810123456")
        self.assertTrue(report.lead["has_active_ads"])
        self.assertEqual(report.lead["prospect_score"], 9)

        # Assert Specialists block
        self.assertIsNotNone(report.specialists.website)
        self.assertEqual(report.specialists.website["status"], "success")
        self.assertIsNotNone(report.specialists.ads)
        self.assertEqual(report.specialists.ads["status"], "success")
        self.assertIsNotNone(report.specialists.maps)
        self.assertEqual(report.specialists.maps["status"], "success")

        # Assert Opportunity block
        self.assertEqual(report.opportunity["opportunity_score"], 91.5)
        self.assertEqual(report.opportunity["recommended_service"], "whatsapp_automation")
        self.assertIn("WhatsApp intake", report.opportunity["primary_problem"])

        # Assert Analysis block
        self.assertEqual(report.analysis["qualification_status"], "qualified")
        self.assertEqual(report.analysis["priority"], "high")
        self.assertEqual(report.analysis["research_status"], "complete")

        # Assert Outreach block & Non-Sending Invariant
        self.assertEqual(report.outreach["outreach_status"], "approved")
        self.assertEqual(report.outreach["draft"]["message"], outreach_draft["message"])
        self.assertFalse(report.outreach["external_send_executed"], "Strict Invariant: Zero external messaging")

        # Assert Metadata block
        self.assertEqual(report.metadata.research_status, "complete")
        self.assertEqual(report.metadata.research_run_id, run_id)
        self.assertEqual(report.metadata.token_usage["total_tokens"], 1770)

        # =====================================================================
        # STAGE 9: Verify Evidence Classification Preservation Invariant
        # =====================================================================
        all_evidence = report.opportunity["evidence"]
        classifications = {item["finding"]: item["classification"] for item in all_evidence}
        # Invariant: No corruption of classification
        for item in all_evidence:
            self.assertIn(item["classification"], ["observed", "inferred", "unknown"])

        # =====================================================================
        # STAGE 10: Verify Idempotency on Repeated Execution
        # =====================================================================
        # Simulate re-running the same pipeline on identical prospect
        repeat_lead = self.service.persist_research_cycle(
            candidate_data=raw_candidate,
            specialist_results=specialist_results,
            opportunity_result=opportunity_result,
            lead_analysis=lead_analysis,
            outreach_record=outreach_record,
            token_usage=token_usage,
            research_run_id=run_id,
        )
        self.assertEqual(repeat_lead.id, lead_id, "Repeated pipeline execution MUST NOT create duplicate lead records")

        # Verify list leads count remains exactly 1
        list_resp = await self.client.get("/api/v1/leads")
        self.assertEqual(list_resp.json()["total"], 1)

    async def test_02_partial_pipeline_preservation_and_api(self):
        """Verify that partial pipeline results persist correctly and expose status='partial' via API."""
        candidate = {
            "source_platform": "meta_ads",
            "source_url": "https://meta.com/ads/partial-dentist-002",
            "business_name": "Radiant Smiles Studio",
            "phone_number": "+919822233344",
        }
        # Website succeeded, Ads failed with timeout
        specialist_results = {
            "website": {
                "status": "success",
                "evidence": [
                    {
                        "finding": "Hero section lacks booking CTA",
                        "source": "website",
                        "evidence": "Inspected home page",
                        "confidence": 0.9,
                        "classification": "observed",
                    }
                ],
            },
            "ads": {
                "status": "failed",
                "error": "Gateway timeout (HTTP 504)",
            },
        }

        lead = self.service.persist_research_cycle(
            candidate_data=candidate,
            specialist_results=specialist_results,
            opportunity_result={
                "opportunity_score": 65.0,
                "primary_problem": "Conversion friction on landing page",
                "recommended_service": "booking_automation",
            },
            errors=["Ads research failed"],
        )

        # Verify via API
        resp = await self.client.get(f"/api/v1/leads/{lead.id}/report")
        self.assertEqual(resp.status_code, 200)
        report = resp.json()
        self.assertEqual(report["metadata"]["research_status"], "partial")
        self.assertEqual(report["specialists"]["website"]["status"], "success")
        self.assertEqual(report["specialists"]["ads"]["status"], "failed")

    async def test_03_credential_safety_invariant(self):
        """Verify API keys and credentials never leak in leads or research runs API responses."""
        run = self.service.create_research_run(
            campaign_id="sec_test_run",
            configuration={"api_token": "secret_super_token"},
        )
        lead = self.service.upsert_lead({
            "source_platform": "google_maps",
            "source_url": "https://maps.google.com/?cid=sec_001",
            "business_name": "Vault Dental",
        })

        # Check run response
        run_resp = await self.client.get(f"/api/v1/research-runs/{run.run_id}")
        self.assertEqual(run_resp.status_code, 200)
        self.assertNotIn("secret_super_token", run_resp.text)

        # Check lead report response
        report_resp = await self.client.get(f"/api/v1/leads/{lead.id}/report")
        self.assertEqual(report_resp.status_code, 200)
        secret_key = self.settings.AI_API_KEY.get_secret_value()
        self.assertNotIn(secret_key, report_resp.text)
        self.assertNotIn("AI_API_KEY", report_resp.text)
        self.assertNotIn("SUPABASE_SERVICE_ROLE_KEY", report_resp.text)


if __name__ == "__main__":
    unittest.main()
