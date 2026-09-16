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

## Open

- **Docker Desktop is not installed on this machine**, so `scripts/check-phase-8.sh`
  cannot be run to completion — everything up to its Postgres-backed final
  section passes (`backend/scripts/verify.sh`: mypy, pytest, spec
  conformance; the `src/api/gateway`/`src/api/transport` diff against
  `v1.1.0` is empty). What, why, what's needed: the exit criteria require
  `npm run verify` to pass with `VITE_API=real` against a running backend,
  which needs a live Postgres. The developer chose Docker Desktop for local
  Postgres now (docker-compose.yml is written, untested — see
  docs/phases/phase-8.md), with a cloud option (e.g. Supabase) deferred for
  later (docs/DEFERRED.md). Next session: confirm Docker Desktop is
  installed and running, then `docker compose up -d postgres` and run
  `scripts/check-phase-8.sh`. If anything in the untested
  Postgres-integration path (docker-compose healthcheck polling, the
  Alembic migration, the uvicorn boot) fails, fix it there — everything
  before it is already verified.
