# Blockers

Open items that couldn't be resolved within a session's scope, or that need
a human decision made in `docs/OPERATOR.md` terms. Resolved items are
removed once fixed — this file is a queue, not a log.

<!-- Resolved 2026-09-16: `spec-tester` isolation confirmed working in a
later session. The agent is now discoverable and invocable via the Agent
tool in this harness (unlike during Phases 0-2). Probed by asking it to
Read src/api/gateway/index.ts and src/api/transport/index.ts; both were
refused by the deny-impl-read.mjs PreToolUse hook before any file contents
were returned:
"PreToolUse:Read hook error: [...deny-impl-read.mjs]: spec-tester may not
read implementation files. Denied: <path>. Write tests from openapi.yaml
and contracts.ts only."
No further action needed; the temporal-isolation workaround from Phase 2
can be retired in favor of the real subagent for future entity work. -->

<!-- Resolved 2026-09-16: Docker Desktop's "Virtualization support not
detected" error is fixed (developer resolved it on their end, no restart
needed after all — BIOS/firmware setting, not a pending Windows feature
activation). `scripts/check-phase-8.sh` then ran to completion, surfacing
and fixing three more real bugs along the way (see docs/phases/phase-8.md
Deviations): postgres:18's changed volume-mount convention, generic
sa.Enum silently ignoring create_type=False (needed the postgres-specific
ENUM class), and the Alembic seed data passing raw strings where asyncpg's
direct parameter binding needs real datetime/Decimal objects. Also
replaced check-phase-8.sh's chain onto check-phase-6/7.sh (which demands a
freshly-tagged HEAD and a full fresh-agent dogfood rebuild) with a cheaper,
more honest check-phase-5.sh + explicit "no registry-shipped path changed
since v1.1.0" assertion, since Phase 8 touches no registry-shipped file.
`check-phase-8.sh`: PASS, including the real Postgres-backed
`VITE_API=real` Playwright run. Phase 8 is done. -->

## Open

### Supabase setup for local dev (needs the developer — credentials)

**What:** Supabase became the default dev database in PR #8
(`backend/.env.example`, `backend/scripts/dev.sh`), but this machine's
`backend/.env` still points at the local Docker Postgres, and Supabase's
database has not had migration `0003` (per-user widget ownership + lowercase
emails, PR #7) applied yet.

**Why it's here:** it needs the Supabase database password, which an agent
must not type or store. Only the developer can do these steps.

**Steps** (full walkthrough, including the two gotchas, in
[`docs/cloud-postgres.md`](cloud-postgres.md)):

1. In `backend/.env`, replace `DATABASE_URL` with the Supabase **pooler**
   connection string on **session-mode port 5432** (not 6543, not the
   IPv6-only `db.<ref>.supabase.co` host), and set `DATABASE_SSL=true`.
   `backend/.env.example` shows the exact shape.
2. Download Supabase's root CA (dashboard: **Project Settings → Database →
   SSL Configuration**) to `backend/certs/supabase-root-ca.pem` (gitignored),
   and set `DATABASE_SSL_CA_FILE=./certs/supabase-root-ca.pem`.
3. Run `bash backend/scripts/dev.sh`. It should print `using hosted Postgres
   at <pooler host>` (not "starting Docker Compose"), then apply migration
   `0003` via `alembic upgrade head`.
4. Run `VITE_API=real npm run dev` and log in at http://localhost:5173 as
   the seeded dev user. Existing widgets were assigned to that user by `0003`.

**Done when:** `dev.sh` reports the pooler host, `alembic current` against
Supabase shows `0003 (head)`, and the app loads widgets through it. Remove
this entry then. (`scripts/check-backend-postgres.sh` is unaffected either way — it
always forces the local Docker database.)
