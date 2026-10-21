"""AI chats through MCP (issue #132): the OAuth sign-in (app/routers/oauth.py),
the /mcp endpoint (app/routers/mcp.py) and its tools (app/mcp_tools.py).

Runs the real sign-in: a session cookie for the user approving, PKCE, the
code and token exchange, then tool calls with the access token. The
`client` fixture of conftest.py, which stands in a fixed user, isn't used.
"""

import base64
import hashlib
import json
import re
from collections.abc import AsyncGenerator
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient, Response
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app import config, rate_window
from app.db import get_session
from app.deploy_checks import production_problems
from app.main import app
from app import mcp_tools
from app.mcp_entities import ENTITIES, McpEntity, check_entities
from app.mcp_tools import tool_definitions
from app.models import (
    McpAuditEntry,
    OAuthClient,
    OAuthCode,
    OAuthGrant,
    User,
    Widget,
    WidgetStatus,
)
from app.models import Session as UserSession
from app.security import hash_token

BASE = "https://app.test"
REDIRECT = "https://chat.example/callback"
VERIFIER = "v" * 43
CHALLENGE = base64.urlsafe_b64encode(hashlib.sha256(VERIFIER.encode()).digest()).rstrip(b"=").decode()


@pytest.fixture(autouse=True)
def mcp_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "MCP_ENABLED", True)
    monkeypatch.setattr(config, "MCP_PUBLIC_URL", BASE)
    rate_window.reset()


@pytest_asyncio.fixture
async def web(session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """The real sign-in: user 1 holds a session cookie, nothing is overridden
    but the database."""
    session.add(
        UserSession(
            user_id=1,
            token_hash=hash_token("browser-session"),
            expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        )
    )
    await session.commit()

    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_session] = override_get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.cookies.set("session_id", "browser-session")
        yield ac
    app.dependency_overrides.clear()


async def register(web: AsyncClient, redirect: str = REDIRECT) -> str:
    response = await web.post("/oauth/register", json={"client_name": "Test Chat", "redirect_uris": [redirect]})
    assert response.status_code == 201, response.text
    client_id: str = response.json()["client_id"]
    return client_id


def authorize_query(client_id: str, **overrides: str) -> dict[str, str]:
    query = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": REDIRECT,
        "code_challenge": CHALLENGE,
        "code_challenge_method": "S256",
        "state": "xyz",
    }
    query.update(overrides)
    return query


def hidden_fields(page: str) -> dict[str, str]:
    import re

    return dict(re.findall(r'name="([a-z_]+)" value="([^"]*)"', page))


async def approve(web: AsyncClient, client_id: str) -> str:
    page = await web.get("/oauth/authorize", params=authorize_query(client_id))
    assert page.status_code == 200
    form = hidden_fields(page.text)
    response = await web.post("/oauth/authorize", data={**form, "decision": "approve"})
    assert response.status_code == 303
    query = parse_qs(urlparse(response.headers["location"]).query)
    assert "error" not in query, query
    assert query["state"] == ["xyz"]
    assert query["iss"] == [BASE]
    return query["code"][0]


def token_request(client_id: str, code: str, **overrides: str) -> dict[str, str]:
    body = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "code": code,
        "redirect_uri": REDIRECT,
        "code_verifier": VERIFIER,
    }
    body.update(overrides)
    return body


async def connect(web: AsyncClient) -> dict[str, Any]:
    """The whole sign-in; returns the token response plus the client id."""
    client_id = await register(web)
    code = await approve(web, client_id)
    response = await web.post("/oauth/token", data=token_request(client_id, code))
    assert response.status_code == 200, response.text
    return {**response.json(), "client_id": client_id}


async def rpc(web: AsyncClient, token: str, method: str, params: dict[str, Any] | None = None, id: int = 1) -> Response:
    message: dict[str, Any] = {"jsonrpc": "2.0", "id": id, "method": method}
    if params is not None:
        message["params"] = params
    return await web.post("/mcp", json=message, headers={"Authorization": f"Bearer {token}"})


async def call(web: AsyncClient, token: str, name: str, arguments: dict[str, Any]) -> tuple[str, bool]:
    response = await rpc(web, token, "tools/call", {"name": name, "arguments": arguments})
    assert response.status_code == 200, response.text
    result = response.json()["result"]
    return result["content"][0]["text"], bool(result.get("isError"))


@pytest_asyncio.fixture
async def token(web: AsyncClient) -> str:
    connection = await connect(web)
    access: str = connection["access_token"]
    return access


NEW_WIDGET = {
    "name": "Desk Lamp",
    "categoryId": 1,
    "availableFrom": "2026-03-01T00:00:00Z",
    "price": "19.50",
    "description": "A lamp.",
}


# ---------------------------------------------------------------- off by default


async def test_everything_is_404_when_mcp_is_off(web: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "MCP_ENABLED", False)
    for method, path in [
        ("POST", "/mcp"),
        ("GET", "/mcp"),
        ("POST", "/oauth/register"),
        ("GET", "/oauth/authorize"),
        ("POST", "/oauth/token"),
        ("GET", "/.well-known/oauth-authorization-server"),
        ("GET", "/.well-known/oauth-protected-resource"),
    ]:
        assert (await web.request(method, path)).status_code == 404, (method, path)


def test_mcp_is_off_unless_the_environment_turns_it_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MCP_ENABLED", raising=False)
    import importlib

    import app.config as fresh

    assert importlib.reload(fresh).MCP_ENABLED is False


# ---------------------------------------------------------------- discovery


async def test_discovery_documents_name_the_public_address(web: AsyncClient) -> None:
    resource = (await web.get("/.well-known/oauth-protected-resource")).json()
    assert resource["resource"] == f"{BASE}/mcp"
    assert resource["authorization_servers"] == [BASE]
    # A client that inserts the resource's path asks here.
    assert (await web.get("/.well-known/oauth-protected-resource/mcp")).json() == resource
    server = (await web.get("/.well-known/oauth-authorization-server")).json()
    assert server["issuer"] == BASE
    assert server["authorization_endpoint"] == f"{BASE}/oauth/authorize"
    assert server["token_endpoint"] == f"{BASE}/oauth/token"
    assert server["registration_endpoint"] == f"{BASE}/oauth/register"
    assert server["code_challenge_methods_supported"] == ["S256"]
    assert server["token_endpoint_auth_methods_supported"] == ["none"]


