"""FastAPI Application Entrypoint for the LeadPulse AI Worker.

Initializes application lifecycle, middleware, routers, and exception handlers.
"""

from contextlib import asynccontextmanager
from typing import AsyncIterator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.core.provider import init_provider, close_provider
from app.api.router import api_router
from app.utils.error_handlers import register_exception_handlers


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan manager handling startup initialization and clean shutdown."""
    settings = get_settings()
    # Configure structured logging with secret masking
    setup_logging(
        log_level=settings.LOG_LEVEL,
        known_secrets=[settings.AI_API_KEY.get_secret_value()]
    )
    # Initialize the OpenAI Agents SDK provider singleton
    init_provider(settings)

    yield

    # Clean up transport resources on shutdown
    await close_provider()


def create_app() -> FastAPI:
    """Factory creating and configuring the FastAPI application instance."""
    settings = get_settings()

    app = FastAPI(
        title="LeadPulse AI Worker",
        description="Python AI worker service executing multi-agent workflows with OpenAI Agents SDK.",
        version="2.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan
    )

    # Allow local Next.js and Vite client integration
    allowed_origins = [
        "http://localhost:3000",
        "http://localhost:3500",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3500",
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register centralized exception handlers
    register_exception_handlers(app)

    # Register routers
    app.include_router(api_router)

    return app


app = create_app()
