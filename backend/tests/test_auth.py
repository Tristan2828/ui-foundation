"""Login/logout/me against the real get_current_user dependency — not the
fixed-user override conftest.py's `client` fixture uses for test_widgets.py,
which tests the widgets domain, not auth itself.
"""

from collections.abc import AsyncGenerator
from datetime import datetime, timedelta, timezone

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db import get_session
from app.main import app
from app.models import Session as UserSession
from app.models import User
from app.security import generate_session_token, hash_password, hash_token

TEST_EMAIL = "auth-test@example.com"
TEST_PASSWORD = "correct-horse-battery"


@pytest_asyncio.fixture
async def auth_client(session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    session.add(User(id=99, email=TEST_EMAIL, name="Auth Test", password_hash=hash_password(TEST_PASSWORD)))
    await session.commit()

    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_session] = override_get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def test_login_success_sets_cookie_and_returns_user(auth_client: AsyncClient) -> None:
    response = await auth_client.post("/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    assert response.status_code == 200
    assert response.json() == {"id": 99, "email": TEST_EMAIL, "name": "Auth Test"}
    assert "session_id" in response.cookies


async def test_login_wrong_password_is_401(auth_client: AsyncClient) -> None:
    response = await auth_client.post("/api/auth/login", json={"email": TEST_EMAIL, "password": "wrong-password"})
    assert response.status_code == 401


async def test_login_unknown_email_is_401(auth_client: AsyncClient) -> None:
    response = await auth_client.post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": "whatever1"}
    )
    assert response.status_code == 401


async def test_me_without_cookie_is_401(auth_client: AsyncClient) -> None:
    response = await auth_client.get("/api/auth/me")
    assert response.status_code == 401


async def test_me_with_cookie_returns_user(auth_client: AsyncClient) -> None:
    await auth_client.post("/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    response = await auth_client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["email"] == TEST_EMAIL


async def test_logout_clears_session(auth_client: AsyncClient) -> None:
    await auth_client.post("/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    logout_response = await auth_client.post("/api/auth/logout")
    assert logout_response.status_code == 204
    me_response = await auth_client.get("/api/auth/me")
    assert me_response.status_code == 401


@pytest_asyncio.fixture
async def register_client(session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    # No pre-seeded user, unlike auth_client — registration needs to be the
    # one creating the first row.
    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_session] = override_get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def test_register_creates_user_and_logs_in(register_client: AsyncClient) -> None:
    response = await register_client.post(
        "/api/auth/register",
        json={"email": "new-user@example.com", "name": "New User", "password": "a-strong-password"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == "new-user@example.com"
    assert response.json()["name"] == "New User"
    assert "session_id" in response.cookies

    # Auto-login: no separate POST /auth/login needed to reach an
    # authenticated endpoint (docs/BUILD-PLAN.md Phase 11 exit criteria).
    me_response = await register_client.get("/api/auth/me")
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "new-user@example.com"


async def test_register_duplicate_email_is_422_with_field_error(register_client: AsyncClient) -> None:
    await register_client.post(
        "/api/auth/register",
        json={"email": "dupe@example.com", "name": "First", "password": "a-strong-password"},
    )
    response = await register_client.post(
        "/api/auth/register",
        json={"email": "dupe@example.com", "name": "Second", "password": "another-password"},
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert any(issue["loc"][-1] == "email" for issue in detail)


async def test_register_weak_password_is_422(register_client: AsyncClient) -> None:
    response = await register_client.post(
        "/api/auth/register",
        json={"email": "short-pw@example.com", "name": "Someone", "password": "short"},
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert any(issue["loc"][-1] == "password" for issue in detail)


async def test_expired_session_is_401(auth_client: AsyncClient, session: AsyncSession) -> None:
    token = generate_session_token()
    session.add(
        UserSession(
            user_id=99,
            token_hash=hash_token(token),
            expires_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
    )
    await session.commit()
    auth_client.cookies.set("session_id", token)
    response = await auth_client.get("/api/auth/me")
    assert response.status_code == 401
