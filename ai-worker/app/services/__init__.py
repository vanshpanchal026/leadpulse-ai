"""Services layer containing agent runner abstractions and business logic."""

from app.services.agent_runner import AgentRunnerService, get_agent_runner
from app.services.opportunity_scorer import (
    OpportunityScoreBreakdown,
    calculate_opportunity_score,
)

from app.services.persistence_service import (
    PersistenceService,
    get_persistence_service,
    reset_persistence_service,
)

__all__ = [
    "AgentRunnerService",
    "get_agent_runner",
    "OpportunityScoreBreakdown",
    "calculate_opportunity_score",
    "OpportunityPipelineResult",
    "OpportunityOrchestratorService",
    "get_opportunity_orchestrator",
    "PersistenceService",
    "get_persistence_service",
    "reset_persistence_service",
]


def __getattr__(name: str):
    if name in (
        "OpportunityPipelineResult",
        "OpportunityOrchestratorService",
        "get_opportunity_orchestrator",
    ):
        import app.services.opportunity_orchestrator as opp_orch
        return getattr(opp_orch, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
