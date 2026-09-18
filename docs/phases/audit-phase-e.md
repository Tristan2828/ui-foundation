# Audit Phase E — Pruning (2026-09-18)

Last of five remediation phases — see `docs/AUDIT-2026-09-18.md`. Branch
`chore/prune-foundation`. Registry-shipped files changed, so this needs a
tag after merge.

## What was removed or consolidated

- **One copy of the entity playbook.** `docs/add-an-entity.md` is the only
  one; `.claude/skills/new-entity/SKILL.md` now just tells the agent to
  read and execute it. The copy embedded in `BUILD-PLAN.md` (and its
  embedded `AGENTS.md` template, which claimed a Stop hook that never
  existed) are gone.
- **`BUILD-PLAN.md` is marked historical, not moved.** About 40 files —
  mostly source comments, many shipped — cite it; moving it would break
  those or churn all of them for no behavior change. A banner says what's
  stale, and the new **`docs/ARCHITECTURE.md`** (~100 lines: layers,
  registry rules, a gates table saying which check each kind of change
  needs, and the lessons from this audit) is what a session reads now.
  `AGENTS.md`'s foundation-repo section keys on `ARCHITECTURE.md`.
- **12 `check-phase-*.sh` scripts retired** (last present at `v1.10.0`).
  Phase 8's became `scripts/check-backend-postgres.sh` (now chaining
  `npm run verify` instead of `check-phase-5 → … → 1`) and Phase 12's
  `scripts/check-cloud-postgres.sh`. The rest re-asserted one-time phase
  facts; `verify`, `consume-test.sh` and `tests/registry.test.ts` cover the
  invariants that still matter.
- **`openapi.yaml` freeze dropped** (`check-openapi-freeze.mjs`, the
  sha256 file). It protected a demo spec; every intended change needed a
  ceremonial "unfreeze". Mock conformance and the backend spec diff
  already catch drift.
- **Storybook out of `starter`.** Consumers no longer install Storybook,
  the 12 stories, or generate screenshot baselines in Step 0 (which drops
  three Step 0 scripts). In this repo Storybook stays as a dev tool;
  screenshots now cover only the patched primitives (button, badge),
  under a separate `playwright.storybook.config.ts` that `npm run verify`
  runs second. 20 baseline PNGs deleted.

## What was added (the reason it's safe to remove the above)

- **`e2e/a11y.spec.ts`** — axe in light and dark mode on the real screens:
  every sidebar page (discovered at runtime, so new entities are covered
  automatically), the entity form, login and register. Before this, *all*
  axe checks ran against isolated primitive stories; nothing checked the
  composites or screens. It found three real violations on its first run:
  - **critical:** the combobox's icon-only trigger (and clear button) had
    no accessible name — upstream shadcn; patched and now shipped as a
    `registry:file`, like button/badge.
  - `/login`, `/register` had no `<main>` landmark or `<h1>`.
  - the row-actions `<th>` was empty (now an `sr-only` "Actions").
- Negative control: removing the combobox label fails the form's a11y
  tests with `button-name` in both themes.

## Deviations

- **The audit said "archive `BUILD-PLAN.md`"; it stays in place** with a
  banner (reason above).
- **Storybook narrowing needed coverage first** — see "What was added".
  Narrowing without it would have removed the repo's only accessibility
  checks.

## What the next session needs to know

- After merge: tag, `consume-test.sh --install-only <tag>`, README tag.
- The audit is complete. Future work starts from `docs/ARCHITECTURE.md`
  and `docs/DEFERRED.md`.
