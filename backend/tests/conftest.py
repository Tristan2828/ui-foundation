"""Exercises app wiring, validation and error-shape conformance against an
in-memory SQLite engine instead of Postgres — fast and dependency-free for
the inner loop. This does NOT stand in for the Postgres-specific checks
`scripts/check-phase-8.sh` runs against a real database (enum/numeric
column behavior, Alembic migrations); see docs/phases/phase-8.md.
"""

from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from decimal import Decimal

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine

from app.db import get_session
from app.main import app
from app.models import Category, Widget, WidgetStatus


@pytest_asyncio.fixture
async def session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    async with AsyncSession(engine) as session:
        session.add(Category(id=1, name="Electronics"))
        session.add(
            Widget(
                id=1,
                name="Wireless Mouse",
                category_id=1,
                status=WidgetStatus.active,
                available_from=datetime(2026, 1, 15, tzinfo=timezone.utc),
                assignee_email="alice@example.com",
                price=Decimal("24.99"),
                description="A basic wireless mouse.",
            )
        )
        await session.commit()
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def client(session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_session] = override_get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
