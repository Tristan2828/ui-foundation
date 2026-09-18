"""FastAPI entrypoint. Mounts the built SPA (Phase 8 item 8 — single
deployable, same-origin, no CORS; see app/spa.py for the client-route
fallback) and the two entity routers.
"""

import os

from fastapi import FastAPI

from app.config import STATIC_DIR
from app.errors import register_error_handlers
from app.routers import auth, categories, widgets
from app.spa import SPAStaticFiles

app = FastAPI(title="UI Foundation Demo API — Widgets", version="1.0.0")
register_error_handlers(app)
app.include_router(auth.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(widgets.router, prefix="/api")

if os.path.isdir(STATIC_DIR):
    app.mount("/", SPAStaticFiles(directory=STATIC_DIR, html=True), name="spa")
