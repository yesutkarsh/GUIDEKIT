"""Device-code login flow for the VS Code extension / CLI (à la ``gh auth login``).

Sequence:
1. The extension calls ``POST /device-auth/request`` and receives a high-entropy
   ``device_code`` plus a short ``user_code`` (``WXYZ-1234``).
2. The human opens the dashboard, enters the ``user_code`` and approves.
3. The extension polls ``POST /device-auth/token`` with its ``device_code``
   until the developer has approved; it then exchanges the code for tokens.
"""

from __future__ import annotations

import uuid
import asyncio
import time
from datetime import timedelta
from typing import Annotated
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import CurrentDeveloper
from app.core.security import (
    create_access_token,
    generate_device_code,
    generate_refresh_token,
    generate_user_code,
    sha256_hex,
)
from app.core.utils import utcnow
from app.db.session import get_db
from app.models.identity import DeviceAuthRequest, DeviceAuthStatus, DeveloperSession, OrgMember
from app.schemas.auth import (
    DeviceAuthInitiateRequest,
    DeviceAuthInitiateResponse,
    DeviceAuthPollRequest,
    DeviceAuthPollResponse,
    DeviceAuthRequestOut,
    DeviceCodeActionRequest,
    DeviceCodeActionResponse,
)

router = APIRouter(prefix="/device-auth", tags=["device-auth"])

DbSession = Annotated[AsyncSession, Depends(get_db)]

_poll_times: dict[str, float] = {}
_poll_times_lock = asyncio.Lock()
_POLL_INTERVAL_SECONDS = 5


def _device_label(client: str) -> str:
    return "VS Code extension" if client == "vscode_extension" else "CLI"


@router.post(
    "/request",
    response_model=DeviceAuthInitiateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Initiate a device-code login",
)
async def request_code(payload: DeviceAuthInitiateRequest, db: DbSession) -> DeviceAuthInitiateResponse:
    # Local development runs a single API process; opportunistic cleanup keeps
    # completed requests from accumulating without a separate worker.
    await db.execute(
        delete(DeviceAuthRequest).where(
            DeviceAuthRequest.expires_at < utcnow() - timedelta(days=1)
        )
    )

    device_code = generate_device_code()

    # user_code is unique; retry in the (astronomically unlikely) case of a clash.
    user_code = generate_user_code()
    for _ in range(5):
        clash = await db.scalar(
            select(DeviceAuthRequest.id).where(DeviceAuthRequest.user_code == user_code)
        )
        if clash is None:
            break
        user_code = generate_user_code()
    else:
        raise HTTPException(status_code=500, detail="Could not generate a unique user code")

    expires_in = settings.device_code_expire_seconds
    db.add(
        DeviceAuthRequest(
            device_code_hash=sha256_hex(device_code),
            user_code=user_code,
            client=payload.client,
            status=DeviceAuthStatus.PENDING.value,
            expires_at=utcnow() + timedelta(seconds=expires_in),
        )
    )
    await db.commit()

    verification_uri = f"{settings.dashboard_url.rstrip('/')}/device"
    return DeviceAuthInitiateResponse(
        device_code=device_code,
        user_code=user_code,
        expires_in=expires_in,
        interval=_POLL_INTERVAL_SECONDS,
        verification_uri=verification_uri,
        verification_uri_complete=f"{verification_uri}?{urlencode({'code': user_code})}",
    )


@router.get(
    "/requests/{user_code}",
    response_model=DeviceAuthRequestOut,
    summary="Inspect a device authorization request before approving it",
)
async def inspect_request(
    user_code: str,
    developer: CurrentDeveloper,
    db: DbSession,
) -> DeviceAuthRequest:
    del developer  # Authentication is required even though the row is not yet assigned.
    request_row = (
        await db.execute(
            select(DeviceAuthRequest).where(
                DeviceAuthRequest.user_code == user_code.strip().upper()
            )
        )
    ).scalar_one_or_none()
    if request_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device request not found")
    if request_row.expires_at <= utcnow() and request_row.status == DeviceAuthStatus.PENDING.value:
        request_row.status = DeviceAuthStatus.EXPIRED.value
        await db.commit()
    return request_row


