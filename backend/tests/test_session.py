"""Tests for transaction-local database session helpers."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, Mock

from app.db.session import set_local_developer


async def test_set_local_developer_sets_guc_and_closes_result_synchronously() -> None:
    """Guard against awaiting SQLAlchemy's synchronous Result.close()."""
    session = AsyncMock()
    result = Mock()
    session.execute.return_value = result
    developer_id = uuid.uuid4()

    await set_local_developer(session, developer_id)

    session.execute.assert_awaited_once()
    result.close.assert_called_once_with()