# ---------------------------------------------------------------- registration


@pytest.mark.parametrize(
    "uri", ["http://evil.example/cb", "javascript:alert(1)", "https://chat.example/cb#frag", "file:///etc/passwd", "/relative"]
)
async def test_register_refuses_unsafe_redirect_addresses(web: AsyncClient, uri: str) -> None:
    response = await web.post("/oauth/register", json={"redirect_uris": [uri]})
    assert response.status_code == 400
    assert response.json()["error"] == "invalid_redirect_uri"


async def test_register_accepts_https_and_loopback(web: AsyncClient) -> None:
    for uri in ["https://claude.ai/api/mcp/auth_callback", "http://localhost:6274/callback", "http://127.0.0.1:9/cb"]:
        assert (await web.post("/oauth/register", json={"redirect_uris": [uri]})).status_code == 201


async def test_register_refuses_a_client_with_a_secret(web: AsyncClient) -> None:
    response = await web.post(
        "/oauth/register", json={"redirect_uris": [REDIRECT], "token_endpoint_auth_method": "client_secret_basic"}
    )
    assert response.status_code == 400


async def test_register_caps_how_many_chats_exist(web: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "MCP_MAX_CLIENTS", 2)
    await register(web)
    await register(web)
    response = await web.post("/oauth/register", json={"redirect_uris": [REDIRECT]})
    assert response.status_code == 429


async def test_register_drops_chats_that_were_never_approved(web: AsyncClient, session: AsyncSession) -> None:
    session.add(
        OAuthClient(
            client_id="stale", client_name="Old", redirect_uris='["https://x.example/cb"]',
            created_at=datetime.now(timezone.utc) - timedelta(days=3),
        )
    )
    await session.commit()
    await register(web)
    ids = [c.client_id for c in (await session.exec(select(OAuthClient))).all()]
    assert "stale" not in ids


# ---------------------------------------------------------------- authorize


async def test_authorize_needs_the_app_sign_in(web: AsyncClient) -> None:
    client_id = await register(web)
    web.cookies.clear()
    response = await web.get("/oauth/authorize", params=authorize_query(client_id))
    assert response.status_code == 401
    assert "Sign in" in response.text


async def test_consent_page_names_the_chat_escaped_and_cannot_be_framed(web: AsyncClient) -> None:
    response = await web.post(
        "/oauth/register", json={"client_name": "<script>alert(1)</script>", "redirect_uris": [REDIRECT]}
    )
    page = await web.get("/oauth/authorize", params=authorize_query(response.json()["client_id"]))
    assert "<script>alert(1)</script>" not in page.text
    assert "&lt;script&gt;" in page.text
    assert "test@example.com" in page.text
    assert page.headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in page.headers["content-security-policy"]


async def test_an_unregistered_redirect_address_is_never_redirected_to(web: AsyncClient) -> None:
    client_id = await register(web)
    response = await web.get(
        "/oauth/authorize", params=authorize_query(client_id, redirect_uri="https://evil.example/cb")
    )
    assert response.status_code == 400
    assert "location" not in response.headers
    unknown = await web.get("/oauth/authorize", params=authorize_query("nobody"))
    assert unknown.status_code == 400


@pytest.mark.parametrize("overrides", [{"code_challenge_method": "plain"}, {"code_challenge": "short"}])
async def test_authorize_requires_pkce_s256(web: AsyncClient, overrides: dict[str, str]) -> None:
    client_id = await register(web)
    response = await web.get("/oauth/authorize", params=authorize_query(client_id, **overrides))
    assert response.status_code == 303
    query = parse_qs(urlparse(response.headers["location"]).query)
    assert query["error"] == ["invalid_request"]
    assert query["state"] == ["xyz"]


async def test_authorize_refuses_a_resource_that_is_not_this_server(web: AsyncClient) -> None:
    client_id = await register(web)
    response = await web.get(
        "/oauth/authorize", params=authorize_query(client_id, resource="https://other.example/mcp")
    )
    assert parse_qs(urlparse(response.headers["location"]).query)["error"] == ["invalid_target"]


async def test_cancelling_sends_access_denied_and_issues_no_code(web: AsyncClient, session: AsyncSession) -> None:
    client_id = await register(web)
    page = await web.get("/oauth/authorize", params=authorize_query(client_id))
    response = await web.post("/oauth/authorize", data={**hidden_fields(page.text), "decision": "deny"})
    assert parse_qs(urlparse(response.headers["location"]).query)["error"] == ["access_denied"]
    assert (await session.exec(select(OAuthCode))).all() == []


async def test_approving_needs_the_page_it_was_shown_on(web: AsyncClient, session: AsyncSession) -> None:
    client_id = await register(web)
    page = await web.get("/oauth/authorize", params=authorize_query(client_id))
    forged = {**hidden_fields(page.text), "csrf": "0" * 64, "decision": "approve"}
    response = await web.post("/oauth/authorize", data=forged)
    assert response.status_code == 400
    assert (await session.exec(select(OAuthCode))).all() == []
    # The page's own token is bound to what was asked for: another challenge fails.
    changed = {**hidden_fields(page.text), "code_challenge": "A" * 43, "decision": "approve"}
    assert (await web.post("/oauth/authorize", data=changed)).status_code == 400


# ---------------------------------------------------------------- token


async def test_the_whole_sign_in_ends_in_a_working_token(web: AsyncClient, session: AsyncSession) -> None:
    connection = await connect(web)
    assert connection["token_type"] == "Bearer"
    assert connection["expires_in"] == config.MCP_ACCESS_TOKEN_TTL_SECONDS
    grant = (await session.exec(select(OAuthGrant))).one()
    # Only hashes are stored.
    assert grant.access_hash == hash_token(connection["access_token"])
    assert connection["access_token"] not in (grant.access_hash, grant.refresh_hash)
    assert (await rpc(web, connection["access_token"], "ping")).json()["result"] == {}


async def test_a_code_works_once(web: AsyncClient) -> None:
    client_id = await register(web)
    code = await approve(web, client_id)
    assert (await web.post("/oauth/token", data=token_request(client_id, code))).status_code == 200
    again = await web.post("/oauth/token", data=token_request(client_id, code))
    assert again.status_code == 400
    assert again.json()["error"] == "invalid_grant"


