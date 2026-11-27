"""Tests for reply detection, bounce handling, and category WhatsApp alerts."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from sqlalchemy.orm import Session

from backend.models.models import Campaign, Contact
from backend.services.gemini_service import ReplyCategory
from backend.workers.reply_watcher import check_all_replies


def _seed_sent_contact(db: Session, *, thread_id: str = "thread-1") -> Contact:
    """Insert a sent contact with a Gmail thread id."""
    campaign = Campaign(name="Reply Campaign", status="running")
    db.add(campaign)
    db.flush()
    contact = Contact(
        campaign_id=campaign.id,
        email="hire@company.com",
        full_name="Sam Hiring",
        company="Company Inc",
        status="sent",
        gmail_thread_id=thread_id,
    )
    db.add(contact)
    db.commit()
    return contact


@patch("backend.workers.reply_watcher.twilio_service.notify_reply")
@patch("backend.workers.reply_watcher.gmail_service.check_replies")
def test_reply_watcher_marks_bounce_without_whatsapp(
    mock_check: MagicMock,
    mock_notify: MagicMock,
    db_session: Session,
) -> None:
    """mailer-daemon senders are marked bounced with no WhatsApp notification."""
    contact = _seed_sent_contact(db_session)
    mock_check.return_value = [
        {
            "thread_id": contact.gmail_thread_id,
            "from_address": "mailer-daemon@google.com",
            "auto_submitted": None,
            "reply_preview": "Delivery Status Notification",
            "received_at": datetime.now(timezone.utc),
        }
    ]

    result = check_all_replies()

    db_session.expire_all()
    refreshed = db_session.get(Contact, contact.id)
    assert refreshed is not None
    assert refreshed.status == "bounced"
    assert result["bounced"] == 1
    assert result["replies"] == 0
    mock_notify.assert_not_called()


@patch("backend.workers.reply_watcher.twilio_service.notify_reply")
@patch("backend.workers.reply_watcher.gemini_service.classify_reply")
@patch("backend.workers.reply_watcher.gmail_service.check_replies")
def test_reply_watcher_stores_category_and_notifies_with_it(
    mock_check: MagicMock,
    mock_classify: MagicMock,
    mock_notify: MagicMock,
    db_session: Session,
) -> None:
    """Human replies are categorized, stored, and included in WhatsApp notify."""
    contact = _seed_sent_contact(db_session)
    mock_check.return_value = [
        {
            "thread_id": contact.gmail_thread_id,
            "from_address": "hire@company.com",
            "auto_submitted": None,
            "reply_preview": "We would love to interview you.",
            "received_at": datetime.now(timezone.utc),
        }
    ]
    mock_classify.return_value = ReplyCategory.interested

    result = check_all_replies()

    db_session.expire_all()
    refreshed = db_session.get(Contact, contact.id)
    assert refreshed is not None
    assert refreshed.status == "replied"
    assert refreshed.reply_category == "interested"
    assert result["replies"] == 1
    mock_notify.assert_called_once()
    args = mock_notify.call_args.args
    assert args[0] == "Sam Hiring"
    assert args[1] == "Company Inc"
    assert args[2] == "We would love to interview you."
    assert args[3] == "interested"
