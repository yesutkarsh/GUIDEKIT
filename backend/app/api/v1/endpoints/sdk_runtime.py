"""Phase 4 Runtime SDK APIs:
- POST /api/v1/sdk/chat   (Conversational Router, Prerequisite Flow Stitcher, and RAG)
- POST /api/v1/sdk/heal   (Cached AI Self-Healing DOM Resolver)
- POST /api/v1/sdk/events (Batched Tour Funnel & Resolution Telemetry Ingestion)
"""

from __future__ import annotations

import hashlib
import json
import re
import uuid
from datetime import date, timedelta
from typing import Annotated, Any
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.embeddings import embed_texts
from app.core.llm_service import classify_intent_and_answer_with_llm
from app.core.security import sha256_hex
from app.core.utils import utcnow
from app.db.session import get_service_db
from app.models.project import Project, ProjectKey, ProjectOrigin
from app.models.workflows import (
    ChatMessage,
    ChatSession,
    Feature,
    FeatureEmbedding,
    FeatureVersion,
    HealSuggestion,
    KnowledgeChunk,
    KnowledgeSource,
    ProjectUsageDaily,
    StepResolutionCache,
    StepResolutionLog,
    TourEvent,
    WorkflowStep,
)
from app.schemas.sdk_runtime import (
    ChainedFeatureSummary,
    RetrievedChunkInfo,
    SDKChatRequest,
    SDKChatResponse,
    SDKEventsBatchRequest,
    SDKEventsBatchResponse,
    SDKHealRequest,
    SDKHealResponse,
    StitchedWorkflowStep,
    TourPlan,
)

router = APIRouter(prefix="/sdk", tags=["sdk-runtime"])

ServiceDbSession = Annotated[AsyncSession, Depends(get_service_db)]


# ---------------------------------------------------------------------------
# SDK Auth & Security Guard
# ---------------------------------------------------------------------------

