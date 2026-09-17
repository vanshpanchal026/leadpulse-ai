"""Root API router combining health and agent run endpoints."""

from fastapi import APIRouter
from app.api.routes import health, run, specialists, opportunities, outreach, leads, research_runs, campaigns

api_router = APIRouter()

# Core health & agent endpoints available at root level
api_router.include_router(health.router, prefix="/health")
api_router.include_router(run.router, prefix="")
api_router.include_router(specialists.router, prefix="")
api_router.include_router(opportunities.router, prefix="")
api_router.include_router(outreach.router, prefix="")
api_router.include_router(leads.router, prefix="")
api_router.include_router(research_runs.router, prefix="")
api_router.include_router(campaigns.router, prefix="")

# Versioned endpoints under /api/v1
api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(health.router, prefix="/health")
api_v1_router.include_router(run.router, prefix="")
api_v1_router.include_router(run.router, prefix="/agent")
api_v1_router.include_router(specialists.router, prefix="")
api_v1_router.include_router(opportunities.router, prefix="")
api_v1_router.include_router(outreach.router, prefix="")
api_v1_router.include_router(leads.router, prefix="")
api_v1_router.include_router(research_runs.router, prefix="")
api_v1_router.include_router(campaigns.router, prefix="")

api_router.include_router(api_v1_router)
