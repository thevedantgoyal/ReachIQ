"""Contact management routes (CSV upload, list, delete)."""

from __future__ import annotations

import csv
import io
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.models import Campaign, Contact
from backend.schemas.schemas import (
    ContactDeleteResponse,
    ContactListResponse,
    ContactResponse,
    ContactUploadResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/contacts", tags=["contacts"])

_CSV_NAME_KEYS = frozenset({"name", "full_name", "fullname"})
_CSV_EMAIL_KEYS = frozenset({"email", "e-mail"})
_CSV_COMPANY_KEYS = frozenset({"company", "organization", "org"})


def _normalize_header(value: str) -> str:
    """Normalize a CSV header for column matching."""
    return value.strip().lower().replace(" ", "_")


def _row_value(row: dict[str, str], keys: frozenset[str]) -> str:
    """Return the first matching column value from a CSV row."""
    for key, val in row.items():
        if _normalize_header(key) in keys:
            return val.strip()
    return ""


def _parse_csv_contacts(raw: bytes) -> list[tuple[str, str, str]]:
    """
    Parse CSV bytes into (name, email, company) tuples.

    Raises ValueError when the file is empty or missing required columns.
    """
    text = raw.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise ValueError("CSV file has no header row.")

    normalized_fields = {_normalize_header(f) for f in reader.fieldnames}
    if not normalized_fields & _CSV_EMAIL_KEYS:
        raise ValueError("CSV must include an 'email' column.")

    rows: list[tuple[str, str, str]] = []
    for line in reader:
        if not any(str(v).strip() for v in line.values()):
            continue
        name = _row_value(line, _CSV_NAME_KEYS)
        email = _row_value(line, _CSV_EMAIL_KEYS).lower()
        company = _row_value(line, _CSV_COMPANY_KEYS)
        if not email:
            continue
        rows.append((name, email, company))
    return rows


@router.post("/upload", response_model=ContactUploadResponse)
async def upload_contacts_csv(
    file: UploadFile,
    db: Session = Depends(get_db),
) -> ContactUploadResponse:
    """Upload a CSV of contacts (columns: name, email, company) and save as pending."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Upload must be a .csv file.",
        )

    raw = await file.read()
    if not raw.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="CSV file is empty.",
        )

    try:
        parsed_rows = _parse_csv_contacts(raw)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    if not parsed_rows:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No valid contact rows found in CSV.",
        )

    campaign = Campaign(
        name=f"CSV upload {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        status="draft",
    )
    db.add(campaign)
    db.flush()

    existing_emails = set(
        db.scalars(
            select(func.lower(Contact.email))
        ).all()
    )

    uploaded = 0
    skipped = 0
    for name, email, company in parsed_rows:
        if email in existing_emails:
            skipped += 1
            continue
        db.add(
            Contact(
                campaign_id=campaign.id,
                email=email,
                full_name=name or None,
                company=company or None,
                status="pending",
            )
        )
        existing_emails.add(email)
        uploaded += 1

    db.commit()
    logger.info(
        "CSV upload complete: uploaded=%s skipped=%s campaign_id=%s",
        uploaded,
        skipped,
        campaign.id,
    )
    return ContactUploadResponse(uploaded=uploaded, skipped=skipped)


@router.get("", response_model=ContactListResponse)
def list_contacts(db: Session = Depends(get_db)) -> ContactListResponse:
    """Return all contacts with their current status."""
    contacts = db.scalars(
        select(Contact).order_by(Contact.created_at.desc())
    ).all()
    return ContactListResponse(
        contacts=[ContactResponse.model_validate(c) for c in contacts]
    )


@router.delete("/{contact_id}", response_model=ContactDeleteResponse)
def delete_contact(
    contact_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> ContactDeleteResponse:
    """Delete a contact by ID."""
    contact = db.get(Contact, contact_id)
    if contact is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact not found: {contact_id}",
        )
    db.delete(contact)
    db.commit()
    logger.info("Deleted contact %s", contact_id)
    return ContactDeleteResponse(contact_id=contact_id)
