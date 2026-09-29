"""Contract-shape checks — see tests/conftest.py for scope. Not a
replacement for the Postgres-backed run in scripts/check-backend-postgres.sh.
"""

from collections.abc import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db import get_session
from app.main import app
from app.models import User, Widget
from app.routers.auth import get_current_user


async def test_list_widgets_is_paginated_and_camel_cased(client: AsyncClient) -> None:
    res = await client.get("/api/widgets")
    assert res.status_code == 200
    body = res.json()
    assert body == {"items": [{**body["items"][0], "categoryId": 1}], "total": 1}
    assert body["items"][0]["price"] == "24.99"


async def test_create_widget_formats_price_as_two_decimal_string(client: AsyncClient) -> None:
    res = await client.post(
        "/api/widgets",
        json={
            "name": "Desk Lamp",
            "categoryId": 1,
            "status": "draft",
            "availableFrom": "2026-05-01T00:00:00Z",
            "assigneeEmail": None,
            "price": "9.50",
            "description": "A lamp.",
        },
    )
    assert res.status_code == 201
    assert res.json()["price"] == "9.50"


async def test_create_widget_rejects_malformed_price_with_field_errors(client: AsyncClient) -> None:
    res = await client.post(
        "/api/widgets",
        json={
            "name": "Bad Widget",
            "categoryId": 1,
            "status": "draft",
            "availableFrom": "2026-05-01T00:00:00Z",
            "price": "9.5",
            "description": "d",
        },
    )
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert any(issue["loc"][-1] == "price" for issue in detail)


async def test_get_missing_widget_returns_404_http_error_body(client: AsyncClient) -> None:
    res = await client.get("/api/widgets/999")
    assert res.status_code == 404
    assert res.json() == {"detail": "Widget not found"}


async def test_delete_widget_returns_204_then_404(client: AsyncClient) -> None:
    res = await client.delete("/api/widgets/1")
    assert res.status_code == 204
    res = await client.get("/api/widgets/1")
    assert res.status_code == 404


@pytest_asyncio.fixture
async def other_user_client(session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Same as `client`, but authenticated as a second user who owns nothing."""
    session.add(User(id=2, email="other@example.com", name="Other User", password_hash="unused"))
    await session.commit()

    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield session

    async def override_get_current_user() -> User:
        return User(id=2, email="other@example.com", name="Other User", password_hash="unused")

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_current_user
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def test_widgets_are_invisible_to_other_users(other_user_client: AsyncClient) -> None:
    res = await other_user_client.get("/api/widgets")
    assert res.json() == {"items": [], "total": 0}
    for method in ("GET", "PATCH", "DELETE"):
        res = await other_user_client.request(method, "/api/widgets/1", json={"name": "x"} if method == "PATCH" else None)
        assert res.status_code == 404, method
        assert res.json() == {"detail": "Widget not found"}


async def test_created_widget_belongs_to_its_creator(other_user_client: AsyncClient, session: AsyncSession) -> None:
    res = await other_user_client.post(
        "/api/widgets",
        json={
            "name": "Mine",
            "categoryId": 1,
            "availableFrom": "2026-05-01T00:00:00Z",
            "price": "1.00",
            "description": "d",
        },
    )
    assert res.status_code == 201
    widget = await session.get(Widget, res.json()["id"])
    assert widget is not None and widget.owner_id == 2
    listed = (await other_user_client.get("/api/widgets")).json()
    assert [w["name"] for w in listed["items"]] == ["Mine"]


# --- tags: the multi-choice field (Phase G) ---------------------------------

_NEW_WIDGET = {
    "name": "Tagged",
    "categoryId": 1,
    "status": "draft",
    "availableFrom": "2026-05-01T00:00:00Z",
    "price": "1.00",
    "description": "d",
}


async def test_tags_default_to_empty_and_are_always_present_on_read(client: AsyncClient) -> None:
    created = await client.post("/api/widgets", json=_NEW_WIDGET)
    assert created.status_code == 201
    assert created.json()["tags"] == []
    listed = (await client.get("/api/widgets")).json()["items"]
    assert all(item["tags"] == [] for item in listed)


async def test_tags_are_returned_in_display_order(client: AsyncClient) -> None:
    res = await client.post("/api/widgets", json={**_NEW_WIDGET, "tags": ["featured", "fragile"]})
    assert res.status_code == 201
    assert res.json()["tags"] == ["fragile", "featured"]


async def test_patch_tags_replaces_clears_or_leaves_the_set(client: AsyncClient) -> None:
    widget_id = (await client.post("/api/widgets", json={**_NEW_WIDGET, "tags": ["bulky"]})).json()["id"]

    replaced = await client.patch(f"/api/widgets/{widget_id}", json={"tags": ["seasonal", "featured"]})
    assert replaced.json()["tags"] == ["seasonal", "featured"]

    untouched = await client.patch(f"/api/widgets/{widget_id}", json={"name": "Renamed"})
    assert untouched.json()["tags"] == ["seasonal", "featured"]

    cleared = await client.patch(f"/api/widgets/{widget_id}", json={"tags": []})
    assert cleared.json()["tags"] == []


async def test_tags_filter_matches_any_of_the_given_tags(client: AsyncClient) -> None:
    await client.post("/api/widgets", json={**_NEW_WIDGET, "name": "A", "tags": ["fragile"]})
    await client.post("/api/widgets", json={**_NEW_WIDGET, "name": "B", "tags": ["bulky", "seasonal"]})
    await client.post("/api/widgets", json={**_NEW_WIDGET, "name": "C", "tags": ["featured"]})

    res = await client.get("/api/widgets", params=[("tags", "fragile"), ("tags", "seasonal")])
    names = sorted(item["name"] for item in res.json()["items"])
    assert names == ["A", "B"]
    assert res.json()["total"] == 2


async def test_duplicate_or_unknown_tags_are_field_errors(client: AsyncClient) -> None:
    duplicate = await client.post("/api/widgets", json={**_NEW_WIDGET, "tags": ["bulky", "bulky"]})
    assert duplicate.status_code == 422
    assert any(item["loc"][-1] == "tags" for item in duplicate.json()["detail"])

    unknown = await client.post("/api/widgets", json={**_NEW_WIDGET, "tags": ["nope"]})
    assert unknown.status_code == 422
    assert any("tags" in item["loc"] for item in unknown.json()["detail"])


async def test_deleting_a_tagged_widget_removes_its_tags(client: AsyncClient) -> None:
    widget_id = (await client.post("/api/widgets", json={**_NEW_WIDGET, "tags": ["bulky"]})).json()["id"]
    assert (await client.delete(f"/api/widgets/{widget_id}")).status_code == 204
    res = await client.get("/api/widgets", params={"tags": "bulky"})
    assert res.json()["total"] == 0
