# Phase 7 — Dogfood

## What was built

- **`scripts/consume-test.sh`'s full dogfood mode** (previously stubbed
  "not implemented, Phase 7 scope"). `consume-test.sh <ref> <EntityName>`
  now: scaffolds a fresh Vite app, installs `<ref>#starter`, runs
  `npx msw init public/ --save` and `git init` (+ an initial commit), then
  launches a genuinely fresh `claude -p "/new-entity <EntityName>"` process
  (`--dangerously-skip-permissions`, no `--max-turns` — see Deviations) in
  that directory with a `logs/consume-test/<ref>-<entity>-<timestamp>/`
  transcript, and finally runs `npm run verify` in the result. Exits
  non-zero on any failure; the transcript and verify log are always kept
  for review, and an app snapshot is kept too on any failure (deleted on
  success).
- **`scripts/check-phase-7.sh`** — cumulative with `check-phase-6.sh`,
  then asserts HEAD is tagged and pushed and runs
  `consume-test.sh <tag> Invoice`.
- **`registry.json`'s `starter` item grew from 6 files to the entire
  working pipeline**: `openapi.yaml`, the MSW mocks (`browser.ts`,
  `server.ts`, `data.ts`, `handlers.ts`, `e2e-hooks.ts`), the gateway
  (`errors.ts`, `widgets.ts`, `categories.ts`), `main.tsx`/`App.tsx`/
  `theme-provider.tsx`/`home.tsx`/`kitchen-sink.tsx`, the full
  `routes/widgets/*` reference implementation, the test suite
  (`tests/gateway/*`, `tests/mocks/conformance.test.ts`,
  `tests/widget-schema.test.ts`), the e2e suite (`global.d.ts`,
  `msw-contract.spec.ts`, `shell.spec.ts`, `smoke.spec.ts`,
  `widget-form.spec.ts`, `widgets-table.spec.ts`), and
  `vitest.config.ts`/`playwright.config.ts`/`tsconfig.test.json`. Also
  gained `button.tsx` and `badge.tsx` as explicit files (see Deviations)
  and the matching `dependencies`/`devDependencies`
  (react-hook-form, @hookform/resolvers, zod, msw, vitest,
  @playwright/test, @axe-core/playwright, openapi-typescript, ajv,
  openapi-response-validator, js-yaml) and `registryDependencies`
  (badge→removed, calendar, card, combobox, dialog, input, popover,
  select, separator, textarea — the shadcn primitives those files import
  that weren't already covered).
- **`theme` item** gained `src/index.css` (the two-layer-aware root
  stylesheet — shadcn's own generated one never imports `theme.css`) and
  `tw-animate-css`/`@fontsource-variable/geist` as dependencies.
- **`conventions` item** gained `scripts/check-deps.mjs` (the enforcer for
  the `deps-allowlist.json` it already shipped, but the script itself
  never had) and `eslint-plugin-check-file`/`@tanstack/eslint-plugin-query`
  as devDependencies (`eslint.config.js` imports both; neither ships with
  a stock Vite scaffold).
- **`docs/add-an-entity.md` and `.claude/skills/new-entity/SKILL.md`**
  gained a **Step 0** covering the one-time bootstrap a fresh app needs
  that the registry structurally cannot ship: the `gen:api`/`verify:fast`/
  `verify` npm scripts (registry.json has no script-merge mechanism),
  `npx msw init public/ --save` (a generated artifact, not a source file),
  and generating this machine's own dark-mode screenshot baselines (see
  Deviations — never shipped, generated locally instead).
- **`AGENTS.md`**'s "Full Plan" section made conditional — it pointed
  every consuming app at `docs/BUILD-PLAN.md`, a file that will never
  exist there.
- Tagged **`v1.1.0`** (moved twice as the dogfood runs found real bugs —
  see Deviations; the tag on `main` is the version that actually passes
  `check-phase-7.sh` end to end, not the first attempt).

## Deviations from the plan

Five real, load-bearing bugs were found by actually running the dogfood
loop — none of them visible from reading the registry or from
`registry validate`, which passed against every broken version along the
way. In order found:

1. **Git Bash mangles a leading `/` before `claude` ever sees it.**
   `claude -p "/new-entity Invoice"` arrived as the literal string
   `"C:/Program Files/Git/new-entity Invoice"` — MSYS path conversion
   rewriting what looks like a Unix absolute path in argv before handing
   it to a native Windows binary. The first real dogfood run's fresh agent
   diagnosed this itself and correctly refused to hand-replicate the
   skill's steps (`disable-model-invocation: true` working as designed)
   rather than guess — but the run was wasted on a test-harness bug, not a
   foundation one. Fixed with `MSYS_NO_PATHCONV=1` on the `claude`
   invocation in `consume-test.sh`.
2. **The registry shipped composites and boundary types, but nothing a
   `/new-entity` session could actually build against.** The second real
   run (slash command now working) explored the installed app
   thoroughly, found no `openapi.yaml`, no `gen:api` script, no test
   tooling installed, no MSW scaffolding, and no `widgets` reference
   implementation to copy from despite `AGENTS.md` pointing at it — wrote
   a precise `docs/BLOCKERS.md` and stopped, exactly per its own
   instructions. This was a real, user-approved scope decision (ship the
   full pipeline, not just infra) — see the registry.json changes above.
3. **`registryDependencies` always fetches live upstream content —
   pinning the shadcn CLI version does not pin component source.** The
   third run built Invoice correctly (39/41 tests) but failed two
   `axe` color-contrast checks on the kitchen-sink page, on markup the
   agent never touched. Diffing every installed shadcn primitive against
   this repo's own copies found the cause: `button.tsx` and `badge.tsx`
   were hand-patched in Phase 3/5 to fix a real WCAG AA failure in
   shadcn's stock destructive variant (tinted bg/text, ~4.0:1) by
   switching to a solid fill — a fix silently lost on every fresh install,
   because `"button"`/`"badge"` in `registryDependencies` re-fetches the
   original upstream source every time, regardless of what's committed
   here. Fixed by moving both to `starter`'s own `files` list
   (`registry:file`, sourced from this repo), the same pattern already
   used for the custom composites. No other installed primitive had
   diverged the same way (checked by diffing all of them against a fresh
   install; `field.tsx`/`sonner.tsx` differ only by an inert `"use client"`
   pragma, harmless in Vite).
4. **Binary files cannot be shipped through a private GitHub shadcn
   registry at all — this is a `gh` CLI bug, not a registry mistake.** The
   fourth run built Invoice correctly again and passed every `axe` check
   (confirming the button/badge fix), failing only on 12 missing
   dark-mode screenshot baselines. Shipping the 24 committed PNGs as
   `registry:file` entries seemed like the obvious fix and validated
   structurally — but every install then failed outright:
   `RegistrySourceFileError: ... The GitHub request failed`. Reproduced
   directly: shadcn's CLI fetches file content via
   `gh api ... -H "Accept: application/vnd.github.raw+json"`, and `gh api`
   corrupts binary responses under that header
   (`transform: short source buffer` / `invalid UTF-8 string`,
   reproduced against this repo's own PNGs, independent of file size —
   confirmed the bytes are fine via both `gh api`'s default base64
   contents endpoint and an authenticated raw-content fetch). This isn't
   fixable from the registry side. It's also not the right fix even if it
   worked — Phase 3 already established that screenshot rendering is
   machine/OS-specific, so shipping this machine's PNGs into a consumer's
   repo was never going to be reliable there either. Reverted the PNG
   files; `docs/add-an-entity.md`/`SKILL.md`'s Step 0 now runs
   `npx playwright test e2e/shell.spec.ts --update-snapshots` once,
   generalizing the same "establish baselines on the machine that runs
   them" approach this repo's own Phase 3 used for CI.
5. **`node -p` colorizes a bare numeric result with ANSI codes in this
   environment, even through command substitution** — `check-phase-6.sh`'s
   `ITEM_COUNT=$(node -p "require('./registry.json').items.length")`
   captured `"\x1b[33m3\x1b[39m"`, not `"3"`, so
   `[ "$ITEM_COUNT" = "3" ]` failed even though the count was correct.
   Only surfaced when running `check-phase-7.sh` itself (which calls
   `check-phase-6.sh`), not by the direct `consume-test.sh` calls used
   for the four runs above. `node -p` does not colorize a top-level
   *string* result (`tools.vite`/`tools.shadcn` elsewhere in these
   scripts were unaffected) — fixed by wrapping the read in `String(...)`.

Two more deviations, neither a bug:

- **No `--max-turns` flag exists in this Claude Code CLI version
  (2.1.273)**, which `docs/BUILD-PLAN.md`'s `run-phase.sh` reference
  assumed. Used `timeout 3600` (wall-clock) as the stand-in.
- **`--dangerously-skip-permissions`, not `--permission-mode acceptEdits`**,
  for the dogfood agent. `acceptEdits` still prompts for Bash (npm
  install, `gen:api`, vitest, Playwright), which hangs forever headless
  with nothing to answer it. `$APP` is a disposable temp directory the
  fresh agent has never touched before, not this repo, so a full bypass
  is scoped to something safe to bypass on.

## Environment notes (not foundation bugs, but shaped this session)

- This machine is memory-constrained (16 GB) for what a dogfood run needs
  (a full Vite+Playwright+Chromium cycle, sometimes with the fresh agent
  additionally starting its own `npm run dev` to self-check). Two runs of
  the *combined* `check-phase-7.sh` gate (local `verify` + install-only +
  full dogfood, back to back) were OOM-killed by the OS before finishing,
  once at 3.3 GB free and once at 3.9 GB free. Both times the underlying
  mechanism had already passed via the lighter, direct `consume-test.sh`
  call — resolved by asking the user to close a few apps (freed to
  5.3 GB), after which the full gate passed clean on the very next try.
  If this recurs on future runs, treat a `killed` status as "retry after
  freeing memory," not as a foundation failure.
- Orphaned `/tmp/tmp.*` scaffold directories (each with a full
  `node_modules`) accumulate when a run is killed rather than exiting
  normally, since `trap ... EXIT` cleanup doesn't run on `SIGKILL`. Swept
  manually a few times this session; nothing currently automates it.

## Verification

`npm run verify` (this repo, local): **PASS** (33 vitest, 30 Playwright —
unchanged; this phase touched no application code, only the registry
manifest, the entity playbook, `AGENTS.md`, and `scripts/`).
`scripts/check-phase-7.sh` run standalone, end to end, no manual
intervention beyond freeing memory once: **PASS**. CI green on `main` at
every commit this phase (confirmed via `gh run watch`, not assumed).
`v1.1.0` points at the commit that passed.

The passing dogfood run's own numbers: **54 vitest tests**, **41
Playwright tests** (10 named states across `invoice-table.spec.ts` /
`invoice-form.spec.ts`, the new nav entry, all `axe` checks including dark
mode, all 12 kitchen-sink dark-mode screenshots, plus the pre-existing
widgets/shell/smoke suite) — all green, zero edits to any file the
registry itself ships (confirmed by diffing the installed app's git
history: the only diff outside `src/routes/invoice/`,
`src/api/gateway/invoice.ts`, `src/mocks/invoice.ts`,
`tests/gateway/invoice.test.ts`, `e2e/invoice-*.spec.ts`, and
`openapi.yaml` was a 2-line addition to `app-shell.tsx`'s own
`NAV_ITEMS` array — exactly what step 7 of the playbook asks for).

## What the next session needs to know

- **This is the project's definition of done, and it has now been met.**
  `docs/BUILD-PLAN.md`'s Scope Ceiling names `check-phase-7.sh` passing as
  the finish line for the whole build; it passes, clean, on `v1.1.0`.
- **Phase 8 (Backend) is the only phase left**, and it's explicitly
  optional and deliberately last — the UI is fully functional on MSW
  without it. Nothing about Phase 7's work blocks or requires it.
- **If Phase 8 (or anything else) touches `registry.json` again**, rerun
  `consume-test.sh --install-only <ref>` *and* a full
  `consume-test.sh <ref> <SomeNewEntity>` dogfood pass before trusting it
  — `registry validate` alone passed against every one of the five broken
  versions found this phase.
- **Any future hand-patch to a shadcn primitive** (accessibility, or
  anything else) must ship as an explicit `registry:file` in `starter`,
  never rely on `registryDependencies` — that always fetches live
  upstream content, silently discarding local patches.
- **Never ship a binary file via `registry:file` from a private GitHub
  repo** — it cannot work (`gh` CLI limitation, not a shadcn or
  registry.json issue). Anything that must be machine-generated
  (screenshot baselines, `schema.d.ts`, `public/mockServiceWorker.js`)
  belongs in the entity playbook's Step 0 bootstrap, not the registry.
- `docs/BLOCKERS.md` is still empty (still resolved from Phase 6). Nothing
  from this phase added to it — every issue found had a real fix landed
  in the same session.
- The Notion tracker (`Frontend Design System`, page id
  `3dd2b1f9153e8047a2b9de3867b13195`) was updated at the end of this
  session: Phase 7 row flipped to done, a new Session Log entry added.
