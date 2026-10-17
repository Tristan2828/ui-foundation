"""Failed sign-in limits (app/login_limits.py, issue #124): per client IP
and per account, counted in login_failures, checked before the password.

The test account's hash uses 1 PBKDF2 iteration (verify_password reads the
count from the stored hash), so twenty attempts don't take twenty times
600k iterations. Unknown emails still run the full dummy hash.
"""

import hashlib
from collections.abc import AsyncGenerator, Callable
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from fastapi import Request
from httpx import ASGITransport, AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app import login_limits
from app.db import get_session
from app.main import app
from app.models import LoginFailure, User

EMAIL = "limits@example.com"
PASSWORD = "correct-horse-battery"
WRONG = "wrong-password"

ClientFor = Callable[[str], AsyncClient]


def fast_hash(password: str) -> str:
    salt = "00" * 16
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 1)
    return f"pbkdf2_sha256$1${salt}${digest.hex()}"


@pytest_asyncio.fixture
async def client_for(session: AsyncSession) -> AsyncGenerator[ClientFor, None]:
    """A client per source IP, all on the same database."""
    session.add(User(id=50, email=EMAIL, name="Limits", password_hash=fast_hash(PASSWORD)))
    await session.commit()

    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_session] = override_get_session
    clients: list[AsyncClient] = []

    def make(ip: str) -> AsyncClient:
        client = AsyncClient(transport=ASGITransport(app=app, client=(ip, 50000)), base_url="http://test")
        clients.append(client)
        return client

    yield make
    for client in clients:
        await client.aclose()
    app.dependency_overrides.clear()


async def attempt(client: AsyncClient, email: str = EMAIL, password: str = WRONG) -> int:
    response = await client.post("/api/auth/login", json={"email": email, "password": password})
    return response.status_code


async def test_the_eleventh_failure_from_one_ip_is_a_429_with_retry_after(client_for: ClientFor) -> None:
    client = client_for("10.0.0.1")
    for _ in range(10):
        assert await attempt(client) == 401
    response = await client.post("/api/auth/login", json={"email": EMAIL, "password": WRONG})
    assert response.status_code == 429
    assert 1 <= int(response.headers["retry-after"]) <= 15 * 60
    assert response.json()["detail"].startswith("Too many sign-in attempts. Try again in ")


async def test_the_twenty_first_failure_for_one_account_from_many_ips_is_a_429(client_for: ClientFor) -> None:
    for n in range(20):
        assert await attempt(client_for(f"10.0.1.{n}")) == 401
    response = await client_for("10.0.2.1").post("/api/auth/login", json={"email": EMAIL, "password": WRONG})
    assert response.status_code == 429
    assert 1 <= int(response.headers["retry-after"]) <= 60 * 60


async def test_over_the_limit_the_right_password_is_refused_too(client_for: ClientFor) -> None:
    client = client_for("10.0.0.2")
    for _ in range(10):
        await attempt(client)
    response = await client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert response.status_code == 429
    assert "session_id" not in response.cookies


async def test_the_limit_is_checked_before_the_password(
    client_for: ClientFor, monkeypatch: pytest.MonkeyPatch
) -> None:
    client = client_for("10.0.0.3")
    for _ in range(10):
        await attempt(client)
    calls: list[str] = []
    monkeypatch.setattr("app.routers.auth.verify_password", lambda password, stored: calls.append(stored) or False)
    assert await attempt(client) == 429
    assert calls == []


async def test_a_success_clears_the_counts(client_for: ClientFor) -> None:
    client = client_for("10.0.0.4")
    for _ in range(9):
        assert await attempt(client) == 401
    assert await attempt(client, password=PASSWORD) == 200
    for _ in range(10):
        assert await attempt(client) == 401
    assert await attempt(client) == 429


async def test_an_unknown_email_counts_like_a_known_one(
    client_for: ClientFor, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(login_limits, "LOGIN_MAX_FAILURES_PER_ACCOUNT", 3)
    for n in range(3):
        assert await attempt(client_for(f"10.0.3.{n}"), email="nobody@example.com") == 401
    assert await attempt(client_for("10.0.3.9"), email="nobody@example.com") == 429
    # No address is stored: the account key is a hash.
    keys = (await session.exec(select(LoginFailure.key).where(LoginFailure.kind == "account"))).all()
    assert keys and all("@" not in key for key in keys)


async def test_old_failures_are_pruned_and_never_count(client_for: ClientFor, session: AsyncSession) -> None:
    long_ago = datetime.now(timezone.utc) - timedelta(hours=2)
    for _ in range(10):
        session.add(LoginFailure(kind="ip", key="10.0.0.5", failed_at=long_ago))
    await session.commit()
    client = client_for("10.0.0.5")
    # Ten failures outside the window: this one isn't over the limit.
    assert await attempt(client) == 401
    rows = (await session.exec(select(LoginFailure).where(LoginFailure.key == "10.0.0.5"))).all()
    assert len(rows) == 1


def with_headers(ip: str, headers: dict[str, str]) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app, client=(ip, 50000)), base_url="http://test", headers=headers)


def request_with(headers: dict[str, str]) -> Request:
    scope = {"type": "http", "client": ("10.9.9.9", 1), "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()]}
    return Request(scope)


def test_client_ip_ignores_the_header_when_the_setting_is_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(login_limits, "CLIENT_IP_HEADER", None)
    assert login_limits.client_ip(request_with({"CF-Connecting-IP": "198.51.100.1"})) == "10.9.9.9"


def test_client_ip_prefers_the_configured_header_over_x_forwarded_for(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(login_limits, "CLIENT_IP_HEADER", "CF-Connecting-IP")
    headers = {"CF-Connecting-IP": " 198.51.100.1 ", "X-Forwarded-For": "203.0.113.7"}
    assert login_limits.client_ip(request_with(headers)) == "198.51.100.1"


def test_client_ip_falls_back_when_the_configured_header_is_missing_or_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(login_limits, "CLIENT_IP_HEADER", "CF-Connecting-IP")
    assert login_limits.client_ip(request_with({})) == "10.9.9.9"
    assert login_limits.client_ip(request_with({"CF-Connecting-IP": "  "})) == "10.9.9.9"


async def test_spoofed_x_forwarded_for_values_share_one_count_with_the_header_set(
    client_for: ClientFor, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(login_limits, "CLIENT_IP_HEADER", "CF-Connecting-IP")
    client_for("10.0.9.1")  # sets up the user and database override
    for n in range(10):
        client = with_headers(f"10.0.9.{n}", {"CF-Connecting-IP": "198.51.100.9", "X-Forwarded-For": f"203.0.113.{n}"})
        async with client:
            assert await attempt(client) == 401
    client = with_headers("10.0.9.99", {"CF-Connecting-IP": "198.51.100.9", "X-Forwarded-For": "203.0.113.200"})
    async with client:
        assert await attempt(client) == 429
