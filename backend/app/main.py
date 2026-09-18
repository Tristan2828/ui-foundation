"""FastAPI entrypoint. Mounts the built SPA (Phase 8 item 8 — single
deployable, same-origin, no CORS; see app/spa.py for the client-route
fallback) and the two entity routers.
"""

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import APP_ENV, COOKIE_SECURE, STATIC_DIR
from app.db import engine
from app.deploy_checks import production_problems
from app.errors import register_error_handlers
from app.routers import auth, categories, widgets
from app.spa import SPAStaticFiles


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # APP_ENV=production only — development starts with no database query.
    if APP_ENV == "production":
        async with AsyncSession(engine) as session:
            problems = await production_problems(session, cookie_secure=COOKIE_SECURE)
        if problems:
            raise RuntimeError(
                "Refusing to start with APP_ENV=production (see docs/deploy.md):\n- "
                + "\n- ".join(problems)
            )
    yield


app = FastAPI(title="UI Foundation Demo API — Widgets", version="1.0.0", lifespan=lifespan)
register_error_handlers(app)
app.include_router(auth.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(widgets.router, prefix="/api")

if os.path.isdir(STATIC_DIR):
    app.mount("/", SPAStaticFiles(directory=STATIC_DIR, html=True), name="spa")
