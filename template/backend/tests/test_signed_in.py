"""The test clients sign in for real (tests/signed_in.py), so a route that
reads the `User` after `session.commit()` fails here as it does live: a 500
from `MissingGreenlet`, not a pass. A detached stand-in user, which the
`client` fixture used to be, never expires, and hid exactly that."""

from collections.abc import AsyncGenerator, Callable, Coroutine
from typing import Any

import pytest
import pytest_asyncio
from fastapi import Depends
from fastapi.routing import APIRoute
from httpx import AsyncClient
from sqlalchemy.exc import MissingGreenlet
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db import get_session
from app.main import app
from app.models import User, WidgetCategory
from app.routers.auth import get_current_user


async def reads_the_user_after_commit(
    user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
) -> dict[str, int | None]:
    session.add(WidgetCategory(name="Written before the read"))
    await session.commit()
    return {"userId": user.id}  # the bug: `user` expired with the commit


async def reads_the_saved_id_after_commit(
    user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
) -> dict[str, int | None]:
    user_id = user.id
    session.add(WidgetCategory(name="Written before the read"))
    await session.commit()
    return {"userId": user_id}


Endpoint = Callable[..., Coroutine[Any, Any, dict[str, int | None]]]


@pytest_asyncio.fixture
async def routes() -> AsyncGenerator[None, None]:
    added: list[APIRoute] = []
    endpoints: dict[str, Endpoint] = {
        "/api/test-after-commit/user": reads_the_user_after_commit,
        "/api/test-after-commit/saved-id": reads_the_saved_id_after_commit,
    }
    for path, endpoint in endpoints.items():
        app.add_api_route(path, endpoint, methods=["POST"])
        # Ahead of the SPA mount at "/", which would otherwise take the path.
        route = app.router.routes.pop()
        app.router.routes.insert(0, route)
        assert isinstance(route, APIRoute)
        added.append(route)
    yield
    for route in added:
        app.router.routes.remove(route)


async def test_reading_the_user_after_a_commit_fails_as_it_does_live(routes: None, client: AsyncClient) -> None:
    # Live, this is a 500; the test client re-raises what caused it.
    with pytest.raises(MissingGreenlet):
        await client.post("/api/test-after-commit/user")


async def test_the_user_id_saved_before_the_commit_is_the_way(routes: None, client: AsyncClient) -> None:
    response = await client.post("/api/test-after-commit/saved-id")
    assert response.status_code == 200
    assert response.json() == {"userId": 1}
