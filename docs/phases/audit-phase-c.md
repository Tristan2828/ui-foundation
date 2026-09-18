# Audit Phase C — Backend Correctness and Deploy Safety (2026-09-18)

Third of five remediation phases — see `docs/AUDIT-2026-09-18.md`. Branch
`fix/backend-deploy-safety`. No registry-shipped path changed (backend,
docs, `package.json` scripts, `.env.real`), so no tag — same as Phases 8
and 12.

## What was built

- **Widget create/update 500'd on real Postgres — confirmed, then fixed.**
  `Widget.available_from` used SQLModel's tz-naive ORM mapping (same bug
  class as Phase 10's `Session.expires_at`). Added a widget POST + PATCH
  to `scripts/check-phase-8.sh` first; it failed with asyncpg's "can't
  subtract offset-naive and offset-aware datetimes", then passed after the
  model got an explicit `DateTime(timezone=True)` column. No migration: the
  DDL was already `timestamptz`; only the ORM's view was wrong.
- **PBKDF2 off the event loop.** `hash_password`/`verify_password` run via
  `run_in_threadpool` in register/login.
- **`APP_ENV=production` startup guard** (`backend/app/deploy_checks.py`,
  run from the FastAPI lifespan). Refuses to start if `COOKIE_SECURE` isn't
  true or any account (default or configured seed email) still verifies
  against the published default password — checked against the stored
  hash, since the seed happened at migration time. Development runs no
  startup query at all.
- **`backend/scripts/set_password.py`** — the fix the guard asks for;
  getpass on a terminal, stdin otherwise; ends the user's sessions.
- **`npm run build:real`** (`vite build --mode real`, `.env.real`).
- **`docs/deploy.md`** — the ordered checklist; README links it.

## Deviations

- **Found a bigger deploy bug than the audit listed: a plain
  `npm run build` ships the mocks.** `import.meta.env.VITE_API` is baked in
  at build time, so the documented deploy path (`npm run build`, then serve
  `dist/` from FastAPI) would serve MSW mock data in production. Confirmed
  by building (the MSW `browser` chunk is in `dist/`); `build:real` leaves
  it out entirely. Caught while writing the deploy doc, which first
  repeated the wrong claim.
- **`getpass` on Windows reads the console, not stdin** — piping into the
  first version of `set_password.py` hung forever. Scripts meant for
  deploy automation must work non-interactively.

## What the next session needs to know

- Verified by hand against the local Docker Postgres: production refuses
  with both problems; after `set_password.py`, only the cookie problem;
  with `COOKIE_SECURE=true`, starts. (Local seed password restored.)
- Still deferred, and now named in `docs/deploy.md`: login rate limiting,
  error reporting.
- Next is **Phase D — consumer lifecycle docs + data-table behavior**.
