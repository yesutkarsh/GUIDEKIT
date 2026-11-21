"""Shared Google-only authentication helper for live smoke scripts."""

from __future__ import annotations

import os


def configured_bearer_token() -> str:
    token = os.environ.get("GUIDEKIT_TOKEN", "").strip()
    if not token:
        raise RuntimeError(
            "GUIDEKIT_TOKEN is required. Sign in with Google and provide a current test bearer token."
        )
    return token


def configured_auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {configured_bearer_token()}"}
