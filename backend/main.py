"""FastAPI application entry point for the ReachIQ API."""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.core.config import settings
from backend.database import get_db
from backend.routes.auth import router as auth_router
from backend.routes.campaigns import router as campaigns_router
from backend.routes.contacts import router as contacts_router
from backend.routes.emails import router as emails_router
from backend.routes.resume import router as resume_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="ReachIQ API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

api_v1 = APIRouter(prefix="/api/v1")
api_v1.include_router(auth_router)
api_v1.include_router(contacts_router)
api_v1.include_router(campaigns_router)
api_v1.include_router(emails_router)
api_v1.include_router(resume_router)
app.include_router(api_v1)


class HealthResponse(BaseModel):
    """Response body for the liveness / readiness health check."""

    status: Literal["ok"] = Field(default="ok")
    env: str
    db: Literal["connected", "error"]


@app.on_event("startup")
def on_startup() -> None:
    """Log application startup."""
    logger.info("ReachIQ API started (APP_ENV=%s)", settings.APP_ENV)


@app.get("/health", response_model=HealthResponse)
def health(db: Session = Depends(get_db)) -> HealthResponse:
    """Return API status, environment name, and database connectivity."""
    db_status: Literal["connected", "error"] = "error"
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:
        logger.warning("Database health check failed: %s", exc)
    return HealthResponse(env=settings.APP_ENV, db=db_status)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