@pytest.mark.parametrize(
    "overrides",
    [
        {"code_verifier": "w" * 43},
        {"code_verifier": "short"},
        {"redirect_uri": "https://chat.example/other"},
    ],
)
async def test_a_wrong_verifier_or_redirect_is_refused_and_burns_the_code(
    web: AsyncClient, overrides: dict[str, str]
) -> None:
    client_id = await register(web)
    code = await approve(web, client_id)
    refused = await web.post("/oauth/token", data=token_request(client_id, code, **overrides))
    assert refused.status_code == 400
    assert refused.json()["error"] == "invalid_grant"
    assert (await web.post("/oauth/token", data=token_request(client_id, code))).status_code == 400


async def test_another_chats_code_is_refused(web: AsyncClient) -> None:
    first = await register(web)
    second = await register(web)
    code = await approve(web, first)
    assert (await web.post("/oauth/token", data=token_request(second, code))).status_code == 400


async def test_an_expired_code_is_refused(web: AsyncClient, session: AsyncSession) -> None:
    client_id = await register(web)
    code = await approve(web, client_id)
    row = (await session.exec(select(OAuthCode))).one()
    row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    session.add(row)
    await session.commit()
    assert (await web.post("/oauth/token", data=token_request(client_id, code))).status_code == 400


async def test_token_errors(web: AsyncClient) -> None:
    unknown = await web.post("/oauth/token", data={"grant_type": "authorization_code", "client_id": "nobody"})
    assert unknown.status_code == 401
    client_id = await register(web)
    odd = await web.post("/oauth/token", data={"grant_type": "password", "client_id": client_id})
    assert odd.json()["error"] == "unsupported_grant_type"


async def test_a_refresh_replaces_both_tokens(web: AsyncClient) -> None:
    connection = await connect(web)
    refreshed = await web.post(
        "/oauth/token",
        data={"grant_type": "refresh_token", "client_id": connection["client_id"], "refresh_token": connection["refresh_token"]},
    )
    assert refreshed.status_code == 200
    new = refreshed.json()
    assert new["access_token"] != connection["access_token"]
    assert new["refresh_token"] != connection["refresh_token"]
    assert (await rpc(web, connection["access_token"], "ping")).status_code == 401
    assert (await rpc(web, new["access_token"], "ping")).status_code == 200


async def test_a_reused_refresh_token_ends_the_connection(web: AsyncClient, session: AsyncSession) -> None:
    connection = await connect(web)
    data = {"grant_type": "refresh_token", "client_id": connection["client_id"], "refresh_token": connection["refresh_token"]}
    new = (await web.post("/oauth/token", data=data)).json()
    # Someone presents the token that was already traded in.
    replay = await web.post("/oauth/token", data=data)
    assert replay.status_code == 400
    assert (await session.exec(select(OAuthGrant))).all() == []
    assert (await rpc(web, new["access_token"], "ping")).status_code == 401


async def test_an_expired_refresh_token_is_refused(web: AsyncClient, session: AsyncSession) -> None:
    connection = await connect(web)
    grant = (await session.exec(select(OAuthGrant))).one()
    grant.refresh_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    session.add(grant)
    await session.commit()
    data = {"grant_type": "refresh_token", "client_id": connection["client_id"], "refresh_token": connection["refresh_token"]}
    assert (await web.post("/oauth/token", data=data)).status_code == 400


async def test_revoking_ends_the_connection(web: AsyncClient) -> None:
    connection = await connect(web)
    response = await web.post(
        "/oauth/revoke", data={"token": connection["access_token"], "client_id": connection["client_id"]}
    )
    assert response.status_code == 200
    assert (await rpc(web, connection["access_token"], "ping")).status_code == 401
    # Unknown tokens answer the same.
    assert (await web.post("/oauth/revoke", data={"token": "nope", "client_id": "x"})).status_code == 200


# ---------------------------------------------------------------- /mcp


async def test_mcp_needs_an_access_token(web: AsyncClient) -> None:
    message = {"jsonrpc": "2.0", "id": 1, "method": "ping"}
    for headers in ({}, {"Authorization": "Bearer nope"}, {"Authorization": "Basic abc"}):
        response = await web.post("/mcp", json=message, headers=headers)
        assert response.status_code == 401
        assert f'resource_metadata="{BASE}/.well-known/oauth-protected-resource"' in response.headers["www-authenticate"]


async def test_an_expired_access_token_is_refused(web: AsyncClient, session: AsyncSession) -> None:
    connection = await connect(web)
    grant = (await session.exec(select(OAuthGrant))).one()
    grant.access_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    session.add(grant)
    await session.commit()
    assert (await rpc(web, connection["access_token"], "ping")).status_code == 401


async def test_initialize_negotiates_the_protocol_version(web: AsyncClient, token: str) -> None:
    ok = (await rpc(web, token, "initialize", {"protocolVersion": "2025-03-26"})).json()["result"]
    assert ok["protocolVersion"] == "2025-03-26"
    assert "tools" in ok["capabilities"]
    newer = (await rpc(web, token, "initialize", {"protocolVersion": "2099-01-01"})).json()["result"]
    assert newer["protocolVersion"] == "2025-06-18"


async def test_notifications_get_no_body_and_batches_answer_together(web: AsyncClient, token: str) -> None:
    auth = {"Authorization": f"Bearer {token}"}
    note = await web.post("/mcp", json={"jsonrpc": "2.0", "method": "notifications/initialized"}, headers=auth)
    assert note.status_code == 202
    assert note.content == b""
    batch = await web.post(
        "/mcp",
        json=[{"jsonrpc": "2.0", "id": 1, "method": "ping"}, {"jsonrpc": "2.0", "id": 2, "method": "ping"}],
        headers=auth,
    )
    assert [m["id"] for m in batch.json()] == [1, 2]


async def test_protocol_errors(web: AsyncClient, token: str) -> None:
    auth = {"Authorization": f"Bearer {token}"}
    assert (await rpc(web, token, "nope")).json()["error"]["code"] == -32601
    assert (await web.post("/mcp", content=b"{", headers=auth)).json()["error"]["code"] == -32700
    assert (await web.post("/mcp", json={"id": 1}, headers=auth)).json()["error"]["code"] == -32600
    unknown = await rpc(web, token, "tools/call", {"name": "drop", "arguments": {}})
    assert unknown.json()["error"]["code"] == -32602
    old = await web.post(
        "/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "ping"}, headers={**auth, "MCP-Protocol-Version": "1999-01-01"}
    )
    assert old.status_code == 400


