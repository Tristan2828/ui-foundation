"""Startup safety checks for APP_ENV=production (see docs/deploy.md).

Development needs none of this and runs no startup query at all. A real
deployment is refused outright rather than warned about: a warning in a log
nobody reads is how a published default password ends up on the internet.
"""

from fastapi.concurrency import run_in_threadpool
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import DEFAULT_SEED_EMAIL, DEFAULT_SEED_PASSWORD, SEED_USER_EMAIL
from app.models import User
from app.security import verify_password


async def production_problems(session: AsyncSession, *, cookie_secure: bool) -> list[str]:
    """Everything that makes this deployment unsafe to serve; empty if none."""
    problems: list[str] = []

    if not cookie_secure:
        problems.append(
            "COOKIE_SECURE is not true; the session cookie would be sent over plain HTTP."
        )

    # Migration 0002 seeds whatever SEED_USER_* held when it ran, so check
    # the stored hash, not the environment: both the configured seed email
    # and the published default one, in case the env changed after seeding.
    for email in sorted({DEFAULT_SEED_EMAIL, SEED_USER_EMAIL}):
        result = await session.exec(select(User).where(User.email == email))
        user = result.first()
        if user is not None and await run_in_threadpool(
            verify_password, DEFAULT_SEED_PASSWORD, user.password_hash
        ):
            problems.append(
                f"User {email} still accepts the published default password. Change it "
                "with backend/scripts/set_password.py before serving this deployment."
            )

    return problems
