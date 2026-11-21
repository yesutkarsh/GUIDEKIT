"""Unit tests for Phase 3 publisher endpoints and embedding service."""

from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.deps import get_current_developer
from app.core.embeddings import embed_texts, local_deterministic_embedding
from app.core.security import sha256_hex
from app.db.session import get_db, get_service_db
from app.main import app
from app.models.project import Project, ProjectKey
from app.models.workflows import Feature, FeatureVersion, PublishedManifest

PROJECT_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
DEVELOPER_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)
TEST_KEY_PLAIN = "gk_pk_live_testkey12345678901234567890"


# ---------------------------------------------------------------------------
# 1. Embedding Service Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_embeddings_unit_norm_and_dimensions():
    texts = ["Book a taxi ride", "Instant cash withdrawal", ""]
    vectors = await embed_texts(texts)
    assert len(vectors) == 3
    for v in vectors:
        assert len(v) == 1536
        norm = math.sqrt(sum(x * x for x in v))
        assert abs(norm - 1.0) < 1e-4


@pytest.mark.asyncio
async def test_embeddings_semantic_similarity():
    query = "How to withdraw cash while driving"
    related = "Request instant driver payout"
    unrelated = "Change your profile photo in settings"

    v_query, v_related, v_unrelated = await embed_texts([query, related, unrelated])

    sim_related = sum(a * b for a, b in zip(v_query, v_related))
    sim_unrelated = sum(a * b for a, b in zip(v_query, v_unrelated))

    assert sim_related > sim_unrelated, f"Related ({sim_related:.4f}) should exceed unrelated ({sim_unrelated:.4f})"


