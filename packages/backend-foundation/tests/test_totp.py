"""The TOTP second step (totp.py, POST /auth/login/totp, issue #125)."""

import hashlib
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from foundation_backend import totp
from foundation_backend.db import get_session
from tests.minimal_app import app
from foundation_backend.models import LoginFailure, PendingLogin, RecoveryCode, User

EMAIL = "totp@example.com"
PASSWORD = "correct-horse-battery"
SECRET = "JBSWY3DPEHPK3PXP"
RECOVERY = "abcd-efgh"
# A fixed clock, well inside one step, so the codes below are stable.
NOW = 1_800_000_015.0


def fast_hash(password: str) -> str:
    salt = "00" * 16
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 1)
    return f"pbkdf2_sha256$1${salt}${digest.hex()}"


def code_at(step_offset: int = 0) -> str:
    return totp.hotp(totp._key(SECRET), totp.current_step(NOW) + step_offset)


# ------------------------------------------------------------ the algorithm

# RFC 6238 Appendix B, SHA-1: the seed "12345678901234567890", 8 digits.
RFC_6238_SHA1 = [
    (59, "94287082"),
    (1111111109, "07081804"),
    (1111111111, "14050471"),
    (1234567890, "89005924"),
    (2000000000, "69279037"),
    (20000000000, "65353130"),
]


