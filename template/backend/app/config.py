"""Single source of the database URL. Read once, from the environment."""

import os
import ssl

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://ui_foundation:ui_foundation@localhost:5432/ui_foundation",
)

# Cloud Postgres support (docs/cloud-postgres.md).
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

# dist/ is the frontend build (`npm run build:real` for a deployment; its
# build-info.json says so, app/deploy_checks.py); resolved relative to this
# file so it works regardless of the process's working directory.
STATIC_DIR: str = os.environ.get(
    "STATIC_DIR",
    os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "dist")),
)

# "production" turns on app/deploy_checks.py at startup: the app refuses to
# start with an insecure cookie or a still-default seeded account. Anything
# else (the default) is development, with no startup checks.
APP_ENV: str = os.environ.get("APP_ENV", "development")

# Which data this backend serves when it isn't production's: "dev" for a
# dev branch of the hosted database, "local" for the docker-compose one.
# Served unauthenticated at GET /api/environment, and the app names it in
# a banner on every screen (DataEnvironmentBanner: "Dev data: changes here
# don't reach production"). Unset, the default, means production data and
# no banner; APP_ENV=production refuses to start with it set.
DATA_LABEL: str | None = os.environ.get("DATA_LABEL", "").strip() or None

# Session cookie. Local dev is plain
# HTTP, so the Secure flag defaults off; a real deployment sets it.
COOKIE_SECURE: bool = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
SESSION_TTL_DAYS: int = int(os.environ.get("SESSION_TTL_DAYS", "7"))

# Failed sign-in limits (app/login_limits.py, docs/deploy.md). Over either,
# POST /auth/login answers 429 before the password is checked. Per IP needs
# uvicorn's --proxy-headers behind a proxy it trusts, or every request
# appears to come from the proxy and this becomes one global limit.
LOGIN_MAX_FAILURES_PER_IP: int = int(os.environ.get("LOGIN_MAX_FAILURES_PER_IP", "10"))
LOGIN_IP_WINDOW_SECONDS: int = int(os.environ.get("LOGIN_IP_WINDOW_SECONDS", str(15 * 60)))
LOGIN_MAX_FAILURES_PER_ACCOUNT: int = int(os.environ.get("LOGIN_MAX_FAILURES_PER_ACCOUNT", "20"))
LOGIN_ACCOUNT_WINDOW_SECONDS: int = int(os.environ.get("LOGIN_ACCOUNT_WINDOW_SECONDS", str(60 * 60)))
# A header a CDN or tunnel always overwrites with the client's address
# (CF-Connecting-IP, True-Client-IP, Fly-Client-IP), read for the per-IP key
# instead of X-Forwarded-For, which such proxies append to. Unset: ignored.
# Safe only if every request reaches the app through that proxy.
CLIENT_IP_HEADER: str | None = os.environ.get("CLIENT_IP_HEADER", "").strip() or None

# The TOTP second step (app/totp.py): how long a sign-in waits for its code
# after the password, and how many wrong codes it gets before it ends.
PENDING_LOGIN_TTL_SECONDS: int = int(os.environ.get("PENDING_LOGIN_TTL_SECONDS", str(5 * 60)))
PENDING_LOGIN_MAX_TRIES: int = int(os.environ.get("PENDING_LOGIN_MAX_TRIES", "5"))
# The name an authenticator app lists the account under.
TOTP_ISSUER: str = os.environ.get("TOTP_ISSUER", "UI Foundation")

# Error reporting (app/error_reporting.py, docs/deploy.md "Error reporting").
# A Sentry-compatible DSN (Sentry, or a self-hosted GlitchTip):
# https://<key>@<host>/<project id>. Unset, the default, errors are only logged.
ERROR_REPORTING_DSN: str | None = os.environ.get("ERROR_REPORTING_DSN", "").strip() or None
# The build a report names: the commit, set by the deploy (unset is fine).
RELEASE: str | None = os.environ.get("RELEASE", "").strip() or None
# How many reports one session may send per minute from the browser, after
# duplicates (the same error) are dropped to one a minute.
CLIENT_ERRORS_PER_MINUTE: int = int(os.environ.get("CLIENT_ERRORS_PER_MINUTE", "10"))

# AI chats reading and writing the app's records through MCP (app/routers/mcp.py,
# app/routers/oauth.py, docs/deploy.md "AI chats (MCP)"). Off by default: with
# it off, /mcp, /oauth/* and the /.well-known/oauth-* documents answer 404.
MCP_ENABLED: bool = os.environ.get("MCP_ENABLED", "false").lower() == "true"
# The app's public https origin, e.g. https://app.example.com: the OAuth
# issuer, and the base of every address the sign-in documents hand out.
# Required when MCP_ENABLED and APP_ENV=production (a proxy hides the real
# one from the app); in development the request's own is used.
MCP_PUBLIC_URL: str | None = os.environ.get("MCP_PUBLIC_URL", "").strip().rstrip("/") or None
MCP_ACCESS_TOKEN_TTL_SECONDS: int = int(os.environ.get("MCP_ACCESS_TOKEN_TTL_SECONDS", str(60 * 60)))
MCP_REFRESH_TOKEN_TTL_DAYS: int = int(os.environ.get("MCP_REFRESH_TOKEN_TTL_DAYS", "30"))
# How many AI chats may be registered at once, and how many requests one
# connection may make a minute (counted in each worker's memory).
MCP_MAX_CLIENTS: int = int(os.environ.get("MCP_MAX_CLIENTS", "50"))
MCP_REQUESTS_PER_MINUTE: int = int(os.environ.get("MCP_REQUESTS_PER_MINUTE", "120"))

# Scheduled jobs (app/jobs.py, docs/deploy.md "Scheduled jobs"): whether
# this process runs the registered jobs on their schedules. On by default
# with APP_ENV=production, off otherwise, so a dev server or a test runs a
# job only when asked (POST /api/jobs/{name}/run, or JOBS_ENABLED=true).
JOBS_ENABLED: bool = os.environ.get("JOBS_ENABLED", "true" if APP_ENV == "production" else "false").lower() == "true"
# How long a job's runs are kept in job_runs.
JOB_RUNS_KEEP_DAYS: int = int(os.environ.get("JOB_RUNS_KEEP_DAYS", "30"))

# Seeded dev user (migration 0002). Not a
# production credential; a real deployment sets its own before going live.
# The defaults are published in the README, which is why production refuses
# to start while any account still accepts DEFAULT_SEED_PASSWORD.
DEFAULT_SEED_EMAIL = "dev@example.com"
DEFAULT_SEED_PASSWORD = "dev-password-123"
SEED_USER_EMAIL: str = os.environ.get("SEED_USER_EMAIL", DEFAULT_SEED_EMAIL)
SEED_USER_PASSWORD: str = os.environ.get("SEED_USER_PASSWORD", DEFAULT_SEED_PASSWORD)
