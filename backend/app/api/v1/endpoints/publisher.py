"""Phase 3 publisher endpoints: workflow sync, knowledge sync, manifest compilation & SDK manifest delivery."""

from __future__ import annotations

import base64
import json
from pathlib import Path
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, Request, Response, UploadFile, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.chunker import chunk_document_text, extract_text_from_pdf
from app.core.config import settings
from app.core.deps import CurrentDeveloper
from app.core.embeddings import embed_texts
from app.core.security import sha256_hex
from app.core.utils import utcnow
from app.db.session import get_db, get_service_db
from app.models.project import Project, ProjectKey, ProjectOrigin
from app.models.workflows import (
    Feature,
    FeatureEmbedding,
    FeatureVersion,
    KnowledgeChunk,
    KnowledgeSource,
    PublishedManifest,
    WorkflowStep,
)
from app.schemas.knowledge import (
    KnowledgeSourceItem,
    KnowledgeTextRequest,
    KnowledgeUploadJsonRequest,
    KnowledgeUploadResponse,
)
from app.schemas.publisher import (
    DraftVersionSummary,
    KnowledgeSyncRequest,
    KnowledgeSyncResponse,
    ManifestPublishRequest,
    ManifestPublishResponse,
    WorkflowSyncRequest,
    WorkflowSyncResponse,
)

