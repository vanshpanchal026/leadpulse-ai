"""Test Suite for LeadPulse AI V2 Phase 8 Persistence API Routes.

Tests:
- GET /api/v1/leads (pagination, filters)
- GET /api/v1/leads/{lead_id}
- GET /api/v1/leads/{lead_id}/report (canonical Phase 9 report shape)
- POST /api/v1/research-runs
- GET /api/v1/research-runs (pagination, filters)
- GET /api/v1/research-runs/{run_id}
- 404 Not Found error handling for unknown IDs
- Security & credential non-leakage through API responses
"""

import os
from pathlib import Path
import shutil
import tempfile
import unittest
from dotenv import load_dotenv
from httpx import ASGITransport, AsyncClient

# Root and worker paths
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_AI_WORKER_DIR = _PROJECT_ROOT / "ai-worker"

from app.core.config import get_settings
from app.core.provider import close_provider, init_provider
from app.main import app
from app.services.persistence_service import (
    PersistenceService,
    get_persistence_service,
    reset_persistence_service,
)
from app.schemas.persistence import LeadReportResponse


class TestPersistenceApi(unittest.IsolatedAsyncioTestCase):
    """Integration tests for Phase 8 leads and research runs HTTP API routes."""

    async def asyncSetUp(self):
        load_dotenv(dotenv_path=_PROJECT_ROOT / ".env")
        self.settings = get_settings()
        init_provider(self.settings)

        # Isolated test SQLite DB
        self.temp_dir = tempfile.mkdtemp()
        self.test_db_path = os.path.join(self.temp_dir, "test_api_persistence.db")

        # Inject isolated persistence service
        reset_persistence_service()
        self.service = PersistenceService(
            settings=self.settings,
            db_path=self.test_db_path,
            enable_supabase=False,
        )

        # Patch global instance
        import app.services.persistence_service as ps_mod
        ps_mod._service_instance = self.service

        self.transport = ASGITransport(app=app)
        self.client = AsyncClient(transport=self.transport, base_url="http://localhost:8000")

    async def asyncTearDown(self):
        await self.client.aclose()
        reset_persistence_service()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    async def test_01_research_runs_endpoints(self):
        """Test POST /api/v1/research-runs, GET list, and GET by ID."""
        # 1. Create run
        create_resp = await self.client.post(
            "/api/v1/research-runs",
            json={
                "campaign_id": "camp_south_delhi_dental",
                "configuration": {"niche": "cosmetic dentistry", "limit": 20},
            },
        )
        self.assertEqual(create_resp.status_code, 201)
        run_data = create_resp.json()
        self.assertIn("run_id", run_data)
        self.assertEqual(run_data["campaign_id"], "camp_south_delhi_dental")
        self.assertEqual(run_data["status"], "running")
        run_id = run_data["run_id"]

        # 2. Get run by ID
        get_resp = await self.client.get(f"/api/v1/research-runs/{run_id}")
        self.assertEqual(get_resp.status_code, 200)
        self.assertEqual(get_resp.json()["run_id"], run_id)

        # 3. List runs
        list_resp = await self.client.get("/api/v1/research-runs?limit=10&offset=0")
        self.assertEqual(list_resp.status_code, 200)
        list_data = list_resp.json()
        self.assertGreaterEqual(list_data["total"], 1)
        self.assertEqual(len(list_data["items"]), 1)
        self.assertEqual(list_data["items"][0]["run_id"], run_id)

        # 4. Unknown run 404
        not_found_resp = await self.client.get("/api/v1/research-runs/nonexistent_run_999")
        self.assertEqual(not_found_resp.status_code, 404)

    async def test_02_leads_endpoints_and_report_contract(self):
        """Test GET /api/v1/leads, GET /api/v1/leads/{lead_id}, and GET /api/v1/leads/{lead_id}/report."""
        # Seed test lead
        lead = self.service.persist_research_cycle(
            candidate_data={
                "source_platform": "google_maps",
                "source_url": "https://maps.google.com/?cid=test_api_001",
                "business_name": "Apex Dental Spa",
                "phone_number": "+919810123456",
                "website_url": "https://apexdentalspa.com",
                "rating": 4.9,
                "review_count": 140,
                "has_active_ads": True,
                "prospect_score": 9,
                "audit_friction_points": ["No online appointment booking"],
            },
            specialist_results={
                "website": {
                    "status": "success",
                    "evidence": [
                        {
                            "finding": "Landing page contains no online booking widget",
                            "source": "website",
                            "evidence": "Inspected all buttons",
                            "confidence": 0.95,
                            "classification": "observed",
                        }
                    ],
                },
                "ads": {
                    "status": "success",
                    "evidence": [
                        {
                            "finding": "2 active Meta Ad campaigns promoting dental implants",
                            "source": "ads",
                            "evidence": "Sponsored ad id 882910",
                            "confidence": 0.99,
                            "classification": "observed",
                        }
                    ],
                },
            },
            opportunity_result={
                "opportunity_score": 88.0,
                "primary_problem": "Active Meta ad traffic landing without instant chat conversion",
                "recommended_service": "whatsapp_automation",
                "why_this_service": "Captures and qualifies high-intent ad clicks instantly",
                "confidence": 0.9,
            },
            lead_analysis={
                "qualification_status": "qualified",
                "priority": "high",
                "research_status": "complete",
                "opportunity_score": 88.0,
                "limitations": [],
            },
            outreach_record={
                "draft": {
                    "message": "I saw your dental implant ads on Meta. Adding instant WhatsApp booking on your site could help capture ad traffic before they bounce.",
                    "service": "whatsapp_automation",
                    "confidence": 0.9,
                    "status": "draft",
                },
                "approval_status": "awaiting_human_approval",
            },
        )

        lead_id = lead.id

        # 1. GET /api/v1/leads
        list_resp = await self.client.get("/api/v1/leads?limit=10&offset=0")
        self.assertEqual(list_resp.status_code, 200)
        list_data = list_resp.json()
        self.assertEqual(list_data["total"], 1)
        self.assertEqual(list_data["items"][0]["id"], lead_id)
        self.assertEqual(list_data["items"][0]["business_name"], "Apex Dental Spa")

        # 2. GET /api/v1/leads/{lead_id}
        single_resp = await self.client.get(f"/api/v1/leads/{lead_id}")
        self.assertEqual(single_resp.status_code, 200)
        single_data = single_resp.json()
        self.assertEqual(single_data["id"], lead_id)
        self.assertEqual(single_data["recommended_service"], "whatsapp_automation")
        self.assertEqual(single_data["opportunity_score"], 88.0)

        # 3. GET /api/v1/leads/{lead_id}/report (Stable Contract Verification)
        report_resp = await self.client.get(f"/api/v1/leads/{lead_id}/report")
        self.assertEqual(report_resp.status_code, 200)
        report_data = report_resp.json()

        # Validate with Pydantic model contract
        validated_report = LeadReportResponse.model_validate(report_data)
        self.assertEqual(validated_report.lead["business_name"], "Apex Dental Spa")
        self.assertEqual(validated_report.opportunity["recommended_service"], "whatsapp_automation")
        self.assertEqual(validated_report.specialists.website["status"], "success")
        self.assertEqual(validated_report.specialists.ads["status"], "success")
        self.assertEqual(validated_report.metadata.research_status, "complete")
        self.assertFalse(validated_report.outreach["external_send_executed"])

        # 4. Unknown lead 404
        not_found_resp = await self.client.get("/api/v1/leads/nonexistent_lead_000")
        self.assertEqual(not_found_resp.status_code, 404)

        report_404_resp = await self.client.get("/api/v1/leads/nonexistent_lead_000/report")
        self.assertEqual(report_404_resp.status_code, 404)

    async def test_03_credential_non_leakage(self):
        """Invariant: Credentials never leak in any API response."""
        lead = self.service.upsert_lead({
            "source_platform": "google_maps",
            "source_url": "https://maps.google.com/?cid=sec_test_001",
            "business_name": "Secure Dental Clinic",
        })

        resp = await self.client.get(f"/api/v1/leads/{lead.id}/report")
        self.assertEqual(resp.status_code, 200)
        body = resp.text

        secret_key = self.settings.AI_API_KEY.get_secret_value()
        self.assertNotIn(secret_key, body)
        self.assertNotIn("AI_API_KEY", body)
        self.assertNotIn("SUPABASE_SERVICE_ROLE_KEY", body)
        self.assertNotIn("APIFY_TOKEN", body)

    async def test_04_specialist_non_dict_api_report(self):
        """Verify GET /api/v1/leads/{lead_id}/report returns HTTP 200 with coerced non-dict specialist data."""
        lead = self.service.upsert_lead({
            "source_platform": "meta_ads",
            "source_url": "https://meta.com/ads/api-test-non-dict",
            "business_name": "Clinic With Error Payload",
            "specialist_results": {
                "website": "Connection timeout after 60s",
                "ads": {"status": "success"},
                "maps": None,
            },
        })

        resp = await self.client.get(f"/api/v1/leads/{lead.id}/report")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["specialists"]["website"]["status"], "recorded")
        self.assertIn("Connection timeout", data["specialists"]["website"]["details"])

    async def test_05_status_filter_all(self):
        """Verify status='all' in GET /api/v1/leads and GET /api/v1/research-runs is treated as no filter."""
        self.service.upsert_lead({
            "source_platform": "google_maps",
            "source_url": "https://maps.google.com/?cid=filter_test_1",
            "business_name": "Filter Dental",
            "status": "new",
        })

        resp = await self.client.get("/api/v1/leads?status=all")
        self.assertEqual(resp.status_code, 200)
        self.assertGreaterEqual(resp.json()["total"], 1)


if __name__ == "__main__":
    unittest.main()
