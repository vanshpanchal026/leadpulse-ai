"""Tests for worker health and readiness probe endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.core.config import get_settings


@pytest.mark.asyncio
async def test_health_endpoint_success():
    """Verify GET /health returns 200 and does not leak secrets."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "leadpulse-ai-worker"
    assert data["version"] == "2.0.0"
    assert "provider" in data
    assert data["provider"]["configured"] is True
    assert data["provider"]["mode"] == "chat_completions"

    # Strict secret leak test
    settings = get_settings()
    secret_val = settings.AI_API_KEY.get_secret_value()
    assert secret_val not in response.text
    assert "api_key" not in data
    assert "AI_API_KEY" not in data


@pytest.mark.asyncio
async def test_readiness_probe():
    """Verify GET /health/ready returns status and provider accessibility."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/health/ready")

    assert response.status_code in (200, 503)
    data = response.json()
    assert "status" in data
    assert "provider_accessible" in data

    # Verify no secret leakage
    settings = get_settings()
    assert settings.AI_API_KEY.get_secret_value() not in response.text


@pytest.mark.asyncio
async def test_versioned_health_endpoints():
    """Verify GET /api/v1/health and /api/v1/health/ready return 200/503 and are properly routed."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        res_health = await client.get("/api/v1/health")
        assert res_health.status_code == 200
        data = res_health.json()
        assert data["status"] == "healthy"

        res_ready = await client.get("/api/v1/health/ready")
        assert res_ready.status_code in (200, 503)

