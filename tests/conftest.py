"""Pytest fixtures for ReachIQ — no real network, broker, Redis, or Postgres."""

from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path

# Must set env BEFORE any backend import (Settings + engine bind at import time).
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_TEST_DB = _PROJECT_ROOT / ".pytest_reachiq.db"

os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["CELERY_BROKER_URL"] = "redis://localhost:6379/1"
os.environ["CELERY_RESULT_BACKEND"] = "redis://localhost:6379/2"
os.environ["GEMINI_API_KEY"] = "test-gemini-key"
os.environ["GEMINI_MODEL"] = "gemini-2.5-flash"
os.environ["CANDIDATE_NAME"] = "Test Candidate"
os.environ["GMAIL_CLIENT_ID"] = "test-client-id.apps.googleusercontent.com"
os.environ["GMAIL_CLIENT_SECRET"] = "test-client-secret"
os.environ["GMAIL_REDIRECT_URI"] = "http://localhost:8000/api/v1/auth/gmail/callback"
os.environ["TWILIO_ACCOUNT_SID"] = "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
os.environ["TWILIO_AUTH_TOKEN"] = "test-twilio-token"
os.environ["TWILIO_WHATSAPP_FROM"] = "whatsapp:+14155238886"
os.environ["TWILIO_WHATSAPP_TO"] = "whatsapp:+15555550123"
os.environ["APP_ENV"] = "test"
os.environ["SECRET_KEY"] = "test-secret-key-at-least-32-characters-long"

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from backend.core.config import get_settings

get_settings.cache_clear()

from backend import database as db_module
from backend.database import Base
from backend.models import models as _models  # noqa: F401 — register metadata

db_module.get_database_url.cache_clear()

_engine = create_engine(
    f"sqlite:///{_TEST_DB}",
    connect_args={"check_same_thread": False},
    poolclass=NullPool,
)


@event.listens_for(_engine, "connect")
def _set_sqlite_fk(dbapi_connection: object, _connection_record: object) -> None:
    """Enable SQLite foreign key enforcement for cascade deletes in tests."""
    cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


db_module.engine = _engine
db_module.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)

# Workers import SessionLocal by name — rebind after engine swap.
import backend.workers.email_worker as email_worker_mod
import backend.workers.reply_watcher as reply_watcher_mod

email_worker_mod.SessionLocal = db_module.SessionLocal
reply_watcher_mod.SessionLocal = db_module.SessionLocal


@pytest.fixture(autouse=True)
def db_session() -> Generator[Session, None, None]:
    """Drop and recreate all tables around each test; yield a bound session."""
    Base.metadata.drop_all(bind=_engine)
    Base.metadata.create_all(bind=_engine)
    session = db_module.SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=_engine)
