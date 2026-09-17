"""Unit tests for AgentRunnerService abstraction and error conditions."""

import asyncio
from unittest.mock import AsyncMock, patch
import pytest
from app.services.agent_runner import AgentRunnerService
from app.schemas.agent import AgentRunRequest, LeadTriageResult
from app.utils.error_handlers import WorkerTimeoutError, AgentExecutionError


def test_agent_resolution():
    """Verify correct agent persona instantiation."""
    service = AgentRunnerService()
    base_agent = service._resolve_agent("base")
    assert base_agent.name == "LeadPulseBaseAgent"

    triage_agent = service._resolve_agent("triage")
    assert triage_agent.name == "LeadPulseTriageAgent"
    assert triage_agent.output_type == LeadTriageResult


def test_unknown_agent_type_raises():
    """Verify requesting an unsupported agent raises AgentExecutionError."""
    service = AgentRunnerService()
    with pytest.raises(AgentExecutionError) as exc_info:
        service._resolve_agent("nonexistent_specialist")
    assert "Unknown agent type" in str(exc_info.value)


@pytest.mark.asyncio
async def test_agent_runner_timeout():
    """Verify that execution exceeding timeout raises WorkerTimeoutError."""
    service = AgentRunnerService()

    async def slow_runner(*args, **kwargs):
        await asyncio.sleep(2.0)
        return None

    request = AgentRunRequest(
        prompt="Test timeout prompt",
        agent_type="base",
        timeout_seconds=0.1
    )

    with patch("agents.Runner.run", side_effect=slow_runner):
        with pytest.raises(WorkerTimeoutError) as exc_info:
            await service.execute(request)

    assert "timed out" in str(exc_info.value)


@pytest.mark.asyncio
async def test_agent_runner_passes_context():
    """Verify that request.context is passed through to Runner.run."""
    service = AgentRunnerService()
    captured_kwargs = {}

    class FakeResult:
        final_output = "fake output"
        raw_responses = []

    async def mock_run(*args, **kwargs):
        captured_kwargs.update(kwargs)
        return FakeResult()

    request = AgentRunRequest(
        prompt="Test prompt",
        agent_type="base",
        context={"custom_key": "custom_val"}
    )

    with patch("agents.Runner.run", side_effect=mock_run):
        res = await service.execute(request)

    assert res.success is True
    assert captured_kwargs.get("context") == {"custom_key": "custom_val"}


@pytest.mark.asyncio
async def test_agent_runner_token_aggregation():
    """Verify token usage correctly extracts and aggregates from raw_responses."""
    service = AgentRunnerService()

    class FakeResponse:
        def __init__(self, usage):
            self.usage = usage

    class FakeUsageObj:
        prompt_tokens = 15
        completion_tokens = 25
        total_tokens = 40

    class FakeResult:
        final_output = "test output"
        raw_responses = [
            FakeResponse(FakeUsageObj()),
            FakeResponse({"prompt_tokens": 10, "completion_tokens": 10, "total_tokens": 20})
        ]

    with patch("agents.Runner.run", new_callable=AsyncMock) as mock_run:
        mock_run.return_value = FakeResult()
        res = await service.execute(AgentRunRequest(prompt="hi", agent_type="base"))

    assert res.token_usage.prompt_tokens == 25
    assert res.token_usage.completion_tokens == 35
    assert res.token_usage.total_tokens == 60

