"""Exercises the package's routes and helpers against an in-memory SQLite
engine instead of Postgres, as an app's own backend tests do. This does
NOT stand in for the Postgres-specific checks an app's
`scripts/check-backend-postgres.sh` runs against a real database
(timestamp columns, Alembic migrations).
"""

from collections.abc import AsyncGenerator
from typing import Any

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine

from foundation_backend.db import get_session
from foundation_backend.models import User
from foundation_backend.testing.signed_in import session_cookie
from tests.minimal_app import app


@pytest_asyncio.fixture
async def session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    # SQLite ignores foreign keys unless asked, and Postgres never does: a
    # reference to a missing row must fail here as it would there.
    @event.listens_for(engine.sync_engine, "connect")
    def _foreign_keys_on(dbapi_connection: Any, _record: Any) -> None:
        dbapi_connection.execute("PRAGMA foreign_keys=ON")
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    async with AsyncSession(engine) as session:
        # The user the `client` fixture signs in as.
        session.add(User(id=1, email="test@example.com", name="Test User", password_hash="unused"))
        await session.commit()
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def client(session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Signed in as user 1 for real: a session row and its cookie, so the real
    `get_current_user` loads the user in the request's own database session,
    as it does live (`foundation_backend/testing/signed_in.py` says why a
    stand-in user isn't)."""

    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield session

    cookies = await session_cookie(session, 1)
    app.dependency_overrides[get_session] = override_get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies) as ac:
        yield ac
    app.dependency_overrides.clear()
