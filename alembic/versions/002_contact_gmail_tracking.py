"""Add Gmail message/thread ids on contacts for reply tracking.

Revision ID: 002_contact_gmail
Revises: 001_initial
Create Date: 2026-05-13

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "002_contact_gmail"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "contacts",
        sa.Column("gmail_thread_id", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "contacts",
        sa.Column("gmail_message_id", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("contacts", "gmail_message_id")
    op.drop_column("contacts", "gmail_thread_id")
