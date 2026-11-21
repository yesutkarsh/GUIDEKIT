"""Declarative base for all ORM models.

The database schema itself is owned by :file:`sql/schema_v2.sql` (applied via
:file:`scripts/init_db.py`); these models mirror it for typed reads/writes and
must be kept in sync with the DDL.
"""

from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for GuideKit ORM models."""

    __abstract__ = True
