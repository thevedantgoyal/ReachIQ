"""Anthropic Claude integration for personalized outreach email generation."""

from __future__ import annotations

import json
import logging
import random
from typing import Any

import anthropic

from backend.core.config import get_settings

logger = logging.getLogger(__name__)

CLAUDE_MODEL = "claude-sonnet-4-20250514"

SYSTEM_PROMPT = """You are an expert job-search outreach writer for a software engineer.
Write personalized cold emails to HR contacts and recruiters.

Candidate profile:
- Role focus: SDE — Backend, Mobile (iOS/Android), Web
- Skills: Python, Node.js, Swift, Kotlin, React, REST APIs, System Design

Rules:
- Tone: formal and professional
- Body must be under 200 words
- Never use generic openers like "I hope this email finds you well"
- Vary sentence structure and email layout on every request so each email feels unique
- Reference the recipient's company naturally when company name is provided
- Output ONLY valid JSON with exactly two keys: "subject" and "body"
- Do not wrap JSON in markdown code fences
"""

STRUCTURE_HINTS: tuple[str, ...] = (
    "Open with a specific observation about the company's engineering work, then introduce the candidate.",
    "Lead with a concise skills summary, then tie it to the company's product or stack.",
    "Start with a direct ask about open SDE roles, supported by one relevant achievement.",
    "Open with mutual-fit language, then list two skills aligned to the company's domain.",
    "Begin with a brief value proposition, then mention backend and mobile experience.",
)


def _build_user_prompt(name: str, company: str) -> str:
    """Build the user prompt with recipient context and a uniqueness hint."""
    structure_hint = random.choice(STRUCTURE_HINTS)
    recipient = name.strip() or "there"
    org = company.strip() or "the company"
    return (
        f"Write a cold outreach email to {recipient} at {org}.\n"
        f"Structure guidance for this email: {structure_hint}\n"
        "Return JSON only: {\"subject\": \"...\", \"body\": \"...\"}"
    )


def _parse_email_json(raw_text: str) -> dict[str, str]:
    """Parse and validate Claude JSON output containing subject and body."""
    try:
        payload: Any = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        logger.warning("Claude returned invalid JSON: %s", exc)
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
    Generate a personalized outreach email subject and body via Claude.

    Returns a dict with keys ``subject`` and ``body``.
    Raises ``ValueError("ai_parse_error")`` when the model output cannot be parsed.
    """
    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    user_prompt = _build_user_prompt(name, company)

    try:
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
    except anthropic.AnthropicError as exc:
        logger.exception("Claude API request failed: %s", exc)
        raise

    text_blocks = [
        block.text
        for block in response.content
        if getattr(block, "type", None) == "text" and hasattr(block, "text")
    ]
    raw_text = "\n".join(text_blocks).strip()
    if not raw_text:
        logger.warning("Claude returned an empty response")
        raise ValueError("ai_parse_error")

    cleaned = raw_text
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    return _parse_email_json(cleaned)
