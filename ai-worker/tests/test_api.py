"""Tests for worker HTTP API endpoints and error response wrapping."""

from unittest.mock import AsyncMock, patch
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.schemas.agent import AgentRunResponse, TokenUsage


@pytest.mark.asyncio
async def test_run_agent_validation_error():
    """Verify empty prompt produces HTTP 422 Unprocessable Entity."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post("/api/v1/run", json={"prompt": ""})

    assert response.status_code == 422
    data = response.json()
    assert data["error_code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_run_agent_success_mock():
    """Verify POST /api/v1/run executes and serializes response correctly."""
    mock_response = AgentRunResponse(
        success=True,
        output="Test output response",
        agent_type="base",
        execution_time_ms=125.5,
        token_usage=TokenUsage(prompt_tokens=10, completion_tokens=5, total_tokens=15),
        error=None
    )

    transport = ASGITransport(app=app)
    with patch("app.services.agent_runner.AgentRunnerService.execute", new_callable=AsyncMock) as mock_exec:
        mock_exec.return_value = mock_response
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.post(
                "/api/v1/run",
                json={"prompt": "Hello test agent", "agent_type": "base"}
            )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["output"] == "Test output response"
    assert data["agent_type"] == "base"
    assert data["token_usage"]["total_tokens"] == 15


@pytest.mark.asyncio
async def test_run_agent_root_alias():
    """Verify POST /run and POST /api/v1/agent/run are working aliases."""
    mock_response = AgentRunResponse(
        success=True,
        output="Root alias response",
        agent_type="base",
        execution_time_ms=50.0,
        token_usage=TokenUsage(prompt_tokens=5, completion_tokens=5, total_tokens=10),
        error=None
    )

    transport = ASGITransport(app=app)
    with patch("app.services.agent_runner.AgentRunnerService.execute", new_callable=AsyncMock) as mock_exec:
        mock_exec.return_value = mock_response
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            # Test POST /run
            res_root = await client.post("/run", json={"prompt": "test root"})
            assert res_root.status_code == 200

            # Test POST /api/v1/agent/run
            res_agent = await client.post("/api/v1/agent/run", json={"prompt": "test agent prefix"})
            assert res_agent.status_code == 200


@pytest.mark.asyncio
async def test_invalid_agent_type_returns_422():
    """Verify unsupported agent_type fails schema validation with HTTP 422 instead of 500."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/api/v1/run",
            json={"prompt": "test prompt", "agent_type": "invalid_specialist"}
        )

    assert response.status_code == 422
    data = response.json()
    assert data["error_code"] == "VALIDATION_ERROR"
    assert "agent_type" in data["detail"]


@pytest.mark.asyncio
async def test_error_handlers_status_mapping():
    """Verify custom exceptions map to HTTP 504 and 502 respectively."""
    from app.utils.error_handlers import WorkerTimeoutError, ProviderError

    transport = ASGITransport(app=app)

    # Test WorkerTimeoutError -> 504
    with patch("app.services.agent_runner.AgentRunnerService.execute", new_callable=AsyncMock) as mock_exec:
        mock_exec.side_effect = WorkerTimeoutError("Timed out after 30s")
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res_timeout = await client.post("/api/v1/run", json={"prompt": "timeout test"})
            assert res_timeout.status_code == 504
            assert res_timeout.json()["error_code"] == "TIMEOUT_ERROR"

    # Test ProviderError -> 502
    with patch("app.services.agent_runner.AgentRunnerService.execute", new_callable=AsyncMock) as mock_exec:
        mock_exec.side_effect = ProviderError("Connection refused by gateway")
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res_prov = await client.post("/api/v1/run", json={"prompt": "provider error test"})
            assert res_prov.status_code == 502
            assert res_prov.json()["error_code"] == "PROVIDER_ERROR"

