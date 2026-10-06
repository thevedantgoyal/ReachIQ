"""Resume PDF upload routes for campaign email attachments."""

from __future__ import annotations

import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, status

from backend.core.config import get_settings
from backend.schemas.schemas import ResumeUploadResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resume", tags=["resume"])

_PROJECT_ROOT = Path(__file__).resolve().parents[2]


@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume_pdf(file: UploadFile) -> ResumeUploadResponse:
    """Accept a resume PDF, save it on the server, and return the absolute path."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Upload must be a .pdf file.",
        )

    settings = get_settings()
    upload_dir = (_PROJECT_ROOT / settings.RESUME_UPLOAD_DIR).resolve()
    upload_dir.mkdir(parents=True, exist_ok=True)

    original_name = Path(file.filename).name or "resume.pdf"
    safe_name = f"{uuid.uuid4().hex}_{original_name}"
    dest = upload_dir / safe_name

    try:
        content = await file.read()
    except Exception as exc:
        logger.exception("Failed to read uploaded resume: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not read uploaded file.",
        ) from exc

    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded file is empty.",
        )

    dest.write_bytes(content)
    resume_path = str(dest)
    logger.info("Resume saved: %s (%s bytes)", resume_path, len(content))

    return ResumeUploadResponse(resume_path=resume_path, filename=original_name)
