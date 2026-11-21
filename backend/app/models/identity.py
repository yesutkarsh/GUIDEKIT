"""Identity models: developers, organizations, memberships, sessions, device auth."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class AuthProvider(StrEnum):
    GOOGLE = "google"


class MemberRole(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class SessionClient(StrEnum):
    DASHBOARD = "dashboard"
    VSCODE_EXTENSION = "vscode_extension"
    CLI = "cli"


class DeviceClient(StrEnum):
    VSCODE_EXTENSION = "vscode_extension"
    CLI = "cli"


class DeviceAuthStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"
    EXPIRED = "expired"
    CONSUMED = "consumed"


class Developer(Base):
    __tablename__ = "developers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    email: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str | None] = mapped_column(Text)
    # Retained as a nullable legacy column; account authentication is Google-only.
    password_hash: Mapped[str | None] = mapped_column(Text)
    auth_provider: Mapped[str] = mapped_column(Text, nullable=False, server_default=AuthProvider.GOOGLE.value)
    auth_provider_id: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    memberships: Mapped[list["OrgMember"]] = relationship(
        back_populates="developer", cascade="all, delete-orphan", passive_deletes=True
    )


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    members: Mapped[list["OrgMember"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan", passive_deletes=True
    )


class OrgMember(Base):
    __tablename__ = "org_members"
    __table_args__ = (Index("org_members_developer_idx", "developer_id"),)

    org_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True
    )
    developer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("developers.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = mapped_column(Text, nullable=False, server_default=MemberRole.MEMBER.value)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    organization: Mapped[Organization] = relationship(back_populates="members")
    developer: Mapped[Developer] = relationship(back_populates="memberships")


class DeveloperSession(Base):
    __tablename__ = "developer_sessions"
    __table_args__ = (
        Index("developer_sessions_developer_idx", "developer_id", postgresql_where="revoked_at IS NULL"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    developer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("developers.id", ondelete="CASCADE"), nullable=False
    )
    client: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    device_label: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DeviceAuthRequest(Base):
    __tablename__ = "device_auth_requests"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    device_code_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    user_code: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    client: Mapped[str] = mapped_column(Text, nullable=False)
    developer_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("developers.id", ondelete="CASCADE")
    )
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=DeviceAuthStatus.PENDING.value)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
