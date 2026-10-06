"""Google Gemini integration for personalized outreach email generation."""

from __future__ import annotations

import json
import logging
from typing import Any

from google import genai
from google.genai.errors import ClientError

from backend.core.config import get_settings

logger = logging.getLogger(__name__)


def _build_prompt(name: str, company: str, candidate_name: str) -> str:
    """Build the Gemini prompt for a personalized outreach email."""
    recipient = name.strip() or "there"
    org = company.strip() or "the company"
    sender = candidate_name.strip() or "the candidate"
    return f"""You are a professional job application email writer.

Write a formal cold outreach email from {sender} to a recruiter.
- Role: Software Development Engineer (Backend, Mobile iOS/Android, Web)
- Skills: Python, Node.js, Swift, Kotlin, React, REST APIs, System Design
- Sender name: {sender}

Recipient: {recipient} at {org}

Rules:
- Open the FIRST sentence with a specific reference to {org}
- Formal and professional tone
- Under 200 words total
- NO generic openers like "I hope this email finds you well"
- Vary the paragraph structure on every call — never repeat the same format
- End with a CTA: request a 15-min call or resume review

Return ONLY valid JSON, no markdown, no backticks:
{{"subject": "...", "body": "..."}}"""


def _parse_email_json(raw_text: str) -> dict[str, str]:
    """Parse and validate Gemini JSON output containing subject and body."""
    try:
        payload: Any = json.loads(raw_text.strip())
    except json.JSONDecodeError as exc:
        logger.warning("Gemini returned invalid JSON: %s", exc)
        raise ValueError("ai_parse_error") from exc

    if not isinstance(payload, dict):
        raise ValueError("ai_parse_error")

    subject = payload.get("subject")
    body = payload.get("body")
    if not isinstance(subject, str) or not isinstance(body, str):
        raise ValueError("ai_parse_error")
    if not subject.strip() or not body.strip():
        raise ValueError("ai_parse_error")

    return {"subject": subject.strip(), "body": body.strip()}


def generate_email(name: str, company: str) -> dict[str, str]:
    """
    Generate a personalized outreach email subject and body via Google Gemini.

    Returns a dict with keys ``subject`` and ``body``.
    Raises ``ValueError("ai_parse_error")`` when the model output cannot be parsed.
    """
    settings = get_settings()
    candidate_name = settings.CANDIDATE_NAME
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    contents = _build_prompt(name, company, candidate_name)

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=contents,
        )
    except ClientError as exc:
        if exc.code == 429:
            logger.error(
                "Gemini quota exceeded for model %s. "
                "Free-tier gemini-2.0-flash often has limit 0 — use GEMINI_MODEL=gemini-2.5-flash in .env. "
                "Details: %s",
                settings.GEMINI_MODEL,
                exc,
            )
        else:
            logger.exception("Gemini API request failed: %s", exc)
        raise
    except Exception as exc:
        logger.exception("Gemini API request failed: %s", exc)
        raise

    raw_text = (response.text or "").strip()
    if not raw_text:
        logger.warning("Gemini returned an empty response")
        raise ValueError("ai_parse_error")

    cleaned = raw_text
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    return _parse_email_json(cleaned)
