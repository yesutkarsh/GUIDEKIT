"""Tests for Pydantic request/response schemas."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models.project import Framework, ProjectBackground, ProjectEnvironment
from app.schemas.project import OriginCreate, ProjectCreate


def test_framework_enum_includes_phase1_expanded_set() -> None:
    assert {f.value for f in Framework} == {"react", "nextjs", "svelte", "sveltekit", "vue", "vanilla"}


def test_project_create_defaults() -> None:
    project = ProjectCreate(name="Taxi Central")
    assert project.framework is Framework.NEXTJS
    assert project.default_locale == "en"
    assert project.supported_locales == ["en"]
    assert project.environment is ProjectEnvironment.DEVELOPMENT
    assert project.background_id is ProjectBackground.UNTITLED_BLEND


def test_project_create_accepts_visual_identity_and_environment() -> None:
    project = ProjectCreate(
        name="Taxi Central",
        environment="production",
        background_id="sunset-pop",
    )
    assert project.environment is ProjectEnvironment.PRODUCTION
    assert project.background_id is ProjectBackground.SUNSET_POP


def test_project_create_rejects_unknown_visual_identity() -> None:
    with pytest.raises(ValidationError):
        ProjectCreate(name="Taxi Central", background_id="unknown")


def test_origin_requires_scheme() -> None:
    with pytest.raises(ValidationError):
        OriginCreate(origin="taxicentral.com")


def test_origin_rejects_path() -> None:
    with pytest.raises(ValidationError):
        OriginCreate(origin="https://taxicentral.com/dashboard")


def test_origin_normalizes_trailing_slash() -> None:
    origin = OriginCreate(origin="https://taxicentral.com/")
    assert origin.origin == "https://taxicentral.com"