router = APIRouter(tags=["publisher"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
ServiceDbSession = Annotated[AsyncSession, Depends(get_service_db)]

STORAGE_DIR = Path(__file__).resolve().parents[4] / "storage" / "manifests"


async def _get_accessible_project(db: AsyncSession, project_id: uuid.UUID) -> Project:
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


# ---------------------------------------------------------------------------
# A. POST /projects/{project_id}/workflows/sync
# ---------------------------------------------------------------------------

@router.post(
    "/projects/{project_id}/workflows/sync",
    response_model=WorkflowSyncResponse,
    summary="Batch sync workflows from IDE / VS Code extension into draft versions",
)
async def sync_workflows(
    project_id: uuid.UUID,
    payload: WorkflowSyncRequest,
    developer: CurrentDeveloper,
    db: DbSession,
) -> WorkflowSyncResponse:
    """Execute two-pass upsert of features, draft versions, and workflow steps.

    Pass 1: Ensure all features exist so prerequisite_feature_slug can be resolved.
    Pass 2: Upsert draft versions and replace their workflow_steps.
    """
    await _get_accessible_project(db, project_id)

    if not payload.features:
        return WorkflowSyncResponse(synced_features=0, draft_versions=[])

    # Pass 1: Upsert features
    slug_to_feature: dict[str, Feature] = {}
    for feat_in in payload.features:
        feat = await db.scalar(
            select(Feature).where(
                Feature.project_id == project_id,
                Feature.slug == feat_in.slug,
            )
        )
        if feat is None:
            feat = Feature(
                id=uuid.uuid4(),
                project_id=project_id,
                slug=feat_in.slug,
                created_by=developer.id,
                created_at=utcnow(),
            )
            db.add(feat)
            await db.flush()
        slug_to_feature[feat_in.slug] = feat

    # Pass 2: Upsert draft versions and steps
    draft_summaries: list[DraftVersionSummary] = []
    now = utcnow()

    for feat_in in payload.features:
        feat = slug_to_feature[feat_in.slug]

        # Resolve prerequisite feature ID
        prereq_id: uuid.UUID | None = None
        if feat_in.prerequisite_feature_slug:
            prereq_feat = slug_to_feature.get(feat_in.prerequisite_feature_slug)
            if prereq_feat is None:
                prereq_feat = await db.scalar(
                    select(Feature).where(
                        Feature.project_id == project_id,
                        Feature.slug == feat_in.prerequisite_feature_slug,
                    )
                )
            if prereq_feat is not None and prereq_feat.id != feat.id:
                prereq_id = prereq_feat.id

        # Check for existing draft version
        draft = await db.scalar(
            select(FeatureVersion).where(
                FeatureVersion.feature_id == feat.id,
                FeatureVersion.status == "draft",
            )
        )

        if draft is not None:
            draft.content = feat_in.content
            draft.example_queries = feat_in.example_queries
            draft.requires_auth = feat_in.requires_auth
            draft.required_role = feat_in.required_role
            draft.prerequisite_feature_id = prereq_id
            draft.updated_at = now

            # Delete old steps for this draft version (allowed by trigger because status == 'draft')
            await db.execute(
                delete(WorkflowStep).where(WorkflowStep.feature_version_id == draft.id)
            )
            await db.flush()
        else:
            max_ver: int = (
                await db.scalar(
                    select(func.coalesce(func.max(FeatureVersion.version_number), 0)).where(
                        FeatureVersion.feature_id == feat.id
                    )
                )
                or 0
            )
            draft = FeatureVersion(
                id=uuid.uuid4(),
                feature_id=feat.id,
                project_id=project_id,
                version_number=max_ver + 1,
                status="draft",
                content=feat_in.content,
                example_queries=feat_in.example_queries,
                requires_auth=feat_in.requires_auth,
                required_role=feat_in.required_role,
                prerequisite_feature_id=prereq_id,
                created_by=developer.id,
                created_at=now,
                updated_at=now,
            )
            db.add(draft)
            await db.flush()

        # Insert synced steps for this draft version
        for s_in in feat_in.steps:
            step = WorkflowStep(
                project_id=project_id,
                feature_version_id=draft.id,
                step_order=s_in.step_order,
                guide_id=s_in.guide_id,
                route_pattern=s_in.route_pattern,
                action_type=s_in.action_type,
                advance_on=s_in.advance_on,
                is_optional=s_in.is_optional,
                wait_timeout_ms=s_in.wait_timeout_ms,
                condition=s_in.condition,
                content=s_in.content,
                target_fingerprint=s_in.target_fingerprint,
            )
            db.add(step)

        await db.flush()

        draft_summaries.append(
            DraftVersionSummary(
                feature_id=feat.id,
                slug=feat.slug,
                version_id=draft.id,
                version_number=draft.version_number,
                step_count=len(feat_in.steps),
            )
        )

    await db.commit()
    return WorkflowSyncResponse(
        synced_features=len(payload.features),
        draft_versions=draft_summaries,
    )


# ---------------------------------------------------------------------------
# B. POST /projects/{project_id}/knowledge/sync
# ---------------------------------------------------------------------------

@router.post(
    "/projects/{project_id}/knowledge/sync",
    response_model=KnowledgeSyncResponse,
    summary="Sync and index knowledge sources and chunks with vector embeddings",
)
async def sync_knowledge(
    project_id: uuid.UUID,
    payload: KnowledgeSyncRequest,
    developer: CurrentDeveloper,
    db: DbSession,
) -> KnowledgeSyncResponse:
    await _get_accessible_project(db, project_id)

    synced_sources = 0
    indexed_chunks = 0
    skipped_sources = 0
    now = utcnow()

    for src_in in payload.sources:
        content_joined = "\n".join(src_in.chunks)
        content_hash = sha256_hex(content_joined)

        existing = await db.scalar(
            select(KnowledgeSource).where(
                KnowledgeSource.project_id == project_id,
                KnowledgeSource.title == src_in.title,
                KnowledgeSource.uri == src_in.uri,
            )
        )

        if existing is not None and existing.content_hash == content_hash and existing.status == "indexed":
            skipped_sources += 1
            continue

        if existing is None:
            source_row = KnowledgeSource(
                id=uuid.uuid4(),
                project_id=project_id,
                source_type=src_in.source_type,
                title=src_in.title,
                uri=src_in.uri,
                content_hash=content_hash,
                status="indexed",
                created_by=developer.id,
                created_at=now,
                updated_at=now,
            )
            db.add(source_row)
            await db.flush()
        else:
            source_row = existing
            source_row.source_type = src_in.source_type
            source_row.content_hash = content_hash
            source_row.status = "indexed"
            source_row.updated_at = now
            # Clear old chunks for this source and locale
            await db.execute(
                delete(KnowledgeChunk).where(
                    KnowledgeChunk.source_id == source_row.id,
                    KnowledgeChunk.locale == src_in.locale,
                )
            )
            await db.flush()

        # Embed chunks
        if src_in.chunks:
            vectors = await embed_texts(src_in.chunks)
            for idx, (chunk_text, vec) in enumerate(zip(src_in.chunks, vectors)):
                chunk_row = KnowledgeChunk(
                    project_id=project_id,
                    source_id=source_row.id,
                    locale=src_in.locale,
                    chunk_index=idx,
                    content=chunk_text,
                    embedding=vec,
                    meta={},
                )
                db.add(chunk_row)
            await db.flush()
            indexed_chunks += len(src_in.chunks)

        synced_sources += 1

    await db.commit()
    return KnowledgeSyncResponse(
        synced_sources=synced_sources,
        indexed_chunks=indexed_chunks,
        skipped_sources=skipped_sources,
    )


# ---------------------------------------------------------------------------
# B2. Phase 6 RAG Knowledge Base Management (PDF, TXT, MD, Raw Text)
# ---------------------------------------------------------------------------

async def _process_and_index_document(
    db: AsyncSession,
    project_id: uuid.UUID,
    developer_id: uuid.UUID,
    filename: str,
    content_bytes: bytes,
    title: str | None = None,
    locale: str = "en",
    uri: str | None = None,
) -> KnowledgeUploadResponse:
    now = utcnow()
    doc_title = title or filename
    lower_fn = filename.lower()

    # Extract text and chunk
    all_chunks: list[dict] = []
    if lower_fn.endswith(".pdf"):
        pages = extract_text_from_pdf(content_bytes)
        for page_num, page_text in pages:
            page_chunks = chunk_document_text(page_text, page_number=page_num)
            all_chunks.extend(page_chunks)
    else:
        text = content_bytes.decode("utf-8", errors="replace")
        all_chunks = chunk_document_text(text)

    if not all_chunks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract readable text from document",
        )

    # Re-index chunk indices
    for idx, c in enumerate(all_chunks):
        c["chunk_index"] = idx

    full_text = "\n".join(c["content"] for c in all_chunks)
    content_hash = sha256_hex(full_text)

    # Embed chunks
    chunk_texts = [c["content"] for c in all_chunks]
    embeddings = await embed_texts(chunk_texts)

    # Upsert knowledge source
    existing = await db.scalar(
        select(KnowledgeSource).where(
            KnowledgeSource.project_id == project_id,
            KnowledgeSource.title == doc_title,
        )
    )

    if existing is None:
        source_row = KnowledgeSource(
            id=uuid.uuid4(),
            project_id=project_id,
            source_type="file" if (lower_fn.endswith(".pdf") or "." in filename) else "markdown",
            title=doc_title,
            uri=uri or filename,
            content_hash=content_hash,
            status="indexed",
            created_by=developer_id,
            created_at=now,
            updated_at=now,
        )
        db.add(source_row)
        await db.flush()
    else:
        source_row = existing
        source_row.content_hash = content_hash
        source_row.status = "indexed"
        source_row.updated_at = now
        await db.execute(
            delete(KnowledgeChunk).where(KnowledgeChunk.source_id == source_row.id)
        )

    # Insert chunks
    for c, vec in zip(all_chunks, embeddings):
        chunk_row = KnowledgeChunk(
            id=uuid.uuid4(),
            project_id=project_id,
            source_id=source_row.id,
            locale=locale,
            chunk_index=c["chunk_index"],
            content=c["content"],
            embedding=vec,
            meta=c.get("meta") or {},
        )
        db.add(chunk_row)

    await db.commit()
    return KnowledgeUploadResponse(
        source_id=source_row.id,
        title=doc_title,
        chunk_count=len(all_chunks),
        status="indexed",
    )


@router.get(
    "/projects/{project_id}/knowledge",
    response_model=list[KnowledgeSourceItem],
    summary="List all indexed knowledge sources for a project",
)
async def list_project_knowledge(
    project_id: uuid.UUID,
    developer: CurrentDeveloper,
    db: DbSession,
) -> list[KnowledgeSourceItem]:
    await _get_accessible_project(db, project_id)

    sources = (
        await db.execute(
            select(KnowledgeSource)
            .where(KnowledgeSource.project_id == project_id)
            .order_by(KnowledgeSource.created_at.desc())
        )
    ).scalars().all()

    result: list[KnowledgeSourceItem] = []
    for src in sources:
        count = await db.scalar(
            select(func.count(KnowledgeChunk.id)).where(KnowledgeChunk.source_id == src.id)
        ) or 0
        result.append(
            KnowledgeSourceItem(
                id=src.id,
                source_type=src.source_type,
                title=src.title,
                uri=src.uri,
                status=src.status,
                chunk_count=count,
                created_at=src.created_at,
                updated_at=src.updated_at,
            )
        )

    return result


@router.post(
    "/projects/{project_id}/knowledge/text",
    response_model=KnowledgeUploadResponse,
    summary="Index raw text or markdown into RAG knowledge base",
)
async def index_knowledge_text(
    project_id: uuid.UUID,
    payload: KnowledgeTextRequest,
    developer: CurrentDeveloper,
    db: DbSession,
) -> KnowledgeUploadResponse:
    await _get_accessible_project(db, project_id)
    content_bytes = payload.content.encode("utf-8")
    return await _process_and_index_document(
        db=db,
        project_id=project_id,
        developer_id=developer.id,
        filename=f"{payload.title}.md",
        content_bytes=content_bytes,
        title=payload.title,
        locale=payload.locale,
        uri=payload.uri,
    )


@router.post(
    "/projects/{project_id}/knowledge/upload",
    response_model=KnowledgeUploadResponse,
    summary="Upload and index a PDF, TXT, or MD document into RAG",
)
async def upload_knowledge_file(
    project_id: uuid.UUID,
    developer: CurrentDeveloper,
    db: DbSession,
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    locale: str = Form(default="en"),
) -> KnowledgeUploadResponse:
    await _get_accessible_project(db, project_id)
    content = await file.read()
    filename = file.filename or "uploaded_document"
    return await _process_and_index_document(
        db=db,
        project_id=project_id,
        developer_id=developer.id,
        filename=filename,
        content_bytes=content,
        title=title,
        locale=locale,
    )


@router.post(
    "/projects/{project_id}/knowledge/upload-json",
    response_model=KnowledgeUploadResponse,
    summary="Upload and index a base64-encoded document (VS Code / JSON clients)",
)
async def upload_knowledge_json(
    project_id: uuid.UUID,
    payload: KnowledgeUploadJsonRequest,
    developer: CurrentDeveloper,
    db: DbSession,
) -> KnowledgeUploadResponse:
    await _get_accessible_project(db, project_id)
    try:
        content_bytes = base64.b64decode(payload.content_base64)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid base64 payload",
        ) from exc

    return await _process_and_index_document(
        db=db,
        project_id=project_id,
        developer_id=developer.id,
        filename=payload.filename,
        content_bytes=content_bytes,
        title=payload.title,
        locale=payload.locale,
    )


