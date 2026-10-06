"""Gmail OAuth and Gmail API helpers (send, reply detection)."""

from __future__ import annotations

import base64
import html
import logging
import mimetypes
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import parseaddr
from pathlib import Path
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.core.config import get_settings
from backend.models.models import Contact, GmailAuth

logger = logging.getLogger(__name__)

GMAIL_SCOPES: tuple[str, ...] = (
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
)


def _web_client_config() -> dict[str, Any]:
    """Build Google OAuth 'web' client config from application settings."""
    s = get_settings()
    return {
        "web": {
            "client_id": s.GMAIL_CLIENT_ID,
            "client_secret": s.GMAIL_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [s.GMAIL_REDIRECT_URI],
        }
    }


def _new_oauth_flow() -> Flow:
    """Construct an OAuth Flow with redirect URI from settings."""
    s = get_settings()
    flow = Flow.from_client_config(
        _web_client_config(),
        scopes=list(GMAIL_SCOPES),
        redirect_uri=s.GMAIL_REDIRECT_URI,
        autogenerate_code_verifier=False,
    )
    return flow


def get_auth_url() -> str:
    """Return the Google OAuth authorization URL for Gmail scopes."""
    flow = _new_oauth_flow()
    authorization_url, _state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return authorization_url


def _get_or_create_gmail_auth_row(db: Session) -> GmailAuth:
    """Return the single integration GmailAuth row, creating it if missing."""
    row = db.scalars(select(GmailAuth).limit(1)).first()
    if row is None:
        row = GmailAuth()
        db.add(row)
        db.flush()
    return row


def exchange_code(code: str, db: Session) -> dict[str, str]:
    """
    Exchange an OAuth authorization code for tokens, persist them on GmailAuth,
    and return token payload for internal use (do not send to HTTP clients).
    """
    flow = _new_oauth_flow()
    flow.fetch_token(code=code)
    creds: Credentials = flow.credentials

    service = build("gmail", "v1", credentials=creds, cache_discovery=False)
    profile = service.users().getProfile(userId="me").execute()
    email = str(profile.get("emailAddress", ""))

    row = _get_or_create_gmail_auth_row(db)
    row.google_email = email or row.google_email
    row.access_token = creds.token
    row.refresh_token = creds.refresh_token or row.refresh_token
    row.token_expiry = creds.expiry
    db.commit()
    db.refresh(row)

    return {
        "email": email,
        "access_token": creds.token or "",
        "refresh_token": creds.refresh_token or "",
    }


def get_credentials(db: Session) -> Credentials:
    """
    Load Google OAuth credentials from GmailAuth, refreshing the access token
    when expired and persisting the new access token silently.
    """
    s = get_settings()
    row = db.scalars(select(GmailAuth).limit(1)).first()
    if row is None or not row.refresh_token:
        raise ValueError("Gmail is not connected: missing GmailAuth credentials.")

    creds = Credentials(
        token=row.access_token,
        refresh_token=row.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=s.GMAIL_CLIENT_ID,
        client_secret=s.GMAIL_CLIENT_SECRET,
        scopes=list(GMAIL_SCOPES),
    )
    if row.token_expiry is not None:
        expiry = row.token_expiry
        if expiry.tzinfo is not None:
            creds.expiry = expiry.astimezone(timezone.utc).replace(tzinfo=None)
        else:
            creds.expiry = expiry

    if not creds.valid and creds.refresh_token:
        creds.refresh(Request())
        row.access_token = creds.token
        if creds.expiry is not None:
            row.token_expiry = (
                creds.expiry.replace(tzinfo=timezone.utc)
                if creds.expiry.tzinfo is None
                else creds.expiry
            )
        db.commit()
        db.refresh(row)

    return creds


