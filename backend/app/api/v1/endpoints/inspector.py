"""Inspector API endpoints — Phase 2 developer-facing management surface.

Provides CRUD and analytics endpoints for features, feature-versions,
workflow steps, self-healing suggestions and project-level analytics.
Every endpoint is developer-scoped (requires ``CurrentDeveloper``) and
verifies project access via Row-Level Security through :func:`_get_accessible_project`.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentDeveloper
from app.core.utils import utcnow
from app.db.session import get_db
from app.models.project import Project
from app.models.workflows import (
    ChatMessage,
    ChatSession,
    Feature,
    FeatureVersion,
    HealSuggestion,
    ProjectUsageDaily,
    PublishedManifest,
    StepResolutionLog,
    TourEvent,
    WorkflowStep,
)
from app.schemas.inspector import (
    AnalyticsOut,
    ChatAnalytics,
    DailyUsageOut,
    FeatureDetailOut,
    FeatureSummaryOut,
    FeatureVersionOut,
    FeatureVersionPatch,
    HealSuggestionOut,
    HealSuggestionReviewRequest,
    HealSuggestionReviewResponse,
    ManifestMetaOut,
    ProjectPatch,
    ResolutionAnalytics,
    TourAnalytics,
    WorkflowStepOut,
)
from app.schemas.project import ProjectOut

router = APIRouter(tags=["inspector"])

DbSession = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_accessible_project(db: AsyncSession, project_id: uuid.UUID) -> Project:
    """Fetch a project by primary key, returning 404 unless the developer has RLS access."""
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


# ---------------------------------------------------------------------------
# Project PATCH
# ---------------------------------------------------------------------------


@router.patch(
    "/projects/{project_id}",
    response_model=ProjectOut,
    summary="Partially update a project's settings",
)
async def patch_project(
    project_id: uuid.UUID,
    payload: ProjectPatch,
    developer: CurrentDeveloper,
    db: DbSession,
) -> Project:
    """Update one or more mutable fields of a project.

    Only the fields explicitly provided in the request body (non-``None``) are
    applied.  ``updated_at`` is refreshed unconditionally.
    """
    project = await _get_accessible_project(db, project_id)

    update_data = payload.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    project.updated_at = utcnow()

    await db.commit()
    await db.refresh(project)
    return project


# ---------------------------------------------------------------------------
# Features
# ---------------------------------------------------------------------------


@router.get(
    "/projects/{project_id}/features",
    response_model=list[FeatureSummaryOut],
    summary="List non-archived features for a project",
)
async def list_features(
    project_id: uuid.UUID,
    developer: CurrentDeveloper,
    db: DbSession,
) -> list[FeatureSummaryOut]:
    """Return a summary of every non-archived feature in the project.

    For each feature the response includes its current draft version, its
    published version, and a step-count derived from the published version
    (falling back to draft when no published version exists).
    """
    await _get_accessible_project(db, project_id)

    features = (
        await db.execute(
            select(Feature)
            .where(Feature.project_id == project_id, Feature.archived_at.is_(None))
            .order_by(Feature.created_at)
        )
    ).scalars().all()

    result: list[FeatureSummaryOut] = []
    for feature in features:
        # Draft version
        draft_row = (
            await db.execute(
                select(FeatureVersion).where(
                    FeatureVersion.feature_id == feature.id,
                    FeatureVersion.status == "draft",
                )
            )
        ).scalar_one_or_none()

        # Published version
        published_row = (
            await db.execute(
                select(FeatureVersion).where(
                    FeatureVersion.feature_id == feature.id,
                    FeatureVersion.status == "published",
                )
            )
        ).scalar_one_or_none()

        # Step count: use published version first, fall back to draft
        count_version = published_row or draft_row
        step_count = 0
        if count_version is not None:
            step_count = await db.scalar(
                select(func.count(WorkflowStep.id)).where(
                    WorkflowStep.feature_version_id == count_version.id
                )
            ) or 0

        result.append(
            FeatureSummaryOut(
                id=feature.id,
                project_id=feature.project_id,
                slug=feature.slug,
                created_at=feature.created_at,
                archived_at=feature.archived_at,
                draft_version=FeatureVersionOut.model_validate(draft_row) if draft_row else None,
                published_version=(
                    FeatureVersionOut.model_validate(published_row) if published_row else None
                ),
                step_count=step_count,
            )
        )

    return result


@router.get(
    "/projects/{project_id}/features/{feature_id}",
    response_model=FeatureDetailOut,
    summary="Get a feature with all its versions and steps",
)
async def get_feature(
    project_id: uuid.UUID,
    feature_id: uuid.UUID,
    developer: CurrentDeveloper,
    db: DbSession,
) -> FeatureDetailOut:
    """Return full detail for a feature: all versions and all workflow steps.

    Steps are collected across every version and ordered by ``step_order``.
    """
    await _get_accessible_project(db, project_id)

    feature = await db.scalar(
        select(Feature).where(Feature.id == feature_id, Feature.project_id == project_id)
    )
    if feature is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feature not found")

    versions = (
        await db.execute(
            select(FeatureVersion)
            .where(FeatureVersion.feature_id == feature_id)
            .order_by(FeatureVersion.version_number)
        )
    ).scalars().all()

    version_ids = [v.id for v in versions]
    steps: list[WorkflowStep] = []
    if version_ids:
        steps = (
            await db.execute(
                select(WorkflowStep)
                .where(WorkflowStep.feature_version_id.in_(version_ids))
                .order_by(WorkflowStep.step_order)
            )
        ).scalars().all()

    return FeatureDetailOut(
        id=feature.id,
        project_id=feature.project_id,
        slug=feature.slug,
        created_at=feature.created_at,
        archived_at=feature.archived_at,
        versions=[FeatureVersionOut.model_validate(v) for v in versions],
        steps=[WorkflowStepOut.model_validate(s) for s in steps],
    )


@router.delete(
    "/projects/{project_id}/features/{feature_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archive/delete a feature from a project",
)
async def delete_feature(
    project_id: uuid.UUID,
    feature_id: uuid.UUID,
    developer: CurrentDeveloper,
    db: DbSession,
) -> None:
    await _get_accessible_project(db, project_id)
    feature = await db.scalar(
        select(Feature).where(Feature.id == feature_id, Feature.project_id == project_id)
    )
    if feature is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feature not found")

    feature.archived_at = utcnow()
    await db.commit()


# ---------------------------------------------------------------------------
# Feature-version PATCH
# ---------------------------------------------------------------------------


@router.patch(
    "/projects/{project_id}/features/{feature_id}/versions/{version_id}",
    response_model=FeatureVersionOut,
    summary="Partially update a draft feature-version",
)
async def patch_feature_version(
    project_id: uuid.UUID,
    feature_id: uuid.UUID,
    version_id: uuid.UUID,
    payload: FeatureVersionPatch,
    developer: CurrentDeveloper,
    db: DbSession,
) -> FeatureVersion:
    """Update mutable fields of a **draft** FeatureVersion.

    Raises ``422`` if the version is not in ``draft`` status; published and
    archived versions are immutable.
    """
    await _get_accessible_project(db, project_id)

    version = await db.scalar(
        select(FeatureVersion).where(
            FeatureVersion.id == version_id,
            FeatureVersion.feature_id == feature_id,
            FeatureVersion.project_id == project_id,
        )
    )
    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Feature version not found"
        )
    if version.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only draft versions may be edited",
        )

    update_data = payload.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(version, field, value)
    version.updated_at = utcnow()

    await db.commit()
    await db.refresh(version)
    return version


# ---------------------------------------------------------------------------
# Heal suggestions
# ---------------------------------------------------------------------------


@router.get(
    "/projects/{project_id}/heal-suggestions",
    response_model=list[HealSuggestionOut],
    summary="List self-heal suggestions for a project",
)
async def list_heal_suggestions(
    project_id: uuid.UUID,
    developer: CurrentDeveloper,
    db: DbSession,
    suggestion_status: str | None = Query(
        default=None,
        alias="status",
        description="Filter by status: pending | approved | rejected (omit for all)",
    ),
) -> list[HealSuggestionOut]:
    """Return heal suggestions enriched with step ``guide_id``, ``route_pattern``
    and the parent feature ``slug``.

    Results are ordered by ``last_seen_at`` descending so the most recent
    regressions surface first.
    """
    await _get_accessible_project(db, project_id)

    stmt = (
        select(
            HealSuggestion,
            WorkflowStep.guide_id,
            WorkflowStep.route_pattern,
            Feature.slug.label("feature_slug"),
        )
        .join(WorkflowStep, WorkflowStep.id == HealSuggestion.step_id)
        .join(FeatureVersion, FeatureVersion.id == WorkflowStep.feature_version_id)
        .join(Feature, Feature.id == FeatureVersion.feature_id)
        .where(HealSuggestion.project_id == project_id)
        .order_by(HealSuggestion.last_seen_at.desc())
    )
    if suggestion_status is not None:
        stmt = stmt.where(HealSuggestion.status == suggestion_status)

    rows = (await db.execute(stmt)).all()

    result: list[HealSuggestionOut] = []
    for row in rows:
        suggestion: HealSuggestion = row[0]
        guide_id: str | None = row[1]
        route_pattern: str | None = row[2]
        feature_slug: str | None = row[3]

        out = HealSuggestionOut.model_validate(suggestion)
        out.guide_id = guide_id
        out.route_pattern = route_pattern
        out.feature_slug = feature_slug
        result.append(out)

    return result


@router.post(
    "/projects/{project_id}/heal-suggestions/{suggestion_id}/review",
    response_model=HealSuggestionReviewResponse,
    summary="Approve or reject a self-heal suggestion",
)
async def review_heal_suggestion(
    project_id: uuid.UUID,
    suggestion_id: uuid.UUID,
    payload: HealSuggestionReviewRequest,
    developer: CurrentDeveloper,
    db: DbSession,
) -> HealSuggestionReviewResponse:
    """Mark a suggestion as ``approved`` or ``rejected``.

    When **approved** the suggested fingerprint is written back into the target
    workflow step inside a draft FeatureVersion:

    * If the step already belongs to a *draft* version that draft is updated
      directly.
    * If the step belongs to a *published* version a new draft is created by
      cloning the published version's fields (incrementing ``version_number``),
      all published steps are copied into the new draft, and the matching step's
      ``target_fingerprint`` is then updated.
    * If a draft for that feature already exists, its matching step (by
      ``step_order``) is updated.
    """
    await _get_accessible_project(db, project_id)

    suggestion = await db.scalar(
        select(HealSuggestion).where(
            HealSuggestion.id == suggestion_id,
            HealSuggestion.project_id == project_id,
        )
    )
    if suggestion is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Heal suggestion not found"
        )

    # Record review metadata
    suggestion.status = payload.action
    suggestion.reviewed_by = developer.id
    suggestion.reviewed_at = utcnow()

    if payload.action == "approve":
        # Load the step the suggestion targets
        step = await db.get(WorkflowStep, suggestion.step_id)
        if step is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Workflow step not found"
            )

        # Determine the feature for this step's current version
        current_version = await db.get(FeatureVersion, step.feature_version_id)
        if current_version is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Feature version not found"
            )

        feature_id = current_version.feature_id

        # Attempt to find an existing draft for this feature
        draft_version = await db.scalar(
            select(FeatureVersion).where(
                FeatureVersion.feature_id == feature_id,
                FeatureVersion.status == "draft",
            )
        )

        if current_version.status == "draft":
            # The step itself belongs to a draft — update it directly
            step.target_fingerprint = suggestion.suggested_fingerprint

        elif draft_version is not None:
            # A draft already exists for this feature; find the matching step
            # inside it by step_order and update that copy.
            draft_step = await db.scalar(
                select(WorkflowStep).where(
                    WorkflowStep.feature_version_id == draft_version.id,
                    WorkflowStep.step_order == step.step_order,
                )
            )
            if draft_step is not None:
                draft_step.target_fingerprint = suggestion.suggested_fingerprint

        else:
            # No draft exists — clone the published version
            published_version = await db.scalar(
                select(FeatureVersion).where(
                    FeatureVersion.feature_id == feature_id,
                    FeatureVersion.status == "published",
                )
            )
            if published_version is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="No published version found to clone into a draft",
                )

            # Determine next version_number
            max_version_number: int = await db.scalar(
                select(func.max(FeatureVersion.version_number)).where(
                    FeatureVersion.feature_id == feature_id
                )
            ) or 0

            new_draft = FeatureVersion(
                feature_id=feature_id,
                project_id=project_id,
                version_number=max_version_number + 1,
                status="draft",
                content=dict(published_version.content),
                example_queries=list(published_version.example_queries),
                requires_auth=published_version.requires_auth,
                required_role=published_version.required_role,
                prerequisite_feature_id=published_version.prerequisite_feature_id,
                created_by=developer.id,
                updated_at=utcnow(),
            )
            db.add(new_draft)
            await db.flush()  # populate new_draft.id

            # Copy all steps from the published version into the new draft
            published_steps = (
                await db.execute(
                    select(WorkflowStep)
                    .where(WorkflowStep.feature_version_id == published_version.id)
                    .order_by(WorkflowStep.step_order)
                )
            ).scalars().all()

            for pub_step in published_steps:
                # Carry over the updated fingerprint for the matching step
                fingerprint = (
                    suggestion.suggested_fingerprint
                    if pub_step.step_order == step.step_order
                    else dict(pub_step.target_fingerprint)
                )
                new_step = WorkflowStep(
                    project_id=project_id,
                    feature_version_id=new_draft.id,
                    step_order=pub_step.step_order,
                    guide_id=pub_step.guide_id,
                    route_pattern=pub_step.route_pattern,
                    action_type=pub_step.action_type,
                    advance_on=pub_step.advance_on,
                    is_optional=pub_step.is_optional,
                    wait_timeout_ms=pub_step.wait_timeout_ms,
                    condition=pub_step.condition,
                    content=dict(pub_step.content),
                    target_fingerprint=fingerprint,
                )
                db.add(new_step)

    await db.commit()
    return HealSuggestionReviewResponse(id=suggestion.id, status=suggestion.status)


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------


@router.get(
    "/projects/{project_id}/analytics",
    response_model=AnalyticsOut,
    summary="Aggregated analytics for a project",
)
async def get_analytics(
    project_id: uuid.UUID,
    developer: CurrentDeveloper,
    db: DbSession,
) -> AnalyticsOut:
    """Return aggregated chat, tour-funnel, resolution and daily-usage metrics.

    All aggregations are computed server-side in a single async session;
    no background tasks are involved.
    """
    await _get_accessible_project(db, project_id)

    # ----- Chat aggregations -----
    total_sessions: int = await db.scalar(
        select(func.count(ChatSession.id)).where(ChatSession.project_id == project_id)
    ) or 0

    total_messages: int = await db.scalar(
        select(func.count(ChatMessage.id)).where(ChatMessage.project_id == project_id)
    ) or 0

    route_rows = (
        await db.execute(
            select(ChatMessage.route_taken, func.count().label("n"))
            .where(ChatMessage.project_id == project_id)
            .group_by(ChatMessage.route_taken)
        )
    ).all()
    by_route: dict[str, int] = {
        (row[0] or "unknown"): row[1] for row in route_rows
    }

    # ----- Tour-funnel aggregations -----
    tour_rows = (
        await db.execute(
            select(TourEvent.event_type, func.count().label("n"))
            .where(TourEvent.project_id == project_id)
            .group_by(TourEvent.event_type)
        )
    ).all()
    tour_counts: dict[str, int] = {row[0]: row[1] for row in tour_rows}

    # ----- Resolution aggregations -----
    res_rows = (
        await db.execute(
            select(StepResolutionLog.status, func.count().label("n"))
            .where(StepResolutionLog.project_id == project_id)
            .group_by(StepResolutionLog.status)
        )
    ).all()
    res_counts: dict[str, int] = {row[0]: row[1] for row in res_rows}

    # ----- Daily usage (last 30 days) -----
    usage_rows = (
        await db.execute(
            select(ProjectUsageDaily)
            .where(ProjectUsageDaily.project_id == project_id)
            .order_by(ProjectUsageDaily.day.desc())
            .limit(30)
        )
    ).scalars().all()

    # ----- Latest manifest -----
    manifest_row = await db.scalar(
        select(PublishedManifest).where(
            PublishedManifest.project_id == project_id,
            PublishedManifest.is_current.is_(True),
        )
    )

    return AnalyticsOut(
        chat=ChatAnalytics(
            total_sessions=total_sessions,
            total_messages=total_messages,
            by_route=by_route,
        ),
        tours=TourAnalytics(
            started=tour_counts.get("started", 0),
            step_completed=tour_counts.get("step_completed", 0),
            completed=tour_counts.get("completed", 0),
            exited=tour_counts.get("exited", 0),
            failed=tour_counts.get("failed", 0),
        ),
        resolution=ResolutionAnalytics(
            matched_primary=res_counts.get("matched_primary", 0),
            matched_fingerprint=res_counts.get("matched_fingerprint", 0),
            healed_by_ai=res_counts.get("healed_by_ai", 0),
            fallback_to_text=res_counts.get("fallback_to_text", 0),
            cache_hit=res_counts.get("cache_hit", 0),
        ),
        usage_daily=[DailyUsageOut.model_validate(row) for row in usage_rows],
        latest_manifest=(
            ManifestMetaOut.model_validate(manifest_row) if manifest_row else None
        ),
    )
