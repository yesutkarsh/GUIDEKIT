"""Tests for application settings loading and validation."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_defaults_are_safe() -> None:
    settings = Settings()
    assert settings.environment == "development"
    assert settings.api_v1_prefix == "/api/v1"
    assert settings.access_token_expire_minutes == 15


def test_cors_origins_split_from_comma_string() -> None:
    settings = Settings(cors_origins="https://a.example, https://b.example")
    assert settings.cors_origins == ["https://a.example", "https://b.example"]


def test_cors_origins_accepts_list() -> None:
    settings = Settings(cors_origins=["https://a.example"])
    assert settings.cors_origins == ["https://a.example"]


def test_environment_is_normalized_to_lowercase() -> None:
    settings = Settings(environment="  PRODUCTION ", secret_key="a" * 64)
    assert settings.environment == "production"


def test_production_rejects_insecure_default_secret() -> None:
    with pytest.raises(ValidationError):
        Settings(environment="production", secret_key="change-me-to-a-long-random-secret")


def test_production_accepts_strong_secret() -> None:
    settings = Settings(environment="production", secret_key="a" * 64)
    assert settings.is_production is True
