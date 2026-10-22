"""deploy_checks.py — what APP_ENV=production refuses to start with."""

import json
from pathlib import Path

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from foundation_backend.config import DEFAULT_SEED_EMAIL, DEFAULT_SEED_PASSWORD
from foundation_backend.deploy_checks import production_problems
from foundation_backend.models import User
from foundation_backend.security import hash_password


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


async def test_a_data_label_is_a_problem(session: AsyncSession) -> None:
    problems = await production_problems(session, cookie_secure=True, data_label="dev")
    assert len(problems) == 1
    assert "DATA_LABEL" in problems[0]


def _built(tmp_path: Path, info: object) -> str:
    (tmp_path / "build-info.json").write_text(json.dumps(info), encoding="utf-8")
    return str(tmp_path)


async def test_a_real_api_build_is_fine(session: AsyncSession, tmp_path: Path) -> None:
    static_dir = _built(tmp_path, {"api": "real", "commit": "abc1234", "pr": None})
    assert await production_problems(session, cookie_secure=True, static_dir=static_dir) == []


@pytest.mark.parametrize("info", [{"api": "mock"}, {}, {"api": None}, ["real"]])
async def test_a_mock_build_is_a_problem(session: AsyncSession, tmp_path: Path, info: object) -> None:
    problems = await production_problems(session, cookie_secure=True, static_dir=_built(tmp_path, info))
    assert len(problems) == 1
    assert "npm run build:real" in problems[0]


async def test_a_build_with_no_build_info_is_a_problem(session: AsyncSession, tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("<!doctype html>", encoding="utf-8")
    problems = await production_problems(session, cookie_secure=True, static_dir=str(tmp_path))
    assert len(problems) == 1
    assert "build-info.json" in problems[0]
    assert "npm run build:real" in problems[0]


async def test_no_frontend_build_at_all_is_a_problem(session: AsyncSession, tmp_path: Path) -> None:
    problems = await production_problems(session, cookie_secure=True, static_dir=str(tmp_path / "dist"))
    assert len(problems) == 1
    assert "npm run build:real" in problems[0]


async def test_unreadable_build_info_is_a_problem(session: AsyncSession, tmp_path: Path) -> None:
    (tmp_path / "build-info.json").write_text("{not json", encoding="utf-8")
    problems = await production_problems(session, cookie_secure=True, static_dir=str(tmp_path))
    assert len(problems) == 1
    assert "JSON" in problems[0]
