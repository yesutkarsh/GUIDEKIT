"""Application settings loaded from the environment and/or a ``.env`` file."""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# A clearly-insecure development default so the app can be imported without a
# live database. Production refuses to start with this value.
_DEV_SECRET_KEY = "change-me-to-a-long-random-secret"


class Settings(BaseSettings):
    """Typed, validated application configuration.

    Values are read from environment variables first, then from a ``.env``
    file in the working directory (see :file:`.env.example`).
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # -- Application ---------------------------------------------------
    app_name: str = "GuideKit API"
    environment: str = "development"  # development | staging | production
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # -- Security & Auth -----------------------------------------------
    secret_key: str = _DEV_SECRET_KEY
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    device_code_expire_seconds: int = 900
    dashboard_url: str = "http://localhost:3000"
    openai_api_key: str | None = None

    # -- Clerk Integration ---------------------------------------------
    clerk_secret_key: str | None = None
    clerk_jwks_url: str | None = None
    clerk_jwt_key: str | None = None  # PEM public key string
    clerk_issuer: str | None = None
    clerk_audience: str | None = None
    clerk_authorized_parties: Annotated[list[str], NoDecode] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # -- LLM & Intent Detection (Mercury 2.5 / Inception / OpenAI) -----
    llm_api_key: str | None = None
    llm_base_url: str = "https://api.inceptionlabs.ai/v1"
    llm_model: str = "mercury-2.5"

    # -- Database ------------------------------------------------------
    database_url: str = "postgresql+psycopg://user:pass@localhost:5432/guidekit"
    db_pool_size: int = 5
    db_max_overflow: int = 10
    db_pool_pre_ping: bool = True

    # -- CORS ----------------------------------------------------------
    # ``NoDecode`` keeps pydantic-settings from JSON-parsing the comma-separated
    # string; the validator below splits it into a list.
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("debug", mode="before")
    @classmethod
    def _parse_debug(cls, value: object) -> bool:
        if isinstance(value, str):
            return value.strip().lower() in {"true", "1", "yes", "on", "debug"}
        return bool(value)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: object) -> object:
        """Accept a comma-separated string (as set in ``.env``) or a list."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("clerk_authorized_parties", mode="before")
    @classmethod
    def _split_clerk_authorized_parties(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("environment", mode="before")
    @classmethod
    def _lower_environment(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @model_validator(mode="after")
    def _validate_security(self) -> "Settings":
        if self.environment in {"staging", "production"} and self.secret_key == _DEV_SECRET_KEY:
            raise ValueError(
                "SECRET_KEY must be set to a strong random value in staging/production."
            )
        return self

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    """Return a cached :class:`Settings` instance (single source of truth)."""
    return Settings()


settings = get_settings()
