"""FastAPI dependencies: authenticated developer and verified SDK project.

* :data:`CurrentDeveloper` resolves the ``Authorization: Bearer`` JWT, loads the
  :class:`~app.models.identity.Developer` and scopes the shared DB transaction
  with ``app.current_developer_id`` so Row-Level Security applies to every
  subsequent query.
* :data:`VerifiedSDKProject` implements the runtime SDK path: it validates a
  publishable key (by SHA-256 hash) plus the ``Origin`` header against the
  project's allowed-origin list, using the service-role session (no developer
  identity, RLS bypassed).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Annotated

import jwt
import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_access_token, decode_clerk_token, sha256_hex
from app.db.session import get_db, get_service_db, set_local_developer
from app.models.identity import Developer
from app.models.project import Project, ProjectKey, ProjectOrigin

bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def _fetch_clerk_profile(clerk_user_id: str) -> tuple[str, str]:
    """Fetch the verified primary Google email used to provision a developer."""
    if not settings.clerk_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Clerk user provisioning is not configured",
        )

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"https://api.clerk.com/v1/users/{clerk_user_id}",
                headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
            )
        response.raise_for_status()
        profile = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to load the verified Google profile",
        ) from exc

    primary_id = profile.get("primary_email_address_id")
    primary = next(
        (
            item
            for item in profile.get("email_addresses", [])
            if item.get("id") == primary_id
        ),
        None,
    )
    verification_status = (primary or {}).get("verification", {}).get("status")
    email = (primary or {}).get("email_address")
    if not email or verification_status != "verified":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A verified primary Google email is required",
        )

    display_name = " ".join(
        part for part in [profile.get("first_name"), profile.get("last_name")] if part
    ).strip()
    return email.lower(), display_name or email.split("@", 1)[0]


async def get_current_developer(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Developer:
    """Resolve the authenticated developer from a Bearer JWT and apply RLS scope.

    Supports both:
    1. GuideKit HS256 tokens (from VS Code Extension / CLI / automated test suites).
    2. Clerk RS256 tokens (from the Next.js Web Console with JIT user provisioning).
    """
    if credentials is None or not credentials.credentials:
        raise _unauthorized("Missing bearer token")

    raw_token = credentials.credentials

    # Inspect algorithm without signature verification first
    try:
        header = jwt.get_unverified_header(raw_token)
        alg = header.get("alg", "HS256")
    except Exception as exc:
        raise _unauthorized("Invalid token header") from exc

    # -----------------------------------------------------------------------
    # Case A: Clerk RS256 Token (Web Dashboard)
    # -----------------------------------------------------------------------
    if alg == "RS256":
        try:
            payload = decode_clerk_token(raw_token)
        except jwt.exceptions.MissingCryptographyError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Google session verification is unavailable. Install the backend authentication dependencies and restart the API.",
            ) from exc
        except jwt.PyJWKClientConnectionError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to reach Google session verification keys. Please retry shortly.",
            ) from exc
        except (jwt.PyJWTError, jwt.PyJWKClientError) as exc:
            raise _unauthorized("Invalid or expired Clerk session token") from exc

        clerk_sub = payload.get("sub")
        if not clerk_sub:
            raise _unauthorized("Clerk token missing subject")

        authorized_party = (payload.get("azp") or "").rstrip("/")
        allowed_parties = {party.rstrip("/") for party in settings.clerk_authorized_parties}
        if allowed_parties and authorized_party not in allowed_parties:
            raise _unauthorized("Clerk token has an invalid authorized party")

        # The Clerk subject is the stable identity key. Older local builds used
        # the provider label ``clerk``; recognize the same subject and normalize
        # it instead of trying to insert a duplicate developer by email.
        stmt = select(Developer).where(Developer.auth_provider_id == clerk_sub)
        developer = (await db.execute(stmt)).scalar_one_or_none()

        if developer is not None and developer.auth_provider != "google":
            developer.auth_provider = "google"
            await db.commit()
            await db.refresh(developer)

        if developer is None:
            email, display_name = await _fetch_clerk_profile(clerk_sub)
            dev_id = uuid.uuid4()
            developer = Developer(
                id=dev_id,
                email=email,
                display_name=display_name,
                auth_provider="google",
                auth_provider_id=clerk_sub,
            )
            db.add(developer)
            try:
                await db.commit()
                await db.refresh(developer)
            except IntegrityError:
                # A concurrent first request may have provisioned the same Clerk user.
                await db.rollback()
                developer = (await db.execute(stmt)).scalar_one_or_none()
                if developer is None:
                    raise

        await set_local_developer(db, developer.id)
        return developer

    # -----------------------------------------------------------------------
    # Case B: GuideKit HS256 Token (VS Code Extension, CLI, Tests)
    # -----------------------------------------------------------------------
    try:
        payload = decode_access_token(raw_token)
    except jwt.PyJWTError as exc:
        raise _unauthorized("Invalid or expired access token") from exc

    if payload.get("type") != "access":
        raise _unauthorized("Invalid token type")

    try:
        developer_id = uuid.UUID(payload["sub"])
    except (KeyError, TypeError, ValueError) as exc:
        raise _unauthorized("Invalid token subject") from exc

    developer = await db.get(Developer, developer_id)
    if developer is None:
        raise _unauthorized("Developer no longer exists")

    # Scope this transaction so RLS policies in schema_v2.sql section 10 apply.
    await set_local_developer(db, developer.id)
    return developer


@dataclass(frozen=True)
class VerifiedSDKProject:
    """Result of SDK publishable-key + Origin verification."""

    project: Project
    key: ProjectKey
    origin: str


async def verified_sdk_project(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_service_db)],
) -> VerifiedSDKProject:
    """Validate an SDK publishable key and its ``Origin`` header.

    The SDK never logs in; it only presents a publishable key. The key is
    public by design, so the security boundary is the project's allowed-origin
    list plus rate limits and quotas.
    """
    try:
        body = await request.json()
    except Exception as exc:  # noqa: BLE001 - malformed/empty body is a client error
        raise HTTPException(status_code=400, detail="Invalid JSON body") from exc

    publishable_key = body.get("publishable_key")
    if not publishable_key or not isinstance(publishable_key, str):
        raise HTTPException(status_code=401, detail="Missing publishable_key")

    key = (
        await db.execute(select(ProjectKey).where(ProjectKey.key_hash == sha256_hex(publishable_key)))
    ).scalar_one_or_none()
    if key is None or key.key_type != "publishable" or key.revoked_at is not None:
        raise HTTPException(status_code=401, detail="Invalid or revoked publishable key")

    origin = (request.headers.get("origin") or "").rstrip("/")
    if not origin:
        raise HTTPException(status_code=403, detail="Missing Origin header")

    allowed = (
        await db.execute(
            select(ProjectOrigin).where(
                ProjectOrigin.project_id == key.project_id,
                ProjectOrigin.origin == origin,
            )
        )
    ).scalar_one_or_none()
    if allowed is None:
        raise HTTPException(status_code=403, detail="Origin is not allowed for this project")

    project = await db.get(Project, key.project_id)
    if project is None:
        raise HTTPException(status_code=401, detail="Project not found")

    return VerifiedSDKProject(project=project, key=key, origin=origin)


# Convenience type aliases used in endpoint signatures.
CurrentDeveloper = Annotated[Developer, Depends(get_current_developer)]
VerifiedSDKProjectDep = Annotated[VerifiedSDKProject, Depends(verified_sdk_project)]