@router.delete(
    "/projects/{project_id}/knowledge/{source_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a knowledge source and all its vector chunks",
)
async def delete_knowledge_source(
    project_id: uuid.UUID,
    source_id: uuid.UUID,
    developer: CurrentDeveloper,
    db: DbSession,
) -> None:
    await _get_accessible_project(db, project_id)
    source = await db.scalar(
        select(KnowledgeSource).where(
            KnowledgeSource.id == source_id,
            KnowledgeSource.project_id == project_id,
        )
    )
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge source not found")

    await db.execute(delete(KnowledgeChunk).where(KnowledgeChunk.source_id == source_id))
    await db.delete(source)
    await db.commit()


# ---------------------------------------------------------------------------
# C. POST /projects/{project_id}/publish
# ---------------------------------------------------------------------------

@router.post(
    "/projects/{project_id}/publish",
    response_model=ManifestPublishResponse,
    summary="Compile and publish workflows into a static CDN-ready manifest",
)
async def publish_manifest(
    project_id: uuid.UUID,
    payload: ManifestPublishRequest,
    developer: CurrentDeveloper,
    db: DbSession,
) -> ManifestPublishResponse:
    project = await _get_accessible_project(db, project_id)
    now = utcnow()

    # Step 1: Promote drafts to published
    draft_stmt = select(FeatureVersion).where(
        FeatureVersion.project_id == project_id,
        FeatureVersion.status == "draft",
    )
    if payload.feature_ids:
        draft_stmt = draft_stmt.where(FeatureVersion.feature_id.in_(payload.feature_ids))

    draft_versions = (await db.execute(draft_stmt)).scalars().all()

    for draft in draft_versions:
        # Archive any currently published version first so feature_versions_one_published_uq is never violated
        current_pub = (
            await db.execute(
                select(FeatureVersion).where(
                    FeatureVersion.feature_id == draft.feature_id,
                    FeatureVersion.status == "published",
                )
            )
        ).scalar_one_or_none()
        if current_pub is not None:
            current_pub.status = "archived"
            current_pub.updated_at = now
            await db.flush()

        # Promote draft
        draft.status = "published"
        draft.published_at = now
        draft.published_by = developer.id
        draft.updated_at = now
        await db.flush()

    # Step 2: Generate feature embeddings for all currently published versions
    published_versions = (
        await db.execute(
            select(FeatureVersion).where(
                FeatureVersion.project_id == project_id,
                FeatureVersion.status == "published",
            )
        )
    ).scalars().all()

    for pv in published_versions:
        # Clear existing embeddings for this version
        await db.execute(
            delete(FeatureEmbedding).where(FeatureEmbedding.feature_version_id == pv.id)
        )
        await db.flush()

        content_dict = pv.content or {}
        example_queries = pv.example_queries or []

        # Iterate each locale in content
        for locale, loc_data in content_dict.items():
            if not isinstance(loc_data, dict):
                continue
            texts_to_embed: list[str] = []
            title = loc_data.get("title")
            if title and isinstance(title, str) and title.strip():
                texts_to_embed.append(title.strip())
            desc = loc_data.get("intent_description") or loc_data.get("description")
            if desc and isinstance(desc, str) and desc.strip():
                texts_to_embed.append(desc.strip())
            for q in example_queries:
                if q and isinstance(q, str) and q.strip() and q not in texts_to_embed:
                    texts_to_embed.append(q.strip())

            if texts_to_embed:
                vectors = await embed_texts(texts_to_embed)
                for src_text, vec in zip(texts_to_embed, vectors):
                    emb_row = FeatureEmbedding(
                        project_id=project_id,
                        feature_version_id=pv.id,
                        locale=str(locale),
                        source_text=src_text,
                        embedding=vec,
                    )
                    db.add(emb_row)
                await db.flush()

    # Step 3: Compile and Store the JSON Manifest
    features_all = (
        await db.execute(select(Feature).where(Feature.project_id == project_id))
    ).scalars().all()
    feature_by_id = {f.id: f for f in features_all}

    manifest_features = []
    for pv in published_versions:
        feat = feature_by_id.get(pv.feature_id)
        if feat is None:
            continue

        prereq_slug: str | None = None
        if pv.prerequisite_feature_id and pv.prerequisite_feature_id in feature_by_id:
            prereq_slug = feature_by_id[pv.prerequisite_feature_id].slug

        steps = (
            await db.execute(
                select(WorkflowStep)
                .where(WorkflowStep.feature_version_id == pv.id)
                .order_by(WorkflowStep.step_order)
            )
        ).scalars().all()

        manifest_features.append(
            {
                "id": str(feat.id),
                "slug": feat.slug,
                "version_id": str(pv.id),
                "version_number": pv.version_number,
                "requires_auth": pv.requires_auth,
                "required_role": pv.required_role,
                "prerequisite_feature_id": str(pv.prerequisite_feature_id) if pv.prerequisite_feature_id else None,
                "prerequisite_feature_slug": prereq_slug,
                "content": pv.content,
                "example_queries": pv.example_queries,
                "steps": [
                    {
                        "id": str(s.id),
                        "step_order": s.step_order,
                        "guide_id": s.guide_id,
                        "route_pattern": s.route_pattern,
                        "action_type": s.action_type,
                        "advance_on": s.advance_on,
                        "is_optional": s.is_optional,
                        "wait_timeout_ms": s.wait_timeout_ms,
                        "condition": s.condition,
                        "content": s.content,
                        "target_fingerprint": s.target_fingerprint,
                    }
                    for s in steps
                ],
            }
        )

    # Calculate next manifest version
    max_ver = (
        await db.scalar(
            select(func.coalesce(func.max(PublishedManifest.manifest_version), 0)).where(
                PublishedManifest.project_id == project_id
            )
        )
        or 0
    )
    next_ver = max_ver + 1

    manifest_obj = {
        "manifest_version": next_ver,
        "project_id": str(project_id),
        "slug": project.slug,
        "name": project.name,
        "framework": project.framework,
        "default_locale": project.default_locale,
        "supported_locales": project.supported_locales,
        "auth_detection_config": project.auth_detection_config,
        "chat_settings": project.chat_settings,
        "published_at": now.isoformat(),
        "features": manifest_features,
    }

    manifest_json = json.dumps(manifest_obj, sort_keys=True, ensure_ascii=False)
    manifest_bytes = manifest_json.encode("utf-8")
    etag = f'W/"{sha256_hex(manifest_json)}"'
    byte_size = len(manifest_bytes)
    storage_key = f"manifests/{project_id}/manifest_v{next_ver}.json"

    # Save to local storage
    project_storage = STORAGE_DIR / str(project_id)
    project_storage.mkdir(parents=True, exist_ok=True)
    (project_storage / f"manifest_v{next_ver}.json").write_bytes(manifest_bytes)
    (project_storage / "latest.json").write_bytes(manifest_bytes)

    # In PostgreSQL: set previous is_current = FALSE, insert new row with is_current = TRUE
    await db.execute(
        update(PublishedManifest)
        .where(
            PublishedManifest.project_id == project_id,
            PublishedManifest.is_current.is_(True),
        )
        .values(is_current=False)
    )
    await db.flush()

    new_manifest = PublishedManifest(
        id=uuid.uuid4(),
        project_id=project_id,
        manifest_version=next_ver,
        etag=etag,
        storage_key=storage_key,
        byte_size=byte_size,
        feature_count=len(published_versions),
        is_current=True,
        published_by=developer.id,
        published_at=now,
    )
    db.add(new_manifest)
    await db.commit()
    await db.refresh(new_manifest)

    return ManifestPublishResponse(
        id=new_manifest.id,
        manifest_id=new_manifest.id,
        manifest_version=new_manifest.manifest_version,
        version_number=new_manifest.manifest_version,
        etag=new_manifest.etag,
        byte_size=new_manifest.byte_size,
        feature_count=new_manifest.feature_count,
        published_features=new_manifest.feature_count,
        storage_key=new_manifest.storage_key,
        manifest_url=f"/sdk/manifest",
        published_at=new_manifest.published_at,
    )


