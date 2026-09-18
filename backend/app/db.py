"""Async engine + session dependency. No repository layer — see
docs/BUILD-PLAN.md Phase 8's minimalism warning; routers call the session
directly.
"""

from collections.abc import AsyncGenerator

from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import DATABASE_URL, database_connect_args

engine = create_async_engine(DATABASE_URL, echo=False, connect_args=database_connect_args())


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSession(engine) as session:
        yield session
