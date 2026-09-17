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

- **Docker Desktop is installed on this machine but cannot start: "Virtualization
  support not detected."** `scripts/check-phase-8.sh` cannot be run to
  completion as a result — everything up to its Postgres-backed final
  section passes (`backend/scripts/verify.sh`: mypy, pytest, spec
  conformance; the `src/api/gateway`/`src/api/transport` diff against
  `v1.1.0` is empty). What, why, what's needed: the exit criteria require
  `npm run verify` to pass with `VITE_API=real` against a running backend,
  which needs a live Postgres. Docker Desktop was installed and launched,
  but its backend (`com.docker.backend`) can't reach a Linux engine —
  `wsl --list --verbose` reports **zero installed distributions** (not
  even Docker's own internal `docker-desktop`/`docker-desktop-data`), and
  Docker Desktop itself reports virtualization isn't detected. This is a
  BIOS/firmware (VT-x/AMD-V) or Windows-feature-activation issue, not a
  Docker or project misconfiguration — the fix is almost certainly a
  restart (Windows feature activation and BIOS virtualization changes both
  typically require one to take effect), which the developer explicitly
  declined for now. Two ways to get a real Postgres running without Docker
  were discussed and declined for now, in case a future session picks
  this up before a reboot happens: (1) a portable/zip EnterpriseDB
  Postgres binary run standalone via `initdb`/`pg_ctl`, no installer or
  virtualization needed; (2) pull the deferred cloud-Postgres task
  (`docs/DEFERRED.md`) forward instead of waiting on Docker. Next session:
  ask whether a restart has happened; if so, `docker compose up -d
  postgres` then `scripts/check-phase-8.sh` as originally planned. If not,
  offer the two alternatives above again rather than re-diagnosing from
  scratch.
