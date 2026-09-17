"""Foundation and Test Agent Definitions for LeadPulse AI.

Provides foundation agents, structured triage agents, and profile test agents
powered by the centralized OpenAI Agents SDK provider configuration and the
LeadPulse configurable business profile.

Multi-agent specialist networks (Search, Scraping, Scoring, Outreach) are deferred to later phases.
"""

from typing import Optional
from agents import Agent

from app.core.provider import create_configured_agent
from app.core.profile import LeadPulseProfile, get_business_profile
from app.schemas.agent import LeadTriageResult


def create_base_agent(
    name: str = "LeadPulseBaseAgent",
    instructions: Optional[str] = None,
    model: Optional[str] = None,
    profile: Optional[LeadPulseProfile] = None
) -> Agent:
    """Instantiate a general-purpose text foundation agent.
    
    Obtains model configuration from the centralized provider layer and injects
    business identity context from the centralized profile.
    """
    prof = profile or get_business_profile()
    default_instructions = (
        "You are the LeadPulse AI foundation agent. "
        "Provide concise, precise, and professional responses for lead intelligence operations."
    )
    base_instructions = instructions or default_instructions
    # Only inject profile if custom instructions were not passed or if using default
    final_instructions = (
        prof.inject_context(base_instructions, agent_role="base")
        if instructions is None
        else instructions
    )

    return create_configured_agent(
        name=name,
        instructions=final_instructions,
        model=model
    )


def create_triage_agent(
    model: Optional[str] = None,
    profile: Optional[LeadPulseProfile] = None
) -> Agent:
    """Instantiate a structured lead qualification triage agent enforcing LeadTriageResult schema.
    
    Obtains model configuration from the centralized provider layer and dynamic
    qualification criteria, seed verticals, and exclusions from the centralized business profile.
    """
    prof = profile or get_business_profile()
    triage_context = prof.get_agent_context("triage")

    instructions = (
        "You are the LeadPulse AI lead triage specialist.\n"
        "Evaluate the provided prospect information and return a structured assessment.\n"
        "If the input prompt provides explicit score, priority, or channel directives, prioritize those directives. "
        "Otherwise, evaluate the prospect using the centralized qualification context below.\n"
        "Your output must adhere to the LeadTriageResult schema containing:\n"
        "- business_name: Exact name of the clinic or company\n"
        "- score: Integer from 0 to 10 reflecting lead qualification\n"
        "- priority: Outreach priority ('immediate', 'high', 'medium', or 'skip')\n"
        "- recommended_channel: Primary communication channel (e.g., 'whatsapp')\n"
        "Always return valid structured JSON matching these schema keys.\n\n"
        f"--- Centralized LeadPulse Qualification Context ---\n"
        f"{triage_context}"
    )

    return create_configured_agent(
        name="LeadPulseTriageAgent",
        instructions=instructions,
        output_type=LeadTriageResult,
        model=model
    )


def create_profile_test_agent(
    role: str = "base",
    model: Optional[str] = None,
    profile: Optional[LeadPulseProfile] = None
) -> Agent:
    """Instantiate a test agent that explicitly consumes the LeadPulse business profile.
    
    Used to verify profile injection, context awareness, and centralized model binding.
    """
    prof = profile or get_business_profile()
    context = prof.get_agent_context(role)

    instructions = (
        "You are the LeadPulse Business Profile verification agent.\n"
        "Your role is to accurately answer questions regarding the LeadPulse business profile, "
        "consultant identity, technical capabilities, services offered, ICP, geographies, "
        "seed verticals, exclusions, and outreach constraints.\n\n"
        f"--- Centralized LeadPulse Business Context ({role.upper()}) ---\n"
        f"{context}"
    )

    return create_configured_agent(
        name="LeadPulseProfileTestAgent",
        instructions=instructions,
        model=model
    )
