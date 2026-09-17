"""Unit tests for Phase 3 Model Provider Centralization.

Verifies:
- Provider configuration loading with valid settings
- Missing configuration detection
- Invalid configuration detection (scheme, protocol mode, invariants)
- Chat Completions mode enforcement (use_responses=False)
- Tracing disabled invariant (tracing_disabled=True)
- Model configuration resolution and agent factory binding
- Zero secret leakage in configuration metadata and string representations
"""

import os
import pytest
from pydantic import SecretStr, ValidationError

from app.core.config import Settings, ConfigurationError, create_settings
from app.core.provider import (
    ProviderConfig,
    get_provider_config,
    get_default_model,
    create_configured_agent,
    init_provider,
    get_provider,
    get_run_config,
    reset_provider,
    is_provider_ready,
)


def test_provider_config_loading_success(test_settings):
    """Verify ProviderConfig loads correctly from validated application settings."""
    config = get_provider_config(test_settings)
    assert config.base_url == "http://localhost:3001/v1"
    assert config.model == "auto"
    assert config.api_mode == "chat_completions"
    assert config.use_responses is False
    assert config.tracing_disabled is True
    assert config.timeout_seconds == 60.0
    assert config.max_retries == 2


def test_provider_config_immutable(test_settings):
    """Verify ProviderConfig is frozen and cannot be mutated at runtime."""
    config = get_provider_config(test_settings)
    with pytest.raises(ValidationError):
        config.model = "gpt-4o"


def test_provider_config_chat_completions_invariant():
    """Verify that attempting to configure responses mode or use_responses=True raises ValueError."""
    # Invalid mode
    with pytest.raises(ValidationError) as exc_info:
        ProviderConfig(
            base_url="http://localhost:3001/v1",
            model="auto",
            api_mode="responses"
        )
    assert "strictly requires api_mode='chat_completions'" in str(exc_info.value)

    # use_responses=True rejected
    with pytest.raises(ValidationError) as exc_info:
        ProviderConfig(
            base_url="http://localhost:3001/v1",
            model="auto",
            use_responses=True
        )
    assert "strictly requires use_responses=False" in str(exc_info.value)


def test_provider_config_tracing_disabled_invariant():
    """Verify that tracing_disabled=False is rejected to prevent telemetry errors."""
    with pytest.raises(ValidationError) as exc_info:
        ProviderConfig(
            base_url="http://localhost:3001/v1",
            model="auto",
            tracing_disabled=False
        )
    assert "strictly requires tracing_disabled=True" in str(exc_info.value)


def test_provider_config_base_url_validation():
    """Verify base_url must start with http:// or https://."""
    with pytest.raises(ValidationError) as exc_info:
        ProviderConfig(
            base_url="ftp://invalid-server.com/v1",
            model="auto"
        )
    assert "base_url must begin with http:// or https://" in str(exc_info.value)

    # Trailing slash is stripped
    cfg = ProviderConfig(
        base_url="http://localhost:3001/v1/",
        model="auto"
    )
    assert cfg.base_url == "http://localhost:3001/v1"


def test_provider_config_model_non_empty():
    """Verify empty model string is rejected."""
    with pytest.raises(ValidationError) as exc_info:
        ProviderConfig(
            base_url="http://localhost:3001/v1",
            model="   "
        )
    assert "model identifier cannot be empty" in str(exc_info.value)


def test_missing_configuration_raises(monkeypatch):
    """Verify missing required environment variables raise ConfigurationError."""
    monkeypatch.delenv("AI_BASE_URL", raising=False)
    monkeypatch.delenv("AI_API_KEY", raising=False)
    monkeypatch.delenv("AI_MODEL", raising=False)

    with pytest.raises(ConfigurationError) as exc_info:
        create_settings(load_env=False)
    assert "Missing required environment variable" in str(exc_info.value)


def test_invalid_base_url_scheme_raises(monkeypatch):
    """Verify invalid URL scheme in Settings raises ConfigurationError."""
    monkeypatch.setenv("AI_BASE_URL", "ftp://my-host.com")
    monkeypatch.setenv("AI_API_KEY", "test-key-123")
    monkeypatch.setenv("AI_MODEL", "auto")

    with pytest.raises(ConfigurationError) as exc_info:
        create_settings(load_env=False)
    assert "must begin with http:// or https://" in str(exc_info.value)


def test_model_configuration_default_and_override(test_settings):
    """Verify get_default_model returns centralized model and create_configured_agent handles overrides."""
    reset_provider()
    init_provider(test_settings)

    # Default model matches settings
    assert get_default_model() == test_settings.AI_MODEL

    # Agent without model override uses default
    agent1 = create_configured_agent(name="TestAgent1", instructions="Test")
    assert agent1.model == test_settings.AI_MODEL

    # Agent with model override uses override
    agent2 = create_configured_agent(name="TestAgent2", instructions="Test", model="custom-model-v2")
    assert agent2.model == "custom-model-v2"


def test_secret_protection_no_key_in_provider_config(test_settings):
    """Verify ProviderConfig contains no secret keys and string representations never leak credentials."""
    config = get_provider_config(test_settings)
    raw_key = test_settings.AI_API_KEY.get_secret_value()

    # Secret is not a field in ProviderConfig
    assert "api_key" not in config.model_dump()
    assert raw_key not in str(config)
    assert raw_key not in repr(config)
    assert raw_key not in config.model_dump_json()


def test_provider_initialization_and_run_config(test_settings):
    """Verify init_provider sets up OpenAIProvider with use_responses=False and RunConfig with tracing_disabled=True."""
    reset_provider()
    assert is_provider_ready() is False

    provider = init_provider(test_settings)
    assert is_provider_ready() is True
    assert provider is not None
    assert provider._use_responses is False

    run_cfg = get_run_config()
    assert run_cfg.tracing_disabled is True
    assert run_cfg.model_provider is provider

    reset_provider()
    assert is_provider_ready() is False


def test_provider_config_missing_required_fields():
    """Verify ProviderConfig requires both base_url and model fields."""
    with pytest.raises(ValidationError):
        ProviderConfig(base_url="http://localhost:3001/v1")  # missing model

    with pytest.raises(ValidationError):
        ProviderConfig(model="auto")  # missing base_url


def test_provider_config_invalid_numeric_bounds():
    """Verify timeout_seconds must be > 0 and max_retries >= 0."""
    with pytest.raises(ValidationError):
        ProviderConfig(base_url="http://localhost:3001/v1", model="auto", timeout_seconds=0.0)

    with pytest.raises(ValidationError):
        ProviderConfig(base_url="http://localhost:3001/v1", model="auto", max_retries=-1)


def test_get_provider_config_with_explicit_settings(test_settings):
    """Verify get_provider_config respects explicit settings parameter even if cached."""
    # First establish default cached config
    cfg1 = get_provider_config(test_settings)
    assert cfg1.model == "auto"

    # Now pass explicit custom settings with a different model
    custom_settings = Settings(
        AI_BASE_URL="http://127.0.0.1:9999/v1",
        AI_API_KEY=SecretStr("custom-secret-key"),
        AI_MODEL="custom-agent-model",
        AI_API_MODE="chat_completions"
    )
    cfg2 = get_provider_config(custom_settings)
    assert cfg2.base_url == "http://127.0.0.1:9999/v1"
    assert cfg2.model == "custom-agent-model"

    # Reset cleans up
    reset_provider()
