"""Agent Runner Service Abstraction.

Encapsulates OpenAI Agents SDK execution lifecycle, timeout management,
token usage accounting, and output structuring.
"""

import asyncio
import logging
import threading
import time
from typing import Any, Optional
from pydantic import BaseModel
from openai import APIConnectionError, APIStatusError, RateLimitError
from agents import Agent, Runner, RunConfig

from app.core.config import get_settings
from app.core.provider import get_run_config
from app.agents.base import (
    create_base_agent,
    create_triage_agent,
    create_profile_test_agent,
)
from app.agents.search_strategist import create_search_strategist_agent
from app.agents.specialists import (
    create_lead_triage_agent,
    create_website_specialist_agent,
    create_ads_specialist_agent,
    create_maps_specialist_agent,
)
from app.schemas.profile import CampaignScope
from app.schemas.search import (
    CampaignLimits,
    SearchStrategy,
    validate_search_strategy_scope,
    filter_search_strategy_to_scope,
)
from app.schemas.agent import AgentRunRequest, AgentRunResponse, TokenUsage
from app.utils.error_handlers import (
    WorkerTimeoutError,
    ProviderError,
    AgentExecutionError,
)

logger = logging.getLogger("ai_worker.services.agent_runner")


class AgentRunnerService:
    """Service responsible for orchestrating agent executions via OpenAI Agents SDK."""

    def __init__(self, run_config: Optional[RunConfig] = None):
        self._run_config = run_config

    def _resolve_run_config(self) -> RunConfig:
        if self._run_config is not None:
            return self._run_config
        return get_run_config()

    def _resolve_agent(self, agent_type: str, context: Optional[dict[str, Any]] = None) -> Agent:
        """Resolve agent instance based on requested type."""
        normalized_type = agent_type.strip().lower()
        if normalized_type == "triage":
            return create_triage_agent()
        elif normalized_type == "base":
            return create_base_agent()
        elif normalized_type in ("profile", "profile_test"):
            return create_profile_test_agent()
        elif normalized_type in ("search_strategist", "search"):
            campaign_scope = None
            limits = None
            if context:
                if "campaign_scope" in context and isinstance(context["campaign_scope"], dict):
                    campaign_scope = CampaignScope(**context["campaign_scope"])
                if "limits" in context and isinstance(context["limits"], dict):
                    limits = CampaignLimits(**context["limits"])
            return create_search_strategist_agent(campaign_scope=campaign_scope, limits=limits)
        elif normalized_type in ("lead_triage", "specialist_triage"):
            return create_lead_triage_agent()
        elif normalized_type in ("website_specialist", "website"):
            return create_website_specialist_agent()
        elif normalized_type in ("ads_specialist", "ads"):
            return create_ads_specialist_agent()
        elif normalized_type in ("maps_specialist", "maps"):
            return create_maps_specialist_agent()
        elif normalized_type in ("opportunity", "opportunity_agent"):
            from app.agents.opportunity_agent import create_opportunity_agent
            return create_opportunity_agent()
        elif normalized_type in ("lead_analyst", "analyst"):
            from app.agents.lead_analyst import create_lead_analyst_agent
            return create_lead_analyst_agent()
        elif normalized_type in ("outreach", "outreach_agent"):
            from app.agents.outreach_agent import create_outreach_agent
            return create_outreach_agent()
        else:
            raise AgentExecutionError(
                f"Unknown agent type '{agent_type}'. Supported types: 'base', 'triage', 'profile_test', 'search_strategist', 'lead_triage', 'website', 'ads', 'maps', 'opportunity', 'lead_analyst'."
            )

    async def execute(self, request: AgentRunRequest) -> AgentRunResponse:
        """Execute an agent run according to request parameters."""
        settings = get_settings()
        timeout_seconds = request.timeout_seconds or settings.AI_TIMEOUT_SECONDS
        agent = self._resolve_agent(request.agent_type, context=request.context)
        config = self._resolve_run_config()

        logger.info(
            "Executing agent run (agent_type=%s, timeout=%.1fs, prompt_len=%d)",
            request.agent_type,
            timeout_seconds,
            len(request.prompt)
        )

        start_time = time.perf_counter()

        try:
            # Wrap execution with strict asyncio timeout guard and pass execution context
            result = await asyncio.wait_for(
                Runner.run(
                    starting_agent=agent,
                    input=request.prompt,
                    context=request.context,
                    run_config=config
                ),
                timeout=timeout_seconds
            )
        except asyncio.TimeoutError as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error("Agent run timed out after %.2f ms", duration_ms)
            raise WorkerTimeoutError(
                f"Agent execution timed out after {timeout_seconds:.1f} seconds"
            ) from exc
        except (APIConnectionError, RateLimitError) as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error("Upstream model connection failure after %.2f ms: %s", duration_ms, type(exc).__name__)
            raise ProviderError(
                f"Connection error reaching upstream model gateway: {type(exc).__name__}"
            ) from exc
        except APIStatusError as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error("Upstream model status failure (%s) after %.2f ms", exc.status_code, duration_ms)
            raise ProviderError(
                f"Upstream model gateway returned error status: {exc.status_code}"
            ) from exc
        except Exception as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error("Agent execution failure after %.2f ms: %s", duration_ms, exc, exc_info=True)
            raise AgentExecutionError(f"Agent runner failed: {str(exc)}") from exc

        duration_ms = (time.perf_counter() - start_time) * 1000

        # Process and normalize structured output
        raw_output = result.final_output

        # For search strategist, enforce/filter scope guardrails on structured output
        if request.agent_type.strip().lower() in ("search_strategist", "search"):
            strategy_obj = None
            if isinstance(raw_output, SearchStrategy):
                strategy_obj = raw_output
            elif isinstance(raw_output, dict):
                try:
                    strategy_obj = SearchStrategy(**raw_output)
                except Exception:
                    pass

            if strategy_obj is not None:
                campaign_scope = None
                limits = None
                if request.context:
                    if "campaign_scope" in request.context and isinstance(request.context["campaign_scope"], dict):
                        campaign_scope = CampaignScope(**request.context["campaign_scope"])
                    if "limits" in request.context and isinstance(request.context["limits"], dict):
                        limits = CampaignLimits(**request.context["limits"])

                violations = validate_search_strategy_scope(
                    strategy=strategy_obj,
                    campaign_scope=campaign_scope,
                    limits=limits
                )
                if violations:
                    logger.warning(
                        "Search Strategist emitted %d scope violations: %s; filtering to compliant queries",
                        len(violations),
                        "; ".join(violations),
                    )
                    raw_output = filter_search_strategy_to_scope(
                        strategy=strategy_obj,
                        campaign_scope=campaign_scope,
                        limits=limits
                    )

        formatted_output: Any
        if isinstance(raw_output, BaseModel):
            formatted_output = raw_output.model_dump()
        elif isinstance(raw_output, (dict, list, int, float, bool)):
            formatted_output = raw_output
        else:
            formatted_output = str(raw_output)

        # Aggregate token consumption across turns from raw_responses
        prompt_tokens = 0
        completion_tokens = 0
        total_tokens = 0

        raw_responses = getattr(result, "raw_responses", [])
        for resp in raw_responses:
            usage = getattr(resp, "usage", None)
            if usage is None and hasattr(resp, "raw_usage"):
                usage = getattr(resp, "raw_usage", None)
            if usage is not None:
                if isinstance(usage, dict):
                    pt = usage.get("prompt_tokens") or usage.get("input_tokens") or 0
                    ct = usage.get("completion_tokens") or usage.get("output_tokens") or 0
                    tt = usage.get("total_tokens") or 0
                else:
                    pt = getattr(usage, "prompt_tokens", 0) or getattr(usage, "input_tokens", 0) or 0
                    ct = getattr(usage, "completion_tokens", 0) or getattr(usage, "output_tokens", 0) or 0
                    tt = getattr(usage, "total_tokens", 0) or 0
                prompt_tokens += pt
                completion_tokens += ct
                total_tokens += tt

        if total_tokens == 0 and (prompt_tokens > 0 or completion_tokens > 0):
            total_tokens = prompt_tokens + completion_tokens

        token_usage = TokenUsage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens
        )

        logger.info(
            "Agent run completed successfully in %.2f ms (tokens: prompt=%d, comp=%d, total=%d)",
            duration_ms,
            token_usage.prompt_tokens,
            token_usage.completion_tokens,
            token_usage.total_tokens
        )

        return AgentRunResponse(
            success=True,
            output=formatted_output,
            agent_type=request.agent_type,
            execution_time_ms=round(duration_ms, 2),
            token_usage=token_usage,
            error=None
        )


_runner_service_instance: Optional[AgentRunnerService] = None
_runner_lock = threading.Lock()


def get_agent_runner() -> AgentRunnerService:
    """Retrieve the singleton AgentRunnerService instance in a thread-safe manner."""
    global _runner_service_instance
    if _runner_service_instance is None:
        with _runner_lock:
            if _runner_service_instance is None:
                _runner_service_instance = AgentRunnerService()
    return _runner_service_instance

