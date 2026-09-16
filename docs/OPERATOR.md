# Operator Notes (human-facing — do not give this file to the agent)

This file holds the judgment calls that don't belong in `docs/BUILD-PLAN.md`:
effort budgets, when to cut scope, and how to respond when an agent session
misbehaves. `docs/BUILD-PLAN.md` is written so an agent can self-assess "done"
from a script; this file is written so you can self-assess "worth it" from a
calendar, which an agent has no way to reason about.

Draft — fill in / adjust the placeholders below as the project actually
unfolds.

## Effort Budget

- No fixed deadline. Treat each phase as "however long one attended session
  runs" for Phases 1-2, then move toward the unattended loop
  (`scripts/run-phase.sh`) once Phases 1-2 have shown which failure modes are
  real.
- If a phase's check script hasn't gone green after ~3 attended sessions,
  stop and re-read the phase's `docs/phases/phase-N.md` reports plus any
  `docs/BLOCKERS.md` entries before continuing — that's a signal the phase
  or the plan needs a human decision, not more agent attempts.

## Scope Cut Lines

- The scope ceiling in the plan (six field types, three composites, three
  registry items) is the actual budget, not a suggestion to renegotiate
  mid-build. If a `docs/BLOCKERS.md` entry argues for widening it, that's
  the conversation to have here, not something to approve inside a session.
- Phase 8 (backend) is optional and explicitly last. Don't pull it forward
  even if the UI phases feel "done enough to want real data" — Phase 7
  (dogfood/consume-test) is the actual definition of done, and it doesn't
  need a backend.

## Intervention Playbook

- **Agent asks to add a dependency not on the allowlist:** read the
  `docs/BLOCKERS.md` case. Decide here, in `deps-allowlist.json` terms —
  don't approve it inside the agent's session.
- **Agent declares a phase complete without a green check script:** don't
  accept it. Point it back at `scripts/check-phase-N.sh` and, if it keeps
  happening, that's the signal to add the `phase-verifier` subagent (Phase 0
  optional tier).
- **Agent tries to skip ahead to a later phase "to make things easier
  later":** stop it. Note the impulse in this file if it recurs — that's a
  sign a phase boundary is drawn wrong, not that the agent should be
  allowed through it.
- **Screenshot / gate checks are permanently red:** this teaches the agent
  to ignore the gate. Fix the gate (see the container-generated baseline
  warning in Phase 3) before doing anything else.

## Progress Tracking

Live status is mirrored to Notion:
https://app.notion.com/p/Frontend-Design-System-3dd2b1f9153e8047a2b9de3867b13195

`docs/phases/phase-N.md` is the durable, in-repo record; Notion is the
at-a-glance view.
