# Phase 1 — Scaffold and Tokens

## What was built

- Vite + React 19 + TypeScript scaffold, merged into the existing repo
  (scaffolded to a scratch dir first and copied in, since `create-vite`
  refuses to run non-interactively in a non-empty directory — this repo
  already had Phase 0's docs/scripts/agent config in it).
- Tailwind v4 via `@tailwindcss/vite`, `@` path alias in `vite.config.ts`,
  `tsconfig.json`, and `tsconfig.app.json`.
- `npx shadcn@4.21.0 init -t vite -b base -p nova -y` — Base UI primitives,
  "Nova" style preset. Recorded as `shadcnInit` in `deps-allowlist.json` so
  future `add` commands don't need to re-derive these flags.
- `button`, `card`, `input` components added.
- `src/styles/theme.css` — the two-layer token structure the plan asks
  for. shadcn's Nova preset generates only a flat semantic layer (its
  standard behavior — see the Decision Ledger: "shadcn ships layer 2
  only"); I split its generated oklch values out into a Layer 1
  primitives block and rewrote Layer 2 to reference them via `var()`.
  Values are unchanged from shadcn's defaults — Phase 5 is where the
  actual palette gets chosen; this phase only had to prove the structure
  holds a dark variant, which it does (`.dark` block remaps Layer 2 only).
- Token lint rule in `eslint.config.js`: `no-restricted-syntax` on JSX
  `className` literals matching the Tailwind-palette-class regex, and on
  hex literals inside `style` prop objects. Verified it fails on a
  `bg-blue-500` fixture and that the rest of the scaffold (including
  shadcn's own generated `button.tsx`) passes clean.
- `e2e/smoke.spec.ts` + `playwright.config.ts` — visits `/`, asserts the
  shadcn `<Button>` on the placeholder home route is visible.
- `vitest.config.ts` — `passWithNoTests: true` and `e2e/**` excluded from
  vitest's own discovery (Playwright specs live there; vitest's default
  include glob was picking them up and crashing on `test()`).
- `verify:fast` / `verify` npm scripts, wired exactly as the plan's
  template describes. `gen:api` is a no-op placeholder until Phase 2
  introduces `openapi.yaml` — `git diff --exit-code -- src/api/schema.d.ts`
  is a no-op against a path that doesn't exist yet, so the pipeline is
  inert but not broken.
- `.github/workflows/verify.yml` — `npm ci`, install Playwright browsers,
  `npm run verify`, on push to `main` and on PRs.
- `deps-allowlist.json` updated to match what `npm install` and
  `shadcn init` actually pulled in (`@base-ui/react`, `cn`,
  `tw-animate-css`, `@fontsource-variable/geist`, `shadcn` itself as a
  pinned runtime dependency) — my first draft had guessed `clsx` +
  `tailwind-merge`, which shadcn no longer uses.

## Deviations from the plan

- The stylelint half of the Phase 5 token rule ("hex literals in CSS
  outside theme.css") was **not** added yet. There is currently no raw CSS
  file in the project besides `theme.css` (exempt) and `index.css` (uses
  `@apply` with semantic classes, no hex). Adding a whole new linter and
  config for zero current violations is exactly the premature scaffolding
  the plan's Scope Ceiling warns against. Revisit in Phase 5 if raw CSS
  files with hardcoded colors actually show up.
- `App.tsx` is a placeholder (`<Button>UI Foundation</Button>` centered on
  the page) — explicitly temporary, replaced by the real app shell in
  Phase 3. Default Vite boilerplate (`App.css`, `src/assets/`, logos) was
  deleted rather than kept, since it hardcodes hex colors the token lint
  rule would immediately flag.

## Verification

`npm run verify` passes: `tsc --noEmit`, `eslint . --max-warnings 0`,
`check-deps.mjs`, `vitest run` (no-op), `playwright test` (1 passed).
`scripts/check-phase-1.sh`: **PASS**.

First CI run failed: Playwright's `webServer` ran `vite preview` with no
prior build step, so there was no `dist/` to serve and the health check
timed out after 60s. My local run had passed only because I'd manually run
`npm run build` earlier in the session. Fixed by making the `webServer`
command self-contained (`npm run build && npm run preview -- --port 4173`)
so `verify` doesn't depend on step ordering outside the script. Confirmed
by deleting `dist/` locally and re-running, then confirmed green on CI
(`gh run watch`).

## What the next session needs to know

- Next up: Phase 2 (Contract and Boundary) — no backend required. This is
  where `openapi.yaml` gets written by hand for the `Widgets` domain
  **including all six Phase 4 field types**, since the spec freezes at the
  end of this phase.
- Confirm the `spec-tester` subagent's isolation end-to-end in this fresh
  session (open item carried over from `docs/phases/phase-0.md`) before
  relying on it to write Phase 2's gateway tests.
- When Phase 3 gets to dark-mode screenshot baselines: generate them
  inside the pinned Playwright Docker container, not on this Windows dev
  machine — the plan's warning about macOS vs. Linux CI rasterization
  mismatches applies equally to Windows vs. Linux.
