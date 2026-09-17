"""LeadPulse AI Worker Configuration Management.

Loads and validates environment variables with strict secret redaction.
Zero secrets are ever logged or exposed in representation strings.
"""

import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional
from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator


class ConfigurationError(Exception):
    """Raised when application configuration or environment validation fails."""
    pass


class Settings(BaseModel):
    """Application runtime settings backed by environment variables."""

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        validate_default=True,
        extra="ignore"
    )

    # Core AI Provider Configuration (Phase 1 proven settings)
    AI_BASE_URL: str = Field(
        ...,
        description="Base URL for the OpenAI-compatible endpoint (e.g. http://localhost:3001/v1)"
    )
    AI_API_KEY: SecretStr = Field(
        ...,
        description="API key for authentication (stored as SecretStr to prevent accidental leakage)"
    )
    AI_MODEL: str = Field(
        default="auto",
        description="Target model identifier"
    )
    AI_API_MODE: str = Field(
        default="chat_completions",
        description="Provider protocol mode (must be chat_completions for core architecture)"
    )

    # Worker Network Service Configuration
    AI_WORKER_HOST: str = Field(
        default="0.0.0.0",
        description="Host interface for the worker HTTP server"
    )
    AI_WORKER_PORT: int = Field(
        default=8000,
        description="Port for the worker HTTP server"
    )

    # Execution & Timeout Controls
    AI_TIMEOUT_SECONDS: float = Field(
        default=60.0,
        gt=0.0,
        le=300.0,
        description="Execution timeout in seconds for agent calls"
    )
    AI_MAX_RETRIES: int = Field(
        default=2,
        ge=0,
        le=5,
        description="Maximum retry attempts on transient model gateway errors"
    )

    # Operational Metadata
    ENVIRONMENT: str = Field(
        default="development",
        description="Runtime environment (development, staging, production)"
    )
    LOG_LEVEL: str = Field(
        default="INFO",
        description="Logging verbosity level (DEBUG, INFO, WARNING, ERROR, CRITICAL)"
    )

    # Apify Tool Gateway Configuration
    APIFY_API_TOKEN: Optional[SecretStr] = Field(
        default=None,
        description="Apify API authentication token (stored as SecretStr to prevent leakage)"
    )
    APIFY_BASE_URL: str = Field(
        default="https://api.apify.com/v2",
        description="Base URL for Apify REST API"
    )

    # Supabase & Persistence Configuration
    SUPABASE_URL: Optional[str] = Field(
        default=None,
        description="Base URL for Supabase project REST API"
    )
    SUPABASE_ANON_KEY: Optional[SecretStr] = Field(
        default=None,
        description="Supabase anonymous client API key"
    )
    SUPABASE_SERVICE_ROLE_KEY: Optional[SecretStr] = Field(
        default=None,
        description="Supabase privileged service-role key for backend writes"
    )
    PERSISTENCE_DB_PATH: str = Field(
        default="data/leadpulse_v2.db",
        description="Local SQLite durable mirror path"
    )

    @field_validator("AI_BASE_URL")
    @classmethod
    def validate_base_url(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ConfigurationError("Missing required environment variable: AI_BASE_URL")
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ConfigurationError("AI_BASE_URL must begin with http:// or https://")
        return v.rstrip("/")

    @field_validator("AI_MODEL")
    @classmethod
    def validate_model(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ConfigurationError("Missing required environment variable: AI_MODEL")
        return v

    @field_validator("AI_API_MODE")
    @classmethod
    def validate_api_mode(cls, v: str) -> str:
        v = v.strip().lower()
        if v != "chat_completions":
            raise ConfigurationError(
                "Phase 2 architecture strictly requires AI_API_MODE='chat_completions'. "
                "Responses API is not permitted for core architecture."
            )
        return v


def _find_and_load_env() -> None:
    """Locate and load .env file from ai-worker directory or workspace root with correct priority."""
    current_dir = Path(__file__).resolve().parent
    # Precedence order (highest to lowest with override=False):
    # 1. ai-worker/.env.local (worker-specific local overrides)
    # 2. ai-worker/.env (worker-specific defaults)
    # 3. workspace_root/.env.local (workspace local developer overrides)
    # 4. workspace_root/.env (workspace defaults)
    search_paths = [
        current_dir.parent.parent / ".env.local",
        current_dir.parent.parent / ".env",
        current_dir.parent.parent.parent / ".env.local",
        current_dir.parent.parent.parent / ".env",
    ]
    for env_path in search_paths:
        if env_path.is_file():
            load_dotenv(dotenv_path=env_path, override=False)


def create_settings(load_env: bool = True) -> Settings:
    """Factory to instantiate and validate Settings from environment variables."""
    if load_env:
        _find_and_load_env()

    base_url = os.environ.get("AI_BASE_URL")
    api_key = os.environ.get("AI_API_KEY")
    model = os.environ.get("AI_MODEL", "auto")
    api_mode = os.environ.get("AI_API_MODE", "chat_completions")
    worker_host = os.environ.get("AI_WORKER_HOST", "0.0.0.0")
    environment = os.environ.get("ENVIRONMENT", "development")
    log_level = os.environ.get("LOG_LEVEL", "INFO")

    if not base_url or not base_url.strip():
        raise ConfigurationError("Missing required environment variable: AI_BASE_URL")
    if not api_key or not api_key.strip():
        raise ConfigurationError("Missing required environment variable: AI_API_KEY")
    if not model or not model.strip():
        raise ConfigurationError("Missing required environment variable: AI_MODEL")

    raw_port = os.environ.get("AI_WORKER_PORT")
    raw_timeout = os.environ.get("AI_TIMEOUT_SECONDS")
    raw_retries = os.environ.get("AI_MAX_RETRIES")

    kwargs: dict[str, Any] = {
        "AI_BASE_URL": base_url,
        "AI_API_KEY": SecretStr(api_key),
        "AI_MODEL": model,
        "AI_API_MODE": api_mode,
        "AI_WORKER_HOST": worker_host,
        "ENVIRONMENT": environment,
        "LOG_LEVEL": log_level,
    }

    apify_token = os.environ.get("APIFY_API_TOKEN") or os.environ.get("APIFY_TOKEN")
    if apify_token and apify_token.strip():
        kwargs["APIFY_API_TOKEN"] = SecretStr(apify_token.strip())

    apify_base_url = os.environ.get("APIFY_BASE_URL")
    if apify_base_url and apify_base_url.strip():
        kwargs["APIFY_BASE_URL"] = apify_base_url.strip().rstrip("/")

    # Supabase & Persistence Configuration
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    if supabase_url and supabase_url.strip():
        kwargs["SUPABASE_URL"] = supabase_url.strip().rstrip("/")

    supabase_anon = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if supabase_anon and supabase_anon.strip():
        kwargs["SUPABASE_ANON_KEY"] = SecretStr(supabase_anon.strip())

    supabase_service = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if supabase_service and supabase_service.strip():
        kwargs["SUPABASE_SERVICE_ROLE_KEY"] = SecretStr(supabase_service.strip())

    persistence_db = os.environ.get("PERSISTENCE_DB_PATH")
    if persistence_db and persistence_db.strip():
        kwargs["PERSISTENCE_DB_PATH"] = persistence_db.strip()

    try:
        if raw_port is not None and raw_port.strip():
            kwargs["AI_WORKER_PORT"] = int(raw_port)
        if raw_timeout is not None and raw_timeout.strip():
            kwargs["AI_TIMEOUT_SECONDS"] = float(raw_timeout)
        if raw_retries is not None and raw_retries.strip():
            kwargs["AI_MAX_RETRIES"] = int(raw_retries)
    except (ValueError, TypeError) as conv_err:
        raise ConfigurationError(f"Invalid numeric configuration value: {conv_err}") from conv_err

    try:
        return Settings(**kwargs)
    except Exception as exc:
        if isinstance(exc, ConfigurationError):
            raise
        err_msg = str(exc)
        if api_key:
            err_msg = err_msg.replace(api_key, "[REDACTED]")
        if apify_token:
            err_msg = err_msg.replace(apify_token, "[REDACTED]")
        if supabase_anon:
            err_msg = err_msg.replace(supabase_anon, "[REDACTED]")
        if supabase_service:
            err_msg = err_msg.replace(supabase_service, "[REDACTED]")
        raise ConfigurationError(f"Configuration validation error: {err_msg}") from exc


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached singleton instance of validated application settings."""
    return create_settings()


def clear_settings_cache() -> None:
    """Clear the cached settings instance (for testing)."""
    get_settings.cache_clear()
