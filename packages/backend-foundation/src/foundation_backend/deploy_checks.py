"""Startup safety checks for APP_ENV=production (see docs/deploy.md).

Development needs none of this and runs no startup query at all. A real
deployment is refused outright rather than warned about: a warning in a log
nobody reads is how a published default password ends up on the internet.
"""

import json
from pathlib import Path

from fastapi.concurrency import run_in_threadpool
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from foundation_backend.config import DEFAULT_SEED_EMAIL, DEFAULT_SEED_PASSWORD, SEED_USER_EMAIL
from foundation_backend.models import User
from foundation_backend.security import verify_password


async def production_problems(
    session: AsyncSession,
    *,
    cookie_secure: bool,
    data_label: str | None = None,
    mcp_enabled: bool = False,
    mcp_public_url: str | None = None,
    static_dir: str | None = None,
) -> list[str]:
    """Everything that makes this deployment unsafe to serve; empty if none.

    `static_dir` is the built frontend (STATIC_DIR); None skips its check.
    """
    problems: list[str] = []

    if static_dir is not None:
        problem = frontend_build_problem(Path(static_dir))
        if problem is not None:
            problems.append(problem)

    # A label says the data isn't production's, and the app shows it on
    # every screen. Production serves production data, so a label here is
    # a dev backend/.env deployed by mistake.
    if data_label is not None:
        problems.append(
            f"DATA_LABEL is set ({data_label!r}); production data has no label, and every "
            "screen would say it isn't production's. Unset it."
        )

    # Chats are sent to the issuer's address to sign in, and the OAuth
    # documents name it; behind a proxy the app can't know it, and the
    # protocol requires https.
    if mcp_enabled and (mcp_public_url is None or not mcp_public_url.startswith("https://")):
        problems.append(
            "MCP_ENABLED is true but MCP_PUBLIC_URL is not an https:// address; AI chats can't "
            "sign in without the app's public address (e.g. https://app.example.com)."
        )

    if not cookie_secure:
        problems.append(
            "COOKIE_SECURE is not true; the session cookie would be sent over plain HTTP."
        )

    # Migration 0002 seeds whatever SEED_USER_* held when it ran, so check
    # the stored hash, not the environment: both the configured seed email
    # and the published default one, in case the env changed after seeding.
    for email in sorted({DEFAULT_SEED_EMAIL, SEED_USER_EMAIL}):
        result = await session.exec(select(User).where(User.email == email))
        user = result.first()
        if user is not None and await run_in_threadpool(
            verify_password, DEFAULT_SEED_PASSWORD, user.password_hash
        ):
            problems.append(
                f"User {email} still accepts the published default password. Change it "
                "with `python -m foundation_backend.scripts.set_password` before serving this deployment."
            )

    return problems


BUILD_COMMAND = "Build it with `npm run build:real`, never a plain `npm run build`"


def frontend_build_problem(static_dir: Path) -> str | None:
    """Why the frontend at `static_dir` mustn't be served, or None.

    The build writes build-info.json (the foundation's Vite plugin) saying
    which API the bundle calls. A mock bundle runs MSW in the browser: the
    app would show fake data to real users and save nothing, with nothing
    saying so. A missing file means a build that predates the plugin, or
    no build at all, so it can't be told apart and is refused too.
    """
    info_file = static_dir / "build-info.json"
    try:
        info = json.loads(info_file.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return f"The frontend has no {info_file}, so it can't be told from a mock build. {BUILD_COMMAND}."
    except (OSError, ValueError):
        return f"{info_file} can't be read as JSON. {BUILD_COMMAND}."
    api = info.get("api") if isinstance(info, dict) else None
    if api != "real":
        return (
            f"The frontend in {static_dir} was built with mocks (api: {api!r} in build-info.json); "
            f"it would serve fake data. {BUILD_COMMAND}."
        )
    return None
