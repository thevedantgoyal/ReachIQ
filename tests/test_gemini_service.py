"""Unit tests for Gemini email generation and reply classification."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from backend.services.gemini_service import (
    AIParseError,
    ReplyCategory,
    ReplyCategoryResult,
    classify_reply,
    generate_email,
)


def _fake_response(text: str) -> SimpleNamespace:
    return SimpleNamespace(text=text, parsed=None)


@patch("backend.services.gemini_service.genai.Client")
def test_generate_email_retries_once_on_bad_json(mock_client_cls: MagicMock) -> None:
    """First invalid JSON triggers one re-prompt; second response is used."""
    client = MagicMock()
    mock_client_cls.return_value = client
    client.models.generate_content.side_effect = [
        _fake_response("not-json"),
        _fake_response('{"subject": "Hello", "body": "Body text here"}'),
    ]

    result = generate_email("Priya", "TechCorp")

    assert result["subject"] == "Hello"
    assert result["body"] == "Body text here"
    assert "prompt" in result
    assert isinstance(result["llm_latency_ms"], int)
    assert client.models.generate_content.call_count == 2


@patch("backend.services.gemini_service.genai.Client")
def test_generate_email_raises_ai_parse_error_after_two_failures(
    mock_client_cls: MagicMock,
) -> None:
    """Two bad responses raise AIParseError with prompt and ai_parse_error message."""
    client = MagicMock()
    mock_client_cls.return_value = client
    client.models.generate_content.side_effect = [
        _fake_response("{bad"),
        _fake_response("{still-bad"),
    ]

    with pytest.raises(AIParseError) as exc_info:
        generate_email("Rahul", "StartupIO")

    assert str(exc_info.value) == "ai_parse_error"
    assert isinstance(exc_info.value.prompt, str)
    assert len(exc_info.value.prompt) > 0
    assert isinstance(exc_info.value.latency_ms, int)
    assert client.models.generate_content.call_count == 2


@patch("backend.services.gemini_service.genai.Client")
def test_classify_reply_out_of_office_by_rules_without_calling_gemini(
    mock_client_cls: MagicMock,
) -> None:
    """OOO rules short-circuit without calling the Gemini API."""
    result = classify_reply(
        "I am currently out of office until Monday.",
        auto_submitted=None,
    )
    assert result == ReplyCategory.out_of_office
    mock_client_cls.assert_not_called()

    result_header = classify_reply("Anything", auto_submitted="auto-replied")
    assert result_header == ReplyCategory.out_of_office
    mock_client_cls.assert_not_called()


@patch("backend.services.gemini_service.genai.Client")
def test_classify_reply_returns_other_when_gemini_fails(
    mock_client_cls: MagicMock,
) -> None:
    """Gemini failures fall back to ReplyCategory.other and never raise."""
    client = MagicMock()
    mock_client_cls.return_value = client
    client.models.generate_content.side_effect = RuntimeError("boom")

    result = classify_reply("Thanks for reaching out, let's chat next week.")
    assert result == ReplyCategory.other


@patch("backend.services.gemini_service.genai.Client")
def test_classify_reply_schema_has_no_additional_properties(
    mock_client_cls: MagicMock,
) -> None:
    """Reply schema must not emit additional_properties (Gemini 400 otherwise)."""
    client = MagicMock()
    mock_client_cls.return_value = client
    client.models.generate_content.return_value = SimpleNamespace(
        text='{"category":"interested"}',
        parsed=ReplyCategoryResult(category=ReplyCategory.interested),
    )

    classify_reply("Can we talk Thursday?")

    config = client.models.generate_content.call_args.kwargs["config"]
    assert "additional_properties" not in str(config.response_schema)
    assert "additional_properties" not in str(ReplyCategoryResult.model_json_schema())

