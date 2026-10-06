"""Twilio WhatsApp notifications for ReachIQ outreach events."""

from __future__ import annotations

import logging

from twilio.base.exceptions import TwilioException
from twilio.rest import Client

from backend.core.config import get_settings

logger = logging.getLogger(__name__)


def _send_whatsapp(body: str) -> None:
    """Send a WhatsApp message using configured Twilio credentials."""
    settings = get_settings()
    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    try:
        client.messages.create(
            body=body,
            from_=settings.TWILIO_WHATSAPP_FROM,
            to=settings.TWILIO_WHATSAPP_TO,
        )
    except TwilioException as exc:
        logger.exception("Twilio WhatsApp send failed: %s", exc)
        raise


def notify_reply(contact_name: str, company: str, preview: str) -> None:
    """Notify the user that a contact replied to an outreach email."""
    name = contact_name.strip() or "A contact"
    org = company.strip() or "unknown company"
    snippet = preview.strip() or "(no preview)"
    body = (
        f"ReachIQ: New reply from {name} at {org}.\n"
        f"Preview: {snippet[:500]}"
    )
    _send_whatsapp(body)
    logger.info("WhatsApp reply notification sent for %s at %s", name, org)


def notify_dead_job(contact_email: str) -> None:
    """Alert the user that an email job exhausted all retry attempts."""
    email = contact_email.strip() or "unknown recipient"
    body = (
        f"ReachIQ: Email job marked DEAD after 3 failed attempts.\n"
        f"Contact: {email}"
    )
    _send_whatsapp(body)
    logger.info("WhatsApp dead-job notification sent for %s", email)


def notify_campaign_complete(sent: int, failed: int) -> None:
    """Send a WhatsApp summary when a campaign finishes processing."""
    body = (
        "ReachIQ: Campaign complete.\n"
        f"Sent: {sent}\n"
        f"Failed: {failed}"
    )
    _send_whatsapp(body)
    logger.info("WhatsApp campaign-complete notification sent (sent=%s failed=%s)", sent, failed)


def notify_daily_summary(sent: int, replies: int, pending: int) -> None:
    """Send a morning digest of outreach activity."""
    body = (
        "ReachIQ: Daily summary.\n"
        f"Sent today: {sent}\n"
        f"Replies today: {replies}\n"
        f"Pending jobs: {pending}"
    )
    _send_whatsapp(body)
    logger.info(
        "WhatsApp daily summary sent (sent=%s replies=%s pending=%s)",
        sent,
        replies,
        pending,
    )
