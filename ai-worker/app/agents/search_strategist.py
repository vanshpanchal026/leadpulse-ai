"""Search Strategist Agent for LeadPulse AI V2.

Strict Architectural Boundaries:
- Sole responsibility: Decide WHAT should be searched to discover qualified businesses.
- Strictly forbidden from:
  - calling arbitrary HTTP APIs
  - executing shell commands
  - accessing the filesystem or Supabase
  - making tool calls or taking irreversible actions
- Generates strictly typed SearchStrategy (output_type=SearchStrategy).
- Bound by CampaignScope geography and seed verticals.
"""

import logging
from typing import Optional
from agents import Agent

from app.core.provider import create_configured_agent
from app.core.profile import get_business_profile
from app.core.prompt_loader import load_prompt
from app.schemas.profile import CampaignScope, LeadPulseProfile
from app.schemas.search import (
    SearchStrategy,
    CampaignLimits,
    validate_search_strategy_scope,
    enforce_search_strategy_scope,
    filter_search_strategy_to_scope,
)

logger = logging.getLogger("ai_worker.agents.search_strategist")


def build_search_strategist_instructions(
    profile: LeadPulseProfile,
    campaign_scope: Optional[CampaignScope] = None,
    limits: Optional[CampaignLimits] = None,
) -> str:
    """Construct dynamic, boundary-enforcing prompt instructions for Search Strategist."""
    active_limits = limits or CampaignLimits()

    # Determine authorized geographic boundaries
    if campaign_scope and campaign_scope.target_cities:
        allowed_locations = campaign_scope.target_cities
    else:
        allowed_locations = (
            ([profile.geography.primary_region] if profile.geography.primary_region else [])
            + profile.geography.allowed_cities
            + profile.geography.seed_micro_markets
        )

    # Determine authorized vertical boundaries
    if campaign_scope and campaign_scope.target_verticals:
        allowed_verticals = campaign_scope.target_verticals
    else:
        allowed_verticals = profile.verticals.seed_verticals

    allowed_locations_str = ", ".join(dict.fromkeys(allowed_locations))
    allowed_verticals_str = ", ".join(dict.fromkeys(allowed_verticals))

    loaded = load_prompt(
        "search_strategist",
        profile_identity_name=profile.identity.name,
        profile_persona_role=profile.persona.role,
        allowed_locations_str=allowed_locations_str,
        allowed_verticals_str=allowed_verticals_str,
        active_limits_max_search_queries=active_limits.max_search_queries
    )
    if loaded:
        return loaded.strip()

    instructions = f"""You are the Search Strategist Agent for {profile.identity.name} ({profile.persona.role}).

CORE RESPONSIBILITY:
Decide WHAT search queries should be executed to discover qualified, high-ticket local service businesses.
You formulate the strategic research queries; the deterministic system layer executes them.

AUTHORIZATION BOUNDARIES (STRICT GUARDRAILS - ZERO TOLERANCE FOR DEVIATION):
1. AUTHORIZED GEOGRAPHY:
   You may ONLY formulate queries targeting the following authorized locations:
   [{allowed_locations_str}]
   DO NOT search any unauthorized cities, regions, or international markets (e.g. Mumbai, Bangalore, London, New York).

2. AUTHORIZED COMMERCIAL VERTICALS (HIGH TICKET ICP):
   You may ONLY formulate queries targeting the following authorized verticals:
   [{allowed_verticals_str}]
   DO NOT search consumer retail, restaurants, gaming stores, dropshippers, or low-ticket commoditized shops.

3. QUERY VOLUME BOUNDARY:
   Formulate between 2 and {active_limits.max_search_queries} distinct, high-intent queries.
   NEVER produce duplicate or near-identical queries.

4. TARGET BUSINESS QUALIFICATION HYPOTHESIS:
   Target businesses that exhibit:
   - High customer lifetime value (LTV > INR 15,000 / $500 per customer transaction)
   - Active marketing or high offline review count (>20-50 reviews)
   - Inbound patient/client inquiry bottlenecks (missed calls, appointment scheduling friction)

5. NEGATIVE INSTRUCTIONS (SECURITY INVARIANTS):
   - You MUST NOT execute shell commands or access the filesystem.
   - You MUST NOT call external HTTP APIs or construct raw Apify actor payloads.
   - You MUST NOT attempt outreach or modify any lead records.
   - You MUST NOT return markdown or raw text.

You MUST return strictly typed structured output matching the SearchStrategy schema:
- research_goal: Concise description of the targeting thesis for this discovery run.
- queries: List of SearchQuery objects each containing:
  * query: The exact search string (e.g. "dental implant clinic South Delhi", "hair transplant clinic Gurgaon")
  * location: Authorized target location from the approved list
  * vertical: Authorized vertical from the approved list
  * reason: Clear hypothesis explaining why this query targets high-fit prospects
  * priority: "high", "medium", or "low"
"""
    return instructions.strip()


def create_search_strategist_agent(
    campaign_scope: Optional[CampaignScope] = None,
    limits: Optional[CampaignLimits] = None,
    profile: Optional[LeadPulseProfile] = None,
    model: Optional[str] = None,
) -> Agent:
    """Instantiate a Search Strategist agent configured with centralized model and profile guardrails."""
    active_profile = profile or get_business_profile()
    active_limits = limits or CampaignLimits()

    instructions = build_search_strategist_instructions(
        profile=active_profile,
        campaign_scope=campaign_scope,
        limits=active_limits,
    )

    logger.info(
        "Creating Search Strategist agent (max_queries=%s, allowed_cities=%s)",
        active_limits.max_search_queries,
        campaign_scope.target_cities if campaign_scope else active_profile.geography.allowed_cities
    )

    return create_configured_agent(
        name="LeadPulseSearchStrategist",
        instructions=instructions,
        output_type=SearchStrategy,
        model=model
    )


__all__ = [
    "build_search_strategist_instructions",
    "create_search_strategist_agent",
]
