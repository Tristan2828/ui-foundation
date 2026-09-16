"""Contract-shape checks — see tests/conftest.py for scope. Not a
replacement for the Postgres-backed run in scripts/check-phase-8.sh.
"""

from httpx import AsyncClient


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
