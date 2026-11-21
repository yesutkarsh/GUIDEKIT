"""Static verification of ``sql/schema_v2.sql`` (no database required).

These tests guarantee the two mandatory Phase 1 patches are present and that
the full v2 table surface, extensions and RLS wiring are intact, so a reviewer
can trust the DDL without running a migration.
"""

from __future__ import annotations

import re
from pathlib import Path

SCHEMA_PATH = Path(__file__).resolve().parents[1] / "sql" / "schema_v2.sql"
SCHEMA = SCHEMA_PATH.read_text(encoding="utf-8")


def _table_block(table_name: str) -> str:
    start = SCHEMA.index(f"CREATE TABLE {table_name} ")
    end = SCHEMA.index("CREATE TABLE", start + 1) if "CREATE TABLE" in SCHEMA[start + 1 :] else len(SCHEMA)
    return SCHEMA[start:end]


REQUIRED_TABLES = [
    "developers",
    "organizations",
    "org_members",
    "developer_sessions",
    "device_auth_requests",
    "projects",
    "project_origins",
    "project_keys",
    "features",
    "feature_versions",
    "feature_embeddings",
    "workflow_steps",
    "published_manifests",
    "knowledge_sources",
    "knowledge_chunks",
    "chat_sessions",
    "chat_messages",
    "tour_events",
    "step_resolution_logs",
    "heal_suggestions",
    "step_resolution_cache",
    "project_usage_daily",
]


def test_legacy_password_column_is_nullable_and_google_is_default() -> None:
    block = _table_block("developers")
    assert "password_hash" in block
    assert re.search(r"password_hash\s+TEXT", block)
    assert "password_hash     TEXT NOT NULL" not in block
    assert "auth_provider     TEXT NOT NULL DEFAULT 'google'" in block
    assert "developers_password_check" not in block


def test_patch2_framework_check_expanded() -> None:
    assert (
        "CHECK (framework IN ('react','nextjs','svelte','sveltekit','vue','vanilla'))" in SCHEMA
    )
    # The old, narrow constraint must be gone.
    assert "CHECK (framework IN ('react','nextjs'))" not in SCHEMA


def test_projects_include_creation_metadata() -> None:
    block = _table_block("projects")
    assert "environment           TEXT NOT NULL DEFAULT 'development'" in block
    assert "background_id         TEXT NOT NULL DEFAULT 'untitled-blend'" in block


def test_all_required_tables_exist() -> None:
    for table in REQUIRED_TABLES:
        assert f"CREATE TABLE {table}" in SCHEMA, f"missing table: {table}"


def test_extensions_enabled() -> None:
    assert "CREATE EXTENSION IF NOT EXISTS pgcrypto" in SCHEMA
    assert "CREATE EXTENSION IF NOT EXISTS vector" in SCHEMA


def test_row_level_security_enabled_on_projects() -> None:
    assert "ALTER TABLE projects ENABLE ROW LEVEL SECURITY" in SCHEMA


def test_api_key_integrity_check_present() -> None:
    assert "CHECK ( (key_type = 'publishable') OR (key_plain IS NULL) )" in SCHEMA


def test_secret_key_hash_column_present() -> None:
    block = _table_block("project_keys")
    assert "key_hash" in block
    assert "key_prefix" in block


def test_published_versions_immutability_trigger() -> None:
    assert "forbid_edit_of_non_draft_steps" in SCHEMA
    assert "workflow_steps_immutable" in SCHEMA
