"""FastAPI entrypoint. Mounts the built SPA (Phase 8 item 8 — single
deployable, same-origin, no CORS; see foundation_backend.spa for the
client-route fallback), the foundation's sign-in, environment, client-error
and OAuth routes (the ui-foundation-backend package), the entity routers,
and the package's scheduled jobs, Web Push and reminders, and MCP routes
(foundation_backend.jobs, .push, .reminders, .routers.mcp; #230), with
this app's MCP entities (app/mcp_entities.py).
"""

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlmodel.ext.asyncio.session import AsyncSession

from app import mcp_entities  # noqa: F401  (registers the app's MCP entities)
from app.config import APP_ENV, COOKIE_SECURE, DATA_LABEL, JOBS_ENABLED, MCP_ENABLED, MCP_PUBLIC_URL, PUSH_ENABLED, STATIC_DIR
from app.db import engine
from app.errors import register_error_handlers
from app.routers import widget_categories, widgets
from app.spa import SPAStaticFiles
from foundation_backend.deploy_checks import production_problems
from foundation_backend import jobs, push, reminders
from foundation_backend.routers import auth, client_errors, environment, jobs as jobs_router, mcp, oauth, push as push_router


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Every environment: push on without its extra or keys would start
    # fine and send nothing, silently.
    push_problem = push.config_problem()
    if push_problem is not None:
        raise RuntimeError(f"Refusing to start (see docs/deploy.md \"Reminders (Web Push)\"): {push_problem}")
    # APP_ENV=production only — development starts with no database query.
    if APP_ENV == "production":
        async with AsyncSession(engine) as session:
            problems = await production_problems(
                session,
                cookie_secure=COOKIE_SECURE,
                data_label=DATA_LABEL,
                mcp_enabled=MCP_ENABLED,
                mcp_public_url=MCP_PUBLIC_URL,
                static_dir=STATIC_DIR,
            )
        if problems:
            raise RuntimeError(
                "Refusing to start with APP_ENV=production (see docs/deploy.md):\n- "
                + "\n- ".join(problems)
            )
    # Scheduled jobs (foundation_backend.jobs): registered by the modules
    # that define them, imported before this runs, or here.
    if PUSH_ENABLED:
        reminders.register()
    schedules = jobs.start_jobs(engine) if JOBS_ENABLED else []
    try:
        yield
    finally:
        await jobs.stop_jobs(schedules)


app = FastAPI(title="UI Foundation Demo API — Widgets", version="1.0.0", lifespan=lifespan)
register_error_handlers(app)
# The foundation's sign-in routes (foundation_backend.routers.auth). The
# template lets people make their own account, so it includes
# register_router too; an app that doesn't leaves it out, with
# /auth/register out of its openapi.yaml and LoginRoute registerPath={null}.
app.include_router(auth.router, prefix="/api")
app.include_router(auth.register_router, prefix="/api")
app.include_router(client_errors.router, prefix="/api")
app.include_router(environment.router, prefix="/api")
app.include_router(jobs_router.router, prefix="/api")
app.include_router(push_router.router, prefix="/api")
app.include_router(widget_categories.router, prefix="/api")
app.include_router(widgets.router, prefix="/api")
# AI chats (MCP_ENABLED; 404 otherwise). At the root, not under /api: the
# addresses are the ones the OAuth documents and chats expect.
app.include_router(oauth.router)
app.include_router(mcp.router)

if os.path.isdir(STATIC_DIR):
    app.mount("/", SPAStaticFiles(directory=STATIC_DIR, html=True), name="spa")
