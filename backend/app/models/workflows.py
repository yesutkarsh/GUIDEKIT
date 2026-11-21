"""Workflow, versioning, manifest, RAG, chat, analytics and self-healing models.

Phase 1 provisions the *foundation* (identity + projects + keys) but these
models mirror the full v2 schema so later phases can build on a stable, typed
layer. They are intentionally not exercised by the Phase 1 endpoints.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    REAL,
    Text,
    Uuid,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector

from app.models.base import Base

EMBEDDING_DIM = 1536  # keep in sync with sql/schema_v2.sql


class FeatureStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class ActionType(StrEnum):
    CLICK = "click"
    INPUT = "input"
    SELECT = "select"
    NAVIGATE = "navigate"
    HOVER = "hover"
    INFO = "info"


class AdvanceOn(StrEnum):
    CLICK = "click"
    INPUT_VALID = "input_valid"
    ROUTE_CHANGE = "route_change"
    ELEMENT_APPEARS = "element_appears"
    MANUAL_NEXT = "manual_next"


class KnowledgeSourceType(StrEnum):
    URL = "url"
    MARKDOWN = "markdown"
    FILE = "file"
    CODE_SUMMARY = "code_summary"
    FAQ = "faq"


class KnowledgeSourceStatus(StrEnum):
    PENDING = "pending"
    INDEXED = "indexed"
    FAILED = "failed"


class ChatRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class TourEventType(StrEnum):
    STARTED = "started"
    STEP_SHOWN = "step_shown"
    STEP_COMPLETED = "step_completed"
    COMPLETED = "completed"
    EXITED = "exited"
    FAILED = "failed"


class Feature(Base):
    __tablename__ = "features"
    __table_args__ = (
        UniqueConstraint("project_id", "slug", name="features_project_slug_uq"),
        UniqueConstraint("id", "project_id", name="features_id_project_uq"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("developers.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class FeatureVersion(Base):
    __tablename__ = "feature_versions"
    __table_args__ = (
        UniqueConstraint("feature_id", "version_number", name="feature_versions_feature_number_uq"),
        UniqueConstraint("id", "project_id", name="feature_versions_id_project_uq"),
        ForeignKeyConstraint(
            ["feature_id", "project_id"],
            ["features.id", "features.project_id"],
            ondelete="CASCADE",
        ),
        Index("feature_versions_one_published_uq", "feature_id", unique=True, postgresql_where="status = 'published'"),
        Index("feature_versions_one_draft_uq", "feature_id", unique=True, postgresql_where="status = 'draft'"),
        Index("feature_versions_project_idx", "project_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    feature_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=FeatureStatus.DRAFT.value)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False)
    example_queries: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, server_default="{}")
    requires_auth: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    required_role: Mapped[str | None] = mapped_column(Text)
    prerequisite_feature_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("developers.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    published_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("developers.id"))


class FeatureEmbedding(Base):
    __tablename__ = "feature_embeddings"
    __table_args__ = (
        UniqueConstraint("feature_version_id", "locale", "source_text", name="feature_embeddings_version_locale_text_uq"),
        ForeignKeyConstraint(
            ["feature_version_id", "project_id"],
            ["feature_versions.id", "feature_versions.project_id"],
            ondelete="CASCADE",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    feature_version_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    locale: Mapped[str] = mapped_column(Text, nullable=False)
    source_text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM), nullable=False)


class WorkflowStep(Base):
    __tablename__ = "workflow_steps"
    __table_args__ = (
        UniqueConstraint("feature_version_id", "step_order", name="workflow_steps_version_order_uq"),
        UniqueConstraint("id", "project_id", name="workflow_steps_id_project_uq"),
        ForeignKeyConstraint(
            ["feature_version_id", "project_id"],
            ["feature_versions.id", "feature_versions.project_id"],
            ondelete="CASCADE",
        ),
        Index("workflow_steps_project_idx", "project_id"),
        Index("workflow_steps_guide_idx", "feature_version_id", "guide_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    feature_version_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    guide_id: Mapped[str | None] = mapped_column(Text)
    route_pattern: Mapped[str] = mapped_column(Text, nullable=False)
    action_type: Mapped[str] = mapped_column(Text, nullable=False)
    advance_on: Mapped[str] = mapped_column(Text, nullable=False, server_default=AdvanceOn.CLICK.value)
    is_optional: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    wait_timeout_ms: Mapped[int] = mapped_column(Integer, nullable=False, server_default="5000")
    condition: Mapped[dict | None] = mapped_column(JSONB)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False)
    target_fingerprint: Mapped[dict] = mapped_column(JSONB, nullable=False)


class PublishedManifest(Base):
    __tablename__ = "published_manifests"
    __table_args__ = (
        UniqueConstraint("project_id", "manifest_version", name="published_manifests_project_version_uq"),
        Index("published_manifests_current_uq", "project_id", unique=True, postgresql_where="is_current"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    manifest_version: Mapped[int] = mapped_column(Integer, nullable=False)
    etag: Mapped[str] = mapped_column(Text, nullable=False)
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    byte_size: Mapped[int | None] = mapped_column(Integer)
    feature_count: Mapped[int | None] = mapped_column(Integer)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    published_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("developers.id"))
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class KnowledgeSource(Base):
    __tablename__ = "knowledge_sources"
    __table_args__ = (
        UniqueConstraint("id", "project_id", name="knowledge_sources_id_project_uq"),
        Index("knowledge_sources_project_idx", "project_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    source_type: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    uri: Mapped[str | None] = mapped_column(Text)
    content_hash: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=KnowledgeSourceStatus.PENDING.value)
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("developers.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"
    __table_args__ = (
        UniqueConstraint("source_id", "chunk_index", "locale", name="knowledge_chunks_source_index_locale_uq"),
        ForeignKeyConstraint(
            ["source_id", "project_id"],
            ["knowledge_sources.id", "knowledge_sources.project_id"],
            ondelete="CASCADE",
        ),
        Index("knowledge_chunks_project_idx", "project_id", "locale"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    source_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    locale: Mapped[str] = mapped_column(Text, nullable=False, server_default="en")
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM), nullable=False)
    # Column name is `metadata`; the Python attribute is `meta` to avoid
    # shadowing the reserved Declarative ``.metadata`` MetaData handle.
    meta: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, server_default="{}")


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    __table_args__ = (
        UniqueConstraint("id", "project_id", name="chat_sessions_id_project_uq"),
        Index("chat_sessions_project_idx", "project_id", "started_at"),
        Index("chat_sessions_visitor_idx", "project_id", "visitor_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    visitor_id: Mapped[str] = mapped_column(Text, nullable=False)
    locale: Mapped[str] = mapped_column(Text, nullable=False, server_default="en")
    origin: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_active_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        ForeignKeyConstraint(
            ["session_id", "project_id"],
            ["chat_sessions.id", "chat_sessions.project_id"],
            ondelete="CASCADE",
        ),
        Index("chat_messages_session_idx", "session_id", "created_at"),
        Index("chat_messages_project_idx", "project_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    session_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    route_taken: Mapped[str | None] = mapped_column(Text)
    matched_feature_version_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    similarity: Mapped[float | None] = mapped_column(REAL)
    retrieved_chunk_ids: Mapped[list[uuid.UUID] | None] = mapped_column(ARRAY(Uuid))
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class TourEvent(Base):
    __tablename__ = "tour_events"
    __table_args__ = (
        Index("tour_events_project_idx", "project_id", "created_at"),
        Index("tour_events_step_idx", "step_id", "event_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    feature_version_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    step_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class StepResolutionLog(Base):
    """Time-partitioned runtime log (see ``sql/schema_v2.sql`` section 7)."""

    __tablename__ = "step_resolution_logs"
    __table_args__ = (
        Index("step_resolution_logs_step_idx", "step_id", "logged_at"),
        Index("step_resolution_logs_project_idx", "project_id", "status", "logged_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    step_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("workflow_steps.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(Text, nullable=False)
    resolution_ms: Mapped[int | None] = mapped_column(Integer)
    page_path: Mapped[str | None] = mapped_column(Text)
    dom_hash: Mapped[str | None] = mapped_column(Text)
    detected_dom_selector: Mapped[str | None] = mapped_column(Text)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class HealSuggestion(Base):
    __tablename__ = "heal_suggestions"
    __table_args__ = (
        Index(
            "heal_suggestions_open_uq",
            "step_id",
            "suggested_selector",
            unique=True,
            postgresql_where="status = 'pending'",
        ),
        Index("heal_suggestions_project_idx", "project_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    step_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("workflow_steps.id", ondelete="CASCADE"), nullable=False
    )
    suggested_fingerprint: Mapped[dict] = mapped_column(JSONB, nullable=False)
    suggested_selector: Mapped[str | None] = mapped_column(Text)
    confidence: Mapped[float | None] = mapped_column(REAL)
    occurrences: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="pending")
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("developers.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class StepResolutionCache(Base):
    __tablename__ = "step_resolution_cache"

    step_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("workflow_steps.id", ondelete="CASCADE"), primary_key=True
    )
    dom_hash: Mapped[str] = mapped_column(Text, primary_key=True)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    resolved_candidate: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ProjectUsageDaily(Base):
    __tablename__ = "project_usage_daily"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    chat_messages: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    ai_resolutions: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    tts_characters: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
