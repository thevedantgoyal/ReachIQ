"""All Pydantic API schemas (single module per project conventions)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class GmailConnectedResponse(BaseModel):
    """Returned after successful Gmail OAuth callback (no tokens exposed)."""

    status: str = Field(default="connected", description="OAuth completion status")
    email: str = Field(description="Connected Google account email address")


class GmailStatusResponse(BaseModel):
    """Gmail connection status for the integration account."""

    connected: bool
    email: str | None = None


class ContactResponse(BaseModel):
    """Single contact row exposed via the API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    campaign_id: UUID
    email: str
    full_name: str | None = None
    company: str | None = None
    status: str
    reply_preview: str | None = None
    replied_at: datetime | None = None
    created_at: datetime


class ContactListResponse(BaseModel):
    """List of all contacts."""

    contacts: list[ContactResponse]


class ContactUploadResponse(BaseModel):
    """Result of a CSV contact upload."""

    uploaded: int
    skipped: int


class ResumeUploadResponse(BaseModel):
    """Result of a resume PDF upload."""

    resume_path: str
    filename: str


class ContactDeleteResponse(BaseModel):
    """Confirmation of contact deletion."""

    status: str = Field(default="deleted")
    contact_id: UUID


class CampaignStartRequest(BaseModel):
    """Payload to queue outreach emails for pending contacts."""

    resume_path: str
    batch_size: int = Field(default=50, ge=1, le=500)


class CampaignStartResponse(BaseModel):
    """Result of starting a campaign batch."""

    queued: int
    campaign_id: str


class CampaignActionResponse(BaseModel):
    """Result of pause or resume campaign controls."""

    status: str


class CampaignStatusResponse(BaseModel):
    """Aggregate outreach pipeline counts."""

    pending: int
    processing: int
    sent: int
    replied: int
    failed: int
    dead: int
    sent_today: int = 0


class RepliedContactResponse(BaseModel):
    """Contact that received a reply, with preview metadata."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str | None = None
    company: str | None = None
    reply_preview: str | None = None
    replied_at: datetime | None = None


class RepliedContactListResponse(BaseModel):
    """List of contacts with replies."""

    replies: list[RepliedContactResponse]


class FailedContactResponse(BaseModel):
    """Contact whose email job failed or is dead."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str | None = None
    company: str | None = None
    job_status: str
    retry_count: int


class FailedContactListResponse(BaseModel):
    """List of failed or dead email jobs."""

    failed: list[FailedContactResponse]