# ---------------------------------------------------------------------------
# D. GET /sdk/manifest
# ---------------------------------------------------------------------------

async def _resolve_sdk_project_key(
    request: Request,
    db: AsyncSession,
) -> tuple[ProjectKey, Project]:
    """Resolve project and publishable key from X-GuideKit-Key, Bearer token, or query param."""
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
                ProjectKey.key_type == "publishable",
                ProjectKey.revoked_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    if key_row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or revoked API key")

    # Origin verification
    origin = (request.headers.get("origin") or "").rstrip("/")
    if origin:
        allowed = await db.scalar(
            select(ProjectOrigin.id).where(
                ProjectOrigin.project_id == key_row.project_id,
                ProjectOrigin.origin == origin,
            )
        )
        if allowed is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Origin not allowed for this project")

    project = await db.get(Project, key_row.project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    return key_row, project


@router.get(
    "/sdk/manifest",
    summary="Public runtime SDK manifest delivery with ETag caching",
)
async def get_sdk_manifest(
    request: Request,
    db: ServiceDbSession,
) -> Response:
    """Deliver compiled manifest with ETag caching and 304 Not Modified support."""
    key_row, project = await _resolve_sdk_project_key(request, db)

    manifest_row = (
        await db.execute(
            select(PublishedManifest).where(
                PublishedManifest.project_id == project.id,
                PublishedManifest.is_current.is_(True),
            )
        )
    ).scalar_one_or_none()

    if manifest_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No published manifest found")

    # Touch key last_used_at
    key_row.last_used_at = utcnow()
    await db.commit()

    # Check ETag (If-None-Match)
    raw_origin = request.headers.get("origin")
    res_headers: dict[str, str] = {
        "ETag": manifest_row.etag,
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    }
    if raw_origin:
        res_headers["Access-Control-Allow-Origin"] = raw_origin

    if_none_match = request.headers.get("if-none-match")
    if if_none_match and if_none_match.strip() == manifest_row.etag:
        return Response(
            status_code=status.HTTP_304_NOT_MODIFIED,
            headers=res_headers,
        )

    # Read manifest bytes from disk or assemble
    latest_file = STORAGE_DIR / str(project.id) / "latest.json"
    if latest_file.is_file():
        content_bytes = latest_file.read_bytes()
    else:
        # Fallback: read specific version or assemble minimal representation
        content_bytes = json.dumps(
            {
                "manifest_version": manifest_row.manifest_version,
                "project_id": str(project.id),
                "name": project.name,
                "slug": project.slug,
                "framework": project.framework,
                "default_locale": project.default_locale,
                "supported_locales": project.supported_locales,
                "published_at": manifest_row.published_at.isoformat(),
                "features": [],
            }
        ).encode("utf-8")

    return Response(
        content=content_bytes,
        media_type="application/json",
        headers=res_headers,
    )
