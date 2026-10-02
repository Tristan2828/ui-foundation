"""Contract-shape checks — see tests/conftest.py for scope. Not a
replacement for the Postgres-backed run in scripts/check-backend-postgres.sh.
"""

from collections.abc import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db import get_session
from app.main import app
from app.models import Category, User, Widget
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


# --- inStock: the yes/no field (3.4.0) --------------------------------------


async def test_in_stock_defaults_to_true_and_is_always_present_on_read(client: AsyncClient) -> None:
    created = await client.post("/api/widgets", json=_NEW_WIDGET)
    assert created.status_code == 201
    assert created.json()["inStock"] is True
    listed = (await client.get("/api/widgets")).json()["items"]
    assert all(isinstance(item["inStock"], bool) for item in listed)


async def test_patch_in_stock_sets_or_leaves_it(client: AsyncClient) -> None:
    widget_id = (await client.post("/api/widgets", json={**_NEW_WIDGET, "inStock": False})).json()["id"]
    untouched = await client.patch(f"/api/widgets/{widget_id}", json={"name": "Renamed"})
    assert untouched.json()["inStock"] is False
    flipped = await client.patch(f"/api/widgets/{widget_id}", json={"inStock": True})
    assert flipped.json()["inStock"] is True


async def test_in_stock_filter_matches_exactly(client: AsyncClient) -> None:
    await client.post("/api/widgets", json={**_NEW_WIDGET, "name": "Out", "inStock": False})
    out_of_stock = (await client.get("/api/widgets", params={"inStock": "false"})).json()
    assert [w["name"] for w in out_of_stock["items"]] == ["Out"]
    in_stock = (await client.get("/api/widgets", params={"inStock": "true"})).json()
    assert "Out" not in [w["name"] for w in in_stock["items"]]
    assert in_stock["total"] >= 1


async def test_null_or_non_boolean_in_stock_is_a_field_error(client: AsyncClient) -> None:
    widget_id = (await client.post("/api/widgets", json=_NEW_WIDGET)).json()["id"]
    null = await client.patch(f"/api/widgets/{widget_id}", json={"inStock": None})
    assert null.status_code == 422
    assert any(item["loc"][-1] == "inStock" for item in null.json()["detail"])

    garbage = await client.post("/api/widgets", json={**_NEW_WIDGET, "inStock": "maybe"})
    assert garbage.status_code == 422
    assert any(item["loc"][-1] == "inStock" for item in garbage.json()["detail"])


# --- extraCategoryIds: the multi-reference field (3.5.0) --------------------


async def _add_categories(session: AsyncSession) -> None:
    session.add(Category(id=2, name="Furniture"))
    session.add(Category(id=3, name="Stationery"))
    await session.commit()


async def test_extra_categories_default_to_empty_and_read_back_ascending(
    client: AsyncClient, session: AsyncSession
) -> None:
    await _add_categories(session)
    empty = await client.post("/api/widgets", json=_NEW_WIDGET)
    assert empty.json()["extraCategoryIds"] == []
    linked = await client.post("/api/widgets", json={**_NEW_WIDGET, "extraCategoryIds": [3, 1]})
    assert linked.status_code == 201
    assert linked.json()["extraCategoryIds"] == [1, 3]


async def test_patch_extra_categories_replaces_clears_or_leaves_the_set(
    client: AsyncClient, session: AsyncSession
) -> None:
    await _add_categories(session)
    widget_id = (await client.post("/api/widgets", json={**_NEW_WIDGET, "extraCategoryIds": [2]})).json()["id"]
    replaced = await client.patch(f"/api/widgets/{widget_id}", json={"extraCategoryIds": [1, 3]})
    assert replaced.json()["extraCategoryIds"] == [1, 3]
    untouched = await client.patch(f"/api/widgets/{widget_id}", json={"name": "Renamed"})
    assert untouched.json()["extraCategoryIds"] == [1, 3]
    cleared = await client.patch(f"/api/widgets/{widget_id}", json={"extraCategoryIds": []})
    assert cleared.json()["extraCategoryIds"] == []


async def test_extra_categories_filter_matches_any_of_the_given_ids(
    client: AsyncClient, session: AsyncSession
) -> None:
    await _add_categories(session)
    await client.post("/api/widgets", json={**_NEW_WIDGET, "name": "A", "extraCategoryIds": [2]})
    await client.post("/api/widgets", json={**_NEW_WIDGET, "name": "B", "extraCategoryIds": [3]})
    await client.post("/api/widgets", json={**_NEW_WIDGET, "name": "C"})
    res = await client.get("/api/widgets", params=[("extraCategoryIds", "2"), ("extraCategoryIds", "3")])
    assert sorted(w["name"] for w in res.json()["items"]) == ["A", "B"]


