"""Application configuration loaded from environment variables via pydantic-settings."""

from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_ENV_FILE = _PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    """Runtime settings sourced from `.env` at the project root."""

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str
    REDIS_URL: str
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str
    GEMINI_API_KEY: str
    GEMINI_MODEL: str = "gemini-2.5-flash"
    CANDIDATE_NAME: str = "Vedant Goyal"
    GMAIL_CLIENT_ID: str
    GMAIL_CLIENT_SECRET: str
    GMAIL_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/gmail/callback"
    GMAIL_ACCESS_TOKEN: Optional[str] = None
    GMAIL_REFRESH_TOKEN: Optional[str] = None
    TWILIO_ACCOUNT_SID: str
    TWILIO_AUTH_TOKEN: str
    TWILIO_WHATSAPP_FROM: str
    TWILIO_WHATSAPP_TO: str
    APP_ENV: str
    SECRET_KEY: str
    DAILY_EMAIL_LIMIT: int = 60
    EMAIL_DELAY_MIN_SECONDS: int = 30
    EMAIL_DELAY_MAX_SECONDS: int = 90
    REPLY_CHECK_INTERVAL_SECONDS: int = 300
    RESUME_UPLOAD_DIR: str = "uploads/resumes"

    @property
    def is_development(self) -> bool:
        """True when `APP_ENV` indicates a local or dev deployment."""
        return self.APP_ENV.lower() in {"development", "dev"}


@lru_cache
def get_settings() -> Settings:
    """Return the cached Settings instance (singleton per process)."""
    return Settings()


settings: Settings = get_settings()
