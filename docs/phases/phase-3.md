# Phase 3 — App Shell

## What was built

- `npx shadcn@4.21.0 add sidebar sonner skeleton empty spinner` — pulled in
  those five plus their registry dependencies (`separator`, `tooltip`,
  `sheet`, `use-mobile`) not already installed. `button` and `input` were
  skipped as already-identical.
- `src/components/app/app-shell.tsx` — the shell: `SidebarProvider` +
  `Sidebar` (icon-collapsible, nav from a `NAV_ITEMS` array, active state
  computed from `useLocation()` since Base UI's `render`-prop merge doesn't
  wire `NavLink`'s own active styling into `SidebarMenuButton`'s
  `data-active`) + `SidebarInset` (header with `SidebarTrigger` and a
  `next-themes`-backed dark-mode toggle, content region rendering
  `<Outlet />`). Wrapped in `TooltipProvider` (required by the installed
  `tooltip`/sidebar-tooltip primitive) and mounts `<Toaster />` once.
- `src/components/app/route-error-boundary.tsx` — route-level error
  boundary using `useRouteError()`/`isRouteErrorResponse()`, rendered via
  the `<Empty>` primitive. Wired as `errorElement` on each leaf route
  (`index`, `kitchen-sink`) rather than on the shared layout route, so a
  crash in one page's content doesn't take the sidebar/header down with it.
- `src/auth/` — `auth-context.ts` (the `AuthContext` + hardcoded
  `FAKE_USER`), `auth-provider.tsx` (`AuthProvider`, consuming the
  context), `use-auth.ts` (`useAuth()` hook, and re-exports `AuthProvider`
  — see Deviations for why). Split across three files instead of the
  plan's two because `eslint-plugin-react-refresh` flags a file that
  exports both a component and a non-component (context/hook) — a real
  fast-refresh hazard, not a false positive like the one already
  suppressed for `src/components/ui/**`.
- `src/components/theme-provider.tsx` — thin wrapper around `next-themes`,
  mounted in `main.tsx` with `attribute="class"` so it drives the `.dark`
  class `src/styles/theme.css` already keys off.
- `src/routes/home.tsx`, `src/routes/kitchen-sink.tsx` — home is a stub
  welcome card (Phase 4 replaces it with the Widgets table). Kitchen sink
  has one `<Section>` (→ `<section data-kitchen="name">`) per installed
  `src/components/ui/*` primitive — button (all variants + disabled), card,
  input (default + disabled), sidebar (self-contained demo instance, own
  `SidebarProvider`, `collapsible="none"`), sheet, tooltip, separator
  (horizontal + vertical), skeleton, spinner, empty, and toast (sonner
  trigger). 11 sections total.
- `src/App.tsx` — now a `createBrowserRouter` with `AppShell` as the root
  layout route and two children (`index` → home, `kitchen-sink`), each with
  its own `errorElement`.
- `e2e/shell.spec.ts` — nav test (visits every `NAV_ENTRIES` path directly
  and via sidebar link clicks, asserting real page content is visible and
  the error boundary's text is absent), 11 dark-mode screenshot tests (one
  `toHaveScreenshot` per kitchen-sink section, toggled into dark mode
  first), and one zero-violations `AxeBuilder` scan of `/kitchen-sink`.
- `e2e/smoke.spec.ts` — updated for the new home content (button text
  changed from the Phase 1 placeholder "UI Foundation" to "Get started").
- `scripts/check-phase-3.sh` — cumulative with `check-phase-2.sh`; asserts
  the shell/auth/kitchen-sink files exist, every primitive has a
  `<Section name="...">` call site, `shell.spec.ts` actually tests the
  error boundary/axe/screenshots (not just that the file exists), and that
  the 11 baseline PNGs are both present and `git`-tracked.
- `deps-allowlist.json` — added `sonner` and `next-themes` (see
  Deviations). `react-router` and `@axe-core/playwright` were already
  present in the allowlist from Phase 0/2 planning but not yet installed;
  installed them this phase.

## Deviations from the plan

