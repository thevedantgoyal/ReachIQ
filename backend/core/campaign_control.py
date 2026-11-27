"""Shared Redis campaign pause flag helpers for API routes and Celery workers."""

from __future__ import annotations

import logging

import redis

from backend.core.config import get_settings

logger = logging.getLogger(__name__)

CAMPAIGN_PAUSED_KEY = "campaign:paused"


def is_campaign_paused() -> bool:
    """
    Return True when the Redis pause flag is set.

    On Redis errors, log a warning and treat the campaign as not paused.
    """
    settings = get_settings()
    try:
        client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        return bool(client.exists(CAMPAIGN_PAUSED_KEY))
    except Exception as exc:
        logger.warning("Failed to read campaign pause flag from Redis: %s", exc)
        return False
