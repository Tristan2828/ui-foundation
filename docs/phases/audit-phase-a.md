# Audit Phase A — Registry Consumer Gaps (2026-09-18)

First of five remediation phases from the pre-reuse audit — see
`docs/AUDIT-2026-09-18.md` for the whole plan. Branch
`fix/registry-consumer-gaps`.

## What was built

- **`@storybook/addon-docs` shipped.** Phase 13 registered it in the
  shipped `.storybook/main.ts` but never added it to `starter`'s
  `devDependencies`. All three Storybook packages are now pinned `^10.6.0`
  in `registry.json` so a future major can't resolve them mismatched.
- **`src/hooks/use-mobile.ts` shipped as a `registry:file`.** Upstream
  shadcn's version (pulled live via `sidebar`) fails
  `eslint-plugin-react-hooks`' `set-state-in-effect` rule, so every
  consumer's first `verify` was red. This repo has had the fix since
  Phase 3; it was never shipped. Same lesson as Phase 7's button/badge:
  **any locally patched primitive or hook must ship explicitly.**
- **Consumers now type-check `tests/` and `e2e/`.** The playbook's Step 0
  `verify:fast` includes `tsc -p tsconfig.test.json`.
- **Consumer-safe `AGENTS.md`.** "Scope and Stopping" is task-based; the
  phase discipline moved to a "Working in the ui-foundation Repo Itself"
  section gated on `docs/BUILD-PLAN.md` existing. The deps rule no longer
  claims a PreToolUse hook (none exists — only `check-deps` in `verify`).
- **`deps-allowlist.json`:** four duplicate entries and the unused
  `openapi-fetch` (dropped in Phase 2) removed.
- **`consume-test.sh --install-only` is much stronger:** it now also runs
  `tsc -p tsconfig.test.json` and `eslint .`, and checks the Phase 10–11
  auth files landed. Both new failure classes above are now caught by the
  fast check, not only by the hour-long dogfood.

## Deviations

- **The first attempt at the tsconfig fix was prose** ("add a reference
  to `tsconfig.test.json` in your root `tsconfig.json`"). The first
  dogfood run passed, but its transcript showed the fresh agent copied
  Step 0's npm scripts verbatim and never touched `tsconfig.json`. Moved
  the check into the pasted `verify:fast` script instead — an instruction
  in a paragraph is optional to an agent; a command in a script it
  copies is not.
- **`use-mobile.ts` was not in the audit.** The first dogfood's agent
  reported patching it itself as an "out-of-scope fix". Read the dogfood
  agent's final report every time — that's where this surfaced.

## What the next session needs to know

- Dogfood evidence: run 1 (before the two fixes above) PASS, 64 vitest +
  71 Playwright; run 2 result recorded in the PR.
- After merge: tag `v1.8.0`, then `scripts/consume-test.sh --install-only
  v1.8.0`, update the README's latest tag.
- Next is **Phase B — auth robustness** (`docs/AUDIT-2026-09-18.md`).
