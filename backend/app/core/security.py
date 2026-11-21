"""Cryptographic and token primitives for GuideKit.

Everything here is pure (no I/O), deterministic, and unit-testable:

* JWT access-token creation / decoding (``PyJWT``, HS256);
* SHA-256 helpers used to store only *hashes* of refresh tokens, device codes
  and secret API keys (never the raw secret at rest);
* high-entropy token/key generation via :mod:`secrets`.

Secret material that the backend must look up later is always stored hashed;
the raw value is returned to the client exactly once.
"""

from __future__ import annotations

import hashlib
import secrets
import string
import uuid
from functools import lru_cache
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import jwt
from app.core.config import settings


# ---------------------------------------------------------------------------
# Hashing helpers
# ---------------------------------------------------------------------------

def sha256_hex(value: str) -> str:
    """Return the lowercase hex SHA-256 digest of ``value``.

    Used for refresh tokens, device codes and API keys so only the digest is
    persisted, matching the ``*_hash`` columns in the schema.
    """
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# JWT access tokens
# ---------------------------------------------------------------------------

_JWT_ALGORITHM = "HS256"
_ACCESS_TOKEN_TYPE = "access"


def create_access_token(
    developer_id: uuid.UUID | str,
    *,
    expires_minutes: int | None = None,
) -> str:
    """Create a signed JWT access token for ``developer_id``."""
    now = datetime.now(timezone.utc)
    lifetime = expires_minutes if expires_minutes is not None else settings.access_token_expire_minutes
    payload: dict[str, Any] = {
        "sub": str(developer_id),
        "type": _ACCESS_TOKEN_TYPE,
        "iat": now,
        "exp": now + timedelta(minutes=lifetime),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=_JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and verify a JWT access token.

    Raises
    ------
    jwt.PyJWTError
        If the token is malformed, expired or has an invalid signature.
    """
    return jwt.decode(token, settings.secret_key, algorithms=[_JWT_ALGORITHM])


@lru_cache(maxsize=4)
def _clerk_jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_keys=True, timeout=5)


def decode_clerk_token(token: str) -> dict[str, Any]:
    """Decode and verify a Clerk RS256 session token.

    Verification is deliberately fail-closed. A configured PEM key or JWKS URL
    is required, and optional issuer/audience settings are enforced when set.
    """
    if not settings.clerk_issuer:
        raise jwt.InvalidIssuerError("CLERK_ISSUER is not configured")

    decode_kwargs: dict[str, Any] = {
        "algorithms": ["RS256"],
        "options": {"verify_aud": bool(settings.clerk_audience), "require": ["exp", "sub"]},
        "issuer": settings.clerk_issuer.rstrip("/"),
    }
    if settings.clerk_audience:
        decode_kwargs["audience"] = settings.clerk_audience

    if settings.clerk_jwt_key:
        return jwt.decode(token, settings.clerk_jwt_key, **decode_kwargs)
    if settings.clerk_jwks_url:
        jwks_client = _clerk_jwks_client(settings.clerk_jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        return jwt.decode(token, signing_key.key, **decode_kwargs)

    raise jwt.InvalidKeyError("Clerk JWT verification key is not configured")


# ---------------------------------------------------------------------------
# High-entropy token / key generation
# ---------------------------------------------------------------------------

def generate_refresh_token() -> str:
    """Generate an opaque refresh token (stored hashed in ``developer_sessions``)."""
    return secrets.token_urlsafe(48)


def _random_alphanumeric(length: int) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_user_code() -> str:
    """Generate a short human-friendly code, e.g. ``WXYZ-1234``."""
    return f"{_random_alphanumeric(4)}-{_random_alphanumeric(4)}"


def generate_device_code() -> str:
    """Generate a high-entropy device code (stored hashed)."""
    return secrets.token_urlsafe(32)


def generate_api_key(key_type: Literal["publishable", "secret"]) -> tuple[str, str]:
    """Generate an API key.

    Returns
    -------
    (full_key, key_prefix)
        ``full_key`` is the raw key handed to the caller exactly once;
        ``key_prefix`` is the display-safe prefix persisted in ``project_keys``.

    Formats:

    * publishable — ``gk_pk_live_<32 random url-safe chars>``
    * secret      — ``gk_sk_live_<48 random url-safe chars>``
    """
    prefix = "pk" if key_type == "publishable" else "sk"
    entropy_bits = secrets.token_urlsafe(32 if key_type == "publishable" else 48)
    full_key = f"gk_{prefix}_live_{entropy_bits}"
    # First 12 characters make a stable, display-safe prefix (e.g. "gk_pk_live_aB3").
    key_prefix = full_key[:12]
    return full_key, key_prefix
