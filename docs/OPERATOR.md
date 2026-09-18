# Operator Notes (human-facing)

Judgment calls that are yours, not an agent's: what's worth building, when
to say no, how to respond when a session goes sideways. The agent-facing
side — how the repo works and which checks a change needs — is
[`ARCHITECTURE.md`](ARCHITECTURE.md). Status is [`STATUS.md`](STATUS.md);
the build history is [`phases/`](phases).

## What the foundation is for (right now)

Simple apps that **display tables of database rows**, sometimes with
editing. That's the whole near-term focus (also in `ARCHITECTURE.md`'s
"Focus" section, so agents see it too).

The original build and the 2026-09-18 audit are done. **The next thing to
build is a real app, not more foundation.** Parts of the foundation were
built before any app existed — auth with self-service registration and
per-user ownership, the backend's cloud/deploy hardening, Storybook — and
were judged over-built for this focus. They stay; don't let them grow.

## Saying no to foundation work

- **The test for any new foundation capability:** is a real app blocked
  without it, today? If not, it's a row in [`DEFERRED.md`](DEFERRED.md) with
  a revisit condition, not code. An agent proposing "while we're here…"
  improvements to the foundation is the building-forever failure mode.
- **Build it against the app that needs it.** The likely first one is a
  read-only table entity (`/new-entity` always builds full CRUD today) —
  design it from your first real read-only screen, not in advance.
- **Before an app is reachable by strangers:** login rate limiting and
  error reporting (`DEFERRED.md`, `deploy.md`). Not before.

## Decisions that are yours

- **New dependencies.** An agent that needs one writes the case in
  `docs/BLOCKERS.md` and stops. Decide in `deps-allowlist.json` terms (npm
  side; the Python side has no allowlist enforcer yet), outside the
  agent's session. Expect auto-mode to refuse the install itself — you run
  it.
- **Secrets.** Database passwords, tokens and API keys never go in a chat
  with an agent. Write them to the gitignored `backend/.env` yourself. Open
  item: applying the migrations to your Supabase project
  (`docs/BLOCKERS.md`).
- **Merging and tagging.** `main` is protected (CI `verify` +
  `verify-backend` + a review). Agents open PRs; you merge; the agent tags
  and install-tests the merge commit afterwards.

## When a session goes sideways

- **Work declared complete without a green gate:** don't accept it. Point
  it back at `npm run verify` (plus `scripts/check-backend-postgres.sh` for
  backend changes, and `scripts/consume-test.sh <sha>` for anything
  `registry.json` ships). A dogfood PASS only counts after checking its
  transcript used the version you meant to test (`phases/audit-phase-a.md`).
- **A gate is permanently red** (e.g. a screenshot baseline that only
  exists for Windows): fix the gate before anything else — a gate that's
  always red teaches the agent to ignore it.
- **The agent disables or works around a check to get green:** revert
  that change. `AGENTS.md`'s rule is that the check is right.
- **The same failure keeps recurring across sessions:** read the relevant
  `docs/phases/*.md` and `docs/BLOCKERS.md` before another attempt — it
  usually needs a decision from you, not more agent time.
