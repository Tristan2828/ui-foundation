# Phase 0 — Session Zero

## What was built

- `docs/BUILD-PLAN.md` — the plan, committed verbatim with every `<pinned>`
  placeholder resolved to `4.21.0` (shadcn CLI). Also resolved: Vite
  `8.3.0`, `@playwright/test` `1.63.0` — recorded in `deps-allowlist.json`.
- `docs/OPERATOR.md` — human-facing budgets/cut-lines draft. Not given to
  the agent. Placeholder content; the operator (Tristan) should adjust the
  effort-budget and intervention sections as real sessions happen.
- `docs/DEFERRED.md` — skeleton carried over from the plan's own table.
- `AGENTS.md` (+ `CLAUDE.md` importing it via `@AGENTS.md`) — v0 from the
  plan's template, hard rules intact, each naming its enforcer.
- `deps-allowlist.json` — initial stack (React 19, Router v7, TanStack
  Query/Table, RHF+zod, openapi-fetch, Tailwind v4, shadcn tooling,
  Playwright, MSW, ajv) plus the three pinned tool versions.
- `scripts/check-deps.mjs` — reads `package.json`, fails if any declared
  dependency isn't in the allowlist. No-ops cleanly today since
  `package.json` doesn't exist until Phase 1.
- `scripts/check-phase-0.sh` — this phase's exit criterion.
- `scripts/check-phase-1.sh` — placeholder per the plan ("even a two-line
  one, so the pattern exists"). Will be filled in for real during Phase 1.
- `.claude/agents/spec-tester.md` — the isolation is declared in the
  agent's own frontmatter (not `.claude/settings.json`), per the plan's
  explicit warning that subagents don't inherit project hooks.
- `.claude/hooks/deny-impl-read.mjs` — the `PreToolUse` deny hook, written
  in Node (not bash+jq) since `jq` isn't installed on this machine and
  Node is guaranteed present.
- `src/api/gateway/.gitkeep`, `src/api/transport/.gitkeep` — placeholders
  so the deny hook has something concrete to refuse before Phase 2 exists.
- Git repo initialized locally and pushed to a new private GitHub repo:
  `Tristan2828/ui-foundation`.

## Isolation verification (spec-tester)

Confirmed at the **hook script** level, invoked directly (not through the
Task tool, since this Claude Code session had already loaded its agent
list before `.claude/agents/spec-tester.md` was created — new project
agents only register at session start):

- `file_path` under `src/api/gateway/` — denied (exit 2), tested with both
  a Windows backslash path and a forward-slash path.
- `file_path` under `src/api/transport/` — pattern present, same logic.
- `file_path` = `AGENTS.md` (unrelated file) — allowed (exit 0).

**Not yet confirmed:** an actual `Task`-launched `spec-tester` subagent
refusing the read end-to-end. Do this at the start of the Phase 1 or
Phase 2 session (whichever opens a fresh Claude Code session first) by
asking `spec-tester` directly to read `src/api/gateway/.gitkeep` and
confirming it refuses. If it succeeds, the isolation is not wired
correctly and no gateway test written by it should be trusted until
fixed.

## Deviations from the plan

- CI workflow running `verify` (listed in the Phase 0 required-tier table)
  is deferred to Phase 1, since `verify`/`verify:fast` don't exist as npm
  scripts until `package.json` exists (Phase 1 step 10). The Phase 0 exit
  criteria in the plan's prose doesn't actually require it either — only
  the summary table does — so this isn't a scope violation, just a
  sequencing note for whoever reads this next.
- Hook scripts use Node (`.mjs`) instead of bash+`jq`, since `jq` isn't
  installed in this environment and Node ships with every dependency the
  scaffold already needs. Functionally equivalent to the plan's sketch.

## What the next session needs to know

- Repo: `https://github.com/Tristan2828/ui-foundation` (private).
- Next up is Phase 1 (Scaffold and Tokens) — run it **attended**, per the
  plan's Quick Start step 7. Do not start the unattended loop yet.
- Confirm the `spec-tester` subagent refusal for real (see above) before
  Phase 2 relies on it.
- `check-phase-1.sh` currently just exits 1 with a "not implemented"
  message — replace it with the real checks as Phase 1 is built, per the
  plan's stated exit criteria for that phase.
