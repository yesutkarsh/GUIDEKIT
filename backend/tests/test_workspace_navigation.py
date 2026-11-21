from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.v1.endpoints.projects import create_project, list_projects, update_org
from app.schemas.project import OrgUpdate, ProjectCreate


@pytest.mark.asyncio
async def test_workspace_rename_requires_membership() -> None:
    db = AsyncMock()
    db.get.return_value = SimpleNamespace(id=uuid.uuid4(), name="Old", slug="old")
    db.scalar.return_value = None

    with pytest.raises(HTTPException) as caught:
        await update_org(db.get.return_value.id, OrgUpdate(name="New"), SimpleNamespace(id=uuid.uuid4()), db)

    assert caught.value.status_code == 404
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_workspace_rename_keeps_slug_immutable() -> None:
    org_id = uuid.uuid4()
    developer_id = uuid.uuid4()
    organization = SimpleNamespace(id=org_id, name="Old name", slug="stable-slug")
    db = AsyncMock()
    db.get.return_value = organization
    db.scalar.return_value = org_id

    renamed = await update_org(org_id, OrgUpdate(name="  New name  "), SimpleNamespace(id=developer_id), db)

    assert renamed.name == "New name"
    assert renamed.slug == "stable-slug"
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(organization)


@pytest.mark.asyncio
async def test_project_listing_filters_and_authorizes_selected_workspace() -> None:
    org_id = uuid.uuid4()
    developer = SimpleNamespace(id=uuid.uuid4())
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    db = AsyncMock()
    db.execute.return_value = result

    with patch("app.api.v1.endpoints.projects._require_org_member", new=AsyncMock()) as require_member:
        projects = await list_projects(developer, db, org_id=org_id)

    assert projects == []
    require_member.assert_awaited_once_with(db, org_id, developer.id)
    statement = str(db.execute.await_args.args[0])
    assert "projects.org_id" in statement


@pytest.mark.asyncio
async def test_project_listing_without_workspace_remains_compatible() -> None:
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    db = AsyncMock()
    db.execute.return_value = result

    with patch("app.api.v1.endpoints.projects._require_org_member", new=AsyncMock()) as require_member:
        assert await list_projects(SimpleNamespace(id=uuid.uuid4()), db) == []

    require_member.assert_not_awaited()


def test_workspace_name_validation_is_bounded_and_non_blank() -> None:
    with pytest.raises(ValidationError):
        OrgUpdate(name="   ")
    with pytest.raises(ValidationError):
        OrgUpdate(name="x" * 121)


@pytest.mark.asyncio
async def test_project_creation_persists_environment_and_background_without_origin() -> None:
    org_id = uuid.uuid4()
    developer = SimpleNamespace(id=uuid.uuid4())
    db = AsyncMock()
    db.scalar.return_value = None
    db.add = MagicMock()

    with (
        patch("app.api.v1.endpoints.projects._require_org_member", new=AsyncMock()),
        patch("app.api.v1.endpoints.projects._unique_project_slug", new=AsyncMock(return_value="new-product")),
    ):
        project = await create_project(
            org_id,
            ProjectCreate(name="New Product", environment="staging", background_id="citron"),
            developer,
            db,
        )

    assert project.environment == "staging"
    assert project.background_id == "citron"
    assert project.default_locale == "en"
    assert project.supported_locales == ["en"]
    db.add.assert_called_once_with(project)
    db.commit.assert_awaited_once()
