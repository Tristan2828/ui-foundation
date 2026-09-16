"""FastAPI entrypoint. Mounts the built SPA (Phase 8 item 8 — single
deployable, same-origin, no CORS) and the two entity routers.
"""

import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import STATIC_DIR
from app.errors import register_error_handlers
from app.routers import categories, widgets

app = FastAPI(title="UI Foundation Demo API — Widgets", version="1.0.0")
register_error_handlers(app)
app.include_router(categories.router, prefix="/api")
app.include_router(widgets.router, prefix="/api")

if os.path.isdir(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="spa")
