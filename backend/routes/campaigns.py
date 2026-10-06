"""Campaign control routes (start, pause, resume, status)."""

from __future__ import annotations

import logging
import uuid
from datetime import date
from pathlib import Path

import redis

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.core.config import get_settings
from backend.database import get_db
from backend.models.models import Campaign, Contact, DailySendLog, EmailJob
from backend.schemas.schemas import (
    CampaignActionResponse,
    CampaignStartRequest,
    CampaignStartResponse,
    CampaignStatusResponse,
)
from backend.workers.email_worker import send_email_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

CAMPAIGN_PAUSED_KEY = "campaign:paused"


def _redis_client() -> redis.Redis:
    """Return a Redis client using application settings."""
    settings = get_settings()
    return redis.from_url(settings.REDIS_URL, decode_responses=True)


@router.post("/start", response_model=CampaignStartResponse)
def start_campaign(
    body: CampaignStartRequest,
    db: Session = Depends(get_db),
) -> CampaignStartResponse:
    """
    Queue Celery send jobs for pending contacts up to ``batch_size``.

    Creates a campaign, email jobs, and dispatches ``send_email_job`` tasks.
    """
    resume_path = Path(body.resume_path)
    if not resume_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Resume file not found: {body.resume_path}",
        )

    pending_contacts = db.scalars(
        select(Contact)
        .where(Contact.status == "pending")
        .order_by(Contact.created_at.asc())
        .limit(body.batch_size)
    ).all()

    if not pending_contacts:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending contacts available to queue.",
        )

    campaign = Campaign(
        name=f"Outreach {uuid.uuid4().hex[:8]}",
        status="running",
    )
    db.add(campaign)
    db.flush()

    queued = 0
    for contact in pending_contacts:
        job = EmailJob(
            campaign_id=campaign.id,
            contact_id=contact.id,
            status="pending",
        )
        db.add(job)
        db.flush()
        send_email_job.delay(
            str(contact.id),
            str(campaign.id),
            str(resume_path),
        )
        queued += 1

    db.commit()
    logger.info(
        "Campaign started: campaign_id=%s queued=%s resume=%s",
        campaign.id,
        queued,
        resume_path,
    )
    return CampaignStartResponse(queued=queued, campaign_id=str(campaign.id))


@router.post("/pause", response_model=CampaignActionResponse)
def pause_campaign() -> CampaignActionResponse:
    """Set Redis flag to pause new campaign sends."""
    client = _redis_client()
    client.set(CAMPAIGN_PAUSED_KEY, "1")
    logger.info("Campaign paused via Redis key %s", CAMPAIGN_PAUSED_KEY)
    return CampaignActionResponse(status="paused")


@router.post("/resume", response_model=CampaignActionResponse)
def resume_campaign() -> CampaignActionResponse:
    """Clear Redis pause flag."""
    client = _redis_client()
    client.delete(CAMPAIGN_PAUSED_KEY)
    logger.info("Campaign resumed; deleted Redis key %s", CAMPAIGN_PAUSED_KEY)
    return CampaignActionResponse(status="resumed")


@router.get("/status", response_model=CampaignStatusResponse)
def campaign_status(db: Session = Depends(get_db)) -> CampaignStatusResponse:
    """Return aggregate counts for the outreach pipeline."""
    pending = db.scalar(
        select(func.count()).select_from(Contact).where(Contact.status == "pending")
    ) or 0
    sent = db.scalar(
        select(func.count()).select_from(Contact).where(Contact.status == "sent")
    ) or 0
    replied = db.scalar(
        select(func.count()).select_from(Contact).where(Contact.status == "replied")
    ) or 0
    processing = db.scalar(
        select(func.count()).select_from(EmailJob).where(EmailJob.status == "processing")
    ) or 0
    failed = db.scalar(
        select(func.count()).select_from(EmailJob).where(EmailJob.status == "failed")
    ) or 0
    dead = db.scalar(
        select(func.count()).select_from(EmailJob).where(EmailJob.status == "dead")
    ) or 0
    sent_today = db.scalar(
        select(func.coalesce(func.sum(DailySendLog.emails_sent), 0)).where(
            DailySendLog.log_date == date.today()
        )
    ) or 0

    return CampaignStatusResponse(
        pending=pending,
        processing=processing,
        sent=sent,
        replied=replied,
        failed=failed,
        dead=dead,
        sent_today=int(sent_today),
    )
