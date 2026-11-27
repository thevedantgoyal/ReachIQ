"""Celery Beat task that polls Gmail for replies to sent outreach emails."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select

from backend.database import SessionLocal
from backend.models.models import Contact
from backend.services import gemini_service, gmail_service, twilio_service
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
    bounced_found = 0

    try:
        contacts = db.scalars(
            select(Contact).where(
                Contact.status == "sent",
                Contact.gmail_thread_id.isnot(None),
            )
        ).all()

        if not contacts:
            logger.info("No sent contacts with Gmail thread ids to check")
            return {"checked": 0, "replies": 0, "bounced": 0}

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
            from_address = str(reply.get("from_address") or "").lower()
            if from_address.startswith("mailer-daemon@") or from_address.startswith(
                "postmaster@"
            ):
                contact.status = "bounced"
                db.commit()
                bounced_found += 1
                logger.info(
                    "Bounce detected for %s (thread_id=%s from=%s)",
                    contact.email,
                    thread_id,
                    from_address,
                )
                continue

            preview = str(reply.get("reply_preview", ""))
            received_at = reply.get("received_at")
            if isinstance(received_at, datetime):
                contact.replied_at = received_at
            else:
                contact.replied_at = datetime.now(timezone.utc)

            contact.status = "replied"
            contact.reply_preview = preview
            db.commit()

            auto_submitted = reply.get("auto_submitted")
            auto_value = str(auto_submitted) if auto_submitted is not None else None
            try:
                category = gemini_service.classify_reply(preview, auto_value)
                contact.reply_category = category.value
                db.commit()
            except Exception as exc:
                logger.warning(
                    "Classification failed for contact %s; leaving reply recorded: %s",
                    contact.id,
                    exc,
                )
                contact.reply_category = gemini_service.ReplyCategory.other.value
                db.commit()

            contact_name = contact.full_name or contact.email
            company = contact.company or "unknown company"
            category_label = contact.reply_category or "other"
            try:
                twilio_service.notify_reply(
                    contact_name, company, preview, category_label
                )
            except Exception as exc:
                logger.exception(
                    "Failed to send reply WhatsApp for contact %s: %s",
                    contact.id,
                    exc,
                )

            logger.info(
                "Reply detected for %s (thread_id=%s category=%s): %s",
                contact.email,
                thread_id,
                category_label,
                preview[:120],
            )
            replies_found += 1

        logger.info(
            "Reply watcher finished: checked=%s replies=%s bounced=%s",
            len(contacts),
            replies_found,
            bounced_found,
        )
        return {
            "checked": len(contacts),
            "replies": replies_found,
            "bounced": bounced_found,
        }

    except Exception as exc:
        db.rollback()
        logger.exception("Reply watcher failed: %s", exc)
        raise

    finally:
        db.close()
