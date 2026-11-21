"""Unit tests for the pure security primitives in ``app.core.security``."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core import security


@pytest.fixture
def clerk_signing_key(monkeypatch: pytest.MonkeyPatch):
    """Exercise real RS256 crypto instead of mocking the Clerk decoder."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_pem = key.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()
    monkeypatch.setattr(security.settings, "clerk_jwt_key", public_pem)
    monkeypatch.setattr(security.settings, "clerk_issuer", "https://clerk.example")
    monkeypatch.setattr(security.settings, "clerk_audience", None)
    return key


def clerk_claims(**changes):
    now = datetime.now(timezone.utc)
    return {"sub": "user_test", "iss": "https://clerk.example", "iat": now,
            "exp": now + timedelta(minutes=1), "azp": "http://localhost:3000", **changes}


def test_clerk_rs256_signature_roundtrip(clerk_signing_key):
    token = jwt.encode(clerk_claims(), clerk_signing_key, algorithm="RS256")
    assert security.decode_clerk_token(token)["sub"] == "user_test"


def test_clerk_rs256_rejects_expired_token(clerk_signing_key):
    token = jwt.encode(clerk_claims(exp=datetime.now(timezone.utc) - timedelta(minutes=1)), clerk_signing_key, algorithm="RS256")
    with pytest.raises(jwt.ExpiredSignatureError):
        security.decode_clerk_token(token)


def test_clerk_rs256_rejects_wrong_issuer(clerk_signing_key):
    token = jwt.encode(clerk_claims(iss="https://untrusted.example"), clerk_signing_key, algorithm="RS256")
    with pytest.raises(jwt.InvalidIssuerError):
        security.decode_clerk_token(token)


def test_clerk_rs256_rejects_invalid_signature(clerk_signing_key):
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = jwt.encode(clerk_claims(), other_key, algorithm="RS256")
    with pytest.raises(jwt.InvalidSignatureError):
        security.decode_clerk_token(token)


@pytest.mark.parametrize("claim", ["sub", "exp"])
def test_clerk_rs256_requires_subject_and_expiry(clerk_signing_key, claim):
    claims = clerk_claims()
    del claims[claim]
    token = jwt.encode(claims, clerk_signing_key, algorithm="RS256")
    with pytest.raises(jwt.MissingRequiredClaimError):
        security.decode_clerk_token(token)


def test_sha256_is_stable_hex_digest() -> None:
    assert security.sha256_hex("abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    assert security.sha256_hex("abc") == security.sha256_hex("abc")
    assert security.sha256_hex("abc") != security.sha256_hex("abd")


def test_access_token_roundtrip() -> None:
    developer_id = uuid.uuid4()
    token = security.create_access_token(developer_id, expires_minutes=5)
    payload = security.decode_access_token(token)

    assert payload["sub"] == str(developer_id)
    assert payload["type"] == "access"
    assert "exp" in payload and "jti" in payload


def test_access_token_rejects_tampering() -> None:
    token = security.create_access_token(uuid.uuid4())
    with pytest.raises(jwt.PyJWTError):
        security.decode_access_token(token + "x")


def test_clerk_token_verification_fails_closed_without_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(security.settings, "clerk_jwt_key", None)
    monkeypatch.setattr(security.settings, "clerk_jwks_url", None)
    monkeypatch.setattr(security.settings, "clerk_issuer", "https://clerk.example")
    with pytest.raises(jwt.InvalidKeyError):
        security.decode_clerk_token("not-a-trusted-token")


def test_clerk_token_verification_requires_issuer(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(security.settings, "clerk_issuer", None)
    with pytest.raises(jwt.InvalidIssuerError):
        security.decode_clerk_token("not-a-trusted-token")


def test_refresh_tokens_are_unique_and_high_entropy() -> None:
    tokens = {security.generate_refresh_token() for _ in range(100)}
    assert len(tokens) == 100
    assert all(len(t) >= 43 for t in tokens)  # 48 bytes urlsafe -> 64 chars


def test_api_key_format_and_uniqueness() -> None:
    pk, pk_prefix = security.generate_api_key("publishable")
    sk, sk_prefix = security.generate_api_key("secret")

    assert pk.startswith("gk_pk_live_")
    assert sk.startswith("gk_sk_live_")
    assert pk_prefix == pk[:12]
    assert sk_prefix == sk[:12]

    keys = {security.generate_api_key("publishable")[0] for _ in range(100)}
    assert len(keys) == 100


def test_user_code_format() -> None:
    for _ in range(50):
        code = security.generate_user_code()
        assert len(code) == 9  # XXXX-XXXX
        assert code[4] == "-"
        assert all(ch.isalnum() for ch in code.replace("-", ""))


def test_device_code_is_unique() -> None:
    codes = {security.generate_device_code() for _ in range(100)}
    assert len(codes) == 100
