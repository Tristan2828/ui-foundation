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

The original build, the 2026-09-18 audit and the first real app (the Game
List) are done. Since 2026-09-20 foundation work runs on **two tracks with
different rules** ([`DEFERRED.md`](DEFERRED.md) "Direction" is the source of
truth; `ARCHITECTURE.md`'s "Focus" repeats it for agents):

- **Design language grows freely** — tokens, semantic tones, `Badge` and
  other variant styles, cell patterns, typography, density, themes. No
  second app or second use required. You review it by looking at results
  (the running app, the per-column options pages); every addition still
  ships with axe contrast coverage in both themes.
- **Structure stays need-driven** — composites, new registry items,
  backend, auth, infrastructure. Parts of it were built before any app
  existed (auth with self-service registration and per-user ownership, the
  backend's cloud/deploy hardening, Storybook) and were judged over-built
  for this focus. They stay; don't let them grow.

## Saying no to structure work

- **The test for new structure:** has a real app hit the need? If not,
  it's a row in [`DEFERRED.md`](DEFERRED.md) with a revisit condition, not
  code. An agent proposing "while we're here…" structure is the
  building-forever failure mode. Design-language work doesn't take this
  test.
- **A consuming app's finding counts as a real need.** The Game List rows
  in `DEFERRED.md` (drift check, `setFilters`/`applyView`, `pinLastColumn`,
  binary MSW overrides) each point at a working implementation in that app
  — port it, don't redesign it. Rows whose revisit condition is "next time
  X is touched" won't be picked up by an agent on its own; to do one now,
  hand it over as the session's named task.
- **Build it against the app that needs it.** A read-only table entity is
  still unbuilt (the entity playbook always builds full CRUD) — design it
  from the first real read-only screen, not in advance.
- **Before an app is reachable by strangers:** login rate limiting and
  error reporting (`DEFERRED.md`, `deploy.md`). Not before.

## Decisions that are yours

- **New dependencies.** An agent that needs one writes the case in
  `docs/BLOCKERS.md` and stops. Decide in `deps-allowlist.json` terms (npm
  side; the Python side has no allowlist enforcer yet), outside the
  agent's session. Expect auto-mode to refuse the install itself — you run
  it.
- **Secrets.** Database passwords, tokens and API keys never go in a chat
  with an agent. Write them to the gitignored `backend/.env` yourself.
- **Merging.** `main` requires no review and no passing checks (removed
  2026-09-28; force-pushes and deletion are still blocked), so you can
  push to it directly or merge a PR yourself. Releasing is automatic
  (`ARCHITECTURE.md` "Releasing"): the `registry` workflow install-tests
  a PR's head SHA when a shipped path changed, and the `tag` workflow
  cuts the next patch tag on every push to `main`. A direct push skips
  the install test, so changes to shipped paths are safer as a PR. Nobody tags by hand except a
  deliberate minor or major bump.

## When a session goes sideways

- **Work declared complete without a green gate:** don't accept it. Point
  it back at `npm run verify` (plus `scripts/check-backend-postgres.sh` for
  backend changes; the `registry` workflow covers anything `registry.json`
  ships). A Fresh UI Build PASS only counts after checking its transcript
  used the version you meant to test (`phases/audit-phase-a.md`).
- **A gate is permanently red** (e.g. a check that only passes on one
  OS — the reason the pixel screenshot baselines were retired): fix the gate before anything else — a gate that's
  always red teaches the agent to ignore it.
- **The agent disables or works around a check to get green:** revert
  that change. `AGENTS.md`'s rule is that the check is right.
- **The same failure keeps recurring across sessions:** read the relevant
  `docs/phases/*.md` and `docs/BLOCKERS.md` before another attempt — it
  usually needs a decision from you, not more agent time.
