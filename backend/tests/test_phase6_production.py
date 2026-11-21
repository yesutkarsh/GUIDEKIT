"""Unit and integration tests for Phase 6 Production Upgrade:
- Dual JWT Verifier (Clerk RS256 + GuideKit HS256)
- VS Code Loopback Token Exchange
- Document Chunker and PDF text handling
- Knowledge Base RAG Endpoints (Text Index, List, Delete)
- Two-Way Feature Workspace Deletion
- LLM Intent Detection & Disambiguation (Procedural vs Grounded RAG)
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from httpx import ASGITransport, AsyncClient

from app.core.chunker import chunk_document_text
from app.core.config import settings
from app.core.deps import get_current_developer
from app.core.llm_service import classify_intent_and_answer_with_llm
from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models.project import Project

PROJECT_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
FEATURE_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
DEVELOPER_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")
KNOWLEDGE_ID = uuid.UUID("44444444-4444-4444-4444-444444444444")
NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)


def _make_developer() -> MagicMock:
    dev = MagicMock()
    dev.id = DEVELOPER_ID
    dev.email = "demo@guidekit.dev"
    dev.display_name = "Demo Dev"
    dev.auth_provider = "email"
    dev.auth_provider_id = None
    dev.created_at = NOW
    return dev


# ---------------------------------------------------------------------------
# 1. Chunker Tests
# ---------------------------------------------------------------------------

def test_chunk_document_text_basic():
    sample_text = (
        "Taxi Sanchalak is an on-demand taxi platform operating across India. " * 8
    )
    chunks = chunk_document_text(sample_text, max_chars=160, overlap_chars=20)
    assert len(chunks) >= 2
    for c in chunks:
        assert "chunk_index" in c
        assert "content" in c
        assert len(c["content"]) <= 200
        assert c["char_count"] > 0


def test_chunk_document_text_empty():
    assert chunk_document_text("") == []
    assert chunk_document_text("   \n\n  ") == []


# ---------------------------------------------------------------------------
# 2. Dual JWT Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_dual_jwt_hs256_verification():
    """Verify that GuideKit native HS256 tokens authenticate seamlessly."""
    token = create_access_token(DEVELOPER_ID, expires_minutes=60)
    header = jwt.get_unverified_header(token)
    assert header.get("alg") == "HS256"

    mock_db = AsyncMock()
    dev_mock = _make_developer()

    # Mock DB query in get_current_developer
    mock_db.get = AsyncMock(return_value=dev_mock)
    mock_db.scalar = AsyncMock(return_value=dev_mock)
    mock_db.execute = AsyncMock()

    with patch("app.core.deps.get_service_db") as mock_get_svc_db:
        mock_svc_ctx = AsyncMock()
        mock_svc_ctx.__aenter__.return_value = mock_db
        mock_svc_ctx.__aexit__.return_value = None
        mock_get_svc_db.return_value = mock_svc_ctx

        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        resolved_dev = await get_current_developer(credentials=creds, db=mock_db)
        assert resolved_dev.id == DEVELOPER_ID


@pytest.mark.asyncio
async def test_dual_jwt_clerk_rs256_mocked():
    """Verify that Clerk RS256 tokens trigger JIT developer provisioning."""
    clerk_token_payload = {
        "sub": "user_clerk_12345",
        "azp": "http://localhost:3000",
    }

    mock_db = AsyncMock()
    exec_res = MagicMock()
    exec_res.scalar_one_or_none.return_value = None  # developer does not exist initially
    mock_db.execute = AsyncMock(return_value=exec_res)
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    with patch("jwt.get_unverified_header", return_value={"alg": "RS256"}), \
         patch("app.core.deps.decode_clerk_token", return_value=clerk_token_payload), \
         patch("app.core.deps._fetch_clerk_profile", new=AsyncMock(return_value=("google_user@example.com", "Google User"))), \
         patch("app.core.deps.get_service_db") as mock_get_svc_db:
        mock_svc_ctx = AsyncMock()
        mock_svc_ctx.__aenter__.return_value = mock_db
        mock_svc_ctx.__aexit__.return_value = None
        mock_get_svc_db.return_value = mock_svc_ctx

        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="dummy.clerk.token")
        dev = await get_current_developer(credentials=creds, db=mock_db)
        assert dev.email == "google_user@example.com"
        assert dev.auth_provider == "google"
        assert dev.auth_provider_id == "user_clerk_12345"


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", [
    jwt.exceptions.MissingCryptographyError("missing crypto"),
    jwt.PyJWKClientConnectionError("offline"),
])
async def test_clerk_verifier_outage_is_not_reported_as_an_expired_session(failure):
    with patch("jwt.get_unverified_header", return_value={"alg": "RS256"}), \
         patch("app.core.deps.decode_clerk_token", side_effect=failure):
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="test-sensitive-token")
        with pytest.raises(HTTPException) as caught:
            await get_current_developer(credentials=credentials, db=AsyncMock())
    assert caught.value.status_code == 503
    assert "test-sensitive-token" not in caught.value.detail


@pytest.mark.asyncio
async def test_existing_clerk_subject_is_normalized_without_duplicate_provisioning():
    """An older local `clerk` row must be reused for the same stable subject."""
    existing = MagicMock()
    existing.id = DEVELOPER_ID
    existing.auth_provider = "clerk"
    existing.auth_provider_id = "user_clerk_legacy"

    mock_db = AsyncMock()
    exec_res = MagicMock()
    exec_res.scalar_one_or_none.return_value = existing
    mock_db.execute = AsyncMock(return_value=exec_res)
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    fetch_profile = AsyncMock()
    with patch("jwt.get_unverified_header", return_value={"alg": "RS256"}), \
         patch("app.core.deps.decode_clerk_token", return_value={
             "sub": "user_clerk_legacy",
             "azp": "http://localhost:3000",
         }), \
         patch("app.core.deps._fetch_clerk_profile", new=fetch_profile):
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="dummy.clerk.token")
        resolved = await get_current_developer(credentials=creds, db=mock_db)

    assert resolved is existing
    assert resolved.auth_provider == "google"
    mock_db.commit.assert_awaited_once()
    fetch_profile.assert_not_awaited()


# ---------------------------------------------------------------------------
# 3. Removed loopback token exchange
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_vscode_loopback_exchange_is_removed():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.post("/api/v1/auth/vscode-exchange", json={})
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 4. Feature Deletion / Archive Endpoint
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_feature_delete_endpoint():
    dev = _make_developer()
    app.dependency_overrides[get_current_developer] = lambda: dev

    mock_db = AsyncMock()
    mock_project = MagicMock()
    mock_project.id = PROJECT_ID

    mock_feature = MagicMock()
    mock_feature.id = FEATURE_ID
    mock_feature.project_id = PROJECT_ID
    mock_feature.archived_at = None

    mock_db.get = AsyncMock(return_value=mock_project)
    mock_db.scalar = AsyncMock(return_value=mock_feature)
    mock_db.commit = AsyncMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.delete(
            f"/api/v1/projects/{PROJECT_ID}/features/{FEATURE_ID}",
            headers={"Authorization": "Bearer dummy_token"},
        )
        assert resp.status_code == 204
        assert mock_feature.archived_at is not None

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 5. Knowledge Base RAG Endpoints
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_knowledge_text_index_and_list():
    dev = _make_developer()
    app.dependency_overrides[get_current_developer] = lambda: dev

    mock_db = AsyncMock()
    mock_project = MagicMock()
    mock_project.id = PROJECT_ID

    mock_db.get = AsyncMock(return_value=mock_project)
    mock_db.scalar = AsyncMock(return_value=None)  # existing source = None
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    with patch("app.api.v1.endpoints.publisher.embed_texts", return_value=[[0.0] * 1536]):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            resp = await client.post(
                f"/api/v1/projects/{PROJECT_ID}/knowledge/text",
                json={
                    "title": "Refund Policy",
                    "content": "Full refund within 5 minutes of booking confirmation.",
                    "locale": "en",
                },
                headers={"Authorization": "Bearer dummy_token"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["chunk_count"] >= 1
            assert "source_id" in data

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 6. LLM Intent Router: Procedural vs Informational Disambiguation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_intent_router_procedural_flow():
    """User asks 'How do I book a taxi?' -> should classify as launch_tour."""
    decision = await classify_intent_and_answer_with_llm(
        user_message="How do I book a taxi?",
        locale="en",
        auth_state={"is_logged_in": True, "role": "passenger"},
        available_features=[{"slug": "book-taxi", "title": "Book a Taxi", "similarity": 0.95}],
        retrieved_chunks=[],
        project_name="Taxi Sanchalak",
    )
    assert decision["intent"] == "launch_tour"
    assert decision["matched_feature_slug"] == "book-taxi"


@pytest.mark.asyncio
async def test_intent_router_informational_policy():
    """User asks policy question mentioning a feature -> should classify as rag_answer."""
    policy_chunk = {
        "chunk_id": str(uuid.uuid4()),
        "source_title": "Ride Cancellation & Refund Policy",
        "content": "Cancellation is free within 5 minutes. After 5 minutes a ₹50 fee applies.",
        "score": 0.88,
    }
    decision = await classify_intent_and_answer_with_llm(
        user_message="What is the cancellation policy if I cancel my taxi booking?",
        locale="en",
        auth_state={"is_logged_in": True, "role": "passenger"},
        available_features=[{"slug": "book-taxi", "title": "Book a Taxi", "similarity": 0.72}],
        retrieved_chunks=[policy_chunk],
        project_name="Taxi Sanchalak",
    )
    # The router should prioritize the policy answer rather than blindly firing Driver.js
    assert decision["intent"] == "rag_answer"
    assert "₹50" in decision["reply"] or "cancellation" in decision["reply"].lower()
    # It should suggest the tour without launching it automatically
    assert decision["suggested_tour_slug"] == "book-taxi"