async def _resolve_sdk_key_and_origin(
    request: Request,
    db: AsyncSession,
) -> tuple[ProjectKey, Project, str | None]:
    """Resolve and authenticate publishable key and validate Origin header."""
    raw_key = request.headers.get("x-guidekit-key")
    if not raw_key:
        auth_hdr = request.headers.get("authorization", "")
        if auth_hdr.lower().startswith("bearer "):
            raw_key = auth_hdr[7:].strip()
    if not raw_key:
        raw_key = request.query_params.get("publishable_key")

    if not raw_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing publishable key (provide X-GuideKit-Key header or publishable_key param)",
        )

    key_hash = sha256_hex(raw_key)
    key_row = (
        await db.execute(
            select(ProjectKey).where(
                ProjectKey.key_hash == key_hash,
                ProjectKey.key_type.in_(["publishable", "publishable_live", "publishable_test"]),
                ProjectKey.revoked_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    if key_row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked publishable key",
        )

    origin = (request.headers.get("origin") or "").rstrip("/")
    if origin:
        allowed = await db.scalar(
            select(ProjectOrigin.id).where(
                ProjectOrigin.project_id == key_row.project_id,
                ProjectOrigin.origin == origin,
            )
        )
        if allowed is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Origin '{origin}' is not allowed for this project",
            )

    project = await db.get(Project, key_row.project_id)
    if project is None or project.archived_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found or archived")

    key_row.last_used_at = utcnow()
    await db.flush()

    return key_row, project, origin or None


def _clean_path(path: str) -> str:
    """Strip query strings and URL fragments for privacy before logging."""
    if not path:
        return "/"
    p = path.split("?")[0].split("#")[0].strip()
    return p if p.startswith("/") else f"/{p}"


async def _increment_daily_usage(
    db: AsyncSession,
    project_id: uuid.UUID,
    chat_messages: int = 0,
    ai_resolutions: int = 0,
) -> None:
    """Atomically upsert daily message or resolution usage count."""
    today = date.today()
    stmt = (
        pg_insert(ProjectUsageDaily)
        .values(
            project_id=project_id,
            day=today,
            chat_messages=chat_messages,
            ai_resolutions=ai_resolutions,
            tts_characters=0,
        )
        .on_conflict_do_update(
            index_elements=["project_id", "day"],
            set_={
                "chat_messages": ProjectUsageDaily.chat_messages + chat_messages,
                "ai_resolutions": ProjectUsageDaily.ai_resolutions + ai_resolutions,
            },
        )
    )
    await db.execute(stmt)
    await db.flush()


# ---------------------------------------------------------------------------
# Lexical & Text Matching Helpers
# ---------------------------------------------------------------------------

GREETING_WORDS = {
    "hi", "hello", "hey", "namaste", "help", "what can you do", "thanks",
    "thank you", "kya kar sakte ho", "madad", "kaise ho", "start",
    "नमस्ते", "मदद", "सहायता", "हेलो", "हाय", "धन्यवाद"
}

STOP_WORDS = {
    "a", "an", "the", "in", "on", "at", "to", "for", "of", "and", "or", "is",
    "are", "how", "do", "i", "can", "what", "where", "my", "me", "you", "it",
    "with", "while", "please", "kaise", "kare", "karna", "hai", "me", "ko"
}


def _tokenize(text: str) -> set[str]:
    """Tokenize and normalize text into clean keywords without punctuation."""
    words = re.findall(r"\w+", text.lower(), re.UNICODE)
    return {w for w in words if len(w) > 1 and w not in STOP_WORDS}


def _lexical_similarity(query_tokens: set[str], target_text: str) -> float:
    """Calculate keyword overlap ratio between query and candidate text."""
    if not query_tokens or not target_text:
        return 0.0
    target_tokens = _tokenize(target_text)
    if not target_tokens:
        return 0.0
    overlap = query_tokens.intersection(target_tokens)
    return len(overlap) / max(len(query_tokens), 1)


# ---------------------------------------------------------------------------
# 1. POST /api/v1/sdk/chat
# ---------------------------------------------------------------------------

@router.post(
    "/chat",
    response_model=SDKChatResponse,
    summary="Runtime conversational router, prerequisite flow stitcher & RAG",
)
async def sdk_chat(
    payload: SDKChatRequest,
    request: Request,
    db: ServiceDbSession,
) -> SDKChatResponse:
    """Process end-user chat message, classify intent, stitch prerequisite flows, or fallback to RAG."""
    key_row, project, origin = await _resolve_sdk_key_and_origin(request, db)
    project_id = project.id
    now = utcnow()
    user_msg_clean = payload.message.strip()
    target_locale = payload.locale if payload.locale in project.supported_locales else project.default_locale

    # 1. Session Management
    session: ChatSession | None = None
    if payload.session_id:
        session = (
            await db.execute(
                select(ChatSession).where(
                    ChatSession.id == payload.session_id,
                    ChatSession.project_id == project_id,
                )
            )
        ).scalar_one_or_none()

    if session is None:
        session = ChatSession(
            id=payload.session_id or uuid.uuid4(),
            project_id=project_id,
            visitor_id=payload.visitor_id,
            locale=target_locale,
            origin=origin,
            started_at=now,
            last_active_at=now,
        )
        db.add(session)
    else:
        session.last_active_at = now

    await db.flush()

    # Log User Message
    user_msg_row = ChatMessage(
        id=uuid.uuid4(),
        project_id=project_id,
        session_id=session.id,
        role="user",
        content=user_msg_clean,
        created_at=now,
    )
    db.add(user_msg_row)
    await db.flush()

    # Query published features for this project
    pub_stmt = (
        select(Feature, FeatureVersion)
        .join(FeatureVersion, FeatureVersion.feature_id == Feature.id)
        .where(
            Feature.project_id == project_id,
            Feature.archived_at.is_(None),
            FeatureVersion.status == "published",
        )
    )
    published_pairs = (await db.execute(pub_stmt)).all()
    feature_map = {feat.id: (feat, ver) for feat, ver in published_pairs}

    # Helper for feature localized title
    def _feat_title(ver: FeatureVersion, loc: str, fallback_slug: str) -> str:
        loc_content = ver.content.get(loc) if isinstance(ver.content, dict) else None
        if loc_content and isinstance(loc_content, dict) and loc_content.get("title"):
            return loc_content["title"]
        en_content = ver.content.get("en") if isinstance(ver.content, dict) else None
        if en_content and isinstance(en_content, dict) and en_content.get("title"):
            return en_content["title"]
        return fallback_slug.replace("-", " ").title()

    # Helper for feature localized description
    def _feat_desc(ver: FeatureVersion, loc: str) -> str:
        loc_content = ver.content.get(loc) if isinstance(ver.content, dict) else None
        if loc_content and isinstance(loc_content, dict):
            return loc_content.get("intent_description") or loc_content.get("description") or ""
        en_content = ver.content.get("en") if isinstance(ver.content, dict) else None
        if en_content and isinstance(en_content, dict):
            return en_content.get("intent_description") or en_content.get("description") or ""
        return ""

    # -----------------------------------------------------------------------
    # Route 1: Smalltalk / Greeting Check
    # -----------------------------------------------------------------------
    normalized_lower = re.sub(r"[^\w\s]", "", user_msg_clean.lower()).strip()
    is_smalltalk = (
        normalized_lower in GREETING_WORDS
        or any(normalized_lower.startswith(g + " ") for g in ["hi", "hello", "hey", "namaste", "नमस्ते"])
    )

    if is_smalltalk:
        titles_list = [
            _feat_title(ver, target_locale, feat.slug) for feat, ver in published_pairs
        ]
        titles_str = ", ".join(titles_list) if titles_list else "App Features"

        if target_locale == "hi":
            reply = f"नमस्ते! मैं {project.name} के लिए आपका गाइडकिट सहायक हूँ। मैं आपको इन प्रक्रियाओं में मार्गदर्शन कर सकता हूँ: {titles_str}। आप क्या शुरू करना चाहेंगे?"
        else:
            reply = f"Hello! I am your GuideKit assistant for {project.name}. I can guide you through our interactive workflows: {titles_str}. What would you like help with?"

        asst_msg = ChatMessage(
            id=uuid.uuid4(),
            project_id=project_id,
            session_id=session.id,
            role="assistant",
            content=reply,
            route_taken="smalltalk",
            created_at=utcnow(),
        )
        db.add(asst_msg)
        await _increment_daily_usage(db, project_id, chat_messages=1)
        await db.commit()

        return SDKChatResponse(
            session_id=session.id,
            message_id=asst_msg.id,
            reply=reply,
            route_taken="smalltalk",
            similarity=None,
            matched_feature_slug=None,
            tour_plan=None,
            retrieved_chunks=[],
        )

    # -----------------------------------------------------------------------
    # Route 2: Hybrid Vector + Lexical Intent Matching
    # -----------------------------------------------------------------------
    query_vectors = await embed_texts([user_msg_clean])
    query_vec = query_vectors[0]
    query_tokens = _tokenize(user_msg_clean)

    # Fetch feature embeddings for published features
    emb_stmt = (
        select(FeatureEmbedding)
        .where(
            FeatureEmbedding.project_id == project_id,
            FeatureEmbedding.feature_version_id.in_([ver.id for _, ver in published_pairs]),
        )
    )
    embeddings_list = (await db.execute(emb_stmt)).scalars().all()

    # Pre-calculate best vector similarity per feature_version_id
    feat_best_vector: dict[uuid.UUID, float] = {}
    for emb in embeddings_list:
        if emb.embedding is not None:
            # Cosine similarity between L2-normalized vectors: dot product
            v1 = query_vec
            v2 = emb.embedding
            dot = sum(a * b for a, b in zip(v1, v2))
            norm1 = sum(a * a for a in v1) ** 0.5
            norm2 = sum(b * b for b in v2) ** 0.5
            sim = dot / (norm1 * norm2) if norm1 > 0 and norm2 > 0 else 0.0
            feat_best_vector[emb.feature_version_id] = max(
                feat_best_vector.get(emb.feature_version_id, -1.0), float(sim)
            )

    # Score each published feature with hybrid score
    scored_features: list[tuple[float, Feature, FeatureVersion]] = []
    for feat, ver in published_pairs:
        v_sim = max(feat_best_vector.get(ver.id, 0.0), 0.0)

        # Lexical score across slug, title, description, and example queries
        lex_targets = [
            feat.slug.replace("-", " "),
            _feat_title(ver, target_locale, feat.slug),
            _feat_desc(ver, target_locale),
        ]
        if ver.example_queries:
            lex_targets.extend(ver.example_queries)

        l_sim = max((_lexical_similarity(query_tokens, t) for t in lex_targets), default=0.0)

        # Boost if query matches substring of title or example query directly
        for t in lex_targets:
            if t and (normalized_lower in t.lower() or t.lower() in normalized_lower):
                l_sim = max(l_sim, 0.85)

        # Hybrid formula
        final_score = max(v_sim, 0.45 * v_sim + 0.55 * l_sim)
        scored_features.append((final_score, feat, ver))

    scored_features.sort(key=lambda x: x[0], reverse=True)

    # -----------------------------------------------------------------------
    # Knowledge Base Chunks Retrieval (for LLM context & RAG fallback)
    # -----------------------------------------------------------------------
    chunks_stmt = (
        select(KnowledgeChunk, KnowledgeSource)
        .join(KnowledgeSource, KnowledgeSource.id == KnowledgeChunk.source_id)
        .where(
            KnowledgeChunk.project_id == project_id,
            KnowledgeSource.status == "indexed",
        )
    )
    chunks_rows = (await db.execute(chunks_stmt)).all()

    scored_chunks: list[tuple[float, KnowledgeChunk, KnowledgeSource]] = []
    for chunk, source in chunks_rows:
        dot = sum(a * b for a, b in zip(query_vec, chunk.embedding))
        n1 = sum(a * a for a in query_vec) ** 0.5
        n2 = sum(b * b for b in chunk.embedding) ** 0.5
        v_sim = dot / (n1 * n2) if n1 > 0 and n2 > 0 else 0.0

        l_sim = _lexical_similarity(query_tokens, chunk.content)
        chunk_score = max(v_sim, 0.40 * v_sim + 0.60 * l_sim)
        scored_chunks.append((chunk_score, chunk, source))

    scored_chunks.sort(key=lambda x: x[0], reverse=True)

    # -----------------------------------------------------------------------
    # LLM Intent Classification & Disambiguation (Mercury 2.5)
    # -----------------------------------------------------------------------
    available_features_ctx = [
        {
            "slug": f.slug,
            "title": _feat_title(v, target_locale, f.slug),
            "intent_description": _feat_desc(v, target_locale),
            "requires_auth": bool(v.requires_auth),
            "required_role": v.required_role,
        }
        for f, v in published_pairs
    ]
    retrieved_chunks_ctx = [
        {
            "chunk_id": str(c.id),
            "source_title": src.title,
            "content": c.content,
            "score": float(s),
        }
        for s, c, src in scored_chunks[:5]
        if s >= 0.20
    ]

    llm_decision = await classify_intent_and_answer_with_llm(
        user_message=user_msg_clean,
        locale=target_locale,
        auth_state={"is_authenticated": payload.auth_state.is_logged_in, "role": payload.auth_state.role},
        available_features=available_features_ctx,
        retrieved_chunks=retrieved_chunks_ctx,
        project_name=project.name,
    )

    # If LLM classified query as an informational/policy question, answer via RAG immediately
    if llm_decision.get("intent") == "rag_answer" and scored_chunks:
        top_chunks = scored_chunks[: project.chat_settings.get("max_context_chunks", 4)]
        retrieved_ids = [c[1].id for c in top_chunks]
        retrieved_info: list[RetrievedChunkInfo] = []

        for s, c, src in top_chunks:
            retrieved_info.append(
                RetrievedChunkInfo(
                    chunk_id=c.id,
                    source_title=src.title,
                    content_preview=c.content[:140] + ("..." if len(c.content) > 140 else ""),
                    score=float(round(s, 4)),
                )
            )

        reply = llm_decision.get("reply") or (
            f"According to documentation: {top_chunks[0][1].content}" if top_chunks else "No policy found."
        )

        suggested_tour_plan = None
        sugg_slug = llm_decision.get("suggested_tour_slug")
        if sugg_slug:
            sugg_pair = next((p for p in published_pairs if p[0].slug == sugg_slug), None)
            if sugg_pair:
                s_feat, s_ver = sugg_pair
                s_steps_stmt = (
                    select(WorkflowStep)
                    .where(WorkflowStep.feature_version_id == s_ver.id)
                    .order_by(WorkflowStep.step_order)
                )
                raw_s_steps = (await db.execute(s_steps_stmt)).scalars().all()
                suggested_tour_plan = TourPlan(
                    target_feature_slug=s_feat.slug,
                    requires_login_first=bool(s_ver.requires_auth and not payload.auth_state.is_logged_in),
                    role_warning=None,
                    chained_features=[
                        ChainedFeatureSummary(
                            feature_id=s_feat.id,
                            slug=s_feat.slug,
                            title=_feat_title(s_ver, target_locale, s_feat.slug),
                            version_number=s_ver.version_number,
                            is_prerequisite=False,
                        )
                    ],
                    steps=[
                        StitchedWorkflowStep(
                            execution_index=i,
                            step_id=st.id,
                            feature_slug=s_feat.slug,
                            step_order=st.step_order,
                            guide_id=st.guide_id,
                            route_pattern=st.route_pattern,
                            action_type=st.action_type,
                            advance_on=st.advance_on,
                            is_optional=bool(st.is_optional) if st.is_optional is not None else False,
                            wait_timeout_ms=st.wait_timeout_ms or 5000,
                            condition=st.condition,
                            content=st.content or {},
                            target_fingerprint=st.target_fingerprint or {},
                        )
                        for i, st in enumerate(raw_s_steps, 1)
                    ],
                )

        asst_msg = ChatMessage(
            id=uuid.uuid4(),
            project_id=project_id,
            session_id=session.id,
            role="assistant",
            content=reply,
            route_taken="rag_answer",
            similarity=float(round(top_chunks[0][0], 4)) if top_chunks else None,
            retrieved_chunk_ids=retrieved_ids,
            created_at=utcnow(),
        )
        db.add(asst_msg)
        await _increment_daily_usage(db, project_id, chat_messages=1)
        await db.commit()

        return SDKChatResponse(
            session_id=session.id,
            message_id=asst_msg.id,
            reply=reply,
            route_taken="rag_answer",
            similarity=float(round(top_chunks[0][0], 4)) if top_chunks else None,
            matched_feature_slug=None,
            tour_plan=None,
            suggested_tour_plan=suggested_tour_plan,
            retrieved_chunks=retrieved_info,
        )

    min_sim = float(project.chat_settings.get("min_similarity", 0.45))
    best_score, matched_feat, matched_ver = scored_features[0] if scored_features else (0.0, None, None)

    # If LLM classified as launch_tour and identified a feature slug, prefer that feature
    if llm_decision.get("intent") == "launch_tour" and llm_decision.get("matched_feature_slug"):
        llm_pair = next((p for p in published_pairs if p[0].slug == llm_decision["matched_feature_slug"]), None)
        if llm_pair:
            matched_feat, matched_ver = llm_pair
            best_score = max(best_score, 0.90)

    if matched_feat is not None and matched_ver is not None and best_score >= min_sim:
        # We matched a workflow feature!
        matched_title = _feat_title(matched_ver, target_locale, matched_feat.slug)

        # Fetch target workflow steps
        target_steps_stmt = (
            select(WorkflowStep)
            .where(WorkflowStep.feature_version_id == matched_ver.id)
            .order_by(WorkflowStep.step_order)
        )
        raw_target_steps = (await db.execute(target_steps_stmt)).scalars().all()

        requires_login_first = False
        chained_features: list[ChainedFeatureSummary] = []
        all_stitched_steps: list[StitchedWorkflowStep] = []
        role_warning: str | None = None
        reply = ""

        # Case A: Requires auth and user is logged out
        if matched_ver.requires_auth and not payload.auth_state.is_logged_in:
            requires_login_first = True

            # Resolve prerequisite feature (default to login)
            prereq_pair: tuple[Feature, FeatureVersion] | None = None
            if matched_ver.prerequisite_feature_id and matched_ver.prerequisite_feature_id in feature_map:
                prereq_pair = feature_map[matched_ver.prerequisite_feature_id]
            else:
                prereq_pair = next(
                    (p for p in published_pairs if p[0].slug == "login" or "login" in p[0].slug),
                    None,
                )

            if prereq_pair:
                prereq_feat, prereq_ver = prereq_pair
                prereq_title = _feat_title(prereq_ver, target_locale, prereq_feat.slug)

                chained_features.append(
                    ChainedFeatureSummary(
                        feature_id=prereq_feat.id,
                        slug=prereq_feat.slug,
                        title=prereq_title,
                        version_number=prereq_ver.version_number,
                        is_prerequisite=True,
                    )
                )

                prereq_steps_stmt = (
                    select(WorkflowStep)
                    .where(WorkflowStep.feature_version_id == prereq_ver.id)
                    .order_by(WorkflowStep.step_order)
                )
                raw_prereq_steps = (await db.execute(prereq_steps_stmt)).scalars().all()

                for idx, ps in enumerate(raw_prereq_steps, start=1):
                    all_stitched_steps.append(
                        StitchedWorkflowStep(
                            execution_index=idx,
                            step_id=ps.id,
                            feature_slug=prereq_feat.slug,
                            step_order=ps.step_order,
                            guide_id=ps.guide_id,
                            route_pattern=ps.route_pattern,
                            action_type=ps.action_type,
                            advance_on=ps.advance_on,
                            is_optional=bool(ps.is_optional) if ps.is_optional is not None else False,
                            wait_timeout_ms=ps.wait_timeout_ms if ps.wait_timeout_ms is not None else 5000,
                            condition=ps.condition,
                            content=ps.content or {},
                            target_fingerprint=ps.target_fingerprint or {},
                        )
                    )

            # Append target feature summary and steps
            chained_features.append(
                ChainedFeatureSummary(
                    feature_id=matched_feat.id,
                    slug=matched_feat.slug,
                    title=matched_title,
                    version_number=matched_ver.version_number,
                    is_prerequisite=False,
                )
            )

            start_idx = len(all_stitched_steps) + 1
            for idx, ts in enumerate(raw_target_steps, start=start_idx):
                all_stitched_steps.append(
                    StitchedWorkflowStep(
                        execution_index=idx,
                        step_id=ts.id,
                        feature_slug=matched_feat.slug,
                        step_order=ts.step_order,
                        guide_id=ts.guide_id,
                        route_pattern=ts.route_pattern,
                        action_type=ts.action_type,
                        advance_on=ts.advance_on,
                        is_optional=bool(ts.is_optional) if ts.is_optional is not None else False,
                        wait_timeout_ms=ts.wait_timeout_ms if ts.wait_timeout_ms is not None else 5000,
                        condition=ts.condition,
                        content=ts.content or {},
                        target_fingerprint=ts.target_fingerprint or {},
                    )
                )

            if target_locale == "hi":
                reply = f"'{matched_title}' प्रक्रिया का उपयोग करने के लिए पहले साइन इन करना आवश्यक है। मैं आपको पहले साइन इन करने में मदद करूँगा, और उसके तुरंत बाद हम '{matched_title}' पर चलेंगे।"
            else:
                reply = f"The '{matched_title}' workflow requires you to sign in first. I'll guide you through signing in, and then we'll proceed straight to '{matched_title}'."

        # Case B: Role Mismatch
        elif (
            matched_ver.required_role
            and payload.auth_state.is_logged_in
            and payload.auth_state.role
            and payload.auth_state.role != matched_ver.required_role
        ):
            role_warning = f"Requires '{matched_ver.required_role}' account (current: '{payload.auth_state.role}')"
            chained_features.append(
                ChainedFeatureSummary(
                    feature_id=matched_feat.id,
                    slug=matched_feat.slug,
                    title=matched_title,
                    version_number=matched_ver.version_number,
                    is_prerequisite=False,
                )
            )
            for idx, ts in enumerate(raw_target_steps, start=1):
                all_stitched_steps.append(
                    StitchedWorkflowStep(
                        execution_index=idx,
                        step_id=ts.id,
                        feature_slug=matched_feat.slug,
                        step_order=ts.step_order,
                        guide_id=ts.guide_id,
                        route_pattern=ts.route_pattern,
                        action_type=ts.action_type,
                        advance_on=ts.advance_on,
                        is_optional=bool(ts.is_optional) if ts.is_optional is not None else False,
                        wait_timeout_ms=ts.wait_timeout_ms if ts.wait_timeout_ms is not None else 5000,
                        condition=ts.condition,
                        content=ts.content or {},
                        target_fingerprint=ts.target_fingerprint or {},
                    )
                )

            if target_locale == "hi":
                reply = f"ध्यान दें: '{matched_title}' प्रक्रिया केवल {matched_ver.required_role} खातों के लिए है। आपका वर्तमान रोल '{payload.auth_state.role}' है। क्या आप फिर भी आगे बढ़ना चाहते हैं?"
            else:
                reply = f"Note: '{matched_title}' requires a {matched_ver.required_role} account. You are currently logged in as a {payload.auth_state.role}. Starting guide anyway..."

        # Case C: Ready to execute
        else:
            chained_features.append(
                ChainedFeatureSummary(
                    feature_id=matched_feat.id,
                    slug=matched_feat.slug,
                    title=matched_title,
                    version_number=matched_ver.version_number,
                    is_prerequisite=False,
                )
            )
            for idx, ts in enumerate(raw_target_steps, start=1):
                all_stitched_steps.append(
                    StitchedWorkflowStep(
                        execution_index=idx,
                        step_id=ts.id,
                        feature_slug=matched_feat.slug,
                        step_order=ts.step_order,
                        guide_id=ts.guide_id,
                        route_pattern=ts.route_pattern,
                        action_type=ts.action_type,
                        advance_on=ts.advance_on,
                        is_optional=bool(ts.is_optional) if ts.is_optional is not None else False,
                        wait_timeout_ms=ts.wait_timeout_ms if ts.wait_timeout_ms is not None else 5000,
                        condition=ts.condition,
                        content=ts.content or {},
                        target_fingerprint=ts.target_fingerprint or {},
                    )
                )

            first_step_text = ""
            if all_stitched_steps:
                fst = all_stitched_steps[0]
                first_step_text = (
                    fst.content.get(target_locale, {}).get("title")
                    or fst.content.get("en", {}).get("title")
                    or fst.guide_id
                    or "Follow the highlighted element"
                )

            if target_locale == "hi":
                reply = f"'{matched_title}' शुरू कर रहे हैं। पहला कदम: {first_step_text}।"
            else:
                reply = f"Starting '{matched_title}'. First step: {first_step_text}."

        tour_plan = TourPlan(
            target_feature_slug=matched_feat.slug,
            requires_login_first=requires_login_first,
            role_warning=role_warning,
            chained_features=chained_features,
            steps=all_stitched_steps,
        )

        asst_msg = ChatMessage(
            id=uuid.uuid4(),
            project_id=project_id,
            session_id=session.id,
            role="assistant",
            content=reply,
            route_taken="feature_match",
            matched_feature_version_id=matched_ver.id,
            similarity=float(round(best_score, 4)),
            created_at=utcnow(),
        )
        db.add(asst_msg)
        await _increment_daily_usage(db, project_id, chat_messages=1)
        await db.commit()

        return SDKChatResponse(
            session_id=session.id,
            message_id=asst_msg.id,
            reply=reply,
            route_taken="feature_match",
            similarity=float(round(best_score, 4)),
            matched_feature_slug=matched_feat.slug,
            tour_plan=tour_plan,
            retrieved_chunks=[],
        )

    # -----------------------------------------------------------------------
    # Route 3: Knowledge Base RAG Fallback
    # -----------------------------------------------------------------------
    rag_threshold = float(project.chat_settings.get("rag_similarity", 0.35))

    if scored_chunks and scored_chunks[0][0] >= rag_threshold:
        top_chunks = scored_chunks[: project.chat_settings.get("max_context_chunks", 4)]
        retrieved_ids = [c[1].id for c in top_chunks]
        retrieved_info: list[RetrievedChunkInfo] = []

        chunk_texts: list[str] = []
        for s, c, src in top_chunks:
            chunk_texts.append(c.content.strip())
            retrieved_info.append(
                RetrievedChunkInfo(
                    chunk_id=c.id,
                    source_title=src.title,
                    content_preview=c.content[:140] + ("..." if len(c.content) > 140 else ""),
                    score=float(round(s, 4)),
                )
            )

        grounded_answer = " ".join(chunk_texts)
        if target_locale == "hi":
            reply = f"दस्तावेज़ों के अनुसार: {grounded_answer}"
        else:
            reply = f"According to documentation: {grounded_answer}"

        asst_msg = ChatMessage(
            id=uuid.uuid4(),
            project_id=project_id,
            session_id=session.id,
            role="assistant",
            content=reply,
            route_taken="rag_answer",
            similarity=float(round(top_chunks[0][0], 4)),
            retrieved_chunk_ids=retrieved_ids,
            created_at=utcnow(),
        )
        db.add(asst_msg)
        await _increment_daily_usage(db, project_id, chat_messages=1)
        await db.commit()

        return SDKChatResponse(
            session_id=session.id,
            message_id=asst_msg.id,
            reply=reply,
            route_taken="rag_answer",
            similarity=float(round(top_chunks[0][0], 4)),
            matched_feature_slug=None,
            tour_plan=None,
            retrieved_chunks=retrieved_info,
        )

    # -----------------------------------------------------------------------
    # Route 4: Out-of-Scope Guardrail
    # -----------------------------------------------------------------------
    custom_oos = project.chat_settings.get("out_of_scope_message")
    if custom_oos:
        reply = custom_oos
    elif target_locale == "hi":
        reply = f"मैं केवल {project.name} से संबंधित प्रक्रियाओं और सवालों में सहायता कर सकता हूँ। कृपया ऐप की सुविधाओं या प्रक्रियाओं के बारे में पूछें!"
    else:
        reply = f"I can only assist with workflows and questions related to {project.name}. Please ask about our interactive tours or app features!"

    asst_msg = ChatMessage(
        id=uuid.uuid4(),
        project_id=project_id,
        session_id=session.id,
        role="assistant",
        content=reply,
        route_taken="out_of_scope",
        created_at=utcnow(),
    )
    db.add(asst_msg)
    await _increment_daily_usage(db, project_id, chat_messages=1)
    await db.commit()

    return SDKChatResponse(
        session_id=session.id,
        message_id=asst_msg.id,
        reply=reply,
        route_taken="out_of_scope",
        similarity=None,
        matched_feature_slug=None,
        tour_plan=None,
        retrieved_chunks=[],
    )


# ---------------------------------------------------------------------------
# 2. POST /api/v1/sdk/heal
# ---------------------------------------------------------------------------

@router.post(
    "/heal",
    response_model=SDKHealResponse,
    summary="Cached AI self-healing DOM selector resolver",
)
async def sdk_heal(
    payload: SDKHealRequest,
    request: Request,
    db: ServiceDbSession,
) -> SDKHealResponse:
    """Resolve broken DOM element against candidate list with persistent caching and heal suggestions."""
    key_row, project, origin = await _resolve_sdk_key_and_origin(request, db)
    project_id = project.id
    now = utcnow()
    step_id = payload.step_id
    clean_path = _clean_path(payload.page_path)

    # 1. Fetch step and verify project ownership
    step_stmt = (
        select(WorkflowStep, FeatureVersion)
        .join(FeatureVersion, FeatureVersion.id == WorkflowStep.feature_version_id)
        .where(
            WorkflowStep.id == step_id,
            FeatureVersion.project_id == project_id,
        )
    )
    step_row = (await db.execute(step_stmt)).first()
    if not step_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow step not found")

    step, version = step_row

    # Canonicalize dom_hash
    dom_hash = payload.dom_hash
    if not dom_hash:
        candidates_raw = [c.model_dump() for c in payload.candidates]
        serialized = json.dumps(candidates_raw, sort_keys=True, default=str)
        dom_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    # 2. Check Cache First (Zero-AI Fast Path)
    cache_entry = (
        await db.execute(
            select(StepResolutionCache).where(
                StepResolutionCache.step_id == step_id,
                StepResolutionCache.dom_hash == dom_hash,
                StepResolutionCache.expires_at > now,
            )
        )
    ).scalar_one_or_none()

    if cache_entry is not None:
        resolved_cand = cache_entry.resolved_candidate
        detected_sel = resolved_cand.get("css_selector")

        # Log cache hit
        log_row = StepResolutionLog(
            id=uuid.uuid4(),
            project_id=project_id,
            step_id=step_id,
            status="cache_hit",
            resolution_ms=1,
            page_path=clean_path,
            dom_hash=dom_hash,
            detected_dom_selector=detected_sel,
            logged_at=now,
        )
        db.add(log_row)

        # Increment occurrences on pending suggestion if exists
        if detected_sel:
            sugg_stmt = (
                select(HealSuggestion).where(
                    HealSuggestion.step_id == step_id,
                    HealSuggestion.suggested_selector == detected_sel,
                    HealSuggestion.status == "pending",
                )
            )
            sugg_row = (await db.execute(sugg_stmt)).scalar_one_or_none()
            if sugg_row is not None:
                sugg_row.occurrences += 1
                sugg_row.last_seen_at = now

        await db.commit()

        return SDKHealResponse(
            status="cache_hit",
            step_id=step_id,
            resolved_candidate=resolved_cand,
            suggested_selector=detected_sel,
            confidence=1.0,
            fallback_text=None,
        )

    # 3. Candidate Scoring & Selection (Cache Miss)
    if not payload.candidates:
        # No candidates visible -> fallback directly to text
        return await _fallback_to_text(db, step, project_id, clean_path, dom_hash, payload.locale)

    fp = step.target_fingerprint or {}
    target_role = (fp.get("role") or "").lower()
    target_tag = (fp.get("tag_name") or fp.get("tag") or "").lower()
    target_texts = [str(t) for t in (fp.get("text") or []) if t]
    if fp.get("text_content"):
        target_texts.append(str(fp["text_content"]))
    target_names = [str(n) for n in (fp.get("accessible_name") or []) if n]
    if fp.get("aria_label"):
        target_names.append(str(fp["aria_label"]))
    target_attrs = fp.get("attrs") or {}
    target_landmark = (fp.get("landmark") or "").lower()
    step_title = step.content.get("en", {}).get("title", "") if isinstance(step.content, dict) else ""

    target_keywords = set()
    for t in target_texts + target_names + [step_title, step.guide_id or ""]:
        target_keywords.update(_tokenize(t))

    best_candidate = None
    best_score = -1.0

    for cand in payload.candidates:
        cand_tag = cand.tag.lower()
        cand_role = (cand.role or cand_tag).lower()
        cand_text = (cand.text or "").strip()
        cand_name = (cand.accessible_name or "").strip()
        cand_attrs = cand.attrs or {}
        cand_landmark = (cand.landmark or "").lower()

        # Component 1: Tag/Role Match (weight: 0.25)
        role_score = 0.0
        if target_role and cand_role == target_role:
            role_score = 0.25
        elif target_tag and cand_tag == target_tag:
            role_score = 0.20
        elif cand_tag in {"button", "a", "input"} and (target_tag in {"button", "a", "input"} or target_role in {"button", "link", "textbox"}):
            role_score = 0.15

        # Component 2: Semantic / Token overlap (weight: 0.40)
        cand_words = _tokenize(cand_text + " " + cand_name + " " + str(cand_attrs))
        text_score = 0.0
        if target_keywords and cand_words:
            overlap = target_keywords.intersection(cand_words)
            text_score = 0.40 * (len(overlap) / max(len(target_keywords), 1))
        # Exact substring bonus
        if any(t.lower() in cand_text.lower() or cand_text.lower() in t.lower() for t in target_texts if len(t) > 2):
            text_score = max(text_score, 0.35)

        # Component 3: Landmark / Context Match (weight: 0.15)
        landmark_score = 0.0
        if target_landmark and cand_landmark:
            if target_landmark in cand_landmark or cand_landmark in target_landmark:
                landmark_score = 0.15
        elif not target_landmark and not cand_landmark:
            landmark_score = 0.10

        # Component 4: Attribute Match (weight: 0.20)
        attr_score = 0.0
        for attr_k, attr_v in target_attrs.items():
            if attr_k in cand_attrs and str(cand_attrs[attr_k]).lower() == str(attr_v).lower():
                attr_score += 0.10
        if cand_attrs.get("data-testid") and (target_attrs.get("data-testid") or step.guide_id):
            tgt_tid = target_attrs.get("data-testid") or step.guide_id or ""
            if tgt_tid.lower() in str(cand_attrs.get("data-testid")).lower():
                attr_score = max(attr_score, 0.20)

        total_conf = min(role_score + text_score + landmark_score + min(attr_score, 0.20), 0.98)
        if total_conf > best_score:
            best_score = total_conf
            best_candidate = cand

    # Resolution threshold
    if best_candidate is not None and best_score >= 0.45:
        cand_dict = best_candidate.model_dump()
        suggested_selector = best_candidate.css_selector

        # 1. Update Step Resolution Cache (7-day TTL)
        cache_stmt = (
            pg_insert(StepResolutionCache)
            .values(
                step_id=step_id,
                dom_hash=dom_hash,
                project_id=project_id,
                resolved_candidate=cand_dict,
                created_at=now,
                expires_at=now + timedelta(days=7),
            )
            .on_conflict_do_update(
                index_elements=["step_id", "dom_hash"],
                set_={
                    "resolved_candidate": cand_dict,
                    "expires_at": now + timedelta(days=7),
                },
            )
        )
        await db.execute(cache_stmt)

        # 2. Upsert Heal Suggestion
        sugg_stmt = (
            select(HealSuggestion).where(
                HealSuggestion.step_id == step_id,
                HealSuggestion.suggested_selector == suggested_selector,
                HealSuggestion.status == "pending",
            )
        )
        existing_sugg = (await db.execute(sugg_stmt)).scalar_one_or_none()

        suggested_fp = {
            "css": suggested_selector,
            "role": best_candidate.role or best_candidate.tag,
            "accessible_name": [best_candidate.accessible_name] if best_candidate.accessible_name else [],
            "text": [best_candidate.text] if best_candidate.text else [],
            "attrs": best_candidate.attrs,
            "landmark": best_candidate.landmark,
        }

        if existing_sugg is not None:
            existing_sugg.occurrences += 1
            existing_sugg.last_seen_at = now
            existing_sugg.confidence = max(existing_sugg.confidence or 0.0, float(round(best_score, 2)))
        else:
            new_sugg = HealSuggestion(
                id=uuid.uuid4(),
                project_id=project_id,
                step_id=step_id,
                suggested_fingerprint=suggested_fp,
                suggested_selector=suggested_selector,
                confidence=float(round(best_score, 2)),
                occurrences=1,
                status="pending",
                first_seen_at=now,
                last_seen_at=now,
            )
            db.add(new_sugg)

        # 3. Log Resolution Log
        log_row = StepResolutionLog(
            id=uuid.uuid4(),
            project_id=project_id,
            step_id=step_id,
            status="healed_by_ai",
            resolution_ms=12,
            page_path=clean_path,
            dom_hash=dom_hash,
            detected_dom_selector=suggested_selector,
            logged_at=now,
        )
        db.add(log_row)

        await _increment_daily_usage(db, project_id, ai_resolutions=1)
        await db.commit()

        return SDKHealResponse(
            status="healed_by_ai",
            step_id=step_id,
            resolved_candidate=cand_dict,
            suggested_selector=suggested_selector,
            confidence=float(round(best_score, 2)),
            fallback_text=None,
        )

    # 4. Fallback to text
    return await _fallback_to_text(db, step, project_id, clean_path, dom_hash, payload.locale)


async def _fallback_to_text(
    db: AsyncSession,
    step: WorkflowStep,
    project_id: uuid.UUID,
    clean_path: str,
    dom_hash: str,
    locale: str,
) -> SDKHealResponse:
    """Log text fallback and extract localized step instructions."""
    now = utcnow()
    log_row = StepResolutionLog(
        id=uuid.uuid4(),
        project_id=project_id,
        step_id=step.id,
        status="fallback_to_text",
        resolution_ms=5,
        page_path=clean_path,
        dom_hash=dom_hash,
        detected_dom_selector=None,
        logged_at=now,
    )
    db.add(log_row)
    await db.commit()

    content = step.content if isinstance(step.content, dict) else {}
    loc_data = content.get(locale) if isinstance(content.get(locale), dict) else content.get("en", {})
    title = loc_data.get("title") or "Next Step"
    desc = loc_data.get("description") or loc_data.get("body") or ""
    fallback_text = f"{title}: {desc}" if desc else title

    return SDKHealResponse(
        status="fallback_to_text",
        step_id=step.id,
        resolved_candidate=None,
        suggested_selector=None,
        confidence=0.0,
        fallback_text=fallback_text,
    )


# ---------------------------------------------------------------------------
# 3. POST /api/v1/sdk/events
# ---------------------------------------------------------------------------

@router.post(
    "/events",
    response_model=SDKEventsBatchResponse,
    summary="Batched tour funnel & resolution telemetry ingestion",
)
async def sdk_events(
    payload: SDKEventsBatchRequest,
    request: Request,
    db: ServiceDbSession,
) -> SDKEventsBatchResponse:
    """Ingest batched tour progression events and resolution logs from the browser SDK."""
    key_row, project, origin = await _resolve_sdk_key_and_origin(request, db)
    project_id = project.id
    now = utcnow()

    # Bulk Insert Tour Events
    tour_events_to_add: list[TourEvent] = []
    for te in payload.tour_events:
        tour_events_to_add.append(
            TourEvent(
                id=uuid.uuid4(),
                project_id=project_id,
                session_id=payload.session_id,
                feature_version_id=te.feature_version_id,
                step_id=te.step_id,
                event_type=te.event_type,
                created_at=now,
            )
        )

    if tour_events_to_add:
        db.add_all(tour_events_to_add)

    # Bulk Insert Resolution Logs
    res_logs_to_add: list[StepResolutionLog] = []
    for rl in payload.resolution_logs:
        clean_path = _clean_path(rl.page_path or "/")
        res_logs_to_add.append(
            StepResolutionLog(
                id=uuid.uuid4(),
                project_id=project_id,
                step_id=rl.step_id,
                status=rl.status,
                resolution_ms=rl.resolution_ms or 0,
                page_path=clean_path,
                dom_hash=rl.dom_hash,
                detected_dom_selector=rl.detected_dom_selector,
                logged_at=now,
            )
        )

    if res_logs_to_add:
        db.add_all(res_logs_to_add)

    await db.commit()

    return SDKEventsBatchResponse(
        ingested_tour_events=len(tour_events_to_add),
        ingested_resolution_logs=len(res_logs_to_add),
    )