- **`sonner` and `next-themes` were not in `deps-allowlist.json`.** Running
  the plan's own literal Phase 3 step 1 (`npx shadcn add ... sonner ...`)
  pulled in `sonner` (the toast library the component wraps) and
  `next-themes` (sonner's own dependency, used for theme-aware toast
  styling) as npm packages, neither pre-listed. Per the Hard Rule this
  should mean `docs/BLOCKERS.md` and stop — but this was an attended
  session, so I asked the operator directly (same resolution Phase 2 used
  for `js-yaml`) rather than halting over a dependency the plan itself
  names. Approved; both added to the allowlist.
- **`next-themes` ended up doing double duty.** Rather than build a
  separate ad-hoc dark-mode mechanism, the shell's toggle and
  `theme-provider.tsx` both use the `next-themes` that `sonner` already
  required — one dependency, not two, and it drives the same `.dark` class
  `theme.css` was already keyed on since Phase 1.
- **`src/hooks/use-mobile.ts` (shadcn-generated, via `sidebar`'s registry
  dependencies) failed lint out of the box** —
  `react-hooks/set-state-in-effect` flagged its effect calling `setState`
  synchronously on mount. Fixed by computing the initial state lazily in
  `useState`'s initializer instead of in the effect body, leaving the
  effect to only subscribe to the media-query `change` event (a legitimate
  external-system subscription, not a render-triggered side effect). This
  is CLI-installed code already meant to be owned/edited, not a hand-rolled
  component.