async def test_unknown_duplicate_or_null_extra_categories_are_field_errors(
    client: AsyncClient, session: AsyncSession
) -> None:
    await _add_categories(session)
    unknown = await client.post("/api/widgets", json={**_NEW_WIDGET, "extraCategoryIds": [1, 99]})
    assert unknown.status_code == 422
    assert any(item["loc"][-1] == "extraCategoryIds" for item in unknown.json()["detail"])

    duplicate = await client.post("/api/widgets", json={**_NEW_WIDGET, "extraCategoryIds": [2, 2]})
    assert duplicate.status_code == 422
    assert any(item["loc"][-1] == "extraCategoryIds" for item in duplicate.json()["detail"])

    widget_id = (await client.post("/api/widgets", json=_NEW_WIDGET)).json()["id"]
    unknown_patch = await client.patch(f"/api/widgets/{widget_id}", json={"extraCategoryIds": [42]})
    assert unknown_patch.status_code == 422
    null = await client.patch(f"/api/widgets/{widget_id}", json={"extraCategoryIds": None})
    assert null.status_code == 422


async def test_categories_by_ids_returns_exactly_those_ignoring_unknown(
    client: AsyncClient, session: AsyncSession
) -> None:
    await _add_categories(session)
    res = await client.get("/api/categories", params=[("ids", "3"), ("ids", "1"), ("ids", "99")])
    assert res.status_code == 200
    assert sorted(c["id"] for c in res.json()) == [1, 3]


# --- checklist: the sub-records pattern (3.6.0) -----------------------------


async def test_checklist_defaults_to_empty_and_keeps_the_order_saved(client: AsyncClient) -> None:
    empty = await client.post("/api/widgets", json=_NEW_WIDGET)
    assert empty.json()["checklist"] == []
    items = [{"text": "Second?", "done": False}, {"text": "First", "done": True}]
    created = await client.post("/api/widgets", json={**_NEW_WIDGET, "checklist": items})
    assert created.status_code == 201
    assert created.json()["checklist"] == items
    fetched = await client.get(f"/api/widgets/{created.json()['id']}")
    assert fetched.json()["checklist"] == items


async def test_patch_checklist_replaces_reorders_clears_or_leaves_it(client: AsyncClient) -> None:
    a, b = {"text": "A", "done": False}, {"text": "B", "done": True}
    widget_id = (await client.post("/api/widgets", json={**_NEW_WIDGET, "checklist": [a, b]})).json()["id"]
    reordered = await client.patch(f"/api/widgets/{widget_id}", json={"checklist": [b, a]})
    assert reordered.json()["checklist"] == [b, a]
    untouched = await client.patch(f"/api/widgets/{widget_id}", json={"name": "Renamed"})
    assert untouched.json()["checklist"] == [b, a]
    cleared = await client.patch(f"/api/widgets/{widget_id}", json={"checklist": []})
    assert cleared.json()["checklist"] == []


async def test_checklist_text_is_trimmed_and_blank_is_a_field_error_on_that_item(client: AsyncClient) -> None:
    trimmed = await client.post("/api/widgets", json={**_NEW_WIDGET, "checklist": [{"text": "  Tidy  ", "done": False}]})
    assert trimmed.json()["checklist"] == [{"text": "Tidy", "done": False}]

    blank = await client.post(
        "/api/widgets",
        json={**_NEW_WIDGET, "checklist": [{"text": "Fine", "done": False}, {"text": "   ", "done": False}]},
    )
    assert blank.status_code == 422
    assert any(item["loc"] == ["body", "checklist", 1, "text"] for item in blank.json()["detail"])


async def test_too_many_or_null_checklist_items_are_field_errors(client: AsyncClient) -> None:
    too_many = [{"text": f"Item {i}", "done": False} for i in range(51)]
    res = await client.post("/api/widgets", json={**_NEW_WIDGET, "checklist": too_many})
    assert res.status_code == 422
    assert any(item["loc"][-1] == "checklist" for item in res.json()["detail"])

    widget_id = (await client.post("/api/widgets", json=_NEW_WIDGET)).json()["id"]
    null = await client.patch(f"/api/widgets/{widget_id}", json={"checklist": None})
    assert null.status_code == 422


async def test_deleting_a_widget_deletes_its_checklist(client: AsyncClient, session: AsyncSession) -> None:
    widget_id = (
        await client.post("/api/widgets", json={**_NEW_WIDGET, "checklist": [{"text": "Gone soon", "done": False}]})
    ).json()["id"]
    assert (await client.delete(f"/api/widgets/{widget_id}")).status_code == 204
    from app.models import WidgetChecklistItem
    from sqlmodel import select

    left = (await session.exec(select(WidgetChecklistItem).where(WidgetChecklistItem.widget_id == widget_id))).all()
    assert left == []
