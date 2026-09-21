"""Agent execution API endpoint."""

import logging
from fastapi import APIRouter, Depends, status

from app.schemas.agent import AgentRunRequest, AgentRunResponse
from app.services.agent_runner import AgentRunnerService, get_agent_runner

router = APIRouter(tags=["Agent Execution"])
logger = logging.getLogger("ai_worker.api.run")


@router.post(
    "/run",
    response_model=AgentRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute an agent task",
    description="Invokes the OpenAI Agents SDK runner to process a prompt and return structured results."
)
async def run_agent(
    request: AgentRunRequest,
    runner: AgentRunnerService = Depends(get_agent_runner)
) -> AgentRunResponse:
    """Execute the configured agent and return structured output."""
    logger.info("Received agent run request: agent_type=%s", request.agent_type)
    return await runner.execute(request)
