"""Email outcome routes (sent, replies, failed)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.models import Contact, EmailJob
from backend.schemas.schemas import (
    ContactListResponse,
    ContactResponse,
    FailedContactListResponse,
    FailedContactResponse,
    RepliedContactListResponse,
    RepliedContactResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/emails", tags=["emails"])


@router.get("/replies", response_model=RepliedContactListResponse)
def list_replies(db: Session = Depends(get_db)) -> RepliedContactListResponse:
    """Return all contacts that received a reply."""
    contacts = db.scalars(
        select(Contact)
        .where(Contact.status == "replied")
        .order_by(Contact.replied_at.desc())
    ).all()
    return RepliedContactListResponse(
        replies=[RepliedContactResponse.model_validate(c) for c in contacts]
    )


@router.get("/sent", response_model=ContactListResponse)
def list_sent_emails(db: Session = Depends(get_db)) -> ContactListResponse:
    """Return all contacts with sent outreach emails."""
    contacts = db.scalars(
        select(Contact)
        .where(Contact.status == "sent")
        .order_by(Contact.created_at.desc())
    ).all()
    return ContactListResponse(
        contacts=[ContactResponse.model_validate(c) for c in contacts]
    )


@router.get("/failed", response_model=FailedContactListResponse)
def list_failed_emails(db: Session = Depends(get_db)) -> FailedContactListResponse:
    """Return contacts whose latest email job failed or is dead."""
    rows = db.execute(
        select(Contact, EmailJob)
        .join(EmailJob, EmailJob.contact_id == Contact.id)
        .where(EmailJob.status.in_(("failed", "dead")))
        .order_by(EmailJob.created_at.desc())
    ).all()

    seen_contact_ids: set = set()
    failed: list[FailedContactResponse] = []
    for contact, job in rows:
        if contact.id in seen_contact_ids:
            continue
        seen_contact_ids.add(contact.id)
        failed.append(
            FailedContactResponse(
                id=contact.id,
                email=contact.email,
                full_name=contact.full_name,
                company=contact.company,
                job_status=job.status,
                retry_count=job.retry_count,
            )
        )

    logger.info("Listed %s failed/dead email jobs", len(failed))
    return FailedContactListResponse(failed=failed)
