# Release 2.0.0 — First Stable (2026-09-18)

The last change before building real apps on the foundation. Branch
`release/2.0.0`; tagged `v2.0.0` after merge. What 2.0 contains is in
`CHANGELOG.md`; this note is the why and what's next.

## Decisions (the developer's)

- **Versioning:** keep all history and the `v1.x` tags; call this `v2.0.0`,
  the first stable release. Squashing history or reusing the `v1.0.0` name
  were rejected — nothing destructive, and honest semver (the audit
  changed what apps get in breaking ways).
- **Database default:** local Docker Postgres for development (no account,
  no secrets); Supabase documented as the cloud choice, set up per app
  when it has real data. The Supabase to-do was removed from `BLOCKERS.md`
  — it never blocked anything.
- **AI-agnostic, not skill-only:** `AGENTS.md` — the file Codex, Cursor,
  Copilot, Gemini CLI and Claude all read — gains "Adding an Entity",
  pointing at `docs/add-an-entity.md`. The playbook, plan template and
  docs describe it as plain instructions for any tool; Claude Code's
  `/new-entity` stays as a shortcut to the same file.

## The honest limit

Only Claude Code gets the *enforced* version of "gateway tests come from
the spec": its `spec-tester` subagent's hook blocks reading the gateway.
Other tools get the same rule as an instruction (write the tests from
`openapi.yaml` before the gateway exists, without opening it). Step 3 and
`AGENTS.md` say exactly that, rather than claiming enforcement everywhere.

## Evidence

- `consume-test.sh` gained `AGENT_PROMPT` to override the instruction.
  The Fresh UI Build for this release used a **plain request with no skill
  and no hint** — "Add an Invoice entity to this app." — to test what a
  non-Claude tool relies on: finding the playbook through `AGENTS.md`.
  Result in the PR.
- Non-Claude tools themselves weren't run (no Codex/Cursor/Gemini CLI on
  this machine); the plain-prompt run is the closest available check.

## What the next session needs to know

- The next thing is a real app (the Notion game list), starting from a
  `docs/entities/game.md` plan — not more foundation work
  (`docs/ARCHITECTURE.md` "Focus").
