"""Tests for send_email_job audit persistence and pause deferral."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from celery.exceptions import Retry
from sqlalchemy.orm import Session

from backend.models.models import Campaign, Contact, EmailJob
from backend.services.gemini_service import AIParseError
from backend.workers.email_worker import send_email_job


def _seed_job(db: Session, resume_path: str) -> tuple[Campaign, Contact, EmailJob]:
    """Insert a campaign, pending contact, and pending email job."""
    campaign = Campaign(name="Test Campaign", status="running")
    db.add(campaign)
    db.flush()
    contact = Contact(
        campaign_id=campaign.id,
        email="recruiter@example.com",
        full_name="Alex Recruiter",
        company="ExampleCo",
        status="pending",
    )
    db.add(contact)
    db.flush()
    job = EmailJob(
        campaign_id=campaign.id,
        contact_id=contact.id,
        status="pending",
    )
    db.add(job)
    db.commit()
    return campaign, contact, job


@pytest.fixture
def resume_file(tmp_path: Path) -> str:
    """Create a temporary PDF path for Gmail attachment checks."""
    path = tmp_path / "resume.pdf"
    path.write_bytes(b"%PDF-1.4 test")
    return str(path)


@patch("backend.workers.email_worker.time.sleep", return_value=None)
@patch("backend.workers.email_worker.is_campaign_paused", return_value=False)
@patch("backend.workers.email_worker.gmail_service.send_email")
@patch("backend.workers.email_worker.gemini_service.generate_email")
def test_send_email_job_persists_prompt_and_latency_on_success(
    mock_generate: MagicMock,
    mock_send: MagicMock,
    _mock_paused: MagicMock,
    _mock_sleep: MagicMock,
    db_session: Session,
    resume_file: str,
) -> None:
    """Successful Gemini output is committed to the job before Gmail send."""
    campaign, contact, job = _seed_job(db_session, resume_file)
    mock_generate.return_value = {
        "subject": "Hi",
        "body": "Hello there",
        "prompt": "PROMPT_TEXT",
        "llm_latency_ms": 123,
    }
    mock_send.return_value = {"message_id": "m1", "thread_id": "t1"}

    result = send_email_job.run(str(contact.id), str(campaign.id), resume_file)

    db_session.refresh(job)
    assert result["thread_id"] == "t1"
    assert job.prompt == "PROMPT_TEXT"
    assert job.llm_latency_ms == 123
    assert job.status == "sent"
    assert job.failure_reason is None


@patch("backend.workers.email_worker.time.sleep", return_value=None)
@patch("backend.workers.email_worker.is_campaign_paused", return_value=False)
@patch("backend.workers.email_worker.gmail_service.send_email")
@patch("backend.workers.email_worker.gemini_service.generate_email")
def test_send_email_job_persists_failure_reason_on_ai_parse_error(
    mock_generate: MagicMock,
    mock_send: MagicMock,
    _mock_paused: MagicMock,
    _mock_sleep: MagicMock,
    db_session: Session,
    resume_file: str,
) -> None:
    """AIParseError writes failure_reason + prompt/latency before retry."""
    campaign, contact, job = _seed_job(db_session, resume_file)
    mock_generate.side_effect = AIParseError(prompt="BAD_PROMPT", latency_ms=45)

    with patch.object(send_email_job, "retry", side_effect=Retry()) as mock_retry:
        with pytest.raises(Retry):
            send_email_job.run(str(contact.id), str(campaign.id), resume_file)
        mock_retry.assert_called_once()

    db_session.expire_all()
    refreshed = db_session.get(EmailJob, job.id)
    assert refreshed is not None
    assert refreshed.prompt == "BAD_PROMPT"
    assert refreshed.llm_latency_ms == 45
    assert refreshed.failure_reason is not None
    assert "AIParseError" in refreshed.failure_reason
    assert "ai_parse_error" in refreshed.failure_reason
    mock_send.assert_not_called()


@patch("backend.workers.email_worker.time.sleep", return_value=None)
@patch("backend.workers.email_worker.is_campaign_paused", return_value=False)
@patch("backend.workers.email_worker.gmail_service.send_email")
@patch("backend.workers.email_worker.gemini_service.generate_email")
def test_send_email_job_persists_failure_reason_on_gmail_error(
    mock_generate: MagicMock,
    mock_send: MagicMock,
    _mock_paused: MagicMock,
    _mock_sleep: MagicMock,
    db_session: Session,
    resume_file: str,
) -> None:
    """Gmail failures persist failure_reason after rollback and before retry."""
    campaign, contact, job = _seed_job(db_session, resume_file)
    mock_generate.return_value = {
        "subject": "Hi",
        "body": "Body",
        "prompt": "PROMPT",
        "llm_latency_ms": 10,
    }
    mock_send.side_effect = ValueError("Gmail is not connected: missing GmailAuth credentials.")

    with patch.object(send_email_job, "retry", side_effect=Retry()) as mock_retry:
        # ValueError that is not ai_parse_error does not retry — it re-raises after mark failed
        with pytest.raises(ValueError, match="Gmail is not connected"):
            send_email_job.run(str(contact.id), str(campaign.id), resume_file)
        mock_retry.assert_not_called()

    db_session.expire_all()
    refreshed = db_session.get(EmailJob, job.id)
    assert refreshed is not None
    assert refreshed.failure_reason is not None
    assert "Gmail is not connected" in refreshed.failure_reason
    assert refreshed.status == "failed"


@patch("backend.workers.email_worker.time.sleep", return_value=None)
@patch("backend.workers.email_worker.gmail_service.send_email")
@patch("backend.workers.email_worker.gemini_service.generate_email")
@patch("backend.workers.email_worker.is_campaign_paused", return_value=True)
def test_send_email_job_defers_when_paused_at_start(
    _mock_paused: MagicMock,
    mock_generate: MagicMock,
    mock_send: MagicMock,
    _mock_sleep: MagicMock,
    db_session: Session,
    resume_file: str,
) -> None:
    """Paused at start defers via apply_async and never calls Gemini or Gmail."""
    campaign, contact, job = _seed_job(db_session, resume_file)

    with patch.object(send_email_job, "apply_async") as mock_apply:
        with patch.object(send_email_job, "retry") as mock_retry:
            result = send_email_job.run(str(contact.id), str(campaign.id), resume_file)

    assert result == {"status": "deferred_paused"}
    mock_apply.assert_called_once()
    assert mock_apply.call_args.kwargs["countdown"] == 300
    mock_retry.assert_not_called()
    mock_generate.assert_not_called()
    mock_send.assert_not_called()

    db_session.expire_all()
    refreshed = db_session.get(EmailJob, job.id)
    assert refreshed is not None
    assert refreshed.status == "pending"


@patch("backend.workers.email_worker.time.sleep", return_value=None)
@patch("backend.workers.email_worker.gmail_service.send_email")
@patch("backend.workers.email_worker.gemini_service.generate_email")
def test_send_email_job_defers_when_paused_after_sleep(
    mock_generate: MagicMock,
    mock_send: MagicMock,
    _mock_sleep: MagicMock,
    db_session: Session,
    resume_file: str,
) -> None:
    """Paused after sleep (before Gemini) defers without calling Gemini."""
    campaign, contact, job = _seed_job(db_session, resume_file)

    with patch(
        "backend.workers.email_worker.is_campaign_paused",
        side_effect=[False, True],
    ):
        with patch.object(send_email_job, "apply_async") as mock_apply:
            result = send_email_job.run(str(contact.id), str(campaign.id), resume_file)

    assert result == {"status": "deferred_paused"}
    mock_apply.assert_called_once()
    assert mock_apply.call_args.kwargs["countdown"] == 300
    mock_generate.assert_not_called()
    mock_send.assert_not_called()

    db_session.expire_all()
    refreshed = db_session.get(EmailJob, job.id)
    assert refreshed is not None
    assert refreshed.status == "pending"