# ---------------------------------------------------------------------------
# 2. Workflow Sync Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_workflow_sync_endpoint():
    dev_mock = MagicMock()
    dev_mock.id = DEVELOPER_ID

    project_mock = MagicMock(spec=Project)
    project_mock.id = PROJECT_ID

    db_mock = AsyncMock()
    db_mock.add = MagicMock()
    db_mock.get.return_value = project_mock

    # scalars().all() returns empty, scalar() returns None
    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = []
    db_mock.execute.return_value = result_mock
    db_mock.scalar.return_value = None
    db_mock.commit = AsyncMock()
    db_mock.flush = AsyncMock()

    app.dependency_overrides[get_current_developer] = lambda: dev_mock
    app.dependency_overrides[get_db] = lambda: db_mock

    payload = {
        "features": [
            {
                "slug": "login",
                "content": {"en": {"title": "Sign In", "intent_description": "User login"}},
                "example_queries": ["Login", "Sign in"],
                "requires_auth": False,
                "required_role": None,
                "prerequisite_feature_slug": None,
                "steps": [
                    {
                        "step_order": 1,
                        "guide_id": "phone-step",
                        "route_pattern": "/login",
                        "action_type": "input",
                        "advance_on": "input_valid",
                        "is_optional": False,
                        "wait_timeout_ms": 5000,
                        "condition": None,
                        "content": {"en": {"title": "Enter Phone"}},
                        "target_fingerprint": {"guide_id": "phone-step", "css": "#phone"},
                    }
                ],
            }
        ]
    }

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.post(
                f"/api/v1/projects/{PROJECT_ID}/workflows/sync",
                json=payload,
                headers={"Authorization": "Bearer fake_token"},
            )
            assert res.status_code == 200, res.text
            data = res.json()
            assert data["synced_features"] == 1
            assert len(data["draft_versions"]) == 1
            assert data["draft_versions"][0]["slug"] == "login"
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 3. Knowledge Sync Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_knowledge_sync_endpoint():
    dev_mock = MagicMock()
    dev_mock.id = DEVELOPER_ID

    project_mock = MagicMock(spec=Project)
    project_mock.id = PROJECT_ID

    db_mock = AsyncMock()
    db_mock.add = MagicMock()
    db_mock.get.return_value = project_mock
    db_mock.scalar.return_value = None
    db_mock.commit = AsyncMock()
    db_mock.flush = AsyncMock()

    app.dependency_overrides[get_current_developer] = lambda: dev_mock
    app.dependency_overrides[get_db] = lambda: db_mock

    payload = {
        "sources": [
            {
                "source_type": "code_summary",
                "title": "Taxi Sanchalak Architecture",
                "uri": "README.md",
                "locale": "en",
                "chunks": ["Taxi Sanchalak is a ride hailing portal.", "Built with SvelteKit."],
            }
        ]
    }

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.post(
                f"/api/v1/projects/{PROJECT_ID}/knowledge/sync",
                json=payload,
                headers={"Authorization": "Bearer fake_token"},
            )
            assert res.status_code == 200, res.text
            data = res.json()
            assert data["synced_sources"] == 1
            assert data["indexed_chunks"] == 2
            assert data["skipped_sources"] == 0
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 4. Manifest Publish Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_publish_manifest_endpoint():
    dev_mock = MagicMock()
    dev_mock.id = DEVELOPER_ID

    project_mock = MagicMock(spec=Project)
    project_mock.id = PROJECT_ID
    project_mock.name = "Test Project"
    project_mock.slug = "test-project"
    project_mock.framework = "nextjs"
    project_mock.default_locale = "en"
    project_mock.supported_locales = ["en"]
    project_mock.auth_detection_config = {}
    project_mock.chat_settings = {}

    db_mock = AsyncMock()
    db_mock.add = MagicMock()
    db_mock.get.return_value = project_mock

    # Return 0 draft versions and 1 published version
    feat_mock = MagicMock(spec=Feature)
    feat_mock.id = uuid.uuid4()
    feat_mock.slug = "book-taxi"

    fv_mock = MagicMock(spec=FeatureVersion)
    fv_mock.id = uuid.uuid4()
    fv_mock.feature_id = feat_mock.id
    fv_mock.version_number = 1
    fv_mock.requires_auth = False
    fv_mock.required_role = None
    fv_mock.prerequisite_feature_id = None
    fv_mock.content = {"en": {"title": "Book Taxi", "intent_description": "Booking"}}
    fv_mock.example_queries = ["Book ride"]

    exec_result = MagicMock()
    exec_result.scalars.return_value.all.return_value = [fv_mock]
    db_mock.execute.return_value = exec_result

    db_mock.scalar.return_value = 0
    db_mock.commit = AsyncMock()
    db_mock.flush = AsyncMock()
    db_mock.refresh = AsyncMock()

    app.dependency_overrides[get_current_developer] = lambda: dev_mock
    app.dependency_overrides[get_db] = lambda: db_mock

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.post(
                f"/api/v1/projects/{PROJECT_ID}/publish",
                json={},
                headers={"Authorization": "Bearer fake_token"},
            )
            assert res.status_code == 200, res.text
            data = res.json()
            assert data["manifest_version"] == 1
            assert "etag" in data
            assert data["byte_size"] > 0
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 5. SDK Manifest Delivery & ETag 304 Caching Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sdk_manifest_delivery_and_caching():
    key_mock = MagicMock(spec=ProjectKey)
    key_mock.id = uuid.uuid4()
    key_mock.project_id = PROJECT_ID
    key_mock.key_type = "publishable"
    key_mock.revoked_at = None

    project_mock = MagicMock(spec=Project)
    project_mock.id = PROJECT_ID
    project_mock.name = "Test Project"
    project_mock.slug = "test-project"
    project_mock.framework = "nextjs"
    project_mock.default_locale = "en"
    project_mock.supported_locales = ["en"]

    manifest_mock = MagicMock(spec=PublishedManifest)
    manifest_mock.project_id = PROJECT_ID
    manifest_mock.manifest_version = 1
    manifest_mock.etag = 'W/"test_etag_12345"'
    manifest_mock.published_at = NOW

    db_mock = AsyncMock()
    db_mock.add = MagicMock()
    db_mock.get.return_value = project_mock

    # execute returns key_mock on first call, manifest_mock on second call
    exec_result_key = MagicMock()
    exec_result_key.scalar_one_or_none.return_value = key_mock

    exec_result_manifest = MagicMock()
    exec_result_manifest.scalar_one_or_none.return_value = manifest_mock

    db_mock.execute.side_effect = [exec_result_key, exec_result_manifest, exec_result_key, exec_result_manifest]
    db_mock.scalar.return_value = uuid.uuid4()  # origin allowed
    db_mock.commit = AsyncMock()

    app.dependency_overrides[get_service_db] = lambda: db_mock

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. 200 OK delivery
            res1 = await client.get(
                "/api/v1/sdk/manifest",
                headers={
                    "X-GuideKit-Key": TEST_KEY_PLAIN,
                    "Origin": "http://localhost:3000",
                },
            )
            assert res1.status_code == 200, res1.text
            assert res1.headers["ETag"] == 'W/"test_etag_12345"'

            # 2. 304 Not Modified
            res2 = await client.get(
                "/api/v1/sdk/manifest",
                headers={
                    "X-GuideKit-Key": TEST_KEY_PLAIN,
                    "Origin": "http://localhost:3000",
                    "If-None-Match": 'W/"test_etag_12345"',
                },
            )
            assert res2.status_code == 304, res2.text
            assert res2.headers["ETag"] == 'W/"test_etag_12345"'
    finally:
        app.dependency_overrides.clear()
