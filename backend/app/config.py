"""Single source of the database URL. Read once, from the environment."""

import os
import ssl

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://ui_foundation:ui_foundation@localhost:5432/ui_foundation",
)

# Cloud Postgres support (see docs/BUILD-PLAN.md Phase 12, docs/cloud-postgres.md).
# asyncpg's own SSL flag — postgresql+asyncpg:// doesn't parse libpq's
# sslmode= query param, so this can't be folded into DATABASE_URL itself.
DATABASE_SSL: bool = os.environ.get("DATABASE_SSL", "false").lower() == "true"

# Some managed providers (confirmed on Supabase) serve their Postgres TLS
# cert from a private CA that isn't in the OS trust store, unlike their own
# HTTPS endpoints — connecting with just DATABASE_SSL=true then fails
# certificate verification. Point this at a local PEM file (that CA's root
# cert) to verify against it explicitly instead of the system trust store.
DATABASE_SSL_CA_FILE: str | None = os.environ.get("DATABASE_SSL_CA_FILE") or None


def database_connect_args() -> dict[str, object]:
    """asyncpg connect_args for DATABASE_URL — shared by app/db.py and
    migrations/env.py, which each construct their own engine."""
    if not DATABASE_SSL:
        return {}
    if DATABASE_SSL_CA_FILE:
        return {"ssl": ssl.create_default_context(cafile=DATABASE_SSL_CA_FILE)}
    return {"ssl": True}

# dist/ is the frontend build (`npm run build`); resolved relative to this
# file so it works regardless of the process's working directory.
STATIC_DIR: str = os.environ.get(
    "STATIC_DIR",
    os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "dist")),
)

# Session cookie (see docs/BUILD-PLAN.md Phase 10). Local dev is plain
# HTTP, so the Secure flag defaults off; a real deployment sets it.
COOKIE_SECURE: bool = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
SESSION_TTL_DAYS: int = int(os.environ.get("SESSION_TTL_DAYS", "7"))

# Seeded dev user (migration 0002 — see docs/BUILD-PLAN.md Phase 10). Not a
# production credential; a real deployment sets its own before going live.
SEED_USER_EMAIL: str = os.environ.get("SEED_USER_EMAIL", "dev@example.com")
SEED_USER_PASSWORD: str = os.environ.get("SEED_USER_PASSWORD", "dev-password-123")
