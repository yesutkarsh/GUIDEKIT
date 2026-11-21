"""Pydantic v2 schemas for the Phase 3 Workflow Sync, Knowledge Sync, and Manifest Publisher APIs."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Workflow Sync Schemas
# ---------------------------------------------------------------------------

class WorkflowStepSyncIn(BaseModel):
    step_order: int
    guide_id: str | None = None
    route_pattern: str
    action_type: str = Field(description="click, input, select, navigate, hover, or info")
    advance_on: str = Field(default="click", description="click, input_valid, route_change, element_appears, manual_next")
    is_optional: bool = False
    wait_timeout_ms: int = 5000
    condition: dict | None = None
    content: dict = Field(description="Localized popover copy, e.g. {'en': {'title': '...', 'description': '...'}}")
    target_fingerprint: dict = Field(description="Layered element locator fingerprint")


class FeatureSyncIn(BaseModel):
    slug: str
    content: dict = Field(description="Localized feature title and intent description, e.g. {'en': {'title': '...', 'intent_description': '...'}}")
    example_queries: list[str] = Field(default_factory=list)
    requires_auth: bool = False
    required_role: str | None = None
    prerequisite_feature_slug: str | None = None
    steps: list[WorkflowStepSyncIn] = Field(default_factory=list)


class WorkflowSyncRequest(BaseModel):
    features: list[FeatureSyncIn]


class DraftVersionSummary(BaseModel):
    feature_id: uuid.UUID
    slug: str
    version_id: uuid.UUID
    version_number: int
    step_count: int


class WorkflowSyncResponse(BaseModel):
    synced_features: int
    draft_versions: list[DraftVersionSummary]


# ---------------------------------------------------------------------------
# Knowledge Sync Schemas
# ---------------------------------------------------------------------------

class KnowledgeSourceSyncIn(BaseModel):
    source_type: Literal["url", "markdown", "file", "code_summary", "faq"] = "code_summary"
    title: str
    uri: str | None = None
    locale: str = "en"
    chunks: list[str]


class KnowledgeSyncRequest(BaseModel):
    sources: list[KnowledgeSourceSyncIn]


class KnowledgeSyncResponse(BaseModel):
    synced_sources: int
    indexed_chunks: int
    skipped_sources: int


# ---------------------------------------------------------------------------
# Manifest Publish Schemas
# ---------------------------------------------------------------------------

class ManifestPublishRequest(BaseModel):
    feature_ids: list[uuid.UUID] | None = Field(
        default=None,
        description="Optional list of feature IDs to publish. If omitted, all features with draft versions are published.",
    )


class ManifestPublishResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    manifest_version: int
    etag: str
    byte_size: int
    feature_count: int
    storage_key: str
    published_at: datetime
    manifest_id: uuid.UUID | None = None
    version_number: int | None = None
    published_features: int | None = None
    manifest_url: str | None = None
