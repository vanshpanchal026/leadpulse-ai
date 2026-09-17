"""OpenAI Agents SDK Provider Singleton Initialization & Centralization.

Adheres strictly to Phase 1 verified settings:
- AsyncOpenAI bound to AI_BASE_URL and AI_API_KEY
- Chat Completions mode exclusively (use_responses=False)
- Telemetry/remote tracing disabled (tracing_disabled=True)
- Centralized ProviderConfig metadata ensuring all agents obtain their model
  and provider settings through this layer.
"""

import logging
import threading
from typing import Any, Optional
from openai import AsyncOpenAI
from pydantic import BaseModel, ConfigDict, Field, field_validator
from agents import Agent, RunConfig
from agents.models.openai_provider import OpenAIProvider

from app.core.config import Settings, get_settings

logger = logging.getLogger("ai_worker.provider")


class ProviderConfig(BaseModel):
    """Centralized, immutable model provider configuration.
    
    Guarantees strict Phase 1 invariants:
    - Chat Completions mode (use_responses=False)
    - Tracing disabled (tracing_disabled=True)
    - Credentials are never stored in plain text or exposed in serialized forms.
    """
    model_config = ConfigDict(frozen=True, arbitrary_types_allowed=True)

    base_url: str = Field(..., description="OpenAI-compatible endpoint base URL")
    model: str = Field(..., description="Configured model identifier")
    api_mode: str = Field(default="chat_completions", description="Provider protocol mode")
    use_responses: bool = Field(default=False, description="Strict Phase 1 requirement: Chat Completions mode")
    tracing_disabled: bool = Field(default=True, description="Strict Phase 1 requirement: Telemetry disabled")
    timeout_seconds: float = Field(default=60.0, gt=0.0, description="Default timeout in seconds")
    max_retries: int = Field(default=2, ge=0, description="Maximum transient retry attempts")

    @field_validator("api_mode")
    @classmethod
    def validate_api_mode(cls, v: str) -> str:
        norm = v.strip().lower()
        if norm != "chat_completions":
            raise ValueError(
                f"Provider configuration strictly requires api_mode='chat_completions', got '{v}'."
            )
        return norm

    @field_validator("use_responses")
    @classmethod
    def validate_use_responses(cls, v: bool) -> bool:
        if v is not False:
            raise ValueError("Provider configuration strictly requires use_responses=False.")
        return v

    @field_validator("tracing_disabled")
    @classmethod
    def validate_tracing_disabled(cls, v: bool) -> bool:
        if v is not True:
            raise ValueError("Provider configuration strictly requires tracing_disabled=True.")
        return v

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, v: str) -> str:
        v = v.strip()
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("base_url must begin with http:// or https://")
        return v.rstrip("/")

    @field_validator("model")
    @classmethod
    def validate_model(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("model identifier cannot be empty")
        return v


_openai_client: Optional[AsyncOpenAI] = None
_model_provider: Optional[OpenAIProvider] = None
_run_config: Optional[RunConfig] = None
_provider_config: Optional[ProviderConfig] = None
_provider_lock = threading.Lock()


def get_provider_config(settings: Optional[Settings] = None) -> ProviderConfig:
    """Retrieve the centralized immutable ProviderConfig.
    
    If explicit settings are provided, constructs and returns a configuration based
    on those settings. Otherwise, returns the cached singleton configuration.
    """
    global _provider_config
    if settings is not None:
        return ProviderConfig(
            base_url=settings.AI_BASE_URL,
            model=settings.AI_MODEL,
            api_mode=settings.AI_API_MODE,
            use_responses=False,
            tracing_disabled=True,
            timeout_seconds=settings.AI_TIMEOUT_SECONDS,
            max_retries=settings.AI_MAX_RETRIES
        )

    if _provider_config is not None:
        return _provider_config

    with _provider_lock:
        if _provider_config is not None:
            return _provider_config

        resolved_settings = get_settings()
        _provider_config = ProviderConfig(
            base_url=resolved_settings.AI_BASE_URL,
            model=resolved_settings.AI_MODEL,
            api_mode=resolved_settings.AI_API_MODE,
            use_responses=False,
            tracing_disabled=True,
            timeout_seconds=resolved_settings.AI_TIMEOUT_SECONDS,
            max_retries=resolved_settings.AI_MAX_RETRIES
        )
        return _provider_config


def get_default_model() -> str:
    """Retrieve the centrally configured model name."""
    return get_provider_config().model


def init_provider(settings: Optional[Settings] = None) -> OpenAIProvider:
    """Initialize the OpenAI Agents SDK model provider singleton with thread safety."""
    global _openai_client, _model_provider, _run_config, _provider_config

    if _model_provider is not None:
        return _model_provider

    with _provider_lock:
        if _model_provider is not None:
            return _model_provider

        if settings is None:
            settings = get_settings()

        # Instantiate provider configuration
        _provider_config = ProviderConfig(
            base_url=settings.AI_BASE_URL,
            model=settings.AI_MODEL,
            api_mode=settings.AI_API_MODE,
            use_responses=False,
            tracing_disabled=True,
            timeout_seconds=settings.AI_TIMEOUT_SECONDS,
            max_retries=settings.AI_MAX_RETRIES
        )

        logger.info(
            "Initializing OpenAI Agents SDK provider (base_url=%s, model=%s, use_responses=False, tracing_disabled=True)",
            _provider_config.base_url,
            _provider_config.model
        )

        # Instantiate underlying AsyncOpenAI client
        _openai_client = AsyncOpenAI(
            base_url=_provider_config.base_url,
            api_key=settings.AI_API_KEY.get_secret_value(),
            timeout=_provider_config.timeout_seconds,
            max_retries=_provider_config.max_retries
        )

        # Initialize OpenAIProvider in Chat Completions mode (strict Phase 1 requirement)
        _model_provider = OpenAIProvider(
            openai_client=_openai_client,
            use_responses=False,
            strict_feature_validation=False
        )

        # Initialize RunConfig with remote tracing disabled
        _run_config = RunConfig(
            model_provider=_model_provider,
            tracing_disabled=True
        )

        logger.info("OpenAI Agents SDK provider initialized successfully")
        return _model_provider


def get_provider() -> OpenAIProvider:
    """Retrieve the initialized OpenAIProvider singleton."""
    global _model_provider
    if _model_provider is None:
        return init_provider()
    return _model_provider


def get_run_config() -> RunConfig:
    """Retrieve the standard RunConfig instance."""
    global _run_config
    if _run_config is None:
        init_provider()
    assert _run_config is not None
    return _run_config


def get_client() -> AsyncOpenAI:
    """Retrieve the underlying AsyncOpenAI client instance."""
    global _openai_client
    if _openai_client is None:
        init_provider()
    assert _openai_client is not None
    return _openai_client


def create_configured_agent(
    name: str,
    instructions: str,
    output_type: Any = None,
    model: Optional[str] = None,
    **kwargs: Any
) -> Agent:
    """Factory creating an Agent configured with the centralized model and provider settings.
    
    All future agents should be instantiated via this factory or inherit its model resolution
    to ensure zero hardcoded models or fragmented configurations.
    """
    resolved_model = model or get_default_model()
    agent_kwargs: dict[str, Any] = {
        "name": name,
        "instructions": instructions,
        "model": resolved_model,
        **kwargs
    }
    if output_type is not None:
        agent_kwargs["output_type"] = output_type

    return Agent(**agent_kwargs)


async def close_provider() -> None:
    """Cleanly close client transports on application shutdown."""
    global _openai_client, _model_provider, _run_config, _provider_config
    client_to_close: Optional[AsyncOpenAI] = None
    with _provider_lock:
        client_to_close = _openai_client
        _openai_client = None
        _model_provider = None
        _run_config = None
        _provider_config = None

    if client_to_close is not None:
        try:
            await client_to_close.close()
            logger.info("OpenAI client connection closed")
        except Exception as exc:
            logger.warning("Error closing OpenAI client: %s", exc)


def reset_provider() -> None:
    """Synchronously reset provider singletons without awaiting transport close (for test isolation)."""
    global _openai_client, _model_provider, _run_config, _provider_config
    with _provider_lock:
        _openai_client = None
        _model_provider = None
        _run_config = None
        _provider_config = None


def is_provider_ready() -> bool:
    """Return True if the provider singleton is initialized."""
    return _model_provider is not None and _openai_client is not None


__all__ = [
    "ProviderConfig",
    "get_provider_config",
    "get_default_model",
    "init_provider",
    "get_provider",
    "get_run_config",
    "get_client",
    "create_configured_agent",
    "close_provider",
    "reset_provider",
    "is_provider_ready",
]
