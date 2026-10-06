"""Add contact status, company, and reply tracking fields.

Revision ID: 003_contact_reply
Revises: 002_contact_gmail
Create Date: 2026-06-01

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "003_contact_reply"
down_revision = "002_contact_gmail"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "contacts",
        sa.Column("company", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "contacts",
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
    )
    op.add_column(
        "contacts",
        sa.Column("reply_preview", sa.Text(), nullable=True),
    )
    op.add_column(
        "contacts",
        sa.Column("replied_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_contacts_status", "contacts", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_contacts_status", table_name="contacts")
    op.drop_column("contacts", "replied_at")
    op.drop_column("contacts", "reply_preview")
    op.drop_column("contacts", "status")
    op.drop_column("contacts", "company")
