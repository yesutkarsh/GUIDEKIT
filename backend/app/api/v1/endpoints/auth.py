"""Google-backed dashboard identity and refreshable client sessions."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentDeveloper
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    sha256_hex,
)
from app.core.utils import utcnow
from app.db.session import get_db
from app.models.identity import (
    DeveloperSession,
    Organization,
    OrgMember,
)
from app.schemas.auth import (
    DeveloperOut,
    LogoutRequest,
    MeResponse,
    RefreshRequest,
    TokenPair,
)

router = APIRouter(prefix="/auth", tags=["auth"])

DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.post("/refresh", response_model=TokenPair, summary="Rotate a refresh token")
async def refresh(payload: RefreshRequest, db: DbSession) -> TokenPair:
    token_hash = sha256_hex(payload.refresh_token)
    session = (
        await db.execute(
            select(DeveloperSession).where(
                DeveloperSession.refresh_token_hash == token_hash,
                DeveloperSession.revoked_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    if session is None or session.expires_at <= utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    # Rotate: issue a fresh refresh token and store only its hash.
    new_refresh_token = generate_refresh_token()
    session.refresh_token_hash = sha256_hex(new_refresh_token)
    session.last_used_at = utcnow()
    await db.commit()

    return TokenPair(
        access_token=create_access_token(session.developer_id),
        refresh_token=new_refresh_token,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Revoke a refresh token")
async def logout(payload: LogoutRequest, db: DbSession) -> None:
    token_hash = sha256_hex(payload.refresh_token)
    session = (
        await db.execute(
            select(DeveloperSession).where(DeveloperSession.refresh_token_hash == token_hash)
        )
    ).scalar_one_or_none()

    if session is not None and session.revoked_at is None:
        session.revoked_at = utcnow()
        await db.commit()


@router.get("/me", response_model=MeResponse, summary="Return the current developer and their organizations")
async def me(developer: CurrentDeveloper, db: DbSession) -> MeResponse:
    organizations = (
        await db.execute(
            select(Organization)
            .join(OrgMember, OrgMember.org_id == Organization.id)
            .where(OrgMember.developer_id == developer.id)
            .order_by(Organization.created_at)
        )
    ).scalars().all()

    return MeResponse(
        developer=DeveloperOut.model_validate(developer),
        organizations=organizations,
        onboarding_required=len(organizations) == 0,
    )
