"""SQLAlchemy engine, session factory, and declarative base for ReachIQ."""

from __future__ import annotations

import os
from collections.abc import Generator
from functools import lru_cache
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

Base = declarative_base()


@lru_cache(maxsize=1)
def get_database_url() -> str:
    """
    Return the Postgres connection URL without importing full Settings.

    This keeps Alembic and other tooling able to connect when only DATABASE_URL
    is present in the environment or .env, even if other app secrets are missing.
    """
    url = os.environ.get("DATABASE_URL", "").strip()
    if url:
        return url
    project_root = Path(__file__).resolve().parents[1]
    env_path = project_root / ".env"
    if env_path.is_file():
        for raw in env_path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            if key.strip() == "DATABASE_URL":
                return val.strip().strip('"').strip("'")
    raise RuntimeError(
        "DATABASE_URL is not set. Add it to your environment or .env at the project root."
    )


engine = create_engine(get_database_url(), pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Yield a database session for FastAPI dependency injection."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables() -> None:
    """Create all tables from ORM metadata (bootstrap / local dev only; use Alembic in prod)."""
    import backend.models.models  # noqa: F401 — register models on Base.metadata

    Base.metadata.create_all(bind=engine)
