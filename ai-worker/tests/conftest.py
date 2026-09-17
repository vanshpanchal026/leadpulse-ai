"""Pytest configuration and shared fixtures for worker testing."""

import os
import sys
from pathlib import Path
import pytest
from httpx import ASGITransport, AsyncClient

# Ensure ai-worker is in python search path
worker_root = Path(__file__).resolve().parent.parent
if str(worker_root) not in sys.path:
    sys.path.insert(0, str(worker_root))

from app.core.config import clear_settings_cache, get_settings
from app.core.provider import close_provider, init_provider
from app.main import app


@pytest.fixture(autouse=True)
def setup_test_environment(monkeypatch):
    """Ensure reliable default environment variables for testing."""
    clear_settings_cache()
    # If not set in environment, inject valid test defaults
    if "AI_BASE_URL" not in os.environ:
        monkeypatch.setenv("AI_BASE_URL", "http://localhost:3001/v1")
    if "AI_API_KEY" not in os.environ:
        monkeypatch.setenv("AI_API_KEY", "test-key-safe")
    if "AI_MODEL" not in os.environ:
        monkeypatch.setenv("AI_MODEL", "auto")
    if "AI_API_MODE" not in os.environ:
        monkeypatch.setenv("AI_API_MODE", "chat_completions")

    yield

    clear_settings_cache()


@pytest.fixture
def test_settings():
    """Fixture providing initialized and validated test settings."""
    return get_settings()


@pytest.fixture
async def async_client():
    """Async HTTP client for testing FastAPI application endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
    await close_provider()

