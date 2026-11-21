"""Pydantic request/response schemas for authentication and device-code login."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.project import OrganizationOut

__all__ = [
    "RefreshRequest",
    "LogoutRequest",
    "TokenPair",
    "DeveloperOut",
    "OrganizationOut",
    "MeResponse",
    "DeviceClient",
    "DeviceAuthInitiateRequest",
    "DeviceAuthInitiateResponse",
    "DeviceAuthPollRequest",
    "DeviceAuthPollResponse",
    "DeviceAuthRequestOut",
    "DeviceCodeActionRequest",
    "DeviceCodeActionResponse",
]


# ---------------------------------------------------------------------------
# Dashboard authentication
# ---------------------------------------------------------------------------

class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"


class DeveloperOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    display_name: str | None
    auth_provider: str
    created_at: datetime


class MeResponse(BaseModel):
    developer: DeveloperOut
    organizations: list[OrganizationOut]
    onboarding_required: bool


# ---------------------------------------------------------------------------
# Device-code login (VS Code extension / CLI)
# ---------------------------------------------------------------------------

DeviceClient = Literal["vscode_extension", "cli"]


class DeviceAuthInitiateRequest(BaseModel):
    client: DeviceClient = "vscode_extension"


class DeviceAuthInitiateResponse(BaseModel):
    device_code: str
    user_code: str
    expires_in: int
    interval: int = 5  # recommended polling interval, seconds
    verification_uri: str | None = None
    verification_uri_complete: str | None = None


class DeviceAuthPollRequest(BaseModel):
    device_code: str


class DeviceAuthPollResponse(BaseModel):
    status: Literal["pending", "approved", "denied", "expired", "consumed"]
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: Literal["bearer"] | None = None
    expires_in: int | None = None


class DeviceCodeActionRequest(BaseModel):
    user_code: str = Field(min_length=4, max_length=16)


class DeviceCodeActionResponse(BaseModel):
    status: Literal["approved", "denied", "expired", "not_found", "already_consumed"]


class DeviceAuthRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_code: str
    client: DeviceClient
    status: Literal["pending", "approved", "denied", "expired", "consumed"]
    created_at: datetime
    expires_at: datetime


# ---------------------------------------------------------------------------
# VS Code Loopback Bridge Token Exchange (Phase 6)
# ---------------------------------------------------------------------------

