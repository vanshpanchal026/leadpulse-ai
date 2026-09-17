"""LeadPulse AI V2 — Phase 6 Live Integration Test Suite.

Proves the complete Phase 6 end-to-end pipeline:
Phase 5 Specialist Aggregate
          ↓
Opportunity Agent (Live Upstream LLM Provider via OpenAI Agents SDK)
          ↓
Lead Analyst (Live Upstream LLM Provider via OpenAI Agents SDK)
          ↓
Final Structured LeadAnalysis

Verifies:
- Opportunity Agent live execution and schema conformance
- Lead Analyst live execution and schema conformance
- POST /api/v1/opportunities/analyze endpoint with both pre-computed aggregate and raw candidate
- Partial failure isolation (failed specialist -> research_status='partial' + explicit limitations)
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
from app.schemas.evidence import (
    Evidence,
    LeadTriageResult,
    WebsiteAnalysisResult,
    AdsAnalysisResult,
    MapsAnalysisResult,
    SpecialistResearchAggregate,
)
from app.schemas.opportunity import OpportunityResult, APPROVED_SERVICES
from app.schemas.lead_analysis import LeadAnalysis
from app.services.deterministic_pipeline import NormalizedCandidate


class TestPhase6LiveIntegration(unittest.IsolatedAsyncioTestCase):
    """Live integration tests for Phase 6 Opportunity Agent and Lead Analyst."""

    async def asyncSetUp(self):
        load_dotenv(dotenv_path=_PROJECT_ROOT / ".env")
        self.settings = get_settings()
        init_provider(self.settings)
        self.transport = ASGITransport(app=app)
        self.client = AsyncClient(transport=self.transport, base_url="http://localhost:8000")

    async def asyncTearDown(self):
        await self.client.aclose()
        await close_provider()

    async def test_01_opportunity_agent_live_execution(self):
        """Verify Opportunity Agent evaluates specialist evidence and outputs structured OpportunityResult."""
        prompt = (
            "Analyze the verified research for 'Apex Dental Spa' in Gurgaon:\n"
            "- Business Type: Cosmetic Dentistry & Dental Implants\n"
            "- Website Audit: Available, but lacks online booking and lacks direct WhatsApp chat CTA.\n"
            "- Meta Ads Audit: Active ads promoting smile makeovers and dental implants.\n"
            "- Maps Audit: Verified local presence, 4.9 rating across 140 reviews.\n"
            "- Observed Friction: Prospects clicking paid ads must call the clinic during business hours.\n"
            "Synthesize this intelligence into a structured OpportunityResult:\n"
            "Identify primary bottleneck, recommend approved service, explain why, "
            "and calculate opportunity_score (0-100) and confidence (0-1)."
        )

        response = await self.client.post(
            "/api/v1/run",
            json={
                "prompt": prompt,
                "agent_type": "opportunity",
                "timeout_seconds": 120.0,
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"], f"Opportunity agent execution failed: {data.get('error')}")
        self.assertEqual(data["agent_type"], "opportunity")

        output = data["output"]
        self.assertIsInstance(output, dict)
        validated = OpportunityResult.model_validate(output)

        self.assertGreaterEqual(validated.opportunity_score, 0.0)
        self.assertLessEqual(validated.opportunity_score, 100.0)
        self.assertGreaterEqual(validated.confidence, 0.0)
        self.assertLessEqual(validated.confidence, 1.0)
        self.assertIn(validated.recommended_service, list(APPROVED_SERVICES.keys()))
        self.assertGreater(len(validated.primary_problem), 5)
        self.assertGreater(len(validated.why_this_service), 10)

    async def test_02_lead_analyst_live_execution(self):
        """Verify Lead Analyst synthesizes intelligence into a structured LeadAnalysis record."""
        prompt = (
            "Synthesize final intelligence for prospective client 'Apex Dental Spa':\n"
            "- Business: Apex Dental Spa (Scorecard: 9/10, Priority: high)\n"
            "- Triage: Qualified for deep research\n"
            "- Specialist Research: All specialists (Website, Ads, Maps) completed successfully.\n"
            "- Opportunity: Score 88.0, Recommended Service: booking_automation.\n"
            "- Problem: Inbound paid ad traffic leaks because clinic lacks 24/7 calendar booking.\n"
            "- Limitations: None. All digital channels verified.\n"
            "Emit a structured LeadAnalysis record."
        )

        response = await self.client.post(
            "/api/v1/run",
            json={
                "prompt": prompt,
                "agent_type": "lead_analyst",
                "timeout_seconds": 120.0,
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"], f"Lead Analyst execution failed: {data.get('error')}")
        self.assertEqual(data["agent_type"], "lead_analyst")

        output = data["output"]
        self.assertIsInstance(output, dict)
        validated = LeadAnalysis.model_validate(output)

        self.assertEqual(validated.qualification_status, "qualified")
        self.assertIn(validated.priority, ["high", "medium", "low"])
        self.assertEqual(validated.research_status, "complete")
        self.assertGreaterEqual(validated.opportunity_score, 0.0)
        self.assertLessEqual(validated.opportunity_score, 100.0)
        self.assertIn(validated.recommended_service, list(APPROVED_SERVICES.keys()))

    async def test_03_opportunity_analyze_endpoint_with_precomputed_aggregate(self):
        """Verify POST /api/v1/opportunities/analyze with candidate and pre-computed specialist aggregate."""
        candidate_payload = {
            "business_name": "Apex Dental Spa",
            "business_type": "Cosmetic Dentistry & Implants",
            "source_platform": "google_maps",
            "source_url": "https://maps.google.com/apexdental",
            "scorecard_score": 9,
            "priority_tier": "immediate",
            "website_url": "https://apexdentalspa.in",
            "has_active_ads": True,
            "rating": 4.9,
            "review_count": 140,
            "friction_points": ["No online booking flow", "Manual appointment intake"],
        }

        aggregate_payload = {
            "business_name": "Apex Dental Spa",
            "triage_result": {
                "qualified": True,
                "priority": "high",
                "reason": "High-value dental clinic with active advertising",
                "research_agents": ["website", "ads", "maps"]
            },
            "website_analysis": {
                "status": "available",
                "has_booking_system": False,
                "has_whatsapp_cta": False,
                "primary_cta": "Call Now",
                "friction_points": ["No calendar booking", "No instant messaging"],
                "confidence": 0.9,
                "findings": ["Clean website with service listing but lacks self-serve booking"]
            },
            "ads_analysis": {
                "status": "active_ads",
                "active_ad_count": 3,
                "ad_themes": ["Smile makeover discount", "Implant warranty"],
                "observed_ctas": ["Learn More"],
                "confidence": 0.85,
                "findings": ["3 active Meta ad creatives running"]
            },
            "maps_analysis": {
                "status": "verified",
                "rating": 4.9,
                "review_count": 140,
                "business_category": "Dental clinic",
                "confidence": 0.95,
                "findings": ["Verified Google profile in Gurgaon"]
            },
            "aggregated_evidence": [
                {
                    "finding": "Active ad campaigns lack online booking conversion path",
                    "source": "ads",
                    "evidence": "Observed 3 active ads directing traffic to site with no booking system",
                    "confidence": 0.9,
                    "classification": "observed"
                }
            ],
            "execution_status": {"website": "success", "ads": "success", "maps": "success"}
        }

        response = await self.client.post(
            "/api/v1/opportunities/analyze",
            json={
                "candidate": candidate_payload,
                "specialist_aggregate": aggregate_payload,
                "timeout_seconds": 120.0
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"], f"Opportunities analyze endpoint failed: {data.get('error')}")

        self.assertIn("lead_analysis", data)
        self.assertIn("opportunity_result", data)
        self.assertIn("specialist_aggregate", data)
        self.assertIn("token_usage", data)

        lead = LeadAnalysis.model_validate(data["lead_analysis"])
        self.assertEqual(lead.business_name, "Apex Dental Spa")
        self.assertEqual(lead.qualification_status, "qualified")
        self.assertEqual(lead.priority, "high")
        self.assertEqual(lead.research_status, "complete")
        self.assertGreater(lead.opportunity_score, 60.0)

        opp = OpportunityResult.model_validate(data["opportunity_result"])
        self.assertIn(opp.recommended_service, list(APPROVED_SERVICES.keys()))

    async def test_04_partial_research_isolation_live(self):
        """Verify that specialist timeout causes research_status='partial' with explicit limitations."""
        candidate_payload = {
            "business_name": "Metro Aesthetics",
            "business_type": "Dermatology Clinic",
            "source_platform": "google_maps",
            "source_url": "https://maps.google.com/metroaesthetics",
            "scorecard_score": 7,
            "priority_tier": "high",
            "website_url": "https://metroaesthetics.in",
            "has_active_ads": False,
            "rating": 4.6,
            "review_count": 55,
            "friction_points": ["Manual WhatsApp scheduling"],
        }

        # Aggregate with Ads failed/timed out
        aggregate_payload = {
            "business_name": "Metro Aesthetics",
            "triage_result": {
                "qualified": True,
                "priority": "high",
                "reason": "Dermatology clinic",
                "research_agents": ["website", "ads"]
            },
            "website_analysis": {
                "status": "available",
                "has_booking_system": False,
                "has_whatsapp_cta": True,
                "primary_cta": "WhatsApp Us",
                "confidence": 0.85,
                "findings": ["Website operational with WhatsApp link"]
            },
            "ads_analysis": {
                "status": "error",
                "findings": ["Ads research unavailable: Worker timeout after 60s"],
                "confidence": 0.0
            },
            "execution_status": {
                "website": "success",
                "ads": "timeout: WorkerTimeoutError after 60.0s"
            }
        }

        response = await self.client.post(
            "/api/v1/opportunities/analyze",
            json={
                "candidate": candidate_payload,
                "specialist_aggregate": aggregate_payload,
                "timeout_seconds": 120.0
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])

        lead = LeadAnalysis.model_validate(data["lead_analysis"])
        # Invariant: research_status must be 'partial'
        self.assertEqual(lead.research_status, "partial")
        # Invariant: limitations must record the ads failure
        self.assertGreater(len(lead.limitations), 0)
        self.assertTrue(any("ads" in lim.lower() for lim in lead.limitations))

    async def test_05_credential_safety_invariant(self):
        """Verify API keys and credentials are never exposed in synthesis responses."""
        prompt = (
            "Analyze candidate 'Clinic X' with scorecard score 5/10 and website available. "
            "Emit a structured OpportunityResult."
        )
        response = await self.client.post(
            "/api/v1/run",
            json={
                "prompt": prompt,
                "agent_type": "opportunity",
                "timeout_seconds": 60.0
            }
        )
        self.assertEqual(response.status_code, 200)
        body = response.text
        api_key = self.settings.AI_API_KEY.get_secret_value() if self.settings.AI_API_KEY else ""
        if api_key and len(api_key) > 5:
            self.assertNotIn(api_key, body)
        apify_token = os.getenv("APIFY_API_TOKEN", "")
        if apify_token and len(apify_token) > 5:
            self.assertNotIn(apify_token, body)


if __name__ == "__main__":
    unittest.main()
