"""Standardized Exception Hierarchy and FastAPI Error Handlers.

Guarantees sanitized error outputs and prevents secret leaks on internal errors.
"""

import logging
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.config import ConfigurationError
from app.schemas.errors import ErrorResponse

logger = logging.getLogger("ai_worker.errors")


class WorkerError(Exception):
    """Base exception for all AI worker errors."""
    def __init__(self, message: str, error_code: str = "WORKER_ERROR"):
        super().__init__(message)
        self.message = message
        self.error_code = error_code


class WorkerTimeoutError(WorkerError):
    """Raised when an agent execution exceeds configured timeout limits."""
    def __init__(self, message: str = "Agent execution timed out"):
        super().__init__(message, error_code="TIMEOUT_ERROR")


class ProviderError(WorkerError):
    """Raised when upstream LLM gateway or provider encounters connection or protocol errors."""
    def __init__(self, message: str = "Upstream model provider error"):
        super().__init__(message, error_code="PROVIDER_ERROR")


class AgentExecutionError(WorkerError):
    """Raised when an agent execution fails during internal runner execution."""
    def __init__(self, message: str = "Agent execution failure"):
        super().__init__(message, error_code="AGENT_EXECUTION_ERROR")


class SearchScopeValidationError(WorkerError, ValueError):
    """Raised when search strategy exceeds campaign limits or violates geography/ICP boundaries."""
    def __init__(self, message: str = "Search scope validation failure", violations: list[str] | None = None):
        super().__init__(message, error_code="SEARCH_SCOPE_VALIDATION_ERROR")
        self.violations = violations or []


def register_exception_handlers(app: FastAPI) -> None:
    """Attach global exception handlers to the FastAPI application."""

    @app.exception_handler(SearchScopeValidationError)
    async def scope_validation_handler(request: Request, exc: SearchScopeValidationError) -> JSONResponse:
        logger.warning("Search scope validation failed: %s (path=%s)", exc.message, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content=ErrorResponse(
                error="Scope Validation Error",
                detail=exc.message,
                error_code=exc.error_code
            ).model_dump()
        )


    @app.exception_handler(WorkerTimeoutError)
    async def timeout_handler(request: Request, exc: WorkerTimeoutError) -> JSONResponse:
        logger.warning("Request timed out: %s (path=%s)", exc.message, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            content=ErrorResponse(
                error="Gateway Timeout",
                detail=exc.message,
                error_code=exc.error_code
            ).model_dump()
        )

    @app.exception_handler(ProviderError)
    async def provider_handler(request: Request, exc: ProviderError) -> JSONResponse:
        logger.error("Provider error encountered: %s (path=%s)", exc.message, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content=ErrorResponse(
                error="Bad Gateway",
                detail=exc.message,
                error_code=exc.error_code
            ).model_dump()
        )

    @app.exception_handler(ConfigurationError)
    async def config_handler(request: Request, exc: ConfigurationError) -> JSONResponse:
        logger.error("Configuration error: %s", str(exc))
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorResponse(
                error="Configuration Error",
                detail=str(exc),
                error_code="CONFIG_ERROR"
            ).model_dump()
        )

    @app.exception_handler(AgentExecutionError)
    async def execution_handler(request: Request, exc: AgentExecutionError) -> JSONResponse:
        logger.error("Agent execution error: %s (path=%s)", exc.message, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorResponse(
                error="Internal Agent Error",
                detail=exc.message,
                error_code=exc.error_code
            ).model_dump()
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        err_details = []
        for err in exc.errors():
            loc = ".".join(str(item) for item in err.get("loc", []) if item != "body")
            msg = err.get("msg", "Invalid value")
            err_details.append(f"{loc}: {msg}" if loc else msg)
        detail_msg = "; ".join(err_details) if err_details else "Request validation schema failed."
        logger.info("Request validation failed: %s (path=%s)", detail_msg, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content=ErrorResponse(
                error="Validation Error",
                detail=detail_msg,
                error_code="VALIDATION_ERROR"
            ).model_dump()
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.critical("Unhandled server exception: %s (path=%s)", type(exc).__name__, request.url.path, exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorResponse(
                error="Internal Server Error",
                detail="An unexpected error occurred during request processing.",
                error_code="INTERNAL_SERVER_ERROR"
            ).model_dump()
        )
