"""LeadPulse AI V2 — Phase 2 Live Integration Test.

Proves the complete end-to-end pipeline:
Project Environment (.env) -> Python Worker (FastAPI) -> OpenAI Agents SDK -> Configured Provider (Local Reverse Proxy) -> Structured Output
"""

import os
import sys
import asyncio
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
from app.core.provider import close_provider, init_provider
from app.main import app


class TestPhase2LiveWorkerIntegration(unittest.IsolatedAsyncioTestCase):
    """Integration test suite executing real model calls through the worker."""

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

    async def test_01_worker_health_live(self):
        """Verify GET /health returns operational status and provider details."""
        response = await self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["service"], "leadpulse-ai-worker")
        self.assertEqual(data["version"], "2.0.0")
        self.assertTrue(data["provider"]["configured"])
        self.assertEqual(data["provider"]["mode"], "chat_completions")
        # Ensure secret API key is never in response body
        self.assertNotIn(self.settings.AI_API_KEY.get_secret_value(), response.text)

    async def test_02_worker_readiness_probe_live(self):
        """Verify GET /health/ready confirms connectivity to upstream AI provider."""
        response = await self.client.get("/health/ready")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ready")
        self.assertTrue(data["provider_accessible"])

    async def test_03_worker_e2e_base_agent_execution(self):
        """Verify POST /api/v1/run executes foundation agent through OpenAI Agents SDK."""
        response = await self.client.post(
            "/api/v1/run",
            json={
                "prompt": "Respond strictly with the single word 'WORKER_CONFIRMED'.",
                "agent_type": "base",
                "timeout_seconds": 60.0
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertIn("WORKER_CONFIRMED", str(data["output"]).upper())
        self.assertGreater(data["execution_time_ms"], 0)
        self.assertIsNotNone(data["token_usage"])
        self.assertGreater(data["token_usage"]["total_tokens"], 0)

    async def test_04_worker_e2e_structured_triage_pipeline(self):
        """Verify full chain: Worker API -> Agents SDK -> Provider -> Pydantic Structured Output."""
        prompt = (
            "Evaluate prospective client 'Cosmo Dental Clinic': 85 positive patient reviews, "
            "running active Instagram advertisements: true, has responsive mobile website: true. "
            "Assign qualification score 9 out of 10, set outreach priority to 'immediate', "
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
        self.assertTrue(data["success"], f"Execution failed: {data.get('error')}")
        self.assertEqual(data["agent_type"], "triage")

        output = data["output"]
        self.assertIsInstance(output, dict, "Output must be a structured dict")
        self.assertIn("business_name", output)
        self.assertIn("Cosmo Dental", output["business_name"])
        self.assertEqual(output["score"], 9)
        self.assertEqual(output["priority"].lower(), "immediate")
        self.assertEqual(output["recommended_channel"].lower(), "whatsapp")

        # Verify token accounting
        self.assertIsNotNone(data["token_usage"])
        self.assertGreater(data["token_usage"]["total_tokens"], 0)
        self.assertGreater(data["token_usage"]["prompt_tokens"], 0)
        self.assertGreater(data["token_usage"]["completion_tokens"], 0)

    async def test_05_worker_route_aliases_and_versioning(self):
        """Verify GET /api/v1/health, GET /api/v1/health/ready, and POST /run root alias."""
        # Versioned health
        res_v1_health = await self.client.get("/api/v1/health")
        self.assertEqual(res_v1_health.status_code, 200)
        self.assertEqual(res_v1_health.json()["status"], "healthy")

        # Versioned readiness
        res_v1_ready = await self.client.get("/api/v1/health/ready")
        self.assertEqual(res_v1_ready.status_code, 200)
        self.assertEqual(res_v1_ready.json()["status"], "ready")

        # Root alias POST /run with context
        res_root_run = await self.client.post(
            "/run",
            json={
                "prompt": "Respond strictly with 'ROOT_ALIAS_CONFIRMED'",
                "agent_type": "base",
                "context": {"integration_test": True},
                "timeout_seconds": 60.0
            }
        )
        self.assertEqual(res_root_run.status_code, 200)
        data = res_root_run.json()
        self.assertTrue(data["success"])
        self.assertIn("ROOT_ALIAS_CONFIRMED", str(data["output"]).upper())


if __name__ == "__main__":
    unittest.main()

