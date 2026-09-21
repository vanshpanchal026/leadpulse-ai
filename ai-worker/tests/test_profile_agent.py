"""Unit tests for Agent Profile Consumption and Centralized Provider Binding.

Verifies:
- Profile injection into base, triage, and test agent instructions
- Centralized model resolution across all agent factories
- Profile test agent resolution and execution in AgentRunnerService
- Worker API execution with profile_test agent type
- Custom profile injection into agents
"""

import pytest
from unittest.mock import AsyncMock, patch
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.core.provider import get_default_model, create_configured_agent
from app.core.profile import (
    get_business_profile,
    LeadPulseProfile,
    CampaignScope,
)
from app.agents.base import (
    create_base_agent,
    create_triage_agent,
    create_profile_test_agent,
)
from app.schemas.agent import AgentRunRequest, AgentRunResponse, LeadTriageResult, TokenUsage
from app.services.agent_runner import AgentRunnerService
from app.main import app


def test_base_agent_uses_centralized_model_and_profile():
    """Verify create_base_agent inherits centralized model and injects profile context."""
    agent = create_base_agent()
    default_model = get_default_model()

    assert agent.model == default_model
    assert "LeadPulse" in agent.instructions
    assert "Vansh Panchal" in agent.instructions


def test_triage_agent_uses_centralized_model_and_profile():
    """Verify create_triage_agent inherits centralized model and injects triage qualification context."""
    agent = create_triage_agent()
    default_model = get_default_model()

    assert agent.model == default_model
    assert agent.output_type == LeadTriageResult
    assert "LeadTriageResult" in agent.instructions
    assert "Vansh Panchal" in agent.instructions
    assert "Delhi" in agent.instructions
    assert "Dermatology" in agent.instructions


def test_profile_test_agent_uses_centralized_model_and_profile():
    """Verify create_profile_test_agent correctly reflects requested profile role."""
    agent_triage = create_profile_test_agent(role="triage")
    assert "Immediate (Score 9-10)" in agent_triage.instructions

    agent_opp = create_profile_test_agent(role="opportunity")
    assert "AUTHORIZED SERVICES WE CAN SELL" in agent_opp.instructions
    assert "WhatsApp Lead & Inquiry Automation" in agent_opp.instructions


def test_custom_profile_injection_in_agent():
    """Verify passing a scoped profile into an agent factory configures instructions accordingly."""
    base_profile = get_business_profile()
    scope = CampaignScope(
        target_cities=["Gurgaon"],
        target_verticals=["Med Spa"]
    )
    scoped_profile = base_profile.with_campaign_scope(scope)

    agent = create_triage_agent(profile=scoped_profile)
    assert "Gurgaon" in agent.instructions
    assert "Med Spa" in agent.instructions
    assert "Delhi," not in agent.instructions


@pytest.mark.asyncio
async def test_agent_runner_executes_profile_test_agent():
    """Verify AgentRunnerService resolves and executes profile_test agent."""
    service = AgentRunnerService()
    resolved = service._resolve_agent("profile_test")
    assert resolved.name == "LeadPulseProfileTestAgent"

    class FakeResult:
        final_output = "LeadPulse offers 7 core automation services led by Vansh Panchal."
        raw_responses = []

    with patch("agents.Runner.run", new_callable=AsyncMock) as mock_run:
        mock_run.return_value = FakeResult()
        response = await service.execute(
            AgentRunRequest(
                prompt="What services does LeadPulse offer?",
                agent_type="profile_test"
            )
        )

    assert response.success is True
    assert "7 core automation services" in response.output
    assert response.agent_type == "profile_test"


@pytest.mark.asyncio
async def test_api_profile_test_endpoint():
    """Verify POST /api/v1/run accepts agent_type='profile_test' and executes properly."""
    mock_response = AgentRunResponse(
        success=True,
        output="LeadPulse operates in Delhi, Gurgaon, and Noida.",
        agent_type="profile_test",
        execution_time_ms=85.0,
        token_usage=TokenUsage(prompt_tokens=20, completion_tokens=10, total_tokens=30),
        error=None
    )

    transport = ASGITransport(app=app)
    with patch("app.services.agent_runner.AgentRunnerService.execute", new_callable=AsyncMock) as mock_exec:
        mock_exec.return_value = mock_response
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.post(
                "/api/v1/run",
                json={
                    "prompt": "What are the target locations for LeadPulse?",
                    "agent_type": "profile_test"
                }
            )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "Delhi, Gurgaon, and Noida" in data["output"]
    assert data["agent_type"] == "profile_test"
