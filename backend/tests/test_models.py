"""Structural tests for ORM models that mirror the v2 schema."""

from __future__ import annotations

from app.models.identity import OrgMember


def test_org_member_uses_the_schema_composite_primary_key() -> None:
    """`org_members` has no surrogate id in schema_v2.sql."""
    columns = {column.name: column for column in OrgMember.__table__.columns}
    assert set(columns) >= {"org_id", "developer_id", "role", "created_at"}
    assert "id" not in columns
    assert columns["org_id"].primary_key is True
    assert columns["developer_id"].primary_key is True
