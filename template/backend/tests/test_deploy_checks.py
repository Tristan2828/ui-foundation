"""app/deploy_checks.py — what APP_ENV=production refuses to start with."""

from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import DEFAULT_SEED_EMAIL, DEFAULT_SEED_PASSWORD
from app.deploy_checks import production_problems
from app.models import User
from app.security import hash_password


async def test_safe_deployment_has_no_problems(session: AsyncSession) -> None:
    assert await production_problems(session, cookie_secure=True) == []


async def test_insecure_cookie_is_a_problem(session: AsyncSession) -> None:
    problems = await production_problems(session, cookie_secure=False)
    assert len(problems) == 1
    assert "COOKIE_SECURE" in problems[0]


async def test_seed_account_with_the_published_password_is_a_problem(session: AsyncSession) -> None:
    session.add(
        User(email=DEFAULT_SEED_EMAIL, name="Dev User", password_hash=hash_password(DEFAULT_SEED_PASSWORD))
    )
    await session.commit()

    problems = await production_problems(session, cookie_secure=True)
    assert len(problems) == 1
    assert DEFAULT_SEED_EMAIL in problems[0]


async def test_seed_account_with_a_changed_password_is_fine(session: AsyncSession) -> None:
    session.add(
        User(email=DEFAULT_SEED_EMAIL, name="Dev User", password_hash=hash_password("a-real-secret-123"))
    )
    await session.commit()

    assert await production_problems(session, cookie_secure=True) == []
