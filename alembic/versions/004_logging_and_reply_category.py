"""Add LLM audit fields on email_jobs and reply_category on contacts.

Revision ID: 004_logging_reply_cat
Revises: 003_contact_reply
Create Date: 2026-11-27

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "004_logging_reply_cat"
down_revision = "003_contact_reply"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add prompt/latency/failure_reason to email_jobs and reply_category to contacts."""
    op.add_column("email_jobs", sa.Column("prompt", sa.Text(), nullable=True))
    op.add_column(
        "email_jobs",
        sa.Column("llm_latency_ms", sa.Integer(), nullable=True),
    )
    op.add_column(
        "email_jobs",
        sa.Column("failure_reason", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "contacts",
        sa.Column("reply_category", sa.String(length=50), nullable=True),
    )


def downgrade() -> None:
    """Remove LLM audit and reply category columns."""
    op.drop_column("contacts", "reply_category")
    op.drop_column("email_jobs", "failure_reason")
    op.drop_column("email_jobs", "llm_latency_ms")
    op.drop_column("email_jobs", "prompt")
