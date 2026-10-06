"""Authentication and OAuth routes (Gmail)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from google.auth.exceptions import GoogleAuthError
from oauthlib.oauth2 import InvalidGrantError
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.models import GmailAuth
from backend.schemas.schemas import GmailConnectedResponse, GmailStatusResponse
from backend.services import gmail_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/gmail")
def gmail_oauth_start() -> RedirectResponse:
    """Redirect the browser to Google's Gmail OAuth consent screen."""
    try:
        url = gmail_service.get_auth_url()
    except Exception as exc:
        logger.exception("Failed to build Gmail OAuth URL: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not start Gmail OAuth flow.",
        ) from exc
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


@router.get("/gmail/callback", response_model=GmailConnectedResponse)
def gmail_oauth_callback(
    code: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> GmailConnectedResponse:
    """Handle Google's OAuth redirect and persist tokens (never returned to client)."""
    if error:
        parts = [f"Google OAuth error: {error}"]
        if error_description:
            parts.append(error_description)
        msg = " — ".join(parts)
        logger.warning("Gmail OAuth callback returned error query param: %s", msg)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg,
        )
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Missing authorization code. Start OAuth from GET /api/v1/auth/gmail "
                "and complete the Google consent screen; do not open the callback URL "
                "directly. After approval, Google redirects here with ?code=... appended."
            ),
        )
    try:
        result = gmail_service.exchange_code(code, db)
    except (GoogleAuthError, InvalidGrantError) as exc:
        logger.warning("Gmail OAuth token exchange failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gmail OAuth token exchange failed.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error during Gmail OAuth: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gmail OAuth failed.",
        ) from exc

    email = result.get("email", "")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gmail profile did not return an email address.",
        )
    return GmailConnectedResponse(status="connected", email=email)


@router.get("/gmail/status", response_model=GmailStatusResponse)
def gmail_connection_status(db: Session = Depends(get_db)) -> GmailStatusResponse:
    """Return whether Gmail OAuth tokens exist (no raw tokens exposed)."""
    row = db.scalars(select(GmailAuth).limit(1)).first()
    if row is None or not row.refresh_token:
        return GmailStatusResponse(connected=False, email=None)
    return GmailStatusResponse(connected=True, email=row.google_email)
