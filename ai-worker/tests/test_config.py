"""Tests for configuration loading, validation, and secret protection."""

import pytest
from pydantic import SecretStr
from app.core.config import Settings, ConfigurationError, create_settings


def test_valid_configuration_creation(monkeypatch):
    """Test successful configuration parsing with valid parameters."""
    monkeypatch.setenv("AI_BASE_URL", "http://localhost:3001/v1/")
    monkeypatch.setenv("AI_API_KEY", "test-secret-key-12345")
    monkeypatch.setenv("AI_MODEL", "test-model")
    monkeypatch.setenv("AI_API_MODE", "chat_completions")
    monkeypatch.setenv("AI_TIMEOUT_SECONDS", "45.0")
    monkeypatch.setenv("AI_MAX_RETRIES", "3")

    settings = create_settings()
    assert settings.AI_BASE_URL == "http://localhost:3001/v1"  # Trailing slash stripped
    assert isinstance(settings.AI_API_KEY, SecretStr)
    assert settings.AI_API_KEY.get_secret_value() == "test-secret-key-12345"
    assert settings.AI_MODEL == "test-model"
    assert settings.AI_TIMEOUT_SECONDS == 45.0
    assert settings.AI_MAX_RETRIES == 3


def test_secret_protection_no_leak():
    """Verify that SecretStr strictly masks secrets in repr, str, and serialization."""
    settings = Settings(
        AI_BASE_URL="http://localhost:3001/v1",
        AI_API_KEY=SecretStr("super_confidential_key_999"),
        AI_MODEL="auto"
    )

    # String conversion must mask
    assert "super_confidential_key_999" not in str(settings.AI_API_KEY)
    assert "super_confidential_key_999" not in repr(settings.AI_API_KEY)
    assert "super_confidential_key_999" not in str(settings)
    assert "super_confidential_key_999" not in repr(settings)

    # model_dump must not reveal plaintext
    dumped = settings.model_dump()
    assert dumped["AI_API_KEY"].get_secret_value() == "super_confidential_key_999"
    assert "super_confidential_key_999" not in str(dumped)


def test_missing_base_url_raises(monkeypatch):
    """Test that missing AI_BASE_URL fails clearly."""
    monkeypatch.delenv("AI_BASE_URL", raising=False)
    with pytest.raises(ConfigurationError) as exc_info:
        create_settings(load_env=False)
    assert "AI_BASE_URL" in str(exc_info.value)
    # Ensure error message does not leak secret values
    assert "super_confidential" not in str(exc_info.value)


def test_missing_api_key_raises(monkeypatch):
    """Test that missing AI_API_KEY fails clearly."""
    monkeypatch.delenv("AI_API_KEY", raising=False)
    with pytest.raises(ConfigurationError) as exc_info:
        create_settings(load_env=False)
    assert "AI_API_KEY" in str(exc_info.value)


def test_invalid_base_url_scheme_raises():
    """Test that non-http(s) AI_BASE_URL fails validation."""
    with pytest.raises(ConfigurationError) as exc_info:
        Settings(
            AI_BASE_URL="ftp://invalid.endpoint",
            AI_API_KEY=SecretStr("safe"),
            AI_MODEL="auto"
        )
    assert "http" in str(exc_info.value)


def test_disallowed_api_mode_raises():
    """Verify that attempting to switch to responses API mode in Phase 2 is blocked."""
    with pytest.raises(ConfigurationError) as exc_info:
        Settings(
            AI_BASE_URL="http://localhost:3001/v1",
            AI_API_KEY=SecretStr("safe"),
            AI_MODEL="auto",
            AI_API_MODE="responses"
        )
    assert "chat_completions" in str(exc_info.value)


def test_invalid_worker_port_raises(monkeypatch):
    """Verify that non-numeric AI_WORKER_PORT raises ConfigurationError."""
    monkeypatch.setenv("AI_WORKER_PORT", "invalid_port")
    with pytest.raises(ConfigurationError) as exc_info:
        create_settings(load_env=False)
    assert "numeric configuration value" in str(exc_info.value).lower()


def test_invalid_timeout_raises(monkeypatch):
    """Verify that non-numeric AI_TIMEOUT_SECONDS raises ConfigurationError."""
    monkeypatch.setenv("AI_TIMEOUT_SECONDS", "not_a_float")
    with pytest.raises(ConfigurationError) as exc_info:
        create_settings(load_env=False)
    assert "numeric configuration value" in str(exc_info.value).lower()

