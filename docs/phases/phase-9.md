# Phase 9 — Storybook

## What was built

- **Storybook 10.6.0** (`storybook` + `@storybook/react-vite`, pinned in
  `deps-allowlist.json`) replaces the kitchen-sink route as the project's
  component browser — a **full replacement**, not additive: the developer
  explicitly chose this over a smaller internal-only swap after being
  shown the tradeoff (kitchen-sink was load-bearing in `registry.json`,
  the permanent Phase 3/5 checks, and `consume-test.sh`, not just the dev
  route).
  - `.storybook/main.ts` / `.storybook/preview.ts` — Vite builder with the
    `@` alias and `tailwindcss()` plugin restated (Storybook's Vite
    builder does not read the project's own `vite.config.ts`), a
    hand-rolled `theme` toolbar global toggling the `dark` class on
    `document.documentElement` (mirrors `next-themes`' `attribute="class"`
    behavior without pulling the full provider tree into story rendering).
  - Twelve `src/components/ui/*.stories.tsx` files, one per primitive,
    reproducing each retired kitchen-sink `<Section>` 1:1 as a single
    `AllVariants` CSF story titled `ui/<Name>`.
  - `e2e/storybook-visual.spec.ts` replaces the "kitchen sink dark mode
    screenshots" / "kitchen sink has zero axe violations [in dark mode]"
    tests that were in `e2e/shell.spec.ts` — one screenshot baseline and
    two axe passes (light + dark) *per primitive* now, not one page-wide
    pass, so a regression in any single primitive fails independently.
- **Two new dependencies only** — deliberately not `@storybook/addon-a11y`
  (a11y coverage reuses the existing `@axe-core/playwright` dependency
  against the built Storybook instead), not `@storybook/addon-themes` (the
  toolbar toggle is ~10 lines, not worth a package), not a static-file
  server (see below), not Chromatic (external paid service, inconsistent
  with this repo's self-hosted-only tooling).
- **Registry contract**: `registry.json`'s `starter` item drops
  `src/routes/kitchen-sink.tsx` and gains all 14 new files plus the two
  new `devDependencies`. `scripts/consume-test.sh`'s expected-file list
  and `.claude/skills/new-entity/SKILL.md` / `docs/add-an-entity.md`'s
  Step 0 bootstrap (now 6 scripts, not 3) were updated to match.
- **Permanent regression scripts rewritten, not left broken**:
  `scripts/check-phase-3.sh` and `scripts/check-phase-5.sh` (which
  directly asserted kitchen-sink's existence and content) now assert the
  Storybook equivalents. A new `scripts/check-phase-9.sh` is this phase's
  own exit criterion, and also re-verifies the check-phase-3/5.sh rewrite
  didn't silently break itself.

## Deviations from plan

1. **Visual-regression mechanism changed mid-implementation.** The plan
   called for `storybook dev --ci` as the Playwright `webServer` (zero new
   dependencies). In practice this was **flaky under Playwright's parallel
   workers** — `storybook dev`'s on-demand Vite compilation races when
   several workers request different stories for the first time
   concurrently; individual reruns always passed, the full parallel suite
   didn't. Switched to `storybook build` + `vite preview --outDir
   storybook-static` (Vite is already a dependency — no new one added),
   mirroring the exact build-then-preview shape the main app's own
   `webServer` entry already used. Zero flakes after the switch.
2. **axe's default ruleset produced false positives against isolated
   story previews** — `landmark-one-main`, `page-has-heading-one`, and
   `region` all fired because `iframe.html` has no `<main>`/`<h1>`/
   landmark wrapper by design (it's a component preview, not a page). The
   old kitchen-sink axe test never hit this because it ran against the
   full `/kitchen-sink` page, which had both. Fixed by disabling those
   three rules specifically for story-preview analysis
   (`e2e/storybook-visual.spec.ts`'s `analyzeStory` helper), not by
   weakening axe generally elsewhere.
3. **Found and fixed a real, unrelated bug while running `npm run
   verify`**: `eslint.config.js`'s `globalIgnores` only excluded `dist`,
   not the new `storybook-static/` build output — ESLint was linting
   Storybook's own minified manager bundle and failing on rules it
   doesn't know about. Fixed by adding `storybook-static` to
   `globalIgnores` (this file ships via the `conventions` registry item,
   so consuming apps get the fix too).
4. **Full-page vs. element-scoped screenshots**: the old kitchen-sink
   baselines were clipped to each `<section data-kitchen>` element; the
   new ones are full-iframe-viewport screenshots (`expect(page)`, not
   `expect(locator)`) since a story's iframe *is* just that component —
   there's no surrounding page to crop out. Baselines are mostly dark
   background around a small rendered component as a result; this is
   expected, not a regression.
5. **Pushed with only win32 baselines committed, same gap Phase 3 already
   solved once** — CI's Linux runner has no `*-chromium-linux.png`
   baseline for any of the 12 new Storybook stories, so `verify.yml`
   failed on the pushed commit (all 12 screenshot tests: "snapshot doesn't
   exist," writing actual). Same fix as Phase 3
   (`docs/phases/phase-3.md`): `verify.yml`'s existing
   `actions/upload-artifact@v4` (`if: failure()`) step had already
   uploaded the 12 actual PNGs; downloaded that artifact
   (`gh run download <id> -n playwright-test-results`) and committed them
   renamed to the `*-chromium-linux.png` convention, same as every other
   baseline in this repo. Worth remembering for next time: **generating
   baselines on win32 only is never sufficient — always expect a Linux
   round-trip through CI for any new screenshot baseline**, not just at
   Phase 3 when the pattern was first established.

## What the next session needs to know

- **Registry-shipped content changed** (unlike Phase 8) — per this
  project's own tagging convention, this phase gets tagged once pushed
  and dogfood-verified (target: `v1.2.0`).
- The dogfood re-run (`scripts/consume-test.sh <ref> <Entity>`) needs the
  work pushed to GitHub first — `shadcn add` fetches from the real repo,
  not local disk. Run against `main` after both fix commits: **PASS** — a
  fresh agent with no memory of this repo built a full `Ticket` CRUD
  entity from `starter#main` alone, and `npm run verify` passed all 62
  tests (12 Storybook screenshot + 24 axe + the new entity's own 14 +
  Widgets' existing 12), confirming the Step 0 bootstrap script additions
  (`storybook`/`build-storybook`/`preview-storybook`) and the new registry
  files work correctly from a blank install.
- Baselines in `e2e/storybook-visual.spec.ts-snapshots/` were generated on
  win32, same caveat as every prior phase's baselines (not CI's Linux
  container — see `docs/BLOCKERS.md`).
- `docs/DEFERRED.md`'s "Real auth" row now has its stated revisit
  condition met (backend language was chosen in Phase 8) — noted here,
  not acted on; out of scope for this phase.
