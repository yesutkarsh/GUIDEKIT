"""Pydantic schemas for Knowledge Base (RAG) management and ingestion."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class KnowledgeSourceItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_type: str
    title: str
    uri: str | None
    status: str
    chunk_count: int
    created_at: datetime
    updated_at: datetime


class KnowledgeTextRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    source_type: Literal["markdown", "faq", "file", "code_summary", "url"] = "markdown"
    locale: str = Field(default="en", max_length=10)
    uri: str | None = None


class KnowledgeUploadResponse(BaseModel):
    source_id: uuid.UUID
    title: str
    chunk_count: int
    status: str


class KnowledgeUploadJsonRequest(BaseModel):
    """Base64 JSON upload format for VS Code extension and non-form clients."""
    filename: str = Field(min_length=1, max_length=255)
    content_base64: str = Field(min_length=1)
    title: str | None = None
    locale: str = "en"

