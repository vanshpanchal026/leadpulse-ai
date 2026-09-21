"""Unit tests for Phase 3 Configurable LeadPulse Business Profile.

Verifies:
- Business profile defaults grounded in repository specification (Vansh, Delhi NCR, 7 services, seed verticals)
- Schema validations and boundary constraints
- Serialization and deserialization round-trip integrity
- Role-specific context generation for future agents (triage, opportunity, outreach, search, base)
- Dynamic campaign overlay scoping
- Zero secret leakage in profile representations
"""

import json
import pytest
from pydantic import ValidationError

from app.schemas.profile import (
    BusinessIdentity,
    AgentPersona,
    TechnicalCapabilities,
    ServiceOffering,
    IdealCustomerProfile,
    TargetBusinessCharacteristics,
    GeographicScope,
    VerticalScope,
    QualificationPreferences,
    ExclusionRules,
    OutreachConstraints,
    CampaignScope,
    LeadPulseProfile,
)
from app.core.profile import (
    DEFAULT_BUSINESS_PROFILE,
    get_business_profile,
    load_business_profile,
    set_business_profile,
    reset_business_profile,
)


def test_business_profile_defaults():
    """Verify default business profile contains verified specification facts."""
    profile = get_business_profile()

    # 1. Identity & Consultant
    assert profile.identity.name == "LeadPulse"
    assert profile.identity.consultant_name == "Vansh Panchal"
    assert "Automation Consultant" in profile.identity.title

    # 2. Persona
    assert "Solo local technology" in profile.persona.role
    assert "laptop or phone" in profile.persona.perspective
    assert "WhatsApp" in profile.persona.core_value_proposition

    # 3. Technical Capabilities
    skills = profile.capabilities.all_skills()
    expected_skills = [
        "React", "Next.js", "Web development",
        "n8n", "APIs", "CRM/workflows",
        "AI integrations", "AI agents", "WhatsApp automation",
        "VPS", "Docker"
    ]
    for sk in expected_skills:
        assert sk in skills, f"Missing skill: {sk}"

    # 4. Canonical Services
    service_ids = [s.id for s in profile.services]
    expected_services = [
        "website_development",
        "ai_agents",
        "whatsapp_automation",
        "lead_automation",
        "booking_automation",
        "crm_workflow_automation",
        "business_automation",
    ]
    assert len(profile.services) == 7
    for sid in expected_services:
        assert sid in service_ids, f"Missing service: {sid}"
        assert profile.get_service_by_id(sid) is not None

    # 5. Target Customer Profile (ICP) & Characteristics
    assert "Local high-ticket" in profile.target_customer.business_type
    assert profile.target_business.min_rating >= 4.0
    assert profile.target_business.min_review_count >= 20
    assert profile.target_business.prefers_active_ads is True

    # 6. Geographies
    assert profile.geography.primary_region == "Delhi NCR"
    assert "Delhi" in profile.geography.allowed_cities
    assert "Gurgaon" in profile.geography.allowed_cities
    assert "Noida" in profile.geography.allowed_cities

    # 7. Seed Verticals
    expected_verticals = [
        "Dermatology",
        "Med Spa",
        "Hair Transplant",
        "Dental",
        "Luxury Salon",
        "Interior Design"
    ]
    for vert in expected_verticals:
        assert vert in profile.verticals.seed_verticals

    # 8. Qualification Preferences
    assert profile.qualification.immediate_score_threshold == 9
    assert profile.qualification.high_score_threshold == 7
    assert profile.qualification.medium_score_threshold == 5
    assert profile.qualification.skip_score_threshold == 4
    assert profile.qualification.primary_channel == "whatsapp"

    # 9. Exclusions
    excluded_types = " ".join(profile.exclusions.excluded_business_types).lower()
    assert "dropshippers" in excluded_types
    assert "commodity retail" in excluded_types
    excluded_services = " ".join(profile.exclusions.excluded_services).lower()
    assert "cold calling" in excluded_services
    assert "graphic design" in excluded_services

    # 10. Outreach Constraints
    assert profile.outreach.min_sentences == 2
    assert profile.outreach.max_sentences == 3
    assert profile.outreach.max_characters == 300
    assert profile.outreach.hard_max_characters == 400
    assert "we help" in profile.outreach.banned_phrases
    assert "game-changer" in profile.outreach.banned_phrases
    assert "leverage" in profile.outreach.banned_phrases
    assert profile.outreach.no_fake_claims is True
    assert profile.outreach.require_human_approval is True