async def _act_on_code(
    payload: DeviceCodeActionRequest,
    developer_id: uuid.UUID,
    db: AsyncSession,
    new_status: DeviceAuthStatus,
) -> DeviceCodeActionResponse:
    request_row = (
        await db.execute(
            select(DeviceAuthRequest)
            .where(DeviceAuthRequest.user_code == payload.user_code.strip().upper())
            .with_for_update()
        )
    ).scalar_one_or_none()

    if request_row is None:
        return DeviceCodeActionResponse(status="not_found")

    if request_row.expires_at <= utcnow():
        request_row.status = DeviceAuthStatus.EXPIRED.value
        await db.commit()
        return DeviceCodeActionResponse(status="expired")

    if request_row.status == DeviceAuthStatus.CONSUMED.value:
        return DeviceCodeActionResponse(status="already_consumed")

    target_status = new_status.value
    if request_row.status == target_status:
        return DeviceCodeActionResponse(
            status="approved" if new_status is DeviceAuthStatus.APPROVED else "denied"
        )
    if request_row.status != DeviceAuthStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "invalid_device_state", "message": "Device request is already final"},
        )

    request_row.status = target_status
    if new_status is DeviceAuthStatus.APPROVED:
        request_row.developer_id = developer_id
    await db.commit()

    return DeviceCodeActionResponse(status="approved" if new_status is DeviceAuthStatus.APPROVED else "denied")


@router.post(
    "/approve",
    response_model=DeviceCodeActionResponse,
    summary="Approve a pending device-code login (dashboard, authenticated)",
)
async def approve(
    payload: DeviceCodeActionRequest,
    developer: CurrentDeveloper,
    db: DbSession,
) -> DeviceCodeActionResponse:
    membership = await db.scalar(
        select(OrgMember.org_id).where(OrgMember.developer_id == developer.id).limit(1)
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "onboarding_required",
                "message": "Create a workspace before connecting VS Code",
            },
        )
    return await _act_on_code(payload, developer.id, db, DeviceAuthStatus.APPROVED)


@router.post(
    "/deny",
    response_model=DeviceCodeActionResponse,
    summary="Deny a pending device-code login (dashboard, authenticated)",
)
async def deny(
    payload: DeviceCodeActionRequest,
    developer: CurrentDeveloper,
    db: DbSession,
) -> DeviceCodeActionResponse:
    return await _act_on_code(payload, developer.id, db, DeviceAuthStatus.DENIED)


@router.post("/token", response_model=DeviceAuthPollResponse, summary="Poll/exchange a device code")
async def poll_token(
    payload: DeviceAuthPollRequest,
    db: DbSession,
    response: Response,
) -> DeviceAuthPollResponse:
    token_hash = sha256_hex(payload.device_code)

    request_row = (
        await db.execute(
            select(DeviceAuthRequest)
            .where(DeviceAuthRequest.device_code_hash == token_hash)
            .with_for_update()
        )
    ).scalar_one_or_none()

    if request_row is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown device_code")

    async with _poll_times_lock:
        now_monotonic = time.monotonic()
        last_poll = _poll_times.get(token_hash)
        if last_poll is not None and now_monotonic - last_poll < _POLL_INTERVAL_SECONDS:
            response.headers["Retry-After"] = str(_POLL_INTERVAL_SECONDS)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="slow_down",
                headers={"Retry-After": str(_POLL_INTERVAL_SECONDS)},
            )
        _poll_times[token_hash] = now_monotonic

    if request_row.expires_at <= utcnow():
        request_row.status = DeviceAuthStatus.EXPIRED.value
        await db.commit()
        async with _poll_times_lock:
            _poll_times.pop(token_hash, None)
        return DeviceAuthPollResponse(status="expired")

    if request_row.status == DeviceAuthStatus.PENDING.value:
        return DeviceAuthPollResponse(status="pending")

    if request_row.status == DeviceAuthStatus.DENIED.value:
        async with _poll_times_lock:
            _poll_times.pop(token_hash, None)
        return DeviceAuthPollResponse(status="denied")

    if request_row.status == DeviceAuthStatus.CONSUMED.value:
        async with _poll_times_lock:
            _poll_times.pop(token_hash, None)
        return DeviceAuthPollResponse(status="consumed")

    if request_row.status == DeviceAuthStatus.APPROVED.value and request_row.developer_id is not None:
        # Exchange: create a session scoped to the requesting client, then consume.
        refresh_token = generate_refresh_token()
        db.add(
            DeveloperSession(
                developer_id=request_row.developer_id,
                client=request_row.client,
                refresh_token_hash=sha256_hex(refresh_token),
                device_label=_device_label(request_row.client),
                expires_at=utcnow() + timedelta(days=settings.refresh_token_expire_days),
                last_used_at=utcnow(),
            )
        )
        request_row.status = DeviceAuthStatus.CONSUMED.value
        await db.commit()
        async with _poll_times_lock:
            _poll_times.pop(token_hash, None)

        return DeviceAuthPollResponse(
            status="approved",
            access_token=create_access_token(request_row.developer_id),
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.access_token_expire_minutes * 60,
        )

    # Approved but never assigned a developer (should not happen).
    return DeviceAuthPollResponse(status="pending")
