"""Unit tests for Phase 4 Runtime SDK endpoints:
Chat Router, Flow Stitcher, RAG, Self-Healing Resolver, and Telemetry Events.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.embeddings import embed_texts
from app.core.security import sha256_hex
from app.db.session import get_service_db
from app.main import app
from app.models.project import Project, ProjectKey, ProjectOrigin
from app.models.workflows import (
    Feature,
    FeatureEmbedding,
    FeatureVersion,
    KnowledgeChunk,
    KnowledgeSource,
    StepResolutionCache,
    WorkflowStep,
)

PROJECT_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
TEST_KEY_PLAIN = "gk_pk_live_runtime_test1234567890123456"
NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)


def _setup_test_project():
    project = MagicMock(spec=Project)
    project.id = PROJECT_ID
    project.name = "Taxi Sanchalak"
    project.slug = "taxi-sanchalak"
    project.framework = "sveltekit"
    project.default_locale = "en"
    project.supported_locales = ["en", "hi"]
    project.chat_settings = {
        "min_similarity": 0.40,
        "rag_similarity": 0.30,
        "out_of_scope_message": "Custom OOS Guardrail",
    }
    project.archived_at = None

    key = MagicMock(spec=ProjectKey)
    key.id = uuid.uuid4()
    key.project_id = PROJECT_ID
    key.key_type = "publishable"
    key.key_hash = sha256_hex(TEST_KEY_PLAIN)
    key.revoked_at = None
    key.last_used_at = NOW

    return project, key


@pytest.mark.asyncio
async def test_sdk_chat_smalltalk():
    """Route 1: Greeting or help message returns smalltalk reply listing features."""
    project, key = _setup_test_project()
    db_mock = AsyncMock()
    db_mock.add = MagicMock()
    db_mock.get.return_value = project

    login_feat = Feature(id=uuid.uuid4(), project_id=PROJECT_ID, slug="login")
    login_ver = FeatureVersion(
        id=uuid.uuid4(),
        feature_id=login_feat.id,
        project_id=PROJECT_ID,
        version_number=1,
        status="published",
        content={"en": {"title": "Sign In"}},
    )

    book_feat = Feature(id=uuid.uuid4(), project_id=PROJECT_ID, slug="book-taxi")
    book_ver = FeatureVersion(
        id=uuid.uuid4(),
        feature_id=book_feat.id,
        project_id=PROJECT_ID,
        version_number=1,
        status="published",
        content={"en": {"title": "Book a Taxi"}},
    )

    async def mock_execute(stmt, *args, **kwargs):
        res = MagicMock()
        stmt_str = str(stmt)
        if "project_keys" in stmt_str:
            res.scalar_one_or_none.return_value = key
        elif "project_origins" in stmt_str:
            res.scalar.return_value = uuid.uuid4()
        elif "chat_sessions" in stmt_str:
            res.scalar_one_or_none.return_value = None
        elif "features" in stmt_str and "feature_versions" in stmt_str:
            res.all.return_value = [(login_feat, login_ver), (book_feat, book_ver)]
        return res

    db_mock.execute = mock_execute
    app.dependency_overrides[get_service_db] = lambda: db_mock

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/sdk/chat",
                headers={"X-GuideKit-Key": TEST_KEY_PLAIN, "Origin": "https://taxisanchalak.com"},
                json={
                    "visitor_id": "vis_123",
                    "message": "Hello!",
                    "locale": "en",
                },
            )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["route_taken"] == "smalltalk"
        assert "Sign In" in data["reply"]
        assert "Book a Taxi" in data["reply"]
        assert data["tour_plan"] is None
    finally:
        app.dependency_overrides.pop(get_service_db, None)


@pytest.mark.asyncio
async def test_sdk_chat_feature_match_logged_out_prereq_stitching():
    """Route 2 Case A: Matched feature requires auth, user logged out -> stitches login first."""
    project, key = _setup_test_project()
    db_mock = AsyncMock()
    db_mock.add = MagicMock()
    db_mock.get.return_value = project

    # Login feature (prerequisite)
    login_feat = Feature(id=uuid.uuid4(), project_id=PROJECT_ID, slug="login")
    login_ver = FeatureVersion(
        id=uuid.uuid4(),
        feature_id=login_feat.id,
        project_id=PROJECT_ID,
        version_number=1,
        status="published",
        requires_auth=False,
        content={"en": {"title": "Sign In", "intent_description": "OTP Login"}},
        example_queries=["log in"],
    )
    login_step = WorkflowStep(
        id=uuid.uuid4(),
        feature_version_id=login_ver.id,
        step_order=1,
        guide_id="login-step-1",
        route_pattern="/login",
        action_type="input",
        advance_on="input_valid",
        content={"en": {"title": "Enter Mobile Number"}},
        target_fingerprint={"tag_name": "input"},
    )

    # Payout feature (requires auth & driver role)
    payout_feat = Feature(id=uuid.uuid4(), project_id=PROJECT_ID, slug="ask-money-on-the-go")
    payout_ver = FeatureVersion(
        id=uuid.uuid4(),
        feature_id=payout_feat.id,
        project_id=PROJECT_ID,
        version_number=1,
        status="published",
        requires_auth=True,
        required_role="driver",
        prerequisite_feature_id=login_feat.id,
        content={"en": {"title": "Ask for Money on the Go", "intent_description": "Request instant cash payout while driving"}},
        example_queries=["How do I ask for money while driving?", "Instant cash withdrawal"],
    )
    payout_step1 = WorkflowStep(
        id=uuid.uuid4(),
        feature_version_id=payout_ver.id,
        step_order=1,
        guide_id="payout-step-1",
        route_pattern="/driver/dashboard",
        action_type="input",
        advance_on="input_valid",
        content={"en": {"title": "Enter Payout Amount"}},
        target_fingerprint={"tag_name": "input"},
    )
    payout_step2 = WorkflowStep(
        id=uuid.uuid4(),
        feature_version_id=payout_ver.id,
        step_order=2,
        guide_id="payout-step-2",
        route_pattern="/driver/dashboard",
        action_type="click",
        advance_on="click",
        content={"en": {"title": "Tap Withdraw Cash"}},
        target_fingerprint={"tag_name": "button"},
    )

    # Embeddings for matching
    payout_vecs = await embed_texts(["Ask for Money on the Go", "Request instant cash payout while driving"])
    payout_emb = FeatureEmbedding(
        id=uuid.uuid4(),
        project_id=PROJECT_ID,
        feature_version_id=payout_ver.id,
        locale="en",
        source_text="Ask for Money on the Go",
        embedding=payout_vecs[0],
    )

    step_query_count = 0

    async def mock_execute(stmt, *args, **kwargs):
        nonlocal step_query_count
        res = MagicMock()
        stmt_str = str(stmt)
        if "project_keys" in stmt_str:
            res.scalar_one_or_none.return_value = key
        elif "project_origins" in stmt_str:
            res.scalar.return_value = uuid.uuid4()
        elif "chat_sessions" in stmt_str:
            res.scalar_one_or_none.return_value = None
        elif "feature_embeddings" in stmt_str:
            res.scalars.return_value.all.return_value = [payout_emb]
        elif "features" in stmt_str and "feature_versions" in stmt_str:
            res.all.return_value = [(login_feat, login_ver), (payout_feat, payout_ver)]
        elif "workflow_steps" in stmt_str:
            step_query_count += 1
            if step_query_count == 1:
                res.scalars.return_value.all.return_value = [payout_step1, payout_step2]
            else:
                res.scalars.return_value.all.return_value = [login_step]
        return res

    db_mock.execute = mock_execute
    app.dependency_overrides[get_service_db] = lambda: db_mock

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/sdk/chat",
                headers={"X-GuideKit-Key": TEST_KEY_PLAIN, "Origin": "https://taxisanchalak.com"},
                json={
                    "visitor_id": "vis_123",
                    "message": "How do I ask for money while driving?",
                    "locale": "en",
                    "auth_state": {"is_logged_in": False, "role": None},
                },
            )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["route_taken"] == "feature_match"
        assert data["matched_feature_slug"] == "ask-money-on-the-go"

        plan = data["tour_plan"]
        assert plan is not None
        assert plan["requires_login_first"] is True
        assert len(plan["chained_features"]) == 2
        assert plan["chained_features"][0]["slug"] == "login"
        assert plan["chained_features"][0]["is_prerequisite"] is True
        assert plan["chained_features"][1]["slug"] == "ask-money-on-the-go"

        # Stitched steps must start with login step then target steps
        steps = plan["steps"]
        assert len(steps) == 3
        assert steps[0]["execution_index"] == 1
        assert steps[0]["feature_slug"] == "login"
        assert steps[1]["execution_index"] == 2
        assert steps[1]["feature_slug"] == "ask-money-on-the-go"
        assert steps[2]["execution_index"] == 3
        assert steps[2]["feature_slug"] == "ask-money-on-the-go"
    finally:
        app.dependency_overrides.pop(get_service_db, None)


@pytest.mark.asyncio
async def test_sdk_chat_feature_match_logged_in_driver():
    """Route 2 Case C: Matched feature when already logged in with valid role -> no login prefix."""
    project, key = _setup_test_project()
    db_mock = AsyncMock()
    db_mock.add = MagicMock()
    db_mock.get.return_value = project

    payout_feat = Feature(id=uuid.uuid4(), project_id=PROJECT_ID, slug="ask-money-on-the-go")
    payout_ver = FeatureVersion(
        id=uuid.uuid4(),
        feature_id=payout_feat.id,
        project_id=PROJECT_ID,
        version_number=1,
        status="published",
        requires_auth=True,
        required_role="driver",
        content={"en": {"title": "Ask for Money on the Go"}},
        example_queries=["withdraw cash"],
    )
    payout_step = WorkflowStep(
        id=uuid.uuid4(),
        feature_version_id=payout_ver.id,
        step_order=1,
        guide_id="payout-step-1",
        route_pattern="/driver/dashboard",
        action_type="click",
        advance_on="click",
        content={"en": {"title": "Instant Cash"}},
        target_fingerprint={"tag_name": "button"},
    )
    payout_vecs = await embed_texts(["Ask for Money on the Go"])
    payout_emb = FeatureEmbedding(
        id=uuid.uuid4(),
        project_id=PROJECT_ID,
        feature_version_id=payout_ver.id,
        locale="en",
        source_text="Ask for Money on the Go",
        embedding=payout_vecs[0],
    )

    async def mock_execute(stmt, *args, **kwargs):
        res = MagicMock()
        stmt_str = str(stmt)
        if "project_keys" in stmt_str:
            res.scalar_one_or_none.return_value = key
        elif "project_origins" in stmt_str:
            res.scalar.return_value = uuid.uuid4()
        elif "chat_sessions" in stmt_str:
            res.scalar_one_or_none.return_value = None
        elif "feature_embeddings" in stmt_str:
            res.scalars.return_value.all.return_value = [payout_emb]
        elif "features" in stmt_str and "feature_versions" in stmt_str:
            res.all.return_value = [(payout_feat, payout_ver)]
        elif "workflow_steps" in stmt_str:
            res.scalars.return_value.all.return_value = [payout_step]
        return res

    db_mock.execute = mock_execute
    app.dependency_overrides[get_service_db] = lambda: db_mock

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/sdk/chat",
                headers={"X-GuideKit-Key": TEST_KEY_PLAIN, "Origin": "https://taxisanchalak.com"},
                json={
                    "visitor_id": "vis_123",
                    "message": "withdraw cash",
                    "locale": "en",
                    "auth_state": {"is_logged_in": True, "role": "driver"},
                },
            )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["route_taken"] == "feature_match"
        plan = data["tour_plan"]
        assert plan["requires_login_first"] is False
        assert len(plan["chained_features"]) == 1
        assert len(plan["steps"]) == 1
        assert plan["steps"][0]["feature_slug"] == "ask-money-on-the-go"
    finally:
        app.dependency_overrides.pop(get_service_db, None)


@pytest.mark.asyncio
async def test_sdk_chat_rag_fallback():
    """Route 3: No feature match, but knowledge chunk matches -> returns RAG answer."""
    project, key = _setup_test_project()
    db_mock = AsyncMock()
    db_mock.add = MagicMock()
    db_mock.get.return_value = project

    chunk_vecs = await embed_texts(["Zero commission fee applies to all instant withdrawals under Silver tier."])
    source = KnowledgeSource(id=uuid.uuid4(), project_id=PROJECT_ID, title="Pricing FAQs", source_type="faq")
    chunk = KnowledgeChunk(
        id=uuid.uuid4(),
        project_id=PROJECT_ID,
        source_id=source.id,
        chunk_index=0,
        content="Zero commission fee applies to all instant withdrawals under Silver tier.",
        embedding=chunk_vecs[0],
    )

    async def mock_execute(stmt, *args, **kwargs):
        res = MagicMock()
        stmt_str = str(stmt)
        if "project_keys" in stmt_str:
            res.scalar_one_or_none.return_value = key
        elif "project_origins" in stmt_str:
            res.scalar.return_value = uuid.uuid4()
        elif "chat_sessions" in stmt_str:
            res.scalar_one_or_none.return_value = None
        elif "features" in stmt_str and "feature_versions" in stmt_str:
            res.all.return_value = []
        elif "knowledge_chunks" in stmt_str:
            res.all.return_value = [(chunk, source)]
        return res

    db_mock.execute = mock_execute
    app.dependency_overrides[get_service_db] = lambda: db_mock

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/sdk/chat",
                headers={"X-GuideKit-Key": TEST_KEY_PLAIN, "Origin": "https://taxisanchalak.com"},
                json={
                    "visitor_id": "vis_123",
                    "message": "What is the commission fee for Silver tier?",
                    "locale": "en",
                },
            )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["route_taken"] == "rag_answer"
        assert "zero commission fee" in data["reply"].lower()
        assert len(data["retrieved_chunks"]) == 1
    finally:
        app.dependency_overrides.pop(get_service_db, None)


@pytest.mark.asyncio
async def test_sdk_chat_out_of_scope():
    """Route 4: Completely unrelated query -> guardrail response."""
    project, key = _setup_test_project()
    db_mock = AsyncMock()
    db_mock.add = MagicMock()
    db_mock.get.return_value = project

    async def mock_execute(stmt, *args, **kwargs):
        res = MagicMock()
        stmt_str = str(stmt)
        if "project_keys" in stmt_str:
            res.scalar_one_or_none.return_value = key
        elif "project_origins" in stmt_str:
            res.scalar.return_value = uuid.uuid4()
        elif "chat_sessions" in stmt_str:
            res.scalar_one_or_none.return_value = None
        elif "features" in stmt_str:
            res.all.return_value = []
        elif "knowledge_chunks" in stmt_str:
            res.all.return_value = []
        return res

    db_mock.execute = mock_execute
    app.dependency_overrides[get_service_db] = lambda: db_mock

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/sdk/chat",
                headers={"X-GuideKit-Key": TEST_KEY_PLAIN, "Origin": "https://taxisanchalak.com"},
                json={
                    "visitor_id": "vis_123",
                    "message": "What is the atmospheric composition of Jupiter's moons?",
                    "locale": "en",
                },
            )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["route_taken"] == "out_of_scope"
        assert "Custom OOS Guardrail" in data["reply"] or "assist" in data["reply"].lower()
    finally:
        app.dependency_overrides.pop(get_service_db, None)


# ---------------------------------------------------------------------------
# 3. Self-Healing Resolver Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sdk_heal_first_call_healed_by_ai():
    """Heal Call 1: Misses cache, scores candidates, returns healed_by_ai and persists cache."""
    project, key = _setup_test_project()
    db_mock = AsyncMock()
    db_mock.add = MagicMock()
    db_mock.get.return_value = project

    step_id = uuid.uuid4()
    step = WorkflowStep(
        id=step_id,
        feature_version_id=uuid.uuid4(),
        step_order=2,
        guide_id="payout-cta-step",
        target_fingerprint={
            "tag_name": "button",
            "role": "button",
            "text": ["Request Instant Cash"],
            "attrs": {"data-testid": "instant-payout-cta"},
        },
        content={"en": {"title": "Withdraw Cash"}},
    )
    ver = FeatureVersion(id=step.feature_version_id, project_id=PROJECT_ID)

    async def mock_execute(stmt, *args, **kwargs):
        res = MagicMock()
        stmt_str = str(stmt)
        if "project_keys" in stmt_str:
            res.scalar_one_or_none.return_value = key
        elif "project_origins" in stmt_str:
            res.scalar.return_value = uuid.uuid4()
        elif "workflow_steps" in stmt_str:
            res.first.return_value = (step, ver)
        elif "step_resolution_cache" in stmt_str:
            res.scalar_one_or_none.return_value = None  # Cache miss
        elif "heal_suggestions" in stmt_str:
            res.scalar_one_or_none.return_value = None
        return res

    db_mock.execute = mock_execute
    app.dependency_overrides[get_service_db] = lambda: db_mock

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/sdk/heal",
                headers={"X-GuideKit-Key": TEST_KEY_PLAIN, "Origin": "https://taxisanchalak.com"},
                json={
                    "step_id": str(step_id),
                    "page_path": "/driver/dashboard?ref=banner",
                    "candidates": [
                        {
                            "candidate_id": "cand_1",
                            "tag": "button",
                            "role": "button",
                            "text": "Withdraw Instant Cash",
                            "accessible_name": "Withdraw earnings on the go",
                            "css_selector": "[data-testid='instant-payout-cta']",
                            "attrs": {"data-testid": "instant-payout-cta"},
                            "landmark": "section#driver-payouts",
                        }
                    ],
                },
            )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "healed_by_ai"
        assert data["step_id"] == str(step_id)
        assert data["suggested_selector"] == "[data-testid='instant-payout-cta']"
        assert data["confidence"] >= 0.50
        assert data["fallback_text"] is None
    finally:
        app.dependency_overrides.pop(get_service_db, None)


@pytest.mark.asyncio
async def test_sdk_heal_second_call_cache_hit():
    """Heal Call 2: Matching dom_hash found in cache -> returns cache_hit immediately."""
    project, key = _setup_test_project()
    db_mock = AsyncMock()
    db_mock.add = MagicMock()
    db_mock.get.return_value = project

    step_id = uuid.uuid4()
    step = WorkflowStep(id=step_id, feature_version_id=uuid.uuid4())
    ver = FeatureVersion(id=step.feature_version_id, project_id=PROJECT_ID)

    cached_cand = {
        "candidate_id": "cand_1",
        "css_selector": "#renamed-instant-cash-btn",
        "tag": "button",
    }
    cached_entry = StepResolutionCache(
        step_id=step_id,
        dom_hash="hash_xyz",
        project_id=PROJECT_ID,
        resolved_candidate=cached_cand,
        expires_at=NOW,
    )

    async def mock_execute(stmt, *args, **kwargs):
        res = MagicMock()
        stmt_str = str(stmt)
        if "project_keys" in stmt_str:
            res.scalar_one_or_none.return_value = key
        elif "project_origins" in stmt_str:
            res.scalar.return_value = uuid.uuid4()
        elif "workflow_steps" in stmt_str:
            res.first.return_value = (step, ver)
        elif "step_resolution_cache" in stmt_str:
            res.scalar_one_or_none.return_value = cached_entry  # Cache hit
        elif "heal_suggestions" in stmt_str:
            res.scalar_one_or_none.return_value = None
        return res

    db_mock.execute = mock_execute
    app.dependency_overrides[get_service_db] = lambda: db_mock

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/sdk/heal",
                headers={"X-GuideKit-Key": TEST_KEY_PLAIN, "Origin": "https://taxisanchalak.com"},
                json={
                    "step_id": str(step_id),
                    "page_path": "/driver/dashboard",
                    "dom_hash": "hash_xyz",
                    "candidates": [],
                },
            )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "cache_hit"
        assert data["suggested_selector"] == "#renamed-instant-cash-btn"
        assert data["confidence"] == 1.0
    finally:
        app.dependency_overrides.pop(get_service_db, None)


@pytest.mark.asyncio
async def test_sdk_heal_fallback_to_text():
    """Heal Call with zero candidates -> returns fallback_to_text."""
    project, key = _setup_test_project()
    db_mock = AsyncMock()
    db_mock.add = MagicMock()
    db_mock.get.return_value = project

    step_id = uuid.uuid4()
    step = WorkflowStep(
        id=step_id,
        feature_version_id=uuid.uuid4(),
        content={"en": {"title": "Confirm Booking", "description": "Click the green confirm button."}},
    )
    ver = FeatureVersion(id=step.feature_version_id, project_id=PROJECT_ID)

    async def mock_execute(stmt, *args, **kwargs):
        res = MagicMock()
        stmt_str = str(stmt)
        if "project_keys" in stmt_str:
            res.scalar_one_or_none.return_value = key
        elif "project_origins" in stmt_str:
            res.scalar.return_value = uuid.uuid4()
        elif "workflow_steps" in stmt_str:
            res.first.return_value = (step, ver)
        elif "step_resolution_cache" in stmt_str:
            res.scalar_one_or_none.return_value = None
        return res

    db_mock.execute = mock_execute
    app.dependency_overrides[get_service_db] = lambda: db_mock

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/sdk/heal",
                headers={"X-GuideKit-Key": TEST_KEY_PLAIN, "Origin": "https://taxisanchalak.com"},
                json={
                    "step_id": str(step_id),
                    "page_path": "/book",
                    "candidates": [],
                },
            )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "fallback_to_text"
        assert data["suggested_selector"] is None
        assert "Confirm Booking: Click the green confirm button" in data["fallback_text"]
    finally:
        app.dependency_overrides.pop(get_service_db, None)


# ---------------------------------------------------------------------------
# 4. Telemetry Events Batch Ingestion Test
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sdk_events_batch_ingestion():
    """Batched tour events & resolution logs ingested cleanly."""
    project, key = _setup_test_project()
    db_mock = AsyncMock()
    db_mock.add_all = MagicMock()
    db_mock.get.return_value = project

    async def mock_execute(stmt, *args, **kwargs):
        res = MagicMock()
        stmt_str = str(stmt)
        if "project_keys" in stmt_str:
            res.scalar_one_or_none.return_value = key
        elif "project_origins" in stmt_str:
            res.scalar.return_value = uuid.uuid4()
        return res

    db_mock.execute = mock_execute
    app.dependency_overrides[get_service_db] = lambda: db_mock

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/sdk/events",
                headers={"X-GuideKit-Key": TEST_KEY_PLAIN, "Origin": "https://taxisanchalak.com"},
                json={
                    "tour_events": [
                        {"event_type": "started"},
                        {"event_type": "step_completed"},
                        {"event_type": "completed"},
                    ],
                    "resolution_logs": [
                        {
                            "step_id": str(uuid.uuid4()),
                            "status": "matched_primary",
                            "resolution_ms": 3,
                            "page_path": "/book?step=1",
                            "detected_dom_selector": "#confirm-btn",
                        }
                    ],
                },
            )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["ingested_tour_events"] == 3
        assert data["ingested_resolution_logs"] == 1
    finally:
        app.dependency_overrides.pop(get_service_db, None)
