"""LeadPulse Business Profile Centralization & Management.

Provides access to the immutable singleton LeadPulseProfile instance,
dynamic campaign scope layering, and profile loading from external configuration.
Guarantees that no agent hardcodes business identity, services, or locations.
"""

import json
import logging
import os
import threading
from pathlib import Path
from typing import Any, Optional, Union
import yaml

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

logger = logging.getLogger("ai_worker.profile")

# Canonical default business profile instance
DEFAULT_BUSINESS_PROFILE: LeadPulseProfile = LeadPulseProfile()

_active_profile: Optional[LeadPulseProfile] = None
_profile_lock = threading.Lock()


def get_business_profile() -> LeadPulseProfile:
    """Retrieve the active LeadPulse business profile singleton."""
    global _active_profile
    if _active_profile is not None:
        return _active_profile

    with _profile_lock:
        if _active_profile is not None:
            return _active_profile
        _active_profile = load_business_profile()
        return _active_profile


def load_business_profile(
    custom_data: Optional[dict[str, Any]] = None,
    config_path: Optional[Union[str, Path]] = None
) -> LeadPulseProfile:
    """Load and validate a LeadPulse business profile.
    
    Supports both JSON and YAML (.yaml, .yml) configuration formats.
    
    Precedence:
    1. Explicit custom_data dictionary
    2. Explicit config_path file (JSON or YAML) — raises FileNotFoundError if missing
    3. LEADPULSE_PROFILE_PATH environment variable (if pointing to valid file)
    4. Canonical DEFAULT_BUSINESS_PROFILE
    """
    if custom_data is not None:
        logger.info("Loading LeadPulse business profile from in-memory dictionary")
        return LeadPulseProfile.model_validate(custom_data)

    if config_path is not None:
        p = Path(config_path).resolve()
        if not p.is_file():
            raise FileNotFoundError(f"Configured business profile file not found: {config_path}")
        logger.info("Loading LeadPulse business profile from explicit file: %s", p)
        with open(p, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        if not isinstance(data, dict):
            raise ValueError(f"Profile configuration file '{config_path}' must parse to a dictionary mapping")
        return LeadPulseProfile.model_validate(data)

    env_path = os.environ.get("LEADPULSE_PROFILE_PATH")
    if env_path:
        p = Path(env_path).resolve()
        if p.is_file():
            logger.info("Loading LeadPulse business profile from environment path: %s", p)
            with open(p, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
            if not isinstance(data, dict):
                raise ValueError(f"Profile configuration file '{env_path}' must parse to a dictionary mapping")
            return LeadPulseProfile.model_validate(data)
        else:
            logger.warning("Configured profile path '%s' from LEADPULSE_PROFILE_PATH not found, falling back to defaults", env_path)

    logger.debug("Using default canonical LeadPulse business profile")
    return DEFAULT_BUSINESS_PROFILE


def set_business_profile(profile: LeadPulseProfile) -> None:
    """Set the active business profile singleton (useful for campaign overrides or tests)."""
    global _active_profile
    with _profile_lock:
        _active_profile = profile
        logger.info("Active LeadPulse business profile updated")


def reset_business_profile() -> None:
    """Reset the active business profile back to canonical defaults."""
    global _active_profile
    with _profile_lock:
        _active_profile = None
        logger.info("Active LeadPulse business profile reset to default")


__all__ = [
    "BusinessIdentity",
    "AgentPersona",
    "TechnicalCapabilities",
    "ServiceOffering",
    "IdealCustomerProfile",
    "TargetBusinessCharacteristics",
    "GeographicScope",
    "VerticalScope",
    "QualificationPreferences",
    "ExclusionRules",
    "OutreachConstraints",
    "CampaignScope",
    "LeadPulseProfile",
    "DEFAULT_BUSINESS_PROFILE",
    "get_business_profile",
    "load_business_profile",
    "set_business_profile",
    "reset_business_profile",
]
