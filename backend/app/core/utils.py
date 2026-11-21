"""Small, dependency-free helpers shared across the application."""

from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timezone

_SLUG_UNSAFE = re.compile(r"[^a-z0-9]+")
_SLUG_EDGE = re.compile(r"^-+|-+$")


def slugify(value: str, *, max_length: int = 80) -> str:
    """Convert arbitrary text into a URL-safe slug (lowercase ``a-z0-9-``)."""
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = _SLUG_UNSAFE.sub("-", normalized.lower()).strip("-")
    slug = _SLUG_EDGE.sub("", slug)
    return (slug or "untitled")[:max_length].rstrip("-")


def utcnow() -> datetime:
    """Return the current time as a timezone-aware UTC ``datetime``."""
    return datetime.now(timezone.utc)