@pytest.mark.parametrize(("unix_time", "expected"), RFC_6238_SHA1)
def test_codes_match_rfc_6238_test_vectors(unix_time: int, expected: str) -> None:
    assert totp.hotp(b"12345678901234567890", unix_time // 30, digits=8) == expected


def test_one_step_of_drift_either_way_and_no_more() -> None:
    step = totp.current_step(NOW)
    assert totp.verify(SECRET, code_at(-1), None, NOW) == step - 1
    assert totp.verify(SECRET, code_at(0), None, NOW) == step
    assert totp.verify(SECRET, code_at(1), None, NOW) == step + 1
    assert totp.verify(SECRET, code_at(2), None, NOW) is None
    assert totp.verify(SECRET, code_at(-2), None, NOW) is None


def test_a_used_step_is_refused() -> None:
    step = totp.current_step(NOW)
    assert totp.verify(SECRET, code_at(0), step, NOW) is None
    assert totp.verify(SECRET, code_at(1), step, NOW) == step + 1


def test_the_otpauth_uri_names_the_account_and_secret() -> None:
    uri = totp.otpauth_uri(SECRET, "a@example.com", "My App")
    assert uri.startswith("otpauth://totp/My%20App%3Aa%40example.com?")
    assert f"secret={SECRET}" in uri and "issuer=My+App" in uri


def test_recovery_codes_are_ten_distinct_and_hash_ignoring_case_and_dashes() -> None:
    codes = totp.generate_recovery_codes()
    assert len(set(codes)) == 10
    assert totp.hash_recovery_code("ABCD EFGH") == totp.hash_recovery_code("abcd-efgh")


# --------------------------------------------------------------- the routes


@pytest.fixture(autouse=True)
def fixed_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    real = totp.current_step
    monkeypatch.setattr(totp, "current_step", lambda now=None: real(NOW if now is None else now))


@pytest_asyncio.fixture
async def client(session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    session.add(
        User(id=60, email=EMAIL, name="Two Step", password_hash=fast_hash(PASSWORD), totp_secret=SECRET)
    )
    session.add(User(id=61, email="plain@example.com", name="Plain", password_hash=fast_hash(PASSWORD)))
    await session.flush()
    session.add(RecoveryCode(user_id=60, code_hash=totp.hash_recovery_code(RECOVERY)))
    await session.commit()

    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_session] = override_get_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def password_step(client: AsyncClient) -> None:
    response = await client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert response.status_code == 202
    assert response.json() == {"next": "totp"}
    assert "session_id" not in response.cookies
    assert "pending_login" in response.cookies


async def send_code(client: AsyncClient, code: str) -> int:
    return (await client.post("/api/auth/login/totp", json={"code": code})).status_code


async def test_an_account_without_totp_signs_in_with_the_password_alone(client: AsyncClient) -> None:
    response = await client.post("/api/auth/login", json={"email": "plain@example.com", "password": PASSWORD})
    assert response.status_code == 200
    assert "session_id" in response.cookies


async def test_the_password_alone_gives_no_session(client: AsyncClient) -> None:
    await password_step(client)
    assert (await client.get("/api/auth/me")).status_code == 401


async def test_a_right_code_starts_the_session(client: AsyncClient, session: AsyncSession) -> None:
    await password_step(client)
    response = await client.post("/api/auth/login/totp", json={"code": code_at(0)})
    assert response.status_code == 200
    assert response.json() == {"id": 60, "email": EMAIL, "name": "Two Step"}
    assert (await client.get("/api/auth/me")).status_code == 200
    # Single use: the pending sign-in is gone.
    assert (await session.exec(select(PendingLogin))).all() == []


async def test_a_code_one_step_old_is_accepted(client: AsyncClient) -> None:
    await password_step(client)
    assert await send_code(client, code_at(-1)) == 200


async def test_a_wrong_code_is_a_401_and_counts_as_a_failure(client: AsyncClient, session: AsyncSession) -> None:
    await password_step(client)
    wrong = "000000" if code_at(0) != "000000" else "111111"
    response = await client.post("/api/auth/login/totp", json={"code": wrong})
    assert response.status_code == 401
    kinds = sorted((await session.exec(select(LoginFailure.kind))).all())
    assert kinds == ["account", "ip"]
    # The pending sign-in is still there for another try.
    assert await send_code(client, code_at(0)) == 200


async def test_a_code_already_used_is_refused(client: AsyncClient) -> None:
    await password_step(client)
    assert await send_code(client, code_at(0)) == 200
    await client.post("/api/auth/logout")
    await password_step(client)
    assert await send_code(client, code_at(0)) == 401


async def test_a_recovery_code_works_once(client: AsyncClient) -> None:
    await password_step(client)
    assert await send_code(client, RECOVERY.upper()) == 200
    await client.post("/api/auth/logout")
    await password_step(client)
    assert await send_code(client, RECOVERY) == 401


async def test_an_expired_pending_sign_in_is_a_410(client: AsyncClient, session: AsyncSession) -> None:
    await password_step(client)
    pending = (await session.exec(select(PendingLogin))).one()
    pending.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    session.add(pending)
    await session.commit()
    response = await client.post("/api/auth/login/totp", json={"code": code_at(0)})
    assert response.status_code == 410
    assert (await session.exec(select(PendingLogin))).all() == []


async def test_five_wrong_codes_end_the_pending_sign_in(client: AsyncClient) -> None:
    await password_step(client)
    wrong = "000000" if code_at(0) != "000000" else "111111"
    for _ in range(4):
        assert await send_code(client, wrong) == 401
    assert await send_code(client, wrong) == 410
    # Even the right code can't use it now: start again.
    assert await send_code(client, code_at(0)) == 410


async def test_no_pending_sign_in_is_a_410(client: AsyncClient) -> None:
    assert await send_code(client, code_at(0)) == 410


async def test_wrong_codes_reach_the_account_limit(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("foundation_backend.login_limits.LOGIN_MAX_FAILURES_PER_ACCOUNT", 2)
    monkeypatch.setattr("foundation_backend.login_limits.LOGIN_MAX_FAILURES_PER_IP", 100)
    await password_step(client)
    wrong = "000000" if code_at(0) != "000000" else "111111"
    assert await send_code(client, wrong) == 401
    assert await send_code(client, wrong) == 401
    assert await send_code(client, code_at(0)) == 429
    # And a right password doesn't reset it while the account has a second step.
    response = await client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert response.status_code == 429



async def test_a_right_password_alone_never_resets_the_count_for_codes(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("foundation_backend.login_limits.LOGIN_MAX_FAILURES_PER_ACCOUNT", 3)
    monkeypatch.setattr("foundation_backend.login_limits.LOGIN_MAX_FAILURES_PER_IP", 100)
    wrong = "000000" if code_at(0) != "000000" else "111111"
    await password_step(client)
    assert await send_code(client, wrong) == 401
    assert await send_code(client, wrong) == 401
    # A fresh pending sign-in: the two failures still count.
    await password_step(client)
    assert await send_code(client, wrong) == 401
    assert await send_code(client, code_at(0)) == 429
