"""SPA client-route fallback and caching (spa.py) — mounted on a throwaway
app over a temp directory, as an app's main.py mounts its dist/, after an
API route, as an app's routers come first.
"""

from collections.abc import AsyncGenerator
from pathlib import Path

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from foundation_backend.spa import SPAStaticFiles

IMMUTABLE = "public, max-age=31536000, immutable"


@pytest_asyncio.fixture
async def spa_client(tmp_path: Path) -> AsyncGenerator[AsyncClient, None]:
    (tmp_path / "index.html").write_text("<html>spa</html>")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    (tmp_path / "assets" / "index-Bx7f3k2a.css").write_text("body{}")
    (tmp_path / "manifest.webmanifest").write_text("{}")
    (tmp_path / "push-sw.js").write_text("self.addEventListener('push', () => {})")
    (tmp_path / "favicon.svg").write_text("<svg/>")
    (tmp_path / "icons").mkdir()
    (tmp_path / "icons" / "icon-192.png").write_bytes(b"\x89PNG")
    app = FastAPI()

    @app.get("/api/widgets")
    async def widgets() -> list[int]:
        return [1]

    app.mount("/", SPAStaticFiles(directory=tmp_path, html=True), name="spa")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.parametrize("path", ["/", "/widgets", "/widgets/3/edit", "/login"])
async def test_client_routes_serve_index_html(spa_client: AsyncClient, path: str) -> None:
    res = await spa_client.get(path)
    assert res.status_code == 200
    assert res.text == "<html>spa</html>"


async def test_real_assets_are_served(spa_client: AsyncClient) -> None:
    assert (await spa_client.get("/assets/app.js")).text == "console.log(1)"


@pytest.mark.parametrize("path", ["/assets/missing.js", "/favicon.ico", "/api/nope", "/api"])
async def test_missing_files_and_api_paths_stay_404(spa_client: AsyncClient, path: str) -> None:
    assert (await spa_client.get(path)).status_code == 404


# ------------------------------------------------------------ Cache-Control


@pytest.mark.parametrize("path", ["/", "/index.html"])
async def test_index_html_is_revalidated(spa_client: AsyncClient, path: str) -> None:
    res = await spa_client.get(path)
    assert res.status_code == 200
    assert res.headers["cache-control"] == "no-cache"


@pytest.mark.parametrize("path", ["/widgets", "/widgets/3/edit", "/assets/not-a-file"])
async def test_client_route_fallback_is_revalidated(spa_client: AsyncClient, path: str) -> None:
    """index.html answering a client route is no-cache, even under assets/."""
    res = await spa_client.get(path)
    assert res.text == "<html>spa</html>"
    assert res.headers["cache-control"] == "no-cache"


@pytest.mark.parametrize("path", ["/assets/app.js", "/assets/index-Bx7f3k2a.css"])
async def test_hashed_assets_are_immutable(spa_client: AsyncClient, path: str) -> None:
    res = await spa_client.get(path)
    assert res.status_code == 200
    assert res.headers["cache-control"] == IMMUTABLE


@pytest.mark.parametrize(
    "path", ["/manifest.webmanifest", "/push-sw.js", "/favicon.svg", "/icons/icon-192.png"]
)
async def test_root_files_are_revalidated(spa_client: AsyncClient, path: str) -> None:
    res = await spa_client.get(path)
    assert res.status_code == 200
    assert res.headers["cache-control"] == "no-cache"


async def test_revalidation_304_keeps_the_header(spa_client: AsyncClient) -> None:
    page = await spa_client.get("/")
    again = await spa_client.get("/", headers={"if-none-match": page.headers["etag"]})
    assert again.status_code == 304
    assert again.headers["cache-control"] == "no-cache"
    asset = await spa_client.get("/assets/app.js")
    again = await spa_client.get("/assets/app.js", headers={"if-none-match": asset.headers["etag"]})
    assert again.status_code == 304
    assert again.headers["cache-control"] == IMMUTABLE


@pytest.mark.parametrize("path", ["/assets/missing-Ab12cd34.js", "/missing.png"])
async def test_missing_files_are_not_cached_as_immutable(spa_client: AsyncClient, path: str) -> None:
    res = await spa_client.get(path)
    assert res.status_code == 404
    assert "immutable" not in res.headers.get("cache-control", "")


async def test_api_routes_are_untouched(spa_client: AsyncClient) -> None:
    res = await spa_client.get("/api/widgets")
    assert res.status_code == 200
    assert res.json() == [1]
    assert "cache-control" not in res.headers
