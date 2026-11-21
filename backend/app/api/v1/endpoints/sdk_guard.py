"""Runtime SDK verification: publishable key + Origin check.

This is the only endpoint the in-app Copilot / Driver.js SDK calls at runtime.
It returns project metadata so the SDK can load the CDN-served manifest. It
never queries the live manifest from this database.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import VerifiedSDKProjectDep
from app.core.utils import utcnow
from app.db.session import get_service_db
from app.schemas.project import SDKVerifyResponse

router = APIRouter(prefix="/sdk", tags=["sdk"])


@router.post("/verify", response_model=SDKVerifyResponse, summary="Verify SDK publishable key + Origin")
async def verify_sdk_key(
    context: VerifiedSDKProjectDep,
    db: Annotated[AsyncSession, Depends(get_service_db)],
) -> SDKVerifyResponse:
    """Return project metadata after validating the key and allowed origin."""
    # Touch last_used_at on the shared service-role session.
    context.key.last_used_at = utcnow()
    await db.commit()

    project = context.project
    return SDKVerifyResponse(
        valid=True,
        project_id=project.id,
        project_name=project.name,
        framework=project.framework,
        default_locale=project.default_locale,
        origin=context.origin,
    )