async def test_there_is_no_stream(web: AsyncClient, token: str) -> None:
    response = await web.get("/mcp", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 405
    assert response.headers["allow"] == "POST"


async def test_a_page_on_another_site_cannot_drive_it(web: AsyncClient, token: str) -> None:
    message = {"jsonrpc": "2.0", "id": 1, "method": "ping"}
    foreign = await web.post("/mcp", json=message, headers={"Authorization": f"Bearer {token}", "Origin": "https://evil.example"})
    assert foreign.status_code == 403
    own = await web.post("/mcp", json=message, headers={"Authorization": f"Bearer {token}", "Origin": BASE})
    assert own.status_code == 200


async def test_requests_are_rate_limited_per_connection(
    web: AsyncClient, token: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(config, "MCP_REQUESTS_PER_MINUTE", 2)
    assert (await rpc(web, token, "ping")).status_code == 200
    assert (await rpc(web, token, "ping")).status_code == 200
    limited = await rpc(web, token, "ping")
    assert limited.status_code == 429
    assert int(limited.headers["retry-after"]) >= 1


# ---------------------------------------------------------------- tools


async def test_the_tools_are_the_seven_and_only_delete_is_destructive(web: AsyncClient, token: str) -> None:
    tools = (await rpc(web, token, "tools/list")).json()["result"]["tools"]
    assert [t["name"] for t in tools] == ["fetch", "search", "list", "create", "update", "delete", "restore"]
    assert tools == tool_definitions()
    for tool in tools:
        assert tool["inputSchema"]["type"] == "object"
    # delete is the one the chat must ask before; create, update and restore lose nothing.
    assert [t["name"] for t in tools if t["annotations"].get("destructiveHint")] == ["delete"]
    # The entity's fields are in the description, so a chat can build a call.
    create = next(t for t in tools if t["name"] == "create")
    assert "availableFrom" in create["description"]
    assert "widget-categories" not in create["inputSchema"]["properties"]["entity"]["enum"]
    assert [t["annotations"]["readOnlyHint"] for t in tools] == [True, True, True, False, False, False, False]


async def test_fetch_reads_a_record_with_its_related_titles(web: AsyncClient, token: str) -> None:
    text, is_error = await call(web, token, "fetch", {"url": "/widgets/1"})
    assert not is_error
    assert text.startswith("# Wireless Mouse\nAddress: /widgets/1")
    assert "Category: Electronics (/widget-categories/1)" in text
    assert "Status: active" in text
    assert "Price: 24.99" in text
    assert "In stock: yes" in text
    assert "Assignee email: alice@example.com" in text
    # The app's own link, with a host, reads the same.
    assert (await call(web, token, "fetch", {"url": "https://app.test/widgets/1"}))[0] == text


async def test_fetch_refuses_what_is_not_there_in_words(web: AsyncClient, token: str, session: AsyncSession) -> None:
    session.add(User(id=2, email="other@example.com", name="Other", password_hash="unused"))
    await session.flush()
    session.add(
        Widget(
            id=2, name="Secret", category_id=1, status=WidgetStatus.draft,
            available_from=datetime(2026, 1, 1, tzinfo=timezone.utc), price=Decimal("1.00"),
            description="", owner_id=2,
        )
    )
    await session.commit()
    for url in ["/widgets/99", "/widgets/2", "/nothing/1", "widgets", "/widgets/abc", None]:
        text, is_error = await call(web, token, "fetch", {"url": url})
        assert is_error, url
    # Another user's record reads exactly like a missing one.
    assert (await call(web, token, "fetch", {"url": "/widgets/2"}))[0] == "No widget at /widgets/2."
    assert (await call(web, token, "fetch", {"url": "/widgets/99"}))[0] == "No widget at /widgets/99."
    assert "Secret" not in (await call(web, token, "search", {"query": "secret"}))[0]


async def test_fetch_a_category(web: AsyncClient, token: str) -> None:
    text, is_error = await call(web, token, "fetch", {"url": "/widget-categories/1"})
    assert not is_error
    assert text == "# Electronics\nAddress: /widget-categories/1\nName: Electronics"


async def test_search_finds_by_title_across_entities(web: AsyncClient, token: str) -> None:
    text, _ = await call(web, token, "search", {"query": "mouse"})
    assert "widgets:\n- Wireless Mouse — /widgets/1 (status: active, price: 24.99)" in text
    text, _ = await call(web, token, "search", {"query": "electr"})
    assert "widget-categories:\n- Electronics — /widget-categories/1" in text
    assert (await call(web, token, "search", {"query": "zzz"}))[0] == "Nothing matches 'zzz'."
    assert (await call(web, token, "search", {"query": "  "}))[1] is True


async def test_list_pages_filters_and_sorts_as_the_api_does(web: AsyncClient, token: str) -> None:
    for name, price in [("Alpha", "5.00"), ("Beta", "50.00"), ("Gamma", "15.00")]:
        await call(web, token, "create", {"entity": "widgets", "fields": {**NEW_WIDGET, "name": name, "price": price}})
    text, _ = await call(web, token, "list", {"entity": "widgets", "limit": 2, "sort": "price:desc"})
    assert text.splitlines()[0] == "widgets 1–2 of 4:"
    assert "Beta" in text.splitlines()[1]
    page2, _ = await call(web, token, "list", {"entity": "widgets", "limit": 2, "offset": 2, "sort": "price:desc"})
    assert page2.splitlines()[0] == "widgets 3–4 of 4:"
    filtered, _ = await call(web, token, "list", {"entity": "widgets", "filters": {"status": "active"}})
    assert filtered.splitlines()[0] == "widgets 1–1 of 1:"
    searched, _ = await call(web, token, "list", {"entity": "widgets", "search": "gam"})
    assert "Gamma" in searched
    assert (await call(web, token, "list", {"entity": "widgets", "offset": 50}))[0].startswith("No widgets at offset 50")
    none, _ = await call(web, token, "list", {"entity": "widgets", "filters": {"inStock": False}})
    assert none == "No widgets match."


async def test_list_says_what_it_did_not_understand(web: AsyncClient, token: str) -> None:
    bad_filter, is_error = await call(web, token, "list", {"entity": "widgets", "filters": {"status": "gone", "colour": "red"}})
    assert is_error
    assert "status" in bad_filter and "colour" in bad_filter
    bad_sort, is_error = await call(web, token, "list", {"entity": "widgets", "sort": "secret:asc"})
    assert is_error and "name:asc" in bad_sort
    assert (await call(web, token, "list", {"entity": "nothing"}))[1] is True
    assert (await call(web, token, "list", {"entity": "widgets", "limit": 1000}))[1] is True
    assert (await call(web, token, "list", {"entity": "widget-categories", "filters": {"x": 1}}))[1] is True


async def test_list_a_category_entity_with_no_filters(web: AsyncClient, token: str) -> None:
    text, _ = await call(web, token, "list", {"entity": "widget-categories"})
    assert text == "widget-categories 1–1 of 1:\n- Electronics — /widget-categories/1"


async def test_create_saves_through_the_apis_validation_and_logs_it(
    web: AsyncClient, token: str, session: AsyncSession
) -> None:
    text, is_error = await call(web, token, "create", {"entity": "widgets", "fields": NEW_WIDGET})
    assert not is_error
    assert text.startswith("Created widget /widgets/2.")
    assert "Price: 19.50" in text
    widget = await session.get(Widget, 2)
    assert widget is not None
    assert widget.name == "Desk Lamp"
    assert widget.owner_id == 1  # the signed-in user's, never a field the chat sends

    entry = (await session.exec(select(McpAuditEntry))).one()
    assert (entry.user_id, entry.action, entry.entity, entry.record_id) == (1, "create", "widgets", 2)
    assert entry.client_id == (await session.exec(select(OAuthGrant))).one().client_id
    assert entry.before is None
    after = json.loads(entry.after)
    assert after["name"] == "Desk Lamp"
    assert after["price"] == "19.50"
    assert entry.at is not None


async def test_create_returns_field_errors_as_text_and_saves_nothing(
    web: AsyncClient, token: str, session: AsyncSession
) -> None:
    fields = {**NEW_WIDGET, "price": "free", "status": "gone", "colour": "red"}
    del fields["name"]
    text, is_error = await call(web, token, "create", {"entity": "widgets", "fields": fields})
    assert is_error
    assert text.startswith("Nothing was saved.")
    for expected in ("colour: not a field of this entity", "name: Field required", "price:", "status:"):
        assert expected in text
    assert (await session.exec(select(Widget).where(Widget.id != 1))).all() == []
    assert (await session.exec(select(McpAuditEntry))).all() == []


async def test_create_refuses_a_reference_to_a_missing_record_like_the_api(
    web: AsyncClient, token: str, session: AsyncSession
) -> None:
    text, is_error = await call(web, token, "create", {"entity": "widgets", "fields": {**NEW_WIDGET, "categoryId": 99}})
    assert is_error
    assert "categoryId: unknown category ids: [99]" in text
    assert (await session.exec(select(McpAuditEntry))).all() == []


async def test_a_read_only_entity_cannot_be_created_or_changed(web: AsyncClient, token: str) -> None:
    created = await call(web, token, "create", {"entity": "widget-categories", "fields": {"name": "x"}})
    assert created == ("widget-categories can't be created through MCP.", True)
    changed = await call(web, token, "update", {"url": "/widget-categories/1", "fields": {"name": "x"}})
    assert changed == ("widget-categories can't be changed through MCP.", True)


async def test_update_changes_only_what_was_sent_and_logs_before_and_after(
    web: AsyncClient, token: str, session: AsyncSession
) -> None:
    text, is_error = await call(
        web, token, "update", {"url": "/widgets/1", "fields": {"price": "30.00", "status": "archived"}}
    )
    assert not is_error
    assert text.startswith("Updated widget /widgets/1. Changed status, price.")
    widget = await session.get(Widget, 1)
    assert widget is not None
    assert (widget.price, widget.status, widget.name) == (Decimal("30.00"), WidgetStatus.archived, "Wireless Mouse")

    entry = (await session.exec(select(McpAuditEntry))).one()
    assert (entry.action, entry.entity, entry.record_id) == ("update", "widgets", 1)
    assert json.loads(entry.before or "") == {"price": "24.99", "status": "active"}
    assert json.loads(entry.after) == {"price": "30.00", "status": "archived"}


async def test_update_that_changes_nothing_says_so_and_still_logs(web: AsyncClient, token: str, session: AsyncSession) -> None:
    text, _ = await call(web, token, "update", {"url": "/widgets/1", "fields": {"name": "Wireless Mouse"}})
    assert "Nothing changed" in text
    entry = (await session.exec(select(McpAuditEntry))).one()
    assert json.loads(entry.after) == {}


async def test_update_refuses_in_words_and_changes_nothing(web: AsyncClient, token: str, session: AsyncSession) -> None:
    for fields in ({"price": "free"}, {"name": None}, {"categoryId": 99}, {"ownerId": 2}, {}):
        text, is_error = await call(web, token, "update", {"url": "/widgets/1", "fields": fields})
        assert is_error, fields
    assert "name: Value error, name can't be null" in (await call(web, token, "update", {"url": "/widgets/1", "fields": {"name": None}}))[0]
    assert (await call(web, token, "update", {"url": "/widgets/99", "fields": {"name": "x"}}))[0] == "No widget at /widgets/99."
    widget = await session.get(Widget, 1)
    assert widget is not None
    assert (widget.name, widget.price) == ("Wireless Mouse", Decimal("24.99"))
    assert (await session.exec(select(McpAuditEntry))).all() == []


async def test_a_refused_write_leaves_nothing_for_a_later_write_to_save(web: AsyncClient, token: str) -> None:
    # The router sets the tags, then refuses the unknown category: the tags it
    # already set must not ride along with the next write in the same request.
    tags_before = (await web.get("/api/widgets/1")).json()["tags"]
    refused = {"url": "/widgets/1", "fields": {"tags": ["fragile", "bulky"], "extraCategoryIds": [99]}}
    batch = await web.post(
        "/mcp",
        json=[
            {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "update", "arguments": refused}},
            {"jsonrpc": "2.0", "id": 2, "method": "tools/call",
             "params": {"name": "update", "arguments": {"url": "/widgets/1", "fields": {"name": "Renamed"}}}},
        ],
        headers={"Authorization": f"Bearer {token}"},
    )
    first, second = batch.json()
    assert first["result"]["isError"]
    assert first["result"]["content"][0]["text"].startswith("Nothing was saved.")
    assert not second["result"].get("isError")
    widget = (await web.get("/api/widgets/1")).json()
    assert (widget["name"], widget["tags"]) == ("Renamed", tags_before)


async def test_a_batch_reads_after_a_write(web: AsyncClient, token: str) -> None:
    # Each write's audit row is committed last, which expires the user the
    # request loaded; a read later in the same batch must not need it loaded.
    calls = [
        ("update", {"url": "/widgets/1", "fields": {"name": "Renamed"}}),
        ("fetch", {"url": "/widgets/1"}),
        ("create", {"entity": "widgets", "fields": NEW_WIDGET}),
        ("list", {"entity": "widgets"}),
        ("delete", {"url": "/widgets/1"}),
        ("search", {"query": "Desk"}),
        ("restore", {"url": "/widgets/1"}),
        ("fetch", {"url": "/widgets/1"}),
    ]
    batch = await web.post(
        "/mcp",
        json=[
            {"jsonrpc": "2.0", "id": i, "method": "tools/call", "params": {"name": name, "arguments": arguments}}
            for i, (name, arguments) in enumerate(calls, start=1)
        ],
        headers={"Authorization": f"Bearer {token}"},
    )
    assert batch.status_code == 200, batch.text
    answers = batch.json()
    assert [a["id"] for a in answers] == list(range(1, len(calls) + 1))
    for (name, _), answer in zip(calls, answers):
        assert not answer["result"].get("isError"), (name, answer)
    assert "Renamed" in answers[1]["result"]["content"][0]["text"]
    assert "Desk Lamp" in answers[5]["result"]["content"][0]["text"]


async def test_update_cannot_reach_another_users_record(web: AsyncClient, token: str, session: AsyncSession) -> None:
    session.add(User(id=2, email="other@example.com", name="Other", password_hash="unused"))
    await session.flush()
    session.add(
        Widget(
            id=2, name="Theirs", category_id=1, status=WidgetStatus.draft,
            available_from=datetime(2026, 1, 1, tzinfo=timezone.utc), price=Decimal("1.00"),
            description="", owner_id=2,
        )
    )
    await session.commit()
    text, is_error = await call(web, token, "update", {"url": "/widgets/2", "fields": {"name": "Mine now"}})
    assert (text, is_error) == ("No widget at /widgets/2.", True)
    widget = await session.get(Widget, 2)
    assert widget is not None
    assert widget.name == "Theirs"


def _only_one_entity_deletes(monkeypatch: pytest.MonkeyPatch) -> None:
    """Widgets stop deleting softly; the delete and restore tools go with them."""
    entities = dict(ENTITIES)
    entities["widgets"] = replace(entities["widgets"], delete=None, restore=None)
    monkeypatch.setattr(mcp_tools, "ENTITIES", entities)


async def test_delete_marks_the_record_deleted_and_logs_the_whole_record(
    web: AsyncClient, token: str, session: AsyncSession
) -> None:
    text, is_error = await call(web, token, "delete", {"url": "/widgets/1"})
    assert not is_error
    assert text.startswith("Deleted widget /widgets/1 (Wireless Mouse). It isn't gone")
    widget = await session.get(Widget, 1)
    assert widget is not None  # soft: the row is still there
    assert widget.deleted_at is not None

    entry = (await session.exec(select(McpAuditEntry))).one()
    assert (entry.action, entry.entity, entry.record_id) == ("delete", "widgets", 1)
    assert json.loads(entry.before or "")["name"] == "Wireless Mouse"
    assert json.loads(entry.after) == json.loads(entry.before or "")

    # Out of reads and lists; findable only by asking for the deleted.
    assert (await call(web, token, "fetch", {"url": "/widgets/1"})) == ("No widget at /widgets/1.", True)
    assert (await call(web, token, "list", {"entity": "widgets"}))[0] == "No widgets match."
    assert (await call(web, token, "search", {"query": "Mouse"}))[0].startswith("Nothing matches")
    listed, _ = await call(web, token, "list", {"entity": "widgets", "filters": {"deleted": True}})
    assert "Wireless Mouse — /widgets/1" in listed
    assert (await call(web, token, "update", {"url": "/widgets/1", "fields": {"name": "x"}}))[1] is True
    # A second delete finds nothing to delete, and logs nothing.
    assert (await call(web, token, "delete", {"url": "/widgets/1"})) == ("No widget at /widgets/1.", True)
    assert len((await session.exec(select(McpAuditEntry))).all()) == 1


async def test_restore_brings_a_deleted_record_back_and_logs_it(
    web: AsyncClient, token: str, session: AsyncSession
) -> None:
    await call(web, token, "delete", {"url": "/widgets/1"})
    text, is_error = await call(web, token, "restore", {"url": "/widgets/1"})
    assert not is_error
    assert text.startswith("Restored widget /widgets/1.")
    assert "Name: Wireless Mouse" in text
    widget = await session.get(Widget, 1)
    assert widget is not None
    assert widget.deleted_at is None
    assert "Wireless Mouse" in (await call(web, token, "fetch", {"url": "/widgets/1"}))[0]

    actions = [entry.action for entry in (await session.exec(select(McpAuditEntry).order_by(col(McpAuditEntry.id)))).all()]
    assert actions == ["delete", "restore"]
    # Nothing is deleted any more, so there is nothing to restore.
    assert (await call(web, token, "restore", {"url": "/widgets/1"})) == ("No deleted widget at /widgets/1.", True)


async def test_delete_and_restore_cannot_reach_another_users_record(
    web: AsyncClient, token: str, session: AsyncSession
) -> None:
    session.add(User(id=2, email="other@example.com", name="Other", password_hash="unused"))
    await session.flush()
    session.add(
        Widget(
            id=2, name="Theirs", category_id=1, status=WidgetStatus.draft,
            available_from=datetime(2026, 1, 1, tzinfo=timezone.utc), price=Decimal("1.00"),
            description="", owner_id=2, deleted_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
        )
    )
    await session.commit()
    assert (await call(web, token, "restore", {"url": "/widgets/2"})) == ("No deleted widget at /widgets/2.", True)
    assert (await call(web, token, "delete", {"url": "/widgets/2"})) == ("No widget at /widgets/2.", True)
    widget = await session.get(Widget, 2)
    assert widget is not None
    assert widget.deleted_at is not None
    assert (await session.exec(select(McpAuditEntry))).all() == []


async def test_an_entity_that_does_not_delete_softly_gets_no_delete_tool(
    web: AsyncClient, token: str, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    _only_one_entity_deletes(monkeypatch)
    tools = (await rpc(web, token, "tools/list")).json()["result"]["tools"]
    assert [t["name"] for t in tools] == ["fetch", "search", "list", "create", "update"]
    for name in ("delete", "restore"):
        assert (await rpc(web, token, "tools/call", {"name": name, "arguments": {"url": "/widgets/1"}})).json()["error"]["code"] == -32602
    widget = await session.get(Widget, 1)
    assert widget is not None
    assert widget.deleted_at is None


async def test_tools_act_as_the_user_who_approved(web: AsyncClient, session: AsyncSession) -> None:
    """A second user's connection sees none of the first user's records."""
    session.add(User(id=2, email="other@example.com", name="Other", password_hash="unused"))
    await session.flush()
    session.add(
        UserSession(user_id=2, token_hash=hash_token("second"), expires_at=datetime.now(timezone.utc) + timedelta(days=1))
    )
    await session.commit()
    web.cookies.set("session_id", "second")
    connection = await connect(web)
    text, is_error = await call(web, connection["access_token"], "fetch", {"url": "/widgets/1"})
    assert (text, is_error) == ("No widget at /widgets/1.", True)
    assert (await call(web, connection["access_token"], "list", {"entity": "widgets"}))[0] == "No widgets match."


async def test_a_bad_argument_shape_is_text_not_a_crash(web: AsyncClient, token: str) -> None:
    cases: list[tuple[str, dict[str, Any]]] = [
        ("create", {"entity": "widgets", "fields": "name=x"}),
        ("update", {"url": "/widgets/1", "fields": ["a"]}),
        ("list", {"entity": "widgets", "filters": "x"}),
        ("list", {"entity": "widgets", "search": 3}),
    ]
    for name, arguments in cases:
        assert (await call(web, token, name, arguments))[1] is True, (name, arguments)


# ---------------------------------------------------------------- deploy


async def test_production_refuses_mcp_without_an_https_public_address(session: AsyncSession) -> None:
    kwargs: dict[str, Any] = {"cookie_secure": True}
    assert not [p for p in await production_problems(session, **kwargs) if "MCP" in p]
    for url in (None, "http://app.example.com"):
        problems = await production_problems(session, mcp_enabled=True, mcp_public_url=url, **kwargs)
        assert any("MCP_PUBLIC_URL" in p for p in problems)
    ok = await production_problems(session, mcp_enabled=True, mcp_public_url="https://app.example.com", **kwargs)
    assert not [p for p in ok if "MCP" in p]


# ------------------------------------------------- addresses under a section


def _widgets_under_a_section(monkeypatch: pytest.MonkeyPatch) -> None:
    """Widgets' pages sit under a section, as in an app that groups its
    screens: /inventory/widgets/<id>. The API stays /api/widgets."""
    entities = dict(ENTITIES)
    entities["widgets"] = replace(entities["widgets"], path="/inventory/widgets")
    check_entities(entities)
    monkeypatch.setattr(mcp_tools, "ENTITIES", entities)


async def test_a_sectioned_address_round_trips_through_every_tool(
    web: AsyncClient, token: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _widgets_under_a_section(monkeypatch)

    text, is_error = await call(web, token, "fetch", {"url": "https://app.test/inventory/widgets/1"})
    assert not is_error
    assert text.startswith("# Wireless Mouse\nAddress: /inventory/widgets/1")
    # Another entity's addresses are unchanged.
    assert "Category: Electronics (/widget-categories/1)" in text
    # The API's form still reads the record.
    assert (await call(web, token, "fetch", {"url": "/api/widgets/1"}))[0] == text

    found, _ = await call(web, token, "search", {"query": "mouse"})
    assert "- Wireless Mouse — /inventory/widgets/1 (" in found
    listed, _ = await call(web, token, "list", {"entity": "widgets"})
    assert "- Wireless Mouse — /inventory/widgets/1 (" in listed

    created, is_error = await call(web, token, "create", {"entity": "widgets", "fields": NEW_WIDGET})
    assert not is_error
    address = created.split()[2].rstrip(".")
    assert address.startswith("/inventory/widgets/")

    updated, is_error = await call(web, token, "update", {"url": address, "fields": {"name": "Renamed"}})
    assert not is_error
    assert updated.startswith(f"Updated widget {address}. Changed name.")
    deleted, is_error = await call(web, token, "delete", {"url": address})
    assert not is_error and deleted.startswith(f"Deleted widget {address} ")
    restored, is_error = await call(web, token, "restore", {"url": address})
    assert not is_error and restored.startswith(f"Restored widget {address}.")

    # The chat is told the addresses to use.
    fetch = next(t for t in tool_definitions() if t["name"] == "fetch")
    assert "/inventory/widgets/<id>" in fetch["description"]


async def test_an_unknown_prefix_is_refused_in_words(
    web: AsyncClient, token: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _widgets_under_a_section(monkeypatch)
    for url in ["/widgets/1", "/inventory/1", "/other/widgets/1", "/inventory/widgets", "/api/inventory/widgets/1"]:
        text, is_error = await call(web, token, "fetch", {"url": url})
        assert is_error, url
        assert text == (
            f"{url!r} isn't a record address. Use a record's address in the app, one of: "
            "/inventory/widgets/<id>, /widget-categories/<id>."
        )


@pytest.mark.parametrize(
    ("path", "problem"),
    [
        ("/widget-categories", "share the address /widget-categories/<id>"),
        ("/api/widgets", "under /api"),
        ("/inventory/widgets/", "no trailing /"),
        ("inventory/widgets", "each after a /"),
        ("/Inventory/Widgets", "lowercase"),
        ("/inventory//widgets", "each after a /"),
    ],
)
def test_addresses_that_cannot_be_told_apart_are_refused_at_startup(path: str, problem: str) -> None:
    entities: dict[str, McpEntity] = dict(ENTITIES)
    entities["widgets"] = replace(entities["widgets"], path=path)
    with pytest.raises(ValueError, match=re.escape(problem)):
        check_entities(entities)


def test_the_registry_as_shipped_is_accepted() -> None:
    check_entities(ENTITIES)


# ------------------------------------------- an API grouped by module


def _widgets_api_under_a_module(monkeypatch: pytest.MonkeyPatch) -> None:
    """Widgets' API sits under a module, /api/inventory/widgets/<id>, and
    its pages under the same section."""
    entities = dict(ENTITIES)
    entities["widgets"] = replace(entities["widgets"], path="/inventory/widgets", api_path="/api/inventory/widgets")
    check_entities(entities)
    monkeypatch.setattr(mcp_tools, "ENTITIES", entities)


async def test_a_grouped_api_address_reads_the_record(
    web: AsyncClient, token: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _widgets_api_under_a_module(monkeypatch)

    text, is_error = await call(web, token, "fetch", {"url": "https://app.test/api/inventory/widgets/1"})
    assert not is_error
    # The address handed back is still the page's.
    assert text.startswith("# Wireless Mouse\nAddress: /inventory/widgets/1")
    assert (await call(web, token, "fetch", {"url": "/inventory/widgets/1"}))[0] == text
    # Another entity's API form is unchanged.
    assert not (await call(web, token, "fetch", {"url": "/api/widget-categories/1"}))[1]

    updated, is_error = await call(web, token, "update", {"url": "/api/inventory/widgets/1", "fields": {"name": "Renamed"}})
    assert not is_error
    assert updated.startswith("Updated widget /inventory/widgets/1. Changed name.")

    # The flat form no longer names widgets.
    text, is_error = await call(web, token, "fetch", {"url": "/api/widgets/1"})
    assert is_error and text.startswith("'/api/widgets/1' isn't a record address.")


@pytest.mark.parametrize(
    ("api_path", "problem"),
    [
        ("/api/widget-categories", "share the API address /api/widget-categories/<id>"),
        ("/inventory/widgets", "must be under /api/"),
        ("/api", "must be under /api/"),
        ("/api/inventory/widgets/", "no trailing /"),
        ("/API/Widgets", "lowercase"),
    ],
)
def test_api_paths_that_cannot_be_told_apart_are_refused_at_startup(api_path: str, problem: str) -> None:
    entities: dict[str, McpEntity] = dict(ENTITIES)
    entities["widgets"] = replace(entities["widgets"], api_path=api_path)
    with pytest.raises(ValueError, match=re.escape(problem)):
        check_entities(entities)


# ------------------------------------------- fields only a script writes


def _assignee_set_by_a_script(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Widgets' assignee is set by a script (an importer, say), never by a
    chat. Returns the calls that reached the entity's create and update."""
    reached: list[str] = []
    widgets = ENTITIES["widgets"]
    assert widgets.create is not None and widgets.update is not None
    create, update = widgets.create, widgets.update

    async def spy_create(session: AsyncSession, user: User, payload: Any) -> Any:
        reached.append("create")
        return await create(session, user, payload)

    async def spy_update(session: AsyncSession, user: User, record_id: int, payload: Any) -> Any:
        reached.append("update")
        return await update(session, user, record_id, payload)

    entities = dict(ENTITIES)
    entities["widgets"] = replace(widgets, script_only=("assigneeEmail",), create=spy_create, update=spy_update)
    check_entities(entities)
    monkeypatch.setattr(mcp_tools, "ENTITIES", entities)
    return reached


@pytest.mark.parametrize("key", ["assigneeEmail", "assignee_email"])
async def test_create_refuses_a_script_only_field_and_saves_nothing(
    web: AsyncClient, token: str, session: AsyncSession, monkeypatch: pytest.MonkeyPatch, key: str
) -> None:
    reached = _assignee_set_by_a_script(monkeypatch)
    fields = {**NEW_WIDGET, key: "bob@example.com"}
    text, is_error = await call(web, token, "create", {"entity": "widgets", "fields": fields})
    assert (text, is_error) == ("Nothing was saved.\n- assigneeEmail: set by a script, not through MCP", True)
    assert reached == []
    assert (await session.exec(select(Widget).where(Widget.id != 1))).all() == []
    assert (await session.exec(select(McpAuditEntry))).all() == []
    # Left out, the same widget is created.
    text, is_error = await call(web, token, "create", {"entity": "widgets", "fields": NEW_WIDGET})
    assert not is_error and text.startswith("Created widget /widgets/2.")
    assert reached == ["create"]


@pytest.mark.parametrize("value", ["bob@example.com", None])
@pytest.mark.parametrize("key", ["assigneeEmail", "assignee_email"])
async def test_update_refuses_a_script_only_field_and_changes_nothing(
    web: AsyncClient, token: str, session: AsyncSession, monkeypatch: pytest.MonkeyPatch, key: str, value: str | None
) -> None:
    reached = _assignee_set_by_a_script(monkeypatch)
    # Changing it or clearing it, alongside a field a chat may change.
    text, is_error = await call(web, token, "update", {"url": "/widgets/1", "fields": {"name": "Renamed", key: value}})
    assert (text, is_error) == ("Nothing was saved.\n- assigneeEmail: set by a script, not through MCP", True)
    assert reached == []
    widget = await session.get(Widget, 1)
    assert widget is not None
    assert (widget.name, widget.assignee_email) == ("Wireless Mouse", "alice@example.com")
    assert (await session.exec(select(McpAuditEntry))).all() == []


async def test_a_script_only_field_is_read_but_not_offered_to_write(
    web: AsyncClient, token: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    def described(tool: str) -> str:
        return next(str(t["description"]) for t in mcp_tools.tool_definitions() if t["name"] == tool)

    for tool in ("create", "update"):
        assert "assigneeEmail (" in described(tool)
    _assignee_set_by_a_script(monkeypatch)
    for tool in ("create", "update"):
        assert "assigneeEmail" not in described(tool)
        assert "name (string" in described(tool)
    text, is_error = await call(web, token, "fetch", {"url": "/widgets/1"})
    assert not is_error
    assert "Assignee email: alice@example.com" in text


@pytest.mark.parametrize(
    ("entity", "script_only", "problem"),
    [
        ("widgets", ("assignee",), "script_only 'assignee' isn't a field of its create or update schema"),
        ("widgets", ("assignee_email",), "script_only 'assignee_email' isn't a field"),
        ("widgets", ("name",), "script_only 'name' is required to create one"),
        ("widget-categories", ("name",), "script_only 'name' isn't a field"),
    ],
)
def test_a_script_only_name_a_chat_could_not_write_is_refused_at_startup(
    entity: str, script_only: tuple[str, ...], problem: str
) -> None:
    entities: dict[str, McpEntity] = dict(ENTITIES)
    entities[entity] = replace(entities[entity], script_only=script_only)
    with pytest.raises(ValueError, match=re.escape(problem)):
        check_entities(entities)