def send_email(
    to_email: str,
    subject: str,
    body: str,
    resume_path: str,
    db: Session,
) -> dict[str, str]:
    """
    Send a multipart plain/HTML email with a PDF resume attachment via Gmail API.
    Updates the matching Contact row with Gmail message and thread ids for reply tracking.
    """
    creds = get_credentials(db)
    service = build("gmail", "v1", credentials=creds, cache_discovery=False)

    path = Path(resume_path)
    if not path.is_file():
        raise FileNotFoundError(f"Resume file not found: {resume_path}")

    pdf_bytes = path.read_bytes()
    filename = path.name or "resume.pdf"
    mime_type, _ = mimetypes.guess_type(filename)
    if mime_type != "application/pdf":
        filename = f"{path.stem}.pdf"

    msg = EmailMessage()
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body, subtype="plain", charset="utf-8")
    html_body = (
        "<html><body><pre>"
        f"{html.escape(body)}</pre></body></html>"
    )
    msg.add_alternative(html_body, subtype="html", charset="utf-8")
    msg.add_attachment(
        pdf_bytes,
        maintype="application",
        subtype="pdf",
        filename=filename,
    )

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
    sent = (
        service.users()
        .messages()
        .send(userId="me", body={"raw": raw})
        .execute()
    )
    message_id = str(sent.get("id", ""))
    thread_id = str(sent.get("threadId", ""))

    contact = db.scalars(
        select(Contact)
        .where(Contact.email == to_email)
        .order_by(Contact.created_at.desc())
        .limit(1)
    ).first()
    if contact is not None:
        contact.gmail_thread_id = thread_id or contact.gmail_thread_id
        contact.gmail_message_id = message_id or contact.gmail_message_id
        db.commit()

    return {"message_id": message_id, "thread_id": thread_id}


def _header_value(headers: list[dict[str, str]], name: str) -> str | None:
    """Return the first header value matching name (case-insensitive)."""
    lower = name.lower()
    for h in headers:
        if str(h.get("name", "")).lower() == lower:
            return str(h.get("value", ""))
    return None


def _parse_internal_date_ms(internal_date: str | None) -> datetime | None:
    """Convert Gmail internalDate string (epoch ms) to timezone-aware datetime."""
    if not internal_date:
        return None
    try:
        ms = int(internal_date)
        return datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc)
    except (TypeError, ValueError):
        return None


def check_replies(thread_ids: list[str], db: Session) -> list[dict[str, Any]]:
    """
    Inspect Gmail threads for the latest inbound message not sent from the
    connected account, and return lightweight reply summaries.
    """
    if not thread_ids:
        return []

    creds = get_credentials(db)
    service = build("gmail", "v1", credentials=creds, cache_discovery=False)

    row = db.scalars(select(GmailAuth).limit(1)).first()
    google_email = (row.google_email or "").lower()
    if not google_email:
        prof = service.users().getProfile(userId="me").execute()
        google_email = str(prof.get("emailAddress", "")).lower()

    results: list[dict[str, Any]] = []
    for thread_id in thread_ids:
        if not thread_id:
            continue
        try:
            thread = (
                service.users()
                .threads()
                .get(userId="me", id=thread_id, format="full")
                .execute()
            )
        except Exception as exc:
            logger.warning("Failed to load Gmail thread %s: %s", thread_id, exc)
            continue

        messages = thread.get("messages") or []
        latest_inbound: dict[str, Any] | None = None
        for m in sorted(messages, key=lambda x: int(x.get("internalDate", "0"))):
            mid = m.get("id")
            if not mid:
                continue
            full = (
                service.users()
                .messages()
                .get(userId="me", id=str(mid), format="metadata", metadataHeaders=["From", "Subject"])
                .execute()
            )
            headers = full.get("payload", {}).get("headers") or []
            from_raw = _header_value(headers, "From") or ""
            _, addr = parseaddr(from_raw)
            addr_lower = addr.lower()
            if addr_lower and addr_lower != google_email:
                snippet = str(full.get("snippet", ""))
                received_at = _parse_internal_date_ms(str(m.get("internalDate", "")))
                latest_inbound = {
                    "thread_id": thread_id,
                    "reply_from": from_raw,
                    "reply_preview": snippet,
                    "received_at": received_at,
                }

        if latest_inbound is not None:
            results.append(latest_inbound)

    return results
