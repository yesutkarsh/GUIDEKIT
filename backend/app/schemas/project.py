"""Pydantic request/response schemas for organizations, projects, origins and keys."""

from __future__ import annotations

import uuid
from datetime import datetime
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.project import (
    Framework,
    KeyType,
    OriginEnvironment,
    ProjectBackground,
    ProjectEnvironment,
)


# ---------------------------------------------------------------------------
# Organizations
# ---------------------------------------------------------------------------

class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    created_at: datetime


class OrgCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str | None = Field(default=None, max_length=80, pattern=r"^[a-z0-9-]+$")


class OrgUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("name must not be blank")
        return value


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str | None = Field(default=None, max_length=80, pattern=r"^[a-z0-9-]+$")
    framework: Framework = Framework.NEXTJS
    default_locale: str = Field(default="en", max_length=35)
    supported_locales: list[str] = Field(default_factory=lambda: ["en"])
    auth_detection_config: dict = Field(default_factory=dict)
    chat_settings: dict = Field(default_factory=dict)
    environment: ProjectEnvironment = ProjectEnvironment.DEVELOPMENT
    background_id: ProjectBackground = ProjectBackground.UNTITLED_BLEND

    @field_validator("supported_locales")
    @classmethod
    def _locales_non_empty(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("supported_locales must contain at least one locale")
        return value


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    slug: str
    framework: str
    default_locale: str
    supported_locales: list[str]
    auth_detection_config: dict
    chat_settings: dict
    environment: str
    background_id: str
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None


# ---------------------------------------------------------------------------
# Allowed origins
# ---------------------------------------------------------------------------

class OriginCreate(BaseModel):
    origin: str = Field(min_length=1, max_length=2048)
    environment: OriginEnvironment = OriginEnvironment.PRODUCTION

    @field_validator("origin")
    @classmethod
    def _normalize_origin(cls, value: str) -> str:
        value = value.strip()
        parsed = urlsplit(value)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("origin must use http or https, e.g. https://taxicentral.com")
        if not parsed.netloc:
            raise ValueError("origin must include a host, e.g. https://taxicentral.com")
        if parsed.path not in ("", "/"):
            raise ValueError("origin must not include a path; use scheme+host(+port) only")
        if parsed.query or parsed.fragment:
            raise ValueError("origin must not include a query string or fragment")
        # Normalise away any trailing slash so lookups are deterministic.
        return f"{parsed.scheme}://{parsed.netloc}"


class OriginOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    origin: str
    environment: str
    created_at: datetime


# ---------------------------------------------------------------------------
# API keys
# ---------------------------------------------------------------------------

class KeyCreate(BaseModel):
    key_type: KeyType
    label: str | None = Field(default=None, max_length=120)


class KeyOut(BaseModel):
    """Display-safe key metadata; ``key_plain`` is only present for publishable keys."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    key_type: str
    key_prefix: str
    key_plain: str | None
    label: str | None
    created_at: datetime
    last_used_at: datetime | None
    revoked_at: datetime | None


class KeyCreatedResponse(BaseModel):
    """Returned once, immediately after key generation.

    ``key`` contains the full secret value; for ``secret`` keys this is the only
    time it is ever shown (only a SHA-256 hash is stored).
    """

    key: KeyOut
    #: Full plaintext key (once only). Kept for the SDK to copy into its config.
    full_key: str


# ---------------------------------------------------------------------------
# SDK runtime verification
# ---------------------------------------------------------------------------

class SDKVerifyRequest(BaseModel):
    publishable_key: str


class SDKVerifyResponse(BaseModel):
    valid: bool
    project_id: uuid.UUID | None = None
    project_name: str | None = None
    framework: str | None = None
    default_locale: str | None = None
    origin: str | None = None
