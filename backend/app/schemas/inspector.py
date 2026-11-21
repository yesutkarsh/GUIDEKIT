"""Pydantic v2 request/response schemas for the Phase 2 Inspector API.

Covers features, feature-versions, workflow steps, self-healing suggestions
and project-level analytics aggregations.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Workflow steps
# ---------------------------------------------------------------------------


class WorkflowStepOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    feature_version_id: uuid.UUID
    step_order: int
    guide_id: str | None
    route_pattern: str
    action_type: str
    advance_on: str
    is_optional: bool
    wait_timeout_ms: int
    condition: dict | None
    content: dict
    target_fingerprint: dict


# ---------------------------------------------------------------------------
# Feature versions
# ---------------------------------------------------------------------------


class FeatureVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    feature_id: uuid.UUID
    project_id: uuid.UUID
    version_number: int
    status: str
    content: dict
    example_queries: list[str]
    requires_auth: bool
    required_role: str | None
    prerequisite_feature_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None


# ---------------------------------------------------------------------------
# Features
# ---------------------------------------------------------------------------


class FeatureSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    slug: str
    created_at: datetime
    archived_at: datetime | None
    draft_version: FeatureVersionOut | None
    published_version: FeatureVersionOut | None
    step_count: int


class FeatureDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    slug: str
    created_at: datetime
    archived_at: datetime | None
    versions: list[FeatureVersionOut]
    steps: list[WorkflowStepOut]


# ---------------------------------------------------------------------------
# Feature-version PATCH payload
# ---------------------------------------------------------------------------


class FeatureVersionPatch(BaseModel):
    """Partial update for a draft FeatureVersion; all fields are optional."""

    requires_auth: bool | None = Field(default=None)
    required_role: str | None = Field(default=None)
    prerequisite_feature_id: uuid.UUID | None = Field(default=None)
    content: dict | None = Field(default=None)


# ---------------------------------------------------------------------------
# Self-healing suggestions
# ---------------------------------------------------------------------------


class HealSuggestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    step_id: uuid.UUID
    suggested_fingerprint: dict
    suggested_selector: str | None
    confidence: float | None
    occurrences: int
    status: str
    first_seen_at: datetime
    last_seen_at: datetime
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None
    # Joined / enriched fields (not stored on HealSuggestion directly)
    guide_id: str | None = None
    route_pattern: str | None = None
    feature_slug: str | None = None


class HealSuggestionReviewRequest(BaseModel):
    action: Literal["approve", "reject"]


class HealSuggestionReviewResponse(BaseModel):
    id: uuid.UUID
    status: str


# ---------------------------------------------------------------------------
# Project PATCH payload
# ---------------------------------------------------------------------------


class ProjectPatch(BaseModel):
    """Partial update for a Project; all fields are optional."""

    name: str | None = Field(default=None)
    framework: str | None = Field(default=None)
    default_locale: str | None = Field(default=None)
    supported_locales: list[str] | None = Field(default=None)
    auth_detection_config: dict | None = Field(default=None)
    chat_settings: dict | None = Field(default=None)
    archived_at: datetime | None = Field(default=None)


# ---------------------------------------------------------------------------
# Analytics nested schemas
# ---------------------------------------------------------------------------


class ChatAnalytics(BaseModel):
    total_sessions: int
    total_messages: int
    by_route: dict[str, int]


class TourAnalytics(BaseModel):
    started: int
    step_completed: int
    completed: int
    exited: int
    failed: int


class ResolutionAnalytics(BaseModel):
    matched_primary: int
    matched_fingerprint: int
    healed_by_ai: int
    fallback_to_text: int
    cache_hit: int


class DailyUsageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    day: date
    chat_messages: int
    ai_resolutions: int


class ManifestMetaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    manifest_version: int
    feature_count: int | None
    published_at: datetime
    etag: str


class AnalyticsOut(BaseModel):
    chat: ChatAnalytics
    tours: TourAnalytics
    resolution: ResolutionAnalytics
    usage_daily: list[DailyUsageOut]
    latest_manifest: ManifestMetaOut | None
