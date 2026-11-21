"""Project, allowed-origin and API-key models."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Index, Text, Uuid, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Framework(StrEnum):
    """Supported project frameworks (Phase 1 patch expands the CHECK list)."""

    REACT = "react"
    NEXTJS = "nextjs"
    SVELTE = "svelte"
    SVELTEKIT = "sveltekit"
    VUE = "vue"
    VANILLA = "vanilla"


class KeyType(StrEnum):
    PUBLISHABLE = "publishable"
    SECRET = "secret"


class OriginEnvironment(StrEnum):
    PRODUCTION = "production"
    STAGING = "staging"
    DEVELOPMENT = "development"


class ProjectEnvironment(StrEnum):
    """High-level lifecycle stage selected when a project is created."""

    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class ProjectBackground(StrEnum):
    """Stable visual identities available for dashboard project cards."""

    UNTITLED_BLEND = "untitled-blend"
    CITRON = "citron"
    MORNING_HAZE = "morning-haze"
    BLUE_SKY = "blue-sky"
    SUNSET_POP = "sunset-pop"


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint("org_id", "slug", name="projects_org_slug_uq"),
        Index("projects_org_idx", "org_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    org_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    framework: Mapped[str] = mapped_column(Text, nullable=False, server_default=Framework.NEXTJS.value)
    default_locale: Mapped[str] = mapped_column(Text, nullable=False, server_default="en")
    supported_locales: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default="{en}"
    )
    auth_detection_config: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    chat_settings: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    environment: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=ProjectEnvironment.DEVELOPMENT.value
    )
    background_id: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=ProjectBackground.UNTITLED_BLEND.value
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ProjectOrigin(Base):
    __tablename__ = "project_origins"
    __table_args__ = (UniqueConstraint("project_id", "origin", name="project_origins_project_origin_uq"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    origin: Mapped[str] = mapped_column(Text, nullable=False)
    environment: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=OriginEnvironment.PRODUCTION.value
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ProjectKey(Base):
    __tablename__ = "project_keys"
    __table_args__ = (
        Index("project_keys_project_idx", "project_id", postgresql_where="revoked_at IS NULL"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    key_type: Mapped[str] = mapped_column(Text, nullable=False)
    key_prefix: Mapped[str] = mapped_column(Text, nullable=False)
    key_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    key_plain: Mapped[str | None] = mapped_column(Text)  # publishable keys only
    label: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("developers.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
