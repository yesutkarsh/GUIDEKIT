#!/usr/bin/env python3
"""Apply :file:`sql/schema_v2.sql` to the Neon database.

This is a standalone, async migration runner. It reads the full DDL script
(which contains multi-statement DDL, ``DO`` blocks and ``$$``-quoted function
bodies) and executes it with ``psycopg`` (v3), whose simple-query path runs a
multi-statement script in one round trip.

Usage::

    # from the backend/ directory
    python scripts/init_db.py                 # apply (no-op if already applied)
    python scripts/init_db.py --drop          # DROP schema public, then re-apply

Environment: reads ``DATABASE_URL`` from the environment or ``.env`` (via
``app.core.config``). The SQLAlchemy ``postgresql+psycopg://`` scheme is
accepted and normalised to a libpq DSN automatically.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

# Allow running directly as `python scripts/init_db.py` without PYTHONPATH.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import psycopg

from app.core.config import settings

SCHEMA_PATH = BACKEND_DIR / "sql" / "schema_v2.sql"

SENTINEL_QUERY = "SELECT to_regclass('public.developers')"


def to_libpq_dsn(database_url: str) -> str:
    """Convert a SQLAlchemy async URL into a libpq/psycopg connection string."""
    url = database_url.strip()
    if not url:
        sys.exit("DATABASE_URL is not set. Copy .env.example to .env and configure it.")
    if "://" in url:
        scheme, rest = url.split("://", 1)
        scheme = scheme.split("+", 1)[0]  # strip the SQLAlchemy dialect marker
        url = f"{scheme}://{rest}"
    return url


async def apply_schema(drop: bool) -> None:
    dsn = to_libpq_dsn(settings.database_url)
    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")

    async with await psycopg.AsyncConnection.connect(dsn, autocommit=True) as conn:
        if drop:
            print("Dropping existing schema (public) and re-creating ...")
            async with conn.cursor() as cur:
                await cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
        else:
            async with conn.cursor() as cur:
                await cur.execute(SENTINEL_QUERY)
                (already,) = await cur.fetchone()
            if already is not None:
                print("Schema is already applied (public.developers exists).")
                print("Use --drop to force a full re-create. Nothing to do.")
                return

        print(f"Applying {SCHEMA_PATH.name} ...")
        async with conn.cursor() as cur:
            await cur.execute(schema_sql)

    print("Schema applied successfully.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply the GuideKit v2 schema to Neon.")
    parser.add_argument(
        "--drop",
        action="store_true",
        help="DROP SCHEMA public CASCADE and re-apply from scratch (DESTRUCTIVE).",
    )
    args = parser.parse_args()

    try:
        asyncio.run(apply_schema(drop=args.drop))
    except psycopg.Error as exc:
        print(f"Migration failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