def test_business_profile_validation_failures():
    """Verify validation guards on profile models reject invalid configurations."""
    # Empty identity name
    with pytest.raises(ValidationError):
        BusinessIdentity(name="", consultant_name="Vansh", title="Dev")

    # Empty cities list
    with pytest.raises(ValidationError):
        GeographicScope(allowed_cities=[])

    # Empty verticals list
    with pytest.raises(ValidationError):
        VerticalScope(seed_verticals=[])

    # Inverted score thresholds (immediate < high)
    with pytest.raises(ValidationError):
        QualificationPreferences(
            immediate_score_threshold=5,
            high_score_threshold=8
        )

    # Rating out of bounds
    with pytest.raises(ValidationError):
        TargetBusinessCharacteristics(min_rating=6.0)

    # max_characters > hard_max_characters
    with pytest.raises(ValidationError):
        OutreachConstraints(max_characters=500, hard_max_characters=400)


def test_profile_serialization_round_trip():
    """Verify profile can be cleanly serialized to JSON/dict and restored without loss."""
    profile = get_business_profile()

    # Model dump dict round trip
    profile_dict = profile.model_dump()
    restored_from_dict = LeadPulseProfile.model_validate(profile_dict)
    assert restored_from_dict == profile

    # JSON round trip
    profile_json = profile.model_dump_json()
    restored_from_json = LeadPulseProfile.model_validate_json(profile_json)
    assert restored_from_json == profile


def test_profile_immutability():
    """Verify profile and submodels are frozen against accidental runtime modification."""
    profile = get_business_profile()

    with pytest.raises(ValidationError):
        profile.identity.consultant_name = "New Name"

    with pytest.raises(ValidationError):
        profile.geography.allowed_cities = ["Mumbai"]


def test_role_specific_agent_context_generation():
    """Verify role-specific context generators extract only relevant facts."""
    profile = get_business_profile()

    # Triage context
    triage_ctx = profile.get_agent_context("triage")
    assert "Vansh Panchal" in triage_ctx
    assert "Delhi" in triage_ctx
    assert "Dermatology" in triage_ctx
    assert "Immediate (Score 9-10)" in triage_ctx
    assert "dropshippers" in triage_ctx

    # Opportunity context
    opp_ctx = profile.get_agent_context("opportunity")
    assert "Vansh Panchal" in opp_ctx
    assert "AUTHORIZED SERVICES" in opp_ctx
    assert "Website Development" in opp_ctx
    assert "WhatsApp Lead & Inquiry Automation" in opp_ctx
    assert "SERVICES WE DO NOT OFFER" in opp_ctx

    # Outreach context
    outreach_ctx = profile.get_agent_context("outreach")
    assert "STRICT OUTREACH GUARDRAILS" in outreach_ctx
    assert "Strictly 2 to 3 sentences" in outreach_ctx
    assert "Target <300 characters" in outreach_ctx
    assert "we help" in outreach_ctx

    # Search context
    search_ctx = profile.get_agent_context("search")
    assert "TARGET REGION" in search_ctx
    assert "SEED MICRO-MARKETS" in search_ctx
    assert "SEED VERTICALS" in search_ctx

    # Base context
    base_ctx = profile.get_agent_context("base")
    assert "LeadPulse" in base_ctx
    assert "Vansh Panchal" in base_ctx


def test_context_injection_helper():
    """Verify inject_context cleanly wraps instructions without duplicating boilerplate."""
    profile = get_business_profile()
    base_prompt = "You are a test agent."
    injected = profile.inject_context(base_prompt, agent_role="triage")

    assert injected.startswith("You are a test agent.")
    assert "--- Centralized LeadPulse Business Context (TRIAGE) ---" in injected
    assert "Delhi" in injected
    assert "-----------------------------------------------------------------" in injected


