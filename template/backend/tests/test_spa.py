"""SPA client-route fallback (app/spa.py) — mounted on a throwaway app over
a temp directory, since app.main only mounts dist/ if it exists at import.
"""

from collections.abc import AsyncGenerator
from pathlib import Path

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.spa import SPAStaticFiles


@pytest_asyncio.fixture
async def spa_client(tmp_path: Path) -> AsyncGenerator[AsyncClient, None]:
    (tmp_path / "index.html").write_text("<html>spa</html>")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    app = FastAPI()
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
