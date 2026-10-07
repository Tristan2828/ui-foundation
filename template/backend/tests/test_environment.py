"""GET /api/environment — DATA_LABEL on the wire, with no session needed."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.routers import environment


@pytest.fixture
def anonymous() -> AsyncClient:
    # No session cookie and no dependency overrides: the banner asks before
    # anyone has logged in.
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def test_unset_means_production_data(anonymous: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(environment, "DATA_LABEL", None)
    async with anonymous as client:
        res = await client.get("/api/environment")
    assert res.status_code == 200
    assert res.json() == {"dataLabel": None}


async def test_a_label_is_served_logged_out(anonymous: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(environment, "DATA_LABEL", "dev")
    async with anonymous as client:
        res = await client.get("/api/environment")
    assert res.status_code == 200
    assert res.json() == {"dataLabel": "dev"}
