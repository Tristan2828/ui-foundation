# Deploying

The shape this foundation is built for: one process. FastAPI serves the API
under `/api` and the built SPA at `/` (`backend/app/spa.py`), so the app is
same-origin, needs no CORS, and uses a plain session cookie. Database setup
is in [`cloud-postgres.md`](cloud-postgres.md).

## Checklist

Do these in order. Steps 3–4 are enforced: with `APP_ENV=production` the
backend refuses to start until they're done (`backend/app/deploy_checks.py`).

1. **Build the frontend with `npm run build:real`** — never plain
   `npm run build`. `VITE_API` is baked in at build time (`src/main.tsx`),
   so a plain build ships MSW and the deployed app serves mock data instead
   of calling the backend. `build:real` uses Vite's `real` mode
   (`.env.real`), which leaves MSW out of the bundle entirely. FastAPI
   serves `dist/` from `STATIC_DIR`.
2. **Migrate:** `cd backend && .venv/Scripts/python -m alembic upgrade head`
   against the production `DATABASE_URL`. On a fresh database, set
   `SEED_USER_EMAIL`/`SEED_USER_PASSWORD` to real values *before* this
   runs — migration `0002` seeds that account once, at migration time.
3. **Change any published default password.** If the seed account was
   created with the default (`dev-password-123`, printed in the README):
   `cd backend && .venv/Scripts/python scripts/set_password.py <email>`
   (prompts twice; or pipe the password in twice). This also ends that
   account's sessions.
4. **Serve over HTTPS and set `COOKIE_SECURE=true`**, so the session cookie
   is never sent over plain HTTP.
5. **Set `APP_ENV=production`.** Start the app; if it refuses, the error
   lists exactly what's left.

## Known gaps before exposing it publicly

Tracked in [`DEFERRED.md`](DEFERRED.md) — fine for a personal or internal
deployment, not for an open one:

- **No login rate limiting.** With self-service registration on, anyone can
  create accounts and guess passwords at full speed. Put the app behind
  something that rate-limits `/api/auth/*`, or behind an access proxy.
- **No error reporting.** Server errors go to uvicorn's log only.
