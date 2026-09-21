"""LeadPulse AI V2 — Phase 5 Live Integration Test Suite.

Proves the complete end-to-end integration:
NormalizedCandidate
    │
    ▼
Lead Triage Agent (Live Upstream LLM Provider via OpenAI Agents SDK)
    │
    ├──── Website Specialist Agent
    │
    ├──── Ads Specialist Agent
    │
    └──── Maps Specialist Agent
             │
             ▼
SpecialistResearchAggregate (Aggregated evidence, failure isolation, strict anti-hallucination)
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
from app.schemas.profile import CampaignScope
from app.schemas.search import CampaignLimits
from app.schemas.evidence import (
    Evidence,
    LeadTriageResult,
    WebsiteAnalysisResult,
    AdsAnalysisResult,
    MapsAnalysisResult,
    SpecialistResearchAggregate,
)
from app.services.deterministic_pipeline import NormalizedCandidate
from app.services.specialist_orchestrator import SpecialistOrchestratorService


class TestPhase5LiveIntegration(unittest.IsolatedAsyncioTestCase):
    """Live end-to-end integration test suite verifying Phase 5 Lead Triage and Specialist Agents."""

    async def asyncSetUp(self):
        load_dotenv(dotenv_path=_PROJECT_ROOT / ".env")
        self.settings = get_settings()
        init_provider(self.settings)
        self.transport = ASGITransport(app=app)
        self.client = AsyncClient(transport=self.transport, base_url="http://localhost:8000")

    async def asyncTearDown(self):
        await self.client.aclose()
        await close_provider()

    async def test_01_lead_triage_agent_live_execution(self):
        """Verify Lead Triage Agent evaluates a candidate and returns structured LeadTriageResult."""
        prompt = (
            "Evaluate prospective business candidate 'Apex Dental Spa' located in Gurgaon:\n"
            "Business Type: Cosmetic Dentistry & Dental Implants\n"
            "Scorecard Score: 9/10 (High ticket, verified location)\n"
            "Active Ads: True (Running Invisalign and implant offers)\n"
            "Website: https://apexdentalspa.in\n"
            "Google Rating: 4.9 across 140 reviews\n"
            "Friction Points: Manual WhatsApp booking, slow intake response\n"
            "Return a structured LeadTriageResult specifying qualification, priority, reason, and research_agents."
        )

        response = await self.client.post(
            "/api/v1/run",
            json={
                "prompt": prompt,
                "agent_type": "lead_triage",
                "timeout_seconds": 120.0
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"], f"Lead triage agent execution failed: {data.get('error')}")
        self.assertEqual(data["agent_type"], "lead_triage")

        output = data["output"]
        self.assertIsInstance(output, dict)
        self.assertIn("qualified", output)
        self.assertIn("priority", output)
        self.assertIn("reason", output)
        self.assertIn("research_agents", output)

        validated = LeadTriageResult.model_validate(output)
        self.assertTrue(validated.qualified)
        self.assertIn(validated.priority, ["high", "medium", "low"])
        self.assertGreater(len(validated.research_agents), 0)

    async def test_02_website_specialist_live_execution(self):
        """Verify Website Specialist analyzes observable signals and produces structured WebsiteAnalysisResult."""
        prompt = (
            "Analyze the following public website inspection data for 'Apex Dental Spa':\n"
            "URL: https://apexdentalspa.in\n"
            "Title: Apex Dental Spa | Premier Cosmetic & Implant Clinic\n"
            "Meta Description: Best cosmetic dentist in Gurgaon offering smile makeovers.\n"
            "Text Summary: Welcome to Apex Dental Spa. We specialize in dental implants and smile design. "
            "Contact our team today to schedule your consultation.\n"
            "Observed CTAs: ['Book Free Consultation', 'Call +91 9876543210', 'Chat on WhatsApp']\n"
            "WhatsApp Links: ['https://wa.me/919876543210']\n"
            "Booking Links: ['https://calendly.com/apexdental/consult']\n"
            "Has Booking System: True\n"
            "Has WhatsApp CTA: True\n"
            "Return a structured WebsiteAnalysisResult."
        )

        response = await self.client.post(
            "/api/v1/run",
            json={
                "prompt": prompt,
                "agent_type": "website_specialist",
                "timeout_seconds": 120.0
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"], f"Website specialist failed: {data.get('error')}")

        output = data["output"]
        validated = WebsiteAnalysisResult.model_validate(output)
        self.assertIn(validated.status, ["available", "partial", "unavailable"])
        self.assertGreaterEqual(validated.confidence, 0.0)
        self.assertLessEqual(validated.confidence, 1.0)
        self.assertIsInstance(validated.evidence, list)

    async def test_03_ads_specialist_live_execution_no_metric_fabrication(self):
        """Verify Ads Specialist analyzes Meta Ads copy and does NOT fabricate spend or ROAS."""
        prompt = (
            "Analyze Meta Ads data for 'Apex Dental Spa':\n"
            "Business Name: Apex Dental Spa\n"
            "Has Active Ads: True\n"
            "Ad Headline: Get 30% Off Dental Implants This Month\n"
            "Ad Creative Text: Restore your natural smile with our German-certified implantologists. Book your free scan.\n"
            "Observed CTA: Send WhatsApp Message\n"
            "Ad Count: 1\n"
            "DO NOT INVENT ad spend, ROAS, or conversion metrics. Return a structured AdsAnalysisResult."
        )

        response = await self.client.post(
            "/api/v1/run",
            json={
                "prompt": prompt,
                "agent_type": "ads_specialist",
                "timeout_seconds": 120.0
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"], f"Ads specialist failed: {data.get('error')}")

        output = data["output"]
        validated = AdsAnalysisResult.model_validate(output)
        self.assertEqual(validated.status, "active_ads")
        self.assertIsNone(validated.ad_spend)
        self.assertIsNone(validated.roas)
        self.assertIsNone(validated.conversion_rate)

    async def test_04_maps_specialist_live_execution_no_sentiment_fabrication(self):
        """Verify Maps Specialist analyzes Google Maps data and does NOT fabricate review sentiment."""
        prompt = (
            "Analyze Google Maps data for 'Apex Dental Spa':\n"
            "Business Name: Apex Dental Spa\n"
            "Category: Dental clinic\n"
            "Rating: 4.9\n"
            "Review Count: 140\n"
            "Address: DLF Phase 5, Gurgaon, Haryana\n"
            "Phone: +91 9876543210\n"
            "Website Present: True\n"
            "Instagram Present: True\n"
            "Review Text: NONE PROVIDED\n"
            "DO NOT FABRICATE review sentiment or customer complaints. Return a structured MapsAnalysisResult."
        )

        response = await self.client.post(
            "/api/v1/run",
            json={
                "prompt": prompt,
                "agent_type": "maps_specialist",
                "timeout_seconds": 120.0
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"], f"Maps specialist failed: {data.get('error')}")

        output = data["output"]
        validated = MapsAnalysisResult.model_validate(output)
        self.assertIn(validated.status, ["verified", "unverified"])
        self.assertEqual(validated.rating, 4.9)
        self.assertEqual(validated.review_count, 140)
        # Invariant: Review sentiment must be None or unknown
        self.assertIn(str(validated.review_sentiment).lower(), ["none", "unknown", ""])

    async def test_05_parallel_specialist_orchestration_endpoint(self):
        """Verify /api/v1/specialists/research executes triage and parallel specialists."""
        candidate_payload = {
            "business_name": "Apex Dental Spa",
            "business_type": "Cosmetic Dentistry",
            "source_platform": "google_maps",
            "source_url": "https://maps.google.com/apexdental",
            "scorecard_score": 9,
            "priority_tier": "immediate",
            "website_url": "https://apexdentalspa.in",
            "has_active_ads": True,
            "rating": 4.9,
            "review_count": 140,
            "address": "DLF Phase 5, Gurgaon",
            "phone_number": "+919876543210",
            "raw_metadata": {
                "category": "Dental clinic",
                "headline": "Dental Implants Special Offer",
                "ad_creative_text": "German implants with lifetime warranty",
                "cta_text": "Book Appointment"
            }
        }

        # Use pre-determined triage to verify specialist parallel execution directly
        pre_triage = {
            "qualified": True,
            "priority": "high",
            "reason": "High-value dental clinic in Gurgaon with active ads",
            "research_agents": ["ads", "maps"]
        }

        response = await self.client.post(
            "/api/v1/specialists/research",
            json={
                "candidate": candidate_payload,
                "triage_result": pre_triage,
                "limits": {"max_deep_research_leads": 5}
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()

        validated = SpecialistResearchAggregate.model_validate(data)
        self.assertEqual(validated.business_name, "Apex Dental Spa")
        self.assertIsNotNone(validated.ads_analysis)
        self.assertIsNotNone(validated.maps_analysis)
        self.assertIn("ads", validated.execution_status)
        self.assertIn("maps", validated.execution_status)

    async def test_06_credential_safety_invariant(self):
        """Verify API keys and sensitive tokens are never exposed in specialist responses."""
        response = await self.client.post(
            "/api/v1/run",
            json={
                "prompt": "Evaluate candidate 'Test Clinic' with rating 4.5.",
                "agent_type": "lead_triage",
                "timeout_seconds": 60.0
            }
        )
        body_text = response.text
        api_key = self.settings.AI_API_KEY.get_secret_value() if self.settings.AI_API_KEY else ""
        if api_key and len(api_key) > 5:
            self.assertNotIn(api_key, body_text)
        apify_token = os.getenv("APIFY_API_TOKEN", "")
        if apify_token and len(apify_token) > 5:
            self.assertNotIn(apify_token, body_text)


if __name__ == "__main__":
    unittest.main()
