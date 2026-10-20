"""FastAPI entrypoint. Mounts the built SPA (Phase 8 item 8 — single
deployable, same-origin, no CORS; see app/spa.py for the client-route
fallback), the entity routers, GET /api/environment, the scheduled jobs
(app/jobs.py, app/routers/jobs.py), Web Push and reminders (app/push.py,
app/reminders.py, app/routers/push.py) and the MCP/OAuth routes
(app/routers/mcp.py, oauth.py).
"""

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlmodel.ext.asyncio.session import AsyncSession

from app import jobs, push, reminders
from app.config import APP_ENV, COOKIE_SECURE, DATA_LABEL, JOBS_ENABLED, MCP_ENABLED, MCP_PUBLIC_URL, PUSH_ENABLED, STATIC_DIR
from app.db import engine
from app.deploy_checks import production_problems
from app.errors import register_error_handlers
from app.routers import auth, client_errors, environment, jobs as jobs_router, mcp, oauth, push as push_router, widget_categories, widgets
from app.spa import SPAStaticFiles


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
    # Scheduled jobs (app/jobs.py): registered by the modules that define
    # them, imported before this runs, or here.
    if PUSH_ENABLED:
        reminders.register()
    schedules = jobs.start_jobs(engine) if JOBS_ENABLED else []
    try:
        yield
    finally:
        await jobs.stop_jobs(schedules)


app = FastAPI(title="UI Foundation Demo API — Widgets", version="1.0.0", lifespan=lifespan)
register_error_handlers(app)
app.include_router(auth.router, prefix="/api")
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
