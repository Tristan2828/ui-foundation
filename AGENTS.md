# Working in the ui-foundation repo

This repo ships two things under one version: the npm package
**`@tristan2828/ui-foundation`** (`packages/ui-foundation/`), which holds
everything apps share, and **the template** (`template/`), the app every
new app starts as. Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) at
the start of every session, then [`docs/DEFERRED.md`](docs/DEFERRED.md) (the
direction and the queue) and any open item in
[`docs/BLOCKERS.md`](docs/BLOCKERS.md).

## The rules

- **`template/` is an app.** Everything in the package's app rules
  ([`packages/ui-foundation/conventions/AGENTS.md`](packages/ui-foundation/conventions/AGENTS.md),
  synced into `template/AGENTS.md`) applies there exactly as in any app:
  the Hard Rules, the required states, kebab-case, the entity playbook.
- **The package follows the same Hard Rules from the inside.** Semantic
  tokens only, shadcn before hand-rolling (`npx shadcn@4.21.0 add <name>`
  run inside `packages/ui-foundation/`), no fetch outside `src/api/transport/`,
  and only the gateway modules may call it. `auth-provider.tsx` is the only
  file that knows how auth works. No hand-written API types: the package's
  come from `openapi/foundation.yaml` (`npm run gen:api` in the package).
  Each is enforced by the package's own lint, tsc and codegen diff.
- **Everything the package exports is a contract with every app.** Prefer
  additive changes: a new optional prop, a new export. A breaking change
  (a removed or renamed export, a changed prop, a changed synced file an
  app relies on) needs a major version bump in
  `packages/ui-foundation/package.json`, a `CHANGELOG.md` entry and upgrade
  steps in `docs/consuming.md`. Then stop and let the developer decide
  (`docs/OPERATOR.md` "Versions").
- **Conventions are edited in the package, never in the template.**
  `template/AGENTS.md`'s foundation block, `template/docs/foundation/` and
  the template's `.claude/`/`.codex/` agent files are written by `sync`.
  Edit `packages/ui-foundation/conventions/`, run `npm run sync`, and
  commit both. `verify` fails if they differ.
- **Two tracks** ([`docs/DEFERRED.md`](docs/DEFERRED.md) "Direction"):
  design language (tokens, tones, variants, cell patterns, typography,
  density) grows freely, with axe contrast coverage in both themes.
  Structure (composites, props, exports, backend, auth, infrastructure) is
  built against a real app's need, not in advance.
- **Dependencies:** the package's allowlist is
  `packages/ui-foundation/deps-allowlist.json`, the template's (every new
  app's) is `template/deps-allowlist.json`. Never add a dependency that
  isn't listed. Write the case in `docs/BLOCKERS.md` and stop. Pinned tool
  versions are in the template's `tools`; never `@latest`.
- **Never hand-tag or hand-publish.** A merge stages the release; the developer approves it
  (`docs/ARCHITECTURE.md` "Releasing"). Open a PR for any change to the
  package or the template, so the install test runs before it ships.

## Scope and stopping

- Do the task you were given and nothing beyond it. Out-of-scope ideas go
  in `docs/DEFERRED.md`, never in code.
- A task is done when `npm run verify` (root) passes: the package's gate,
  then the template's against the package as built. Backend changes also
  need `npm run verify:backend`, and `template/scripts/check-backend-postgres.sh`
  if Docker is available. The table in `docs/ARCHITECTURE.md` "Verification"
  says what each gate covers.
- If verify can't pass without breaking a rule, an instruction conflicts
  with current library docs, or the change would exceed the task's scope:
  write `docs/BLOCKERS.md` (what, why, what you tried) and stop.
- A new check counts only after a negative control: break the thing, watch
  it fail, restore it.

## At the end of a session

There are no per-session log files. Whatever the next session needs to
know goes where it will be read:

- **What changed and why**, including anything that deviated from the task
  and what was found along the way: the PR description or commit message.
- **What's left:** `docs/DEFERRED.md` (remove rows that shipped, add new
  ones with a revisit condition) and `docs/BLOCKERS.md`.
- **What apps must do to upgrade**, for a notable release: `CHANGELOG.md`.
- **Anything that changes how the repo works:** `docs/ARCHITECTURE.md`.

## Commands

```bash
npm install                 # installs every workspace and builds the package
npm run dev                 # builds the package, then the template on :5173 (mock API)
npm run verify:fast         # package + template gates, no browsers
npm run verify              # everything, including Storybook and Playwright
npm run sync                # rebuild the package and re-sync conventions into template/
npm run verify:backend      # the template's reference backend (mypy, pytest, spec conformance)
bash scripts/consume-test.sh --install-only   # a fresh app from the packed tarball (commit first)
```

After changing package source, `npm run build` (or any of the above)
before running the template's own tools directly. The template imports the
package's built `dist/`, the same way every app does.
