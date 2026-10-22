"""Error reporting (error_reporting.py, POST /client-errors, issue #126):
a 500 sends one Sentry envelope to the DSN, nothing is sent without one,
and a report never carries what it mustn't."""

import json
from collections.abc import AsyncGenerator, Iterator
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
import pytest_asyncio
from fastapi import Depends
from httpx import ASGITransport, AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from foundation_backend import error_reporting
from foundation_backend.db import get_session
from tests.minimal_app import app
from foundation_backend.models import Session as UserSession
from foundation_backend.models import User
from foundation_backend.routers import client_errors
from foundation_backend.routers.auth import get_current_user
from foundation_backend.security import hash_token

DSN = "https://publickey@errors.example.com/42"
TOKEN = "session-token-for-reporting-tests"
EMAIL = "reporter@example.com"
# Each must never reach a report.
SECRETS = ["body-value-xyz", "cookie-value-xyz", "query-value-xyz", "header-value-xyz", "path-value-xyz", EMAIL]

Sent = list[tuple[str, str, bytes]]


@pytest.fixture
def sent(monkeypatch: pytest.MonkeyPatch) -> Iterator[Sent]:
    """Envelopes posted to the destination, sent synchronously."""
    captured: Sent = []
    monkeypatch.setattr(error_reporting, "ERROR_REPORTING_DSN", DSN)
    monkeypatch.setattr(error_reporting, "_dispatch", error_reporting._send)
    monkeypatch.setattr(error_reporting, "_post", lambda url, key, body: captured.append((url, key, body)))
    client_errors.reset()
    yield captured
    client_errors.reset()


def event_of(envelope: bytes) -> dict[str, Any]:
    header, item, payload = envelope.rstrip(b"\n").split(b"\n")
    assert json.loads(item)["type"] == "event"
    assert json.loads(header)["dsn"] == DSN
    return dict(json.loads(payload))


async def boom(item_id: str, user: User = Depends(get_current_user)) -> None:
    raise RuntimeError("the widget store fell over")


@pytest_asyncio.fixture
async def client(session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    session.add(User(id=70, email=EMAIL, name="Reporter", password_hash="unused"))
    await session.flush()
    expires = datetime.now(timezone.utc) + timedelta(days=1)
    session.add(UserSession(user_id=70, token_hash=hash_token(TOKEN), expires_at=expires))
    await session.commit()

    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_session] = override_get_session
    app.add_api_route("/api/test-boom/{item_id}", boom, methods=["POST"])
    # Ahead of the SPA mount at "/", which would otherwise take the path.
    route = app.router.routes.pop()
    app.router.routes.insert(0, route)
    # A 500 is re-raised after the handler answers; the client reads the answer.
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.router.routes.remove(route)
    app.dependency_overrides.clear()


async def crash(client: AsyncClient) -> int:
    client.cookies.set("session_id", TOKEN)
    client.cookies.set("other", "cookie-value-xyz")
    response = await client.post(
        "/api/test-boom/path-value-xyz?search=query-value-xyz",
        json={"note": "body-value-xyz"},
        headers={"X-Custom": "header-value-xyz"},
    )
    return response.status_code


# ------------------------------------------------------------ server 500s


async def test_a_500_sends_one_envelope_to_the_dsn(client: AsyncClient, sent: Sent) -> None:
    assert await crash(client) == 500
    assert len(sent) == 1
    url, key, envelope = sent[0]
    assert url == "https://errors.example.com/api/42/envelope/"
    assert key == "publickey"
    event = event_of(envelope)
    exception = event["exception"]["values"][0]
    assert exception["type"] == "RuntimeError"
    assert exception["value"] == "the widget store fell over"
    assert exception["stacktrace"]["frames"]
    assert event["tags"] == {"source": "server", "route": "/api/test-boom/{item_id}", "method": "POST", "status": "500"}
    assert event["user"] == {"id": "70"}
    assert event["platform"] == "python"


async def test_a_report_holds_no_body_cookie_header_query_path_or_email(client: AsyncClient, sent: Sent) -> None:
    assert await crash(client) == 500
    envelope = sent[0][2].decode()
    for secret in SECRETS:
        assert secret not in envelope
    assert "request" not in event_of(sent[0][2])


