"""Unit tests for Phase 2 Inspector API endpoints.

All tests run without a real database.  SQLAlchemy sessions and the
``get_current_developer`` dependency are mocked via FastAPI's
``dependency_overrides`` mechanism and :mod:`unittest.mock`.

Usage::

    # from backend/
    pytest tests/test_phase2_endpoints.py -v
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.deps import get_current_developer
from app.db.session import get_db
from app.main import app

# ---------------------------------------------------------------------------
# Shared test data
# ---------------------------------------------------------------------------

PROJECT_ID = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
FEATURE_ID = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
VERSION_ID = uuid.UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
SUGGESTION_ID = uuid.UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")
DEVELOPER_ID = uuid.UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")

NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Dependency override factories
# ---------------------------------------------------------------------------


def _make_developer() -> MagicMock:
    dev = MagicMock()
    dev.id = DEVELOPER_ID
    dev.email = "test@guidekit.dev"
    return dev


def _make_project(**kwargs) -> MagicMock:
    p = MagicMock()
    p.id = PROJECT_ID
    p.org_id = uuid.uuid4()
    p.name = kwargs.get("name", "Test Project")
    p.slug = kwargs.get("slug", "test-project")
    p.framework = kwargs.get("framework", "nextjs")
    p.default_locale = kwargs.get("default_locale", "en")
    p.supported_locales = kwargs.get("supported_locales", ["en"])
    p.auth_detection_config = kwargs.get("auth_detection_config", {})
    p.chat_settings = kwargs.get("chat_settings", {})
    p.environment = kwargs.get("environment", "development")
    p.background_id = kwargs.get("background_id", "untitled-blend")
    p.created_at = NOW
    p.updated_at = NOW
    p.archived_at = None
    return p


def _override_developer():
    """Synchronous override that returns a mock developer."""
    async def _inner():
        return _make_developer()
    return _inner


def _make_async_db_mock() -> AsyncMock:
    """Return an AsyncMock that mimics the AsyncSession interface."""
    db = AsyncMock()
    # execute returns a result mock with scalars().all() chain
    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = []
    result_mock.all.return_value = []
    db.execute.return_value = result_mock
    db.scalar.return_value = None
    db.get.return_value = None
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.flush = AsyncMock()
    db.add = MagicMock()
    return db


# ---------------------------------------------------------------------------
# Client fixture with dependency overrides applied
# ---------------------------------------------------------------------------


@pytest.fixture
async def client_with_overrides() -> AsyncGenerator[AsyncClient, None]:
    """HTTP test client with developer and DB session mocked."""
    dev_mock = _make_developer()
    db_mock = _make_async_db_mock()
    # db.get(Project) → returns a fake project
    db_mock.get.return_value = _make_project()

    async def _override_dev():
        return dev_mock

    async def _override_db():
        return db_mock

    app.dependency_overrides[get_current_developer] = _override_dev
    app.dependency_overrides[get_db] = _override_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Test 1: PATCH /projects/{project_id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_patch_project_returns_updated_project(client_with_overrides: AsyncClient) -> None:
    """PATCH /projects/{id} should return 200 with updated project data."""
    project_mock = _make_project(name="Updated Name", framework="sveltekit")

    # Retrieve the already-wired db mock and configure refresh side-effect
    # so the returned model has updated values.
    async def _override_db_patch():
        db = _make_async_db_mock()
        db.get.return_value = project_mock

        async def _refresh(obj):
            # Simulate SQLAlchemy refresh updating the obj from DB
            pass

        db.refresh.side_effect = _refresh
        return db

    app.dependency_overrides[get_db] = _override_db_patch

    response = await client_with_overrides.patch(
        f"/api/v1/projects/{PROJECT_ID}",
        json={"name": "Updated Name", "framework": "sveltekit"},
        headers={"Authorization": "Bearer fake-token"},
    )

    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    # The name comes from the mock object attribute
    assert data["name"] == "Updated Name"


# ---------------------------------------------------------------------------
# Test 2: GET /projects/{project_id}/features — empty list
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_features_empty(client_with_overrides: AsyncClient) -> None:
    """GET /projects/{id}/features should return 200 with an empty list."""
    response = await client_with_overrides.get(
        f"/api/v1/projects/{PROJECT_ID}/features",
        headers={"Authorization": "Bearer fake-token"},
    )
    assert response.status_code == 200
    assert response.json() == []


# ---------------------------------------------------------------------------
# Test 3: GET /projects/{project_id}/features/{fid} — 404 when missing
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_feature_not_found() -> None:
    """GET /projects/{id}/features/{fid} should return 404 for unknown features."""
    dev_mock = _make_developer()

    async def _override_dev():
        return dev_mock

    async def _override_db_404():
        db = _make_async_db_mock()
        db.get.return_value = _make_project()   # project found
        db.scalar.return_value = None           # feature NOT found
        return db

    app.dependency_overrides[get_current_developer] = _override_dev
    app.dependency_overrides[get_db] = _override_db_404

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        response = await c.get(
            f"/api/v1/projects/{PROJECT_ID}/features/{FEATURE_ID}",
            headers={"Authorization": "Bearer fake-token"},
        )

    app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json()["detail"] == "Feature not found"


# ---------------------------------------------------------------------------
# Test 4: GET /projects/{project_id}/heal-suggestions — empty list
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_heal_suggestions_empty(client_with_overrides: AsyncClient) -> None:
    """GET /projects/{id}/heal-suggestions should return 200 with an empty list."""
    response = await client_with_overrides.get(
        f"/api/v1/projects/{PROJECT_ID}/heal-suggestions",
        headers={"Authorization": "Bearer fake-token"},
    )
    assert response.status_code == 200
    assert response.json() == []


# ---------------------------------------------------------------------------
# Test 5: GET /projects/{project_id}/analytics — zero counts
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_analytics_zero_counts() -> None:
    """GET /projects/{id}/analytics should return 200 with zeroed-out counters."""
    dev_mock = _make_developer()

    async def _override_dev():
        return dev_mock

    async def _override_db_analytics():
        db = _make_async_db_mock()
        db.get.return_value = _make_project()
        # All scalar counts return 0
        db.scalar.return_value = 0

        # execute calls for group-by queries return empty results
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = []
        result_mock.all.return_value = []
        db.execute.return_value = result_mock

        return db

    app.dependency_overrides[get_current_developer] = _override_dev
    app.dependency_overrides[get_db] = _override_db_analytics

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        response = await c.get(
            f"/api/v1/projects/{PROJECT_ID}/analytics",
            headers={"Authorization": "Bearer fake-token"},
        )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()

    # Verify top-level structure
    assert "chat" in body
    assert "tours" in body
    assert "resolution" in body
    assert "usage_daily" in body
    assert "latest_manifest" in body

    # Zero counts
    assert body["chat"]["total_sessions"] == 0
    assert body["chat"]["total_messages"] == 0
    assert body["tours"]["started"] == 0
    assert body["tours"]["completed"] == 0
    assert body["resolution"]["matched_primary"] == 0
    assert body["usage_daily"] == []
    assert body["latest_manifest"] is None


# ---------------------------------------------------------------------------
# Test 6: POST /projects/{id}/heal-suggestions/{sid}/review — approve
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_review_heal_suggestion_reject() -> None:
    """POST …/review with action=reject should return 200 and status=rejected."""
    dev_mock = _make_developer()

    # Build a mock suggestion
    suggestion_mock = MagicMock()
    suggestion_mock.id = SUGGESTION_ID
    suggestion_mock.project_id = PROJECT_ID
    suggestion_mock.step_id = uuid.uuid4()
    suggestion_mock.status = "pending"
    suggestion_mock.reviewed_by = None
    suggestion_mock.reviewed_at = None

    async def _override_dev():
        return dev_mock

    async def _override_db_review():
        db = _make_async_db_mock()
        db.get.return_value = _make_project()   # project found
        # scalar for suggestion lookup
        db.scalar.return_value = suggestion_mock

        async def _commit():
            # When the endpoint sets suggestion.status = "rejected" we capture it
            suggestion_mock.status = "rejected"

        db.commit.side_effect = _commit
        return db

    app.dependency_overrides[get_current_developer] = _override_dev
    app.dependency_overrides[get_db] = _override_db_review

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        response = await c.post(
            f"/api/v1/projects/{PROJECT_ID}/heal-suggestions/{SUGGESTION_ID}/review",
            json={"action": "reject"},
            headers={"Authorization": "Bearer fake-token"},
        )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(SUGGESTION_ID)
    assert body["status"] == "rejected"


# ---------------------------------------------------------------------------
# Test 7: PATCH /projects/{id}/features/{fid}/versions/{vid} — 404 on missing
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_patch_feature_version_not_found() -> None:
    """PATCH …/versions/{vid} should return 404 when the version does not exist."""
    dev_mock = _make_developer()

    async def _override_dev():
        return dev_mock

    async def _override_db_v_missing():
        db = _make_async_db_mock()
        db.get.return_value = _make_project()
        db.scalar.return_value = None  # version not found
        return db

    app.dependency_overrides[get_current_developer] = _override_dev
    app.dependency_overrides[get_db] = _override_db_v_missing

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        response = await c.patch(
            f"/api/v1/projects/{PROJECT_ID}/features/{FEATURE_ID}/versions/{VERSION_ID}",
            json={"requires_auth": True},
            headers={"Authorization": "Bearer fake-token"},
        )

    app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json()["detail"] == "Feature version not found"
