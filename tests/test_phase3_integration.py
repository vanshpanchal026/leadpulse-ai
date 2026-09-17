"""LeadPulse AI V2 — Phase 3 Live Integration Test.

Proves the complete end-to-end pipeline with:
- Centralized Model Provider Configuration
- Configurable Business Profile
- Profile-aware Agents (Base, Triage, and Profile Test Agent)
- Real upstream model gateway execution (Chat Completions mode, use_responses=False, tracing_disabled=True)
"""

import sys
import unittest
from pathlib import Path
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
from app.core.provider import (
    close_provider,
    init_provider,
    get_provider_config,
    get_default_model,
)
from app.core.profile import get_business_profile
from app.main import app


class TestPhase3LiveIntegration(unittest.IsolatedAsyncioTestCase):
    """Integration test suite executing real model calls verifying Phase 3 features."""

    async def asyncSetUp(self):
        # Load workspace .env
        load_dotenv(dotenv_path=_PROJECT_ROOT / ".env")
        self.settings = get_settings()
        init_provider(self.settings)
        self.transport = ASGITransport(app=app)
        self.client = AsyncClient(transport=self.transport, base_url="http://localhost:8000")

    async def asyncTearDown(self):
        await self.client.aclose()
        await close_provider()

    async def test_01_provider_centralization_live(self):
        """Verify centralized ProviderConfig resolves correctly in live runtime."""
        config = get_provider_config()
        self.assertEqual(config.base_url, self.settings.AI_BASE_URL)
        self.assertEqual(config.model, self.settings.AI_MODEL)
        self.assertEqual(config.api_mode, "chat_completions")
        self.assertFalse(config.use_responses)
        self.assertTrue(config.tracing_disabled)
        self.assertEqual(get_default_model(), self.settings.AI_MODEL)

    async def test_02_business_profile_centralization_live(self):
        """Verify business profile loads canonical LeadPulse values in live environment."""
        profile = get_business_profile()
        self.assertEqual(profile.identity.name, "LeadPulse")
        self.assertEqual(profile.identity.consultant_name, "Vansh Panchal")
        self.assertEqual(len(profile.services), 7)
        self.assertIn("Delhi", profile.geography.allowed_cities)
        self.assertIn("Dermatology", profile.verticals.seed_verticals)

    async def test_03_profile_test_agent_live_execution(self):
        """Verify profile test agent consumes business profile and answers factual questions."""
        prompt = (
            "Based strictly on your business context, who is the lead consultant for LeadPulse "
            "and what primary messaging platform is automated? Respond in 1 brief sentence."
        )
        response = await self.client.post(
            "/api/v1/run",
            json={
                "prompt": prompt,
                "agent_type": "profile_test",
                "timeout_seconds": 60.0
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"], f"Execution error: {data.get('error')}")
        self.assertEqual(data["agent_type"], "profile_test")
        output_str = str(data["output"]).lower()
        self.assertIn("vansh", output_str)
        self.assertIn("whatsapp", output_str)

    async def test_04_triage_agent_with_profile_context_live(self):
        """Verify triage agent with profile context scores a high-ticket clinic correctly."""
        prompt = (
            "Evaluate prospective client 'Aesthetic Dermatology Studio' located in South Delhi: "
            "120 5-star patient reviews, active Meta ads running driving to generic homepage, "
            "no WhatsApp button on website. "
            "Score qualification 9 out of 10, set outreach priority to 'immediate', "
            "and set recommended outreach channel to 'whatsapp'."
        )
        response = await self.client.post(
            "/api/v1/run",
            json={
                "prompt": prompt,
                "agent_type": "triage",
                "timeout_seconds": 60.0
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"], f"Execution error: {data.get('error')}")

        output = data["output"]
        self.assertIsInstance(output, dict)
        self.assertIn("Aesthetic Dermatology Studio", output.get("business_name", ""))
        self.assertEqual(output.get("score"), 9)
        self.assertEqual(str(output.get("priority")).lower(), "immediate")
        self.assertEqual(str(output.get("recommended_channel")).lower(), "whatsapp")

    async def test_05_secret_protection_in_live_pipeline(self):
        """Verify live API responses never leak secret credentials."""
        secret_key = self.settings.AI_API_KEY.get_secret_value()

        # Check health
        res_health = await self.client.get("/health")
        self.assertNotIn(secret_key, res_health.text)

        # Check readiness
        res_ready = await self.client.get("/health/ready")
        self.assertNotIn(secret_key, res_ready.text)

        # Check agent run
        res_run = await self.client.post(
            "/api/v1/run",
            json={
                "prompt": "Respond with 'SECURE_TEST_CONFIRMED'",
                "agent_type": "base",
                "timeout_seconds": 60.0
            }
        )
        self.assertNotIn(secret_key, res_run.text)


if __name__ == "__main__":
    unittest.main()
