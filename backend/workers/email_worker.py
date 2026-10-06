"""Celery task that generates, sends, and tracks a single outreach email."""

from __future__ import annotations

import logging
import random
import time
import uuid
from datetime import date, datetime, timezone

from celery.exceptions import Retry
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.core.config import get_settings
from backend.database import SessionLocal
from backend.models.models import Campaign, Contact, DailySendLog, EmailJob
from backend.services import gemini_service, gmail_service, twilio_service
from backend.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

MAX_JOB_ATTEMPTS = 3
DAILY_LIMIT_RETRY_SECONDS = 3600


def _parse_uuid(value: str, label: str) -> uuid.UUID:
    """Parse a UUID string for Celery task arguments."""
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid {label}: {value}") from exc


def _get_email_job(
    db: Session, contact_id: uuid.UUID, campaign_id: uuid.UUID
) -> EmailJob | None:
    """Return the latest email job for a contact within a campaign."""
    return db.scalars(
        select(EmailJob)
        .where(
            EmailJob.contact_id == contact_id,
            EmailJob.campaign_id == campaign_id,
        )
        .order_by(EmailJob.created_at.desc())
        .limit(1)
    ).first()


def _utc_today() -> date:
    """Return the current UTC calendar date for daily send log lookups."""
    return datetime.now(timezone.utc).date()


def _get_today_send_count(db: Session, campaign_id: uuid.UUID) -> int:
    """Return how many emails were sent for a campaign on the current UTC date."""
    today = _utc_today()
    log = db.scalars(
        select(DailySendLog).where(
            DailySendLog.campaign_id == campaign_id,
            DailySendLog.log_date == today,
        )
    ).first()
    return log.emails_sent if log is not None else 0


def _increment_daily_send_log(db: Session, campaign_id: uuid.UUID) -> None:
    """Increment or create the daily send counter for a campaign."""
    today = _utc_today()
    log = db.scalars(
        select(DailySendLog).where(
            DailySendLog.campaign_id == campaign_id,
            DailySendLog.log_date == today,
        )
    ).first()
    if log is None:
        log = DailySendLog(
            campaign_id=campaign_id,
            log_date=today,
            emails_sent=1,
        )
        db.add(log)
    else:
        log.emails_sent += 1


def _resolve_company(contact: Contact, campaign: Campaign | None) -> str:
    """Return the company name for personalization."""
    if contact.company and contact.company.strip():
        return contact.company.strip()
    if campaign is not None and campaign.name.strip():
        return campaign.name.strip()
    return "your company"


def _mark_job_dead(db: Session, job: EmailJob, contact: Contact) -> None:
    """Mark a job as dead and notify the user via WhatsApp."""
    job.status = "dead"
    db.commit()
    try:
        twilio_service.notify_dead_job(contact.email)
    except Exception as exc:
        logger.exception("Failed to send dead-job WhatsApp alert: %s", exc)


@celery_app.task(bind=True, max_retries=3, name="backend.workers.email_worker.send_email_job")
def send_email_job(self, contact_id: str, campaign_id: str, resume_path: str) -> dict[str, str]:
    """
    Generate and send one outreach email for a contact.

    Celery passes UUID primary keys as strings because the task serializer is JSON.
    """
    settings = get_settings()
    db = SessionLocal()
    job: EmailJob | None = None
    contact: Contact | None = None

    try:
        parsed_contact_id = _parse_uuid(contact_id, "contact_id")
        parsed_campaign_id = _parse_uuid(campaign_id, "campaign_id")

        contact = db.get(Contact, parsed_contact_id)
        if contact is None:
            raise ValueError(f"Contact not found: {contact_id}")

        campaign = db.get(Campaign, parsed_campaign_id)
        if campaign is None:
            raise ValueError(f"Campaign not found: {campaign_id}")

        job = _get_email_job(db, parsed_contact_id, parsed_campaign_id)
        if job is None:
            raise ValueError(
                f"No email job for contact={contact_id} campaign={campaign_id}"
            )

        job.status = "processing"
        db.commit()

        sent_today = _get_today_send_count(db, parsed_campaign_id)
        if sent_today >= settings.DAILY_EMAIL_LIMIT:
            logger.info(
                "Daily email limit reached for campaign %s (%s/%s)",
                parsed_campaign_id,
                sent_today,
                settings.DAILY_EMAIL_LIMIT,
            )
            job.status = "pending"
            db.commit()
            raise self.retry(countdown=DAILY_LIMIT_RETRY_SECONDS)

        delay_seconds = random.randint(
            settings.EMAIL_DELAY_MIN_SECONDS,
            settings.EMAIL_DELAY_MAX_SECONDS,
        )
        logger.info(
            "Waiting %s seconds before sending to %s",
            delay_seconds,
            contact.email,
        )
        time.sleep(delay_seconds)

        recipient_name = contact.full_name or contact.email
        company = _resolve_company(contact, campaign)
        email_content = gemini_service.generate_email(recipient_name, company)

        send_result = gmail_service.send_email(
            to_email=contact.email,
            subject=email_content["subject"],
            body=email_content["body"],
            resume_path=resume_path,
            db=db,
        )

        contact.gmail_thread_id = send_result.get("thread_id") or contact.gmail_thread_id
        contact.gmail_message_id = send_result.get("message_id") or contact.gmail_message_id
        contact.status = "sent"

        job.gmail_thread_id = contact.gmail_thread_id
        job.status = "sent"
        _increment_daily_send_log(db, parsed_campaign_id)
        db.commit()

        logger.info(
            "Email sent to %s (thread_id=%s)",
            contact.email,
            contact.gmail_thread_id,
        )
        return send_result

    except Retry:
        raise

    except ValueError as exc:
        db.rollback()
        if str(exc) == "ai_parse_error" and job is not None and contact is not None:
            logger.warning("AI parse error for contact %s", contact_id)
            job.retry_count += 1
            if job.retry_count >= MAX_JOB_ATTEMPTS:
                _mark_job_dead(db, job, contact)
                return {"status": "dead", "reason": "ai_parse_error"}
            job.status = "failed"
            db.commit()
            raise self.retry(
                countdown=60 * (2 ** self.request.retries),
                exc=exc,
            ) from exc
        logger.exception("Validation error in send_email_job: %s", exc)
        if job is not None:
            job.status = "failed"
            db.commit()
        raise

    except Exception as exc:
        db.rollback()
        if job is not None and contact is not None:
            job.retry_count += 1
            if job.retry_count >= MAX_JOB_ATTEMPTS:
                _mark_job_dead(db, job, contact)
                return {"status": "dead", "reason": str(exc)}
            job.status = "failed"
            db.commit()
            logger.warning(
                "Email job failed for %s (attempt %s/%s): %s",
                contact.email,
                job.retry_count,
                MAX_JOB_ATTEMPTS,
                exc,
            )
            raise self.retry(
                countdown=60 * (2 ** self.request.retries),
                exc=exc,
            ) from exc

        logger.exception("Unexpected error in send_email_job: %s", exc)
        raise

    finally:
        db.close()