def test_campaign_scope_overlay():
    """Verify with_campaign_scope creates a tailored profile without mutating original."""
    original = get_business_profile()

    scope = CampaignScope(
        name="Gurgaon Aesthetics Campaign",
        target_cities=["Gurgaon"],
        target_verticals=["Dermatology", "Med Spa"],
        focus_service_ids=["whatsapp_automation", "booking_automation"],
        min_rating=4.5,
        min_review_count=50,
        prefers_active_ads_only=True
    )

    scoped_profile = original.with_campaign_scope(scope)

    # Scoped profile reflects campaign parameters
    assert scoped_profile.geography.allowed_cities == ["Gurgaon"]
    assert scoped_profile.verticals.seed_verticals == ["Dermatology", "Med Spa"]
    assert len(scoped_profile.services) == 2
    assert {s.id for s in scoped_profile.services} == {"whatsapp_automation", "booking_automation"}
    assert scoped_profile.target_business.min_rating == 4.5
    assert scoped_profile.target_business.min_review_count == 50

    # Original canonical profile remains completely unchanged
    assert len(original.geography.allowed_cities) == 3
    assert len(original.services) == 7


def test_custom_profile_loader(tmp_path):
    """Verify loading custom profile from in-memory dict and JSON configuration file."""
    custom_dict = DEFAULT_BUSINESS_PROFILE.model_dump()
    custom_dict["identity"]["consultant_name"] = "Custom Consultant"

    # In-memory dict load
    loaded = load_business_profile(custom_data=custom_dict)
    assert loaded.identity.consultant_name == "Custom Consultant"

    # File load
    temp_profile_file = tmp_path / "custom_profile.json"
    temp_profile_file.write_text(json.dumps(custom_dict), encoding="utf-8")

    loaded_from_file = load_business_profile(config_path=temp_profile_file)
    assert loaded_from_file.identity.consultant_name == "Custom Consultant"

    # Reset verifies canonical default is preserved
    reset_business_profile()
    assert get_business_profile().identity.consultant_name == "Vansh Panchal"


def test_no_secret_leakage_in_profile():
    """Verify profile models and serializations contain zero secret API keys or credentials."""
    profile = get_business_profile()
    dump_str = json.dumps(profile.model_dump())

    # Ensure no credential terms exist
    assert "api_key" not in dump_str
    assert "secret" not in dump_str.lower()
    assert "password" not in dump_str.lower()
    assert "token" not in dump_str.lower()


def test_business_profile_empty_services_rejected():
    """Verify LeadPulseProfile rejects empty services list."""
    with pytest.raises(ValidationError) as exc_info:
        LeadPulseProfile(services=[])
    assert "at least one authorized service offering" in str(exc_info.value)


def test_campaign_scope_service_validations():
    """Verify CampaignScope rejects empty focus_service_ids and with_campaign_scope rejects unmatched IDs."""
    # Empty focus_service_ids rejected
    with pytest.raises(ValidationError) as exc_info:
        CampaignScope(focus_service_ids=[])
    assert "focus_service_ids cannot be empty" in str(exc_info.value)

    # Empty string inside list rejected
    with pytest.raises(ValidationError):
        CampaignScope(focus_service_ids=["   "])

    # None of the focus service IDs exist
    profile = get_business_profile()
    with pytest.raises(ValueError) as exc_info:
        profile.with_campaign_scope(CampaignScope(focus_service_ids=["nonexistent_service_xyz"]))
    assert "matched available services" in str(exc_info.value)


def test_custom_profile_loader_yaml_and_missing_file(tmp_path):
    """Verify load_business_profile seamlessly parses YAML files and raises FileNotFoundError for missing files."""
    import yaml

    custom_dict = DEFAULT_BUSINESS_PROFILE.model_dump()
    custom_dict["identity"]["consultant_name"] = "YAML Consultant"

    # YAML file loading
    yaml_file = tmp_path / "custom_profile.yaml"
    yaml_file.write_text(yaml.dump(custom_dict), encoding="utf-8")

    loaded = load_business_profile(config_path=yaml_file)
    assert loaded.identity.consultant_name == "YAML Consultant"

    # Explicit missing file raises FileNotFoundError
    with pytest.raises(FileNotFoundError):
        load_business_profile(config_path=tmp_path / "nonexistent_file.yaml")

    # Reset verifies canonical profile is restored
    reset_business_profile()
    assert get_business_profile().identity.consultant_name == "Vansh Panchal"
