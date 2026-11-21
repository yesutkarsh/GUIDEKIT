"""Database engine and session factories for Neon Serverless PostgreSQL.

Design notes
------------
* A single lazily-created :class:`~sqlalchemy.ext.asyncio.AsyncEngine` is shared
  by the whole app (created on first use, so importing the app never opens a
  connection).
* Three session providers are exposed:

  * :func:`get_db` — plain session. Used for signup/login and anything that only
    touches non-RLS tables (``developers``, ``organizations``, ``org_members``,
    ``developer_sessions``, ``device_auth_requests``).
  * :func:`get_developer_db` — dashboard/extension session. It sets
    ``SET LOCAL app.current_developer_id`` so Postgres Row-Level Security
    (see ``schema_v2.sql`` section 10) scopes every query to the developer's
    own tenancy automatically.
  * :func:`get_service_db` — SDK/runtime "service role" path. The SDK does not
    log in, so there is no developer id; instead RLS is disabled for the local
    transaction (``SET LOCAL row_security = off``).

    .. note:: Disabling RLS requires the connected role to own the tables (or
       hold ``BYPASSRLS``). In Neon this is the default role that ran the
       migration. For a hardened multi-role deployment, create a dedicated
       ``service_role`` with ``BYPASSRLS`` and point the SDK path at it.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from functools import lru_cache

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

# GUC set per-request so the schema's RLS policies can identify the caller.
_RLS_DEVELOPER_GUC = "app.current_developer_id"


@lru_cache
def get_engine() -> AsyncEngine:
    """Return the shared async engine, creating it on first use."""
    if not settings.database_url:
        raise RuntimeError(
            "DATABASE_URL is not configured. Copy .env.example to .env and set it."
        )
    return create_async_engine(
        settings.database_url,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_pre_ping=settings.db_pool_pre_ping,
        echo=settings.debug,
    )


async_session_factory = async_sessionmaker(
    get_engine(),
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncIterator[AsyncSession]:
    """Yield a plain async session (transaction rolled back on error)."""
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def set_local_developer(session: AsyncSession, developer_id: uuid.UUID | str) -> None:
    """Scope the current transaction to ``developer_id`` for RLS.

    Equivalent to ``SET LOCAL app.current_developer_id = '<id>'``.
    """
    result = await session.execute(
        text("SELECT set_config(:guc, :id, true)"),
        {"guc": _RLS_DEVELOPER_GUC, "id": str(developer_id)},
    )
    # AsyncSession.execute() returns a synchronous SQLAlchemy Result wrapper.
    result.close()


async def get_developer_db() -> AsyncIterator[AsyncSession]:
    """Yield a session whose transaction has no RLS context yet.

    The caller (an auth dependency) is expected to call
    :func:`set_local_developer` once the developer has been resolved.
    """
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def get_service_db() -> AsyncIterator[AsyncSession]:
    """Yield a "service role" session with RLS disabled for the transaction.

    Used only by the SDK key/origin verification endpoint (``sdk_guard``),
    which has no developer identity and must read ``project_keys`` /
    ``project_origins`` directly.
    """
    async with async_session_factory() as session:
        await session.execute(text("SET LOCAL row_security = off"))
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