- **Added `--destructive-foreground` to `theme.css` and switched the
  `destructive` button variant to a solid fill.** The axe scan on
  `/kitchen-sink` caught a real WCAG AA failure: the shadcn-shipped
  `destructive` variant (`bg-destructive/10 text-destructive`, a tinted
  "soft" button) computed to a 4.0:1 contrast ratio against its own tinted
  background, short of the 4.5:1 minimum for normal text. Verified
  independently (`red-500 #e7000b` vs `white` = 4.77:1, vs `black` = 4.40:1)
  before choosing a fix. `destructive` was the only button variant without
  a `-foreground` token — every other variant (`primary`, `secondary`,
  `accent`) already pairs a solid background with a dedicated foreground
  token, so this closes what looks like a gap in the original token set
  rather than introducing a new design decision, and reuses the existing
  `--red-500`/`--red-400` primitives (still no raw hex). This is a Phase 5
  "palette" question strictly speaking (theme.css's own header comment
  says Phase 5 is "where the primitive palette itself is deliberately
  chosen"), but the axe gate is a hard exit criterion for *this* phase, and
  the fix is one token add plus a one-line variant change, not a palette
  pass — flagging for Phase 5 to review with the rest of the palette
  regardless. **Not independently verified:** dark mode's `--destructive`
  (`red-400`) against `--destructive-foreground` (`white`) — the axe scan
  only runs against the light theme; the color-contrast rule was not
  re-checked after toggling dark mode.
- **Fixed a real (not introduced) flake in `e2e/msw-contract.spec.ts`.**
  Under 8 parallel Playwright workers (this machine's default), the test
  intermittently failed with a raw HTML response instead of MSW's JSON —
  100% reproducible at `--workers=8`, 100% passing at `--workers=1`.
  Root cause: it waited on `navigator.serviceWorker.ready`, which resolves
  once the worker is *activated*, but doesn't guarantee the current page is
  already that worker's *controller* — the actual precondition for its
  fetches to be intercepted. Changed the wait to
  `page.waitForFunction(() => navigator.serviceWorker.controller !== null)`.
  Verified with 15 repeated runs at `--workers=8` (previously flaky),
  0 failures after the fix. This test predates Phase 3 (written in Phase 2)
  and wasn't in this phase's step list, but a `npm run verify` that
  intermittently fails for reasons unrelated to the phase being checked
  breaks every later phase's own check script, which is cumulative on
  `npm run verify` passing — in scope to fix, not defer.
- **Screenshot baselines are win32, not Linux — see `docs/BLOCKERS.md`.**
  No `docker` or WSL distribution is available in this session's
  environment, so the plan's prescribed
  `docker run ... mcr.microsoft.com/playwright:v4.21.0 ...` command
  couldn't be run. The 11 baseline PNGs are genuinely committed and the
  screenshot mechanism is proven working locally, but CI
  (`ubuntu-latest`) will look for differently-named
  (`*-linux.png`) files that don't exist yet and is expected to fail on
  first run. Logged in `docs/BLOCKERS.md` with three concrete regeneration
  options for whoever has Docker/Linux access.
- **`SidebarInset` (from the `sidebar` registry item) already renders a
  `<main>`.** The first app-shell draft wrapped `<Outlet />` in its own
  `<main>` inside `SidebarInset`, producing an invalid nested-`<main>`
  structure that axe's `landmark-one-main` rule flagged as *zero* main
  landmarks (not two) — nested `main` elements don't count. Changed the
  content wrapper to a plain `<div>`.
- **Neither route had a real `<h1>`.** axe's `page-has-heading-one` rule
  caught this too. Kitchen sink got a visible `<h1>Kitchen Sink</h1>`
  (it had no page title at all before); home got a `sr-only` `<h1>Home</h1>`
  since the visible `Card`'s title already reads "UI Foundation" and a
  second visible "Home" heading would be redundant.
- **Sidebar content (header/nav/footer) wasn't contained by any landmark.**
  axe's `region` rule flagged the sidebar's title, nav links, and user-name
  footer as outside any landmark — `Sidebar`'s own root `<div>` doesn't
  carry a `role` or forward arbitrary props in its desktop render branch.
  Fixed by wrapping the `<Sidebar>` element itself in `<nav aria-label="…">`
  in both `app-shell.tsx` (`"Primary"`) and the kitchen-sink demo instance
  (`"Sidebar demo"`, distinct label to satisfy landmark-uniqueness).
  Confirmed this doesn't break Sidebar's own CSS: the only `peer`/
  `peer-data-[variant=inset]` relationship in `sidebar.tsx` is scoped to
  `variant="inset"`, which neither usage sets.

## Verification

`npm run verify` passes: 28 vitest tests (unchanged from Phase 2) + 17
Playwright tests — `smoke.spec.ts` (1, updated for the new home content),
`msw-contract.spec.ts` (1, pre-existing, fixed this phase), and the new
`shell.spec.ts` (15: 3 nav, 11 dark-mode screenshots, 1 axe scan). Confirmed
by hand, not just existence:

- Toggled dark mode manually in a real browser (Playwright MCP) on both
  `/` and `/kitchen-sink` before writing the automated screenshot tests —
  every section's tokens flip correctly, no hardcoded colors visible.
- Opened the Sheet and clicked the toast trigger manually; both work.
- Re-ran `axe` after each fix until zero violations, not just once.
- Stress-tested the `msw-contract.spec.ts` fix specifically (15 runs at
  `--workers=8`) rather than trusting a single green run.
- `scripts/check-phase-3.sh`: **PASS** once this phase's files are
  committed (its own git-tracked check on the baseline PNGs fails, by
  design, against an uncommitted working tree — verified that failure mode
  too, not just the success path).

## What the next session needs to know

- Next up: Phase 4 (Reference Screens) — `widgets-table.tsx` and
  `widget-form.tsx` against the six field types already frozen into
  `openapi.yaml`'s `Widget` schema in Phase 2.
- **Before anything else touches CI:** resolve the win32/Linux baseline
  mismatch in `docs/BLOCKERS.md`. The first CI run on this branch is
  expected to fail the Playwright screenshot step for exactly that reason
  — don't mistake it for a real regression.
- `src/auth/` is now three files, not the plan's two
  (`auth-provider.tsx` + `use-auth.ts`) — `auth-context.ts` holds the
  `AuthContext`/`FAKE_USER`. If Phase 8 replaces the fake user with a real
  mechanism, all three files are in play, and `use-auth.ts` re-exporting
  `AuthProvider` (so `main.tsx` doesn't have to import `auth-provider.tsx`
  directly, which the ESLint boundary rule blocks) should carry forward.
- The `destructive` button variant changed shape (solid fill, not tinted).
  Phase 5's palette pass should treat `--destructive-foreground` as an
  existing token to keep, not rediscover — and should verify dark-mode
  contrast for it, which this phase did not.
- `docs/BLOCKERS.md` still has the Phase 2 `spec-tester` item open
  (unrelated to this phase, not touched).
