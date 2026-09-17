"""Single source of the database URL. Read once, from the environment."""

import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://ui_foundation:ui_foundation@localhost:5432/ui_foundation",
)

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
