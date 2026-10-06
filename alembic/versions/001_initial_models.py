"""initial_models

Revision ID: 001_initial
Revises:
Create Date: 2026-05-13

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default=sa.text("'draft'")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "gmail_auth",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("google_email", sa.String(length=320), nullable=True),
        sa.Column("access_token", sa.Text(), nullable=True),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("token_expiry", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_contacts_campaign_id"), "contacts", ["campaign_id"], unique=False)
    op.create_table(
        "daily_send_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("log_date", sa.Date(), nullable=False),
        sa.Column("emails_sent", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_daily_send_logs_campaign_id"),
        "daily_send_logs",
        ["campaign_id"],
        unique=False,
    )
    op.create_table(
        "email_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("gmail_thread_id", sa.String(length=255), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["contact_id"], ["contacts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_email_jobs_campaign_id", "email_jobs", ["campaign_id"], unique=False)
    op.create_index("ix_email_jobs_gmail_thread_id", "email_jobs", ["gmail_thread_id"], unique=False)
    op.create_index("ix_email_jobs_status", "email_jobs", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_email_jobs_status", table_name="email_jobs")
    op.drop_index("ix_email_jobs_gmail_thread_id", table_name="email_jobs")
    op.drop_index("ix_email_jobs_campaign_id", table_name="email_jobs")
    op.drop_table("email_jobs")
    op.drop_index(op.f("ix_daily_send_logs_campaign_id"), table_name="daily_send_logs")
    op.drop_table("daily_send_logs")
    op.drop_index(op.f("ix_contacts_campaign_id"), table_name="contacts")
    op.drop_table("contacts")
    op.drop_table("gmail_auth")
    op.drop_table("campaigns")
