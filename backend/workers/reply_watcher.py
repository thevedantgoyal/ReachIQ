"""Celery Beat task that polls Gmail for replies to sent outreach emails."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select

from backend.database import SessionLocal
from backend.models.models import Contact
from backend.services import gmail_service, twilio_service
from backend.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="backend.workers.reply_watcher.check_all_replies")
def check_all_replies() -> dict[str, int]:
    """
    Poll Gmail for replies on sent contacts and notify the user via WhatsApp.

    Scheduled every 300 seconds by Celery Beat.
    """
    db = SessionLocal()
    replies_found = 0

    try:
        contacts = db.scalars(
            select(Contact).where(
                Contact.status == "sent",
                Contact.gmail_thread_id.isnot(None),
            )
        ).all()

        if not contacts:
            logger.info("No sent contacts with Gmail thread ids to check")
            return {"checked": 0, "replies": 0}

        thread_ids = [contact.gmail_thread_id for contact in contacts if contact.gmail_thread_id]
        reply_map = {
            item["thread_id"]: item
            for item in gmail_service.check_replies(thread_ids, db)
            if item.get("thread_id")
        }

        for contact in contacts:
            thread_id = contact.gmail_thread_id
            if not thread_id or thread_id not in reply_map:
                continue

            reply = reply_map[thread_id]
            preview = str(reply.get("reply_preview", ""))
            received_at = reply.get("received_at")
            if isinstance(received_at, datetime):
                contact.replied_at = received_at
            else:
                contact.replied_at = datetime.now(timezone.utc)

            contact.status = "replied"
            contact.reply_preview = preview
            db.commit()

            contact_name = contact.full_name or contact.email
            company = contact.company or "unknown company"
            try:
                twilio_service.notify_reply(contact_name, company, preview)
            except Exception as exc:
                logger.exception(
                    "Failed to send reply WhatsApp for contact %s: %s",
                    contact.id,
                    exc,
                )

            logger.info(
                "Reply detected for %s (thread_id=%s): %s",
                contact.email,
                thread_id,
                preview[:120],
            )
            replies_found += 1

        logger.info(
            "Reply watcher finished: checked=%s replies=%s",
            len(contacts),
            replies_found,
        )
        return {"checked": len(contacts), "replies": replies_found}

    except Exception as exc:
        db.rollback()
        logger.exception("Reply watcher failed: %s", exc)
        raise

    finally:
        db.close()
