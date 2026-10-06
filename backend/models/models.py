"""All SQLAlchemy ORM models for ReachIQ (single module per project conventions)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class Campaign(Base):
    """Outreach campaign grouping contacts and email jobs."""

    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    contacts: Mapped[list["Contact"]] = relationship(
        "Contact", back_populates="campaign", cascade="all, delete-orphan"
    )
    email_jobs: Mapped[list["EmailJob"]] = relationship(
        "EmailJob", back_populates="campaign", cascade="all, delete-orphan"
    )
    daily_send_logs: Mapped[list["DailySendLog"]] = relationship(
        "DailySendLog", back_populates="campaign", cascade="all, delete-orphan"
    )


class Contact(Base):
    """Recipient within a campaign."""

    __tablename__ = "contacts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="pending", index=True
    )
    reply_preview: Mapped[str | None] = mapped_column(Text, nullable=True)
    replied_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    gmail_thread_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    gmail_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="contacts")
    email_jobs: Mapped[list["EmailJob"]] = relationship(
        "EmailJob", back_populates="contact", cascade="all, delete-orphan"
    )


class EmailJob(Base):
    """Queued or processed email send for one contact."""

    __tablename__ = "email_jobs"
    __table_args__ = (
        Index("ix_email_jobs_campaign_id", "campaign_id"),
        Index("ix_email_jobs_status", "status"),
        Index("ix_email_jobs_gmail_thread_id", "gmail_thread_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contacts.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    gmail_thread_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="email_jobs")
    contact: Mapped["Contact"] = relationship("Contact", back_populates="email_jobs")


class DailySendLog(Base):
    """Tracks how many emails were sent per campaign per calendar day."""

    __tablename__ = "daily_send_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    log_date: Mapped[date] = mapped_column(Date, nullable=False)
    emails_sent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    campaign: Mapped["Campaign"] = relationship(
        "Campaign", back_populates="daily_send_logs"
    )


class GmailAuth(Base):
    """Stored Gmail OAuth credentials for the integration user."""

    __tablename__ = "gmail_auth"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    google_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expiry: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
