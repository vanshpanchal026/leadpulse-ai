"""Agent layer: Foundation and test agent factories for the OpenAI Agents SDK."""

from app.agents.base import (
    create_base_agent,
    create_triage_agent,
    create_profile_test_agent,
)
from app.agents.search_strategist import (
    create_search_strategist_agent,
    build_search_strategist_instructions,
)
from app.agents.opportunity_agent import (
    create_opportunity_agent,
    build_opportunity_agent_instructions,
    build_low_evidence_opportunity_result,
)
from app.agents.lead_analyst import (
    create_lead_analyst_agent,
    build_lead_analyst_instructions,
    build_fallback_lead_analysis,
)

from app.agents.outreach_agent import (
    create_outreach_agent,
)

__all__ = [
    "create_base_agent",
    "create_triage_agent",
    "create_profile_test_agent",
    "create_search_strategist_agent",
    "build_search_strategist_instructions",
    "create_opportunity_agent",
    "build_opportunity_agent_instructions",
    "build_low_evidence_opportunity_result",
    "create_lead_analyst_agent",
    "build_lead_analyst_instructions",
    "build_fallback_lead_analysis",
    "create_outreach_agent",
]
