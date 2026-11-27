"""Google Gemini integration for personalized outreach email generation and reply classification."""

from __future__ import annotations

import json
import logging
import time
from enum import Enum
from typing import Any

from google import genai
from google.genai import types
from google.genai.errors import ClientError
from pydantic import BaseModel

from backend.core.config import get_settings

logger = logging.getLogger(__name__)

_REPROMPT_SUFFIX = (
    "\n\nYour previous answer was not valid JSON. Return ONLY the JSON object."
)

_OOO_PHRASES: tuple[str, ...] = (
    "out of office",
    "out-of-office",
    "automatic reply",
    "auto-reply",
    "on leave",
)


class AIParseError(ValueError):
    """Raised when Gemini email JSON cannot be parsed after one re-prompt."""

    def __init__(self, prompt: str, latency_ms: int) -> None:
        """Store audit fields while keeping ``str(self) == "ai_parse_error"``."""
        super().__init__("ai_parse_error")
        self.prompt = prompt
        self.latency_ms = latency_ms


class ReplyCategory(str, Enum):
    """Classification labels for recruiter replies."""

    interested = "interested"
    rejected = "rejected"
    out_of_office = "out_of_office"
    needs_more_info = "needs_more_info"
    other = "other"


class ReplyCategoryResult(BaseModel):
    """Schema-constrained Gemini output for reply classification."""

    category: ReplyCategory


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


def _strip_markdown_fences(raw_text: str) -> str:
    """Remove optional markdown code fences around model JSON output."""
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    return cleaned


def _call_gemini(client: genai.Client, prompt: str) -> tuple[str, int]:
    """
    Call Gemini once and return cleaned text plus latency in milliseconds.

    Propagates ``ClientError`` and other non-parse API failures unchanged.
    """
    settings = get_settings()
    started = time.perf_counter()
    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
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

    latency_ms = int((time.perf_counter() - started) * 1000)
    raw_text = (response.text or "").strip()
    return _strip_markdown_fences(raw_text), latency_ms


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


def generate_email(name: str, company: str) -> dict[str, Any]:
    """
    Generate a personalized outreach email subject and body via Google Gemini.

    Retries the model call once when the first response is not valid JSON.
    Returns a dict with keys ``subject``, ``body``, ``prompt``, and ``llm_latency_ms``.
    Raises ``AIParseError`` when both attempts fail to parse.
    """
    settings = get_settings()
    candidate_name = settings.CANDIDATE_NAME
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    prompt = _build_prompt(name, company, candidate_name)
    total_latency_ms = 0

    cleaned, latency_ms = _call_gemini(client, prompt)
    total_latency_ms += latency_ms

    if not cleaned:
        logger.info("Gemini returned an empty response; re-prompting once")
    else:
        try:
            parsed = _parse_email_json(cleaned)
            return {
                **parsed,
                "prompt": prompt,
                "llm_latency_ms": total_latency_ms,
            }
        except ValueError:
            logger.info("Gemini returned invalid JSON; re-prompting once")

    cleaned_retry, latency_retry_ms = _call_gemini(
        client, prompt + _REPROMPT_SUFFIX
    )
    total_latency_ms += latency_retry_ms

    if not cleaned_retry:
        logger.warning("Gemini returned an empty response on re-prompt")
        raise AIParseError(prompt=prompt, latency_ms=total_latency_ms)

    try:
        parsed = _parse_email_json(cleaned_retry)
    except ValueError as exc:
        raise AIParseError(prompt=prompt, latency_ms=total_latency_ms) from exc

    return {
        **parsed,
        "prompt": prompt,
        "llm_latency_ms": total_latency_ms,
    }


def classify_reply(
    text: str,
    auto_submitted: str | None = None,
) -> ReplyCategory:
    """
    Classify a recruiter reply using cheap rules first, then Gemini.

    Never raises — returns ``ReplyCategory.other`` on any classification failure.
    """
    if auto_submitted is not None and auto_submitted.strip().lower() not in {"", "no"}:
        return ReplyCategory.out_of_office

    lowered = (text or "").lower()
    if any(phrase in lowered for phrase in _OOO_PHRASES):
        return ReplyCategory.out_of_office

    settings = get_settings()
    truncated = (text or "")[:2000]
    contents = (
        "Classify this recruiter email reply into exactly one category.\n"
        "Categories:\n"
        "- interested: positive interest, interview ask, or wants to talk\n"
        "- rejected: clear rejection or not moving forward\n"
        "- out_of_office: automatic absence / vacation reply\n"
        "- needs_more_info: asks for details, portfolio, or clarification\n"
        "- other: anything else\n\n"
        f"Reply text:\n<<<{truncated}>>>"
    )

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=0,
                response_mime_type="application/json",
                response_schema=ReplyCategoryResult,
            ),
        )
        parsed = response.parsed
        if isinstance(parsed, ReplyCategoryResult):
            return parsed.category
        if isinstance(parsed, dict) and "category" in parsed:
            return ReplyCategory(str(parsed["category"]))
        if hasattr(parsed, "category"):
            return ReplyCategory(str(getattr(parsed, "category")))
        logger.warning("Unexpected Gemini classify_reply parsed value: %r", parsed)
        return ReplyCategory.other
    except Exception as exc:
        logger.warning("Reply classification failed; defaulting to other: %s", exc)
        return ReplyCategory.other
