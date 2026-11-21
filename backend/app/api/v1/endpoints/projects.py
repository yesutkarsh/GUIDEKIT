"""Organization, project, allowed-origin and API-key provisioning endpoints.

Every endpoint here is developer-scoped: the ``CurrentDeveloper`` dependency
sets the Row-Level-Security context, so ``projects``, ``project_origins`` and
``project_keys`` are automatically filtered to the developer's own tenancy.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentDeveloper
from app.core.security import generate_api_key, sha256_hex
from app.core.utils import slugify, utcnow
from app.db.session import get_db
from app.models.identity import MemberRole, Organization, OrgMember
from app.models.project import KeyType, Project, ProjectKey, ProjectOrigin
from app.schemas.auth import OrganizationOut
from app.schemas.project import (
    KeyCreate,
    KeyCreatedResponse,
    KeyOut,
    OrgCreate,
    OrgUpdate,
    OriginCreate,
    OriginOut,
    ProjectCreate,
    ProjectOut,
)

router = APIRouter(tags=["projects"])

DbSession = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_accessible_project(db: AsyncSession, project_id: uuid.UUID) -> Project:
    """Fetch a project, returning 404 unless the developer has RLS access."""
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


async def _require_org_member(
    db: AsyncSession, org_id: uuid.UUID, developer_id: uuid.UUID
) -> Organization:
    org = await db.get(Organization, org_id)
    member = await db.scalar(
        select(OrgMember.org_id).where(
            OrgMember.org_id == org_id, OrgMember.developer_id == developer_id
        )
    )
    if org is None or member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


async def _unique_project_slug(db: AsyncSession, org_id: uuid.UUID, base: str) -> str:
    base = slugify(base)
    for attempt in range(5):
        slug = base if attempt == 0 else f"{base[:60]}-{uuid.uuid4().hex[:4]}"
        clash = await db.scalar(
            select(Project.id).where(Project.org_id == org_id, Project.slug == slug)
        )
        if clash is None:
            return slug
    raise HTTPException(status_code=500, detail="Could not generate a unique project slug")


# ---------------------------------------------------------------------------
# Organizations
# ---------------------------------------------------------------------------

@router.get("/orgs", response_model=list[OrganizationOut], summary="List my organizations")
async def list_orgs(developer: CurrentDeveloper, db: DbSession) -> list[Organization]:
    organizations = (
        await db.execute(
            select(Organization)
            .join(OrgMember, OrgMember.org_id == Organization.id)
            .where(OrgMember.developer_id == developer.id)
            .order_by(Organization.created_at)
        )
    ).scalars().all()
    return list(organizations)


@router.post(
    "/orgs",
    response_model=OrganizationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create an organization (creator becomes owner)",
)
async def create_org(
    payload: OrgCreate, developer: CurrentDeveloper, db: DbSession
) -> Organization:
    base_slug = payload.slug or slugify(payload.name)
    for attempt in range(5):
        slug = base_slug if attempt == 0 else f"{base_slug[:60]}-{uuid.uuid4().hex[:4]}"
        clash = await db.scalar(select(Organization.id).where(Organization.slug == slug))
        if clash is None:
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate a unique organization slug")

    org = Organization(name=payload.name, slug=slug)
    db.add(org)
    await db.flush()
    db.add(OrgMember(org_id=org.id, developer_id=developer.id, role=MemberRole.OWNER.value))
    await db.commit()
    await db.refresh(org)
    return org


@router.patch("/orgs/{org_id}", response_model=OrganizationOut, summary="Rename an organization")
async def update_org(
    org_id: uuid.UUID,
    payload: OrgUpdate,
    developer: CurrentDeveloper,
    db: DbSession,
) -> Organization:
    org = await _require_org_member(db, org_id, developer.id)
    org.name = payload.name
    await db.commit()
    await db.refresh(org)
    return org


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

@router.post(
    "/orgs/{org_id}/projects",
    response_model=ProjectOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a project inside an organization",
)
async def create_project(
    org_id: uuid.UUID,
    payload: ProjectCreate,
    developer: CurrentDeveloper,
    db: DbSession,
) -> Project:
    await _require_org_member(db, org_id, developer.id)

    project = Project(
        org_id=org_id,
        name=payload.name,
        slug=await _unique_project_slug(db, org_id, payload.slug or payload.name),
        framework=payload.framework.value,
        default_locale=payload.default_locale,
        supported_locales=payload.supported_locales,
        auth_detection_config=payload.auth_detection_config,
        chat_settings=payload.chat_settings,
        environment=payload.environment.value,
        background_id=payload.background_id.value,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/projects", response_model=list[ProjectOut], summary="List projects I can access")
async def list_projects(
    developer: CurrentDeveloper,
    db: DbSession,
    org_id: uuid.UUID | None = None,
) -> list[Project]:
    if org_id is not None:
        await _require_org_member(db, org_id, developer.id)

    query = (
        select(Project)
        .join(OrgMember, OrgMember.org_id == Project.org_id)
        .where(OrgMember.developer_id == developer.id)
    )
    if org_id is not None:
        query = query.where(Project.org_id == org_id)

    projects = (
        await db.execute(query.order_by(Project.created_at.desc()))
    ).scalars().all()
    return list(projects)


@router.get("/projects/{project_id}", response_model=ProjectOut, summary="Get a project")
async def get_project(
    project_id: uuid.UUID, developer: CurrentDeveloper, db: DbSession
) -> Project:
    return await _get_accessible_project(db, project_id)


# ---------------------------------------------------------------------------
# Allowed origins
# ---------------------------------------------------------------------------

@router.get(
    "/projects/{project_id}/origins",
    response_model=list[OriginOut],
    summary="List allowed origins for a project",
)
async def list_origins(
    project_id: uuid.UUID, developer: CurrentDeveloper, db: DbSession
) -> list[ProjectOrigin]:
    await _get_accessible_project(db, project_id)
    origins = (
        await db.execute(
            select(ProjectOrigin)
            .where(ProjectOrigin.project_id == project_id)
            .order_by(ProjectOrigin.created_at)
        )
    ).scalars().all()
    return list(origins)


@router.post(
    "/projects/{project_id}/origins",
    response_model=OriginOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add an allowed origin for a project",
)
async def create_origin(
    project_id: uuid.UUID,
    payload: OriginCreate,
    developer: CurrentDeveloper,
    db: DbSession,
) -> ProjectOrigin:
    await _get_accessible_project(db, project_id)

    origin = payload.origin.rstrip("/")
    duplicate = await db.scalar(
        select(ProjectOrigin.id).where(
            ProjectOrigin.project_id == project_id, ProjectOrigin.origin == origin
        )
    )
    if duplicate is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Origin already added")

    row = ProjectOrigin(
        project_id=project_id,
        origin=origin,
        environment=payload.environment.value,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.delete(
    "/projects/{project_id}/origins/{origin_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove an allowed origin",
)
async def delete_origin(
    project_id: uuid.UUID,
    origin_id: uuid.UUID,
    developer: CurrentDeveloper,
    db: DbSession,
) -> None:
    await _get_accessible_project(db, project_id)
    row = await db.get(ProjectOrigin, origin_id)
    if row is None or row.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Origin not found")
    await db.delete(row)
    await db.commit()


# ---------------------------------------------------------------------------
# API keys
# ---------------------------------------------------------------------------

@router.get(
    "/projects/{project_id}/keys",
    response_model=list[KeyOut],
    summary="List API keys for a project",
)
async def list_keys(
    project_id: uuid.UUID, developer: CurrentDeveloper, db: DbSession
) -> list[ProjectKey]:
    await _get_accessible_project(db, project_id)
    keys = (
        await db.execute(
            select(ProjectKey)
            .where(ProjectKey.project_id == project_id, ProjectKey.revoked_at.is_(None))
            .order_by(ProjectKey.created_at)
        )
    ).scalars().all()
    return list(keys)


@router.post(
    "/projects/{project_id}/keys",
    response_model=KeyCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a publishable or secret API key",
)
async def create_key(
    project_id: uuid.UUID,
    payload: KeyCreate,
    developer: CurrentDeveloper,
    db: DbSession,
) -> KeyCreatedResponse:
    await _get_accessible_project(db, project_id)

    full_key, key_prefix = generate_api_key(payload.key_type.value)
    is_publishable = payload.key_type is KeyType.PUBLISHABLE

    row = ProjectKey(
        project_id=project_id,
        key_type=payload.key_type.value,
        key_prefix=key_prefix,
        key_hash=sha256_hex(full_key),
        key_plain=full_key if is_publishable else None,
        label=payload.label,
        created_by=developer.id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    return KeyCreatedResponse(key=KeyOut.model_validate(row), full_key=full_key)


@router.delete(
    "/projects/{project_id}/keys/{key_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke an API key",
)
async def revoke_key(
    project_id: uuid.UUID,
    key_id: uuid.UUID,
    developer: CurrentDeveloper,
    db: DbSession,
) -> None:
    await _get_accessible_project(db, project_id)
    row = await db.get(ProjectKey, key_id)
    if row is None or row.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Key not found")
    if row.revoked_at is None:
        row.revoked_at = utcnow()
        await db.commit()