async def test_nothing_is_sent_without_a_dsn(
    client: AsyncClient, sent: Sent, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(error_reporting, "ERROR_REPORTING_DSN", None)
    assert await crash(client) == 500
    assert sent == []


async def test_a_failing_destination_never_breaks_the_answer(
    client: AsyncClient, sent: Sent, monkeypatch: pytest.MonkeyPatch
) -> None:
    def refuse(url: str, key: str, body: bytes) -> None:
        raise OSError("connection refused")

    monkeypatch.setattr(error_reporting, "_post", refuse)
    assert await crash(client) == 500


def test_scrub_cuts_sql_parameters_and_query_strings() -> None:
    message = (
        "(psycopg.errors.UniqueViolation) duplicate key\n"
        "[SQL: INSERT INTO users (email) VALUES (%s)]\n[parameters: ('alice@example.com',)]"
    )
    assert error_reporting.scrub(message) == "(psycopg.errors.UniqueViolation) duplicate key"
    assert (
        error_reporting.scrub("GET https://app.example.com/widgets?search=alice#top failed, then /api/x?y=1")
        == "GET https://app.example.com/widgets failed, then /api/x"
    )


@pytest.mark.parametrize(
    ("dsn", "url", "key"),
    [
        ("https://k@o1.ingest.sentry.io/123", "https://o1.ingest.sentry.io/api/123/envelope/", "k"),
        ("http://k@glitchtip.lan:8000/7", "http://glitchtip.lan:8000/api/7/envelope/", "k"),
        ("https://k@example.com/errors/9", "https://example.com/errors/api/9/envelope/", "k"),
    ],
)
def test_parse_dsn(dsn: str, url: str, key: str) -> None:
    assert error_reporting.parse_dsn(dsn) == (url, key)


def test_a_dsn_without_a_key_is_refused() -> None:
    with pytest.raises(ValueError):
        error_reporting.parse_dsn("https://example.com/1")


# ------------------------------------------------------- browser reports

REPORT = {
    "source": "route",
    "type": "TypeError",
    "message": "Cannot read properties of undefined (reading 'name') at https://app.example.com/widgets/7?search=alice",
    "stack": (
        "TypeError: Cannot read properties of undefined\n"
        "    at WidgetView (https://app.example.com/assets/index-abc.js?v=query-value-xyz:12:345)\n"
        "    at renderWithHooks (https://app.example.com/assets/index-abc.js:1:2)"
    ),
    "route": "/widgets/:id",
    "release": "abc1234",
}


async def post_report(client: AsyncClient, report: dict[str, Any], cookie: bool = True) -> int:
    client.cookies.clear()
    if cookie:
        client.cookies.set("session_id", TOKEN)
    return (await client.post("/api/client-errors", json=report)).status_code


async def test_a_client_report_needs_a_session(client: AsyncClient, sent: Sent) -> None:
    assert await post_report(client, REPORT, cookie=False) == 401
    assert sent == []


async def test_a_client_report_is_forwarded_scrubbed_with_the_sessions_user(client: AsyncClient, sent: Sent) -> None:
    assert await post_report(client, REPORT) == 204
    assert len(sent) == 1
    event = event_of(sent[0][2])
    exception = event["exception"]["values"][0]
    assert exception["type"] == "TypeError"
    assert "search=alice" not in exception["value"]
    frames = exception["stacktrace"]["frames"]
    # Oldest first, as Sentry lists them; the script URL keeps no query.
    assert [frame["function"] for frame in frames] == ["renderWithHooks", "WidgetView"]
    assert frames[1]["filename"] == "https://app.example.com/assets/index-abc.js"
    assert event["platform"] == "javascript"
    assert event["release"] == "abc1234"
    assert event["user"] == {"id": "70"}
    assert event["tags"]["route"] == "/widgets/:id"
    assert "query-value-xyz" not in sent[0][2].decode()


async def test_the_same_client_error_goes_through_once_a_minute(client: AsyncClient, sent: Sent) -> None:
    assert await post_report(client, REPORT) == 204
    assert await post_report(client, REPORT) == 204
    assert len(sent) == 1
    assert await post_report(client, {**REPORT, "message": "Another failure"}) == 204
    assert len(sent) == 2


async def test_a_session_is_capped_per_minute(
    client: AsyncClient, sent: Sent, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(client_errors, "CLIENT_ERRORS_PER_MINUTE", 2)
    for n in range(4):
        assert await post_report(client, {**REPORT, "message": f"failure {n}"}) == 204
    assert len(sent) == 2


async def test_a_client_report_rejects_unknown_fields_by_ignoring_them(client: AsyncClient, sent: Sent) -> None:
    # Only the contract's fields exist: anything else the page sends is dropped.
    assert await post_report(client, {**REPORT, "body": "body-value-xyz", "email": EMAIL}) == 204
    envelope = sent[0][2].decode()
    assert "body-value-xyz" not in envelope and EMAIL not in envelope
