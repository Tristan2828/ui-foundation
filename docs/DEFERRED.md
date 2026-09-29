# Direction and Deferred

The developer's standing decisions about what gets built, and the queue of
what is left. When another doc disagrees with this one, this one wins, and
the other doc is updated to match. Out-of-scope ideas land here, never in
code. A row is **removed when it ships**: this is a queue, not a log (git
history has every removed row).

## Direction

- **Shared code, not a starter kit** (decided 2026-09-28, shipped as 3.0).
  The foundation-owned layer is the npm package
  `@tristan2828/ui-foundation`, and apps upgrade by bumping its version. The
  template is copied once, and what it copies is the app's own
  ([`ARCHITECTURE.md`](ARCHITECTURE.md) "Why shared code"). Generic changes
  found in an app are raised here and released, not kept as local variants.
  That is the path a fix takes to every app.
- **Two tracks** (decided 2026-09-20, while building the Game List app).
  *Design language* grows freely and does not wait for a second app or a
  second use: tokens, semantic tones, `Badge` and variant styles, cell
  patterns, typography, density, themes. *Structure* stays need-driven,
  built against a real app's actual screen and not in advance: composites,
  new entry points or exports, backend, auth, infrastructure. Why the
  split: design language is cheap to review by looking at results, and it
  is exactly what an app can't get right alone (contrast, both themes,
  consistency). Structure is where "building forever" is the real risk.
- **Configuration grows from real forks.** A new prop or slot on a
  composite is structure: it is added when an app needs the variation, not
  in advance. Every one so far (`AppShell`'s `nav`/`sidebarExtra`/
  `defaultSidebarOpen`, `EntityForm`'s `danger`, `LoginRoute`'s
  `registerPath`) replaced a fork in Game List.
- **Polish is wanted.** The v1 "doesn't need to be good, needs to be
  reusable" stance was a ship guard, not a design position. Now that a real
  app exists, design-language work is not capped.
- **Review model.** The developer reviews *results* (the running app,
  options pages, screenshots), not every line. The mechanical gates are the
  safety net, and the goal is a foundation strong enough that line-by-line
  review isn't needed.
- **Unchanged:** the Hard Rules (semantic tokens only, shadcn before
  hand-rolling, gateway boundaries, the dependency allowlist). Every
  design-language addition ships with axe contrast coverage in both themes.

## Deferred

| Item | Revisit when |
|---|---|
| Move the Game List app onto 3.0 (`consuming.md` "Moving a 2.x app onto the package"). It is the first real test of the migration path and of the configuration props, which came from its forks | The next Game List session with room for it. Take 3.0 whole in one branch. Whatever doesn't map onto the package's props is a finding for here, not a new fork |
| Sharing the backend. `template/backend/` is copied into each app and diverges from then on, so a backend fix (auth, the deploy checks, the SPA fallback) reaches no app on its own | Two apps need the same backend fix, or a second app keeps the reference backend. Then decide between a Python package for the auth/deploy/SPA layer and a documented patch routine |
| Login rate limiting / lockout on repeated failed attempts | The app is exposed somewhere a brute-force attempt is a real threat, not a personal/local deployment. Self-service registration widens this gap |
| Error reporting | An app is actually deployed to strangers |
| Additional themes | The developer wants a distinct look; the two-layer tokens already support it. Still no theme-switcher UI (see Excluded) |
| TypeScript 7 (native compiler) | typescript-eslint, openapi-typescript and Storybook's react-docgen-typescript all support it. TS 7's package exposes no classic JS API, and all three are built on that API. The tsconfigs are already TS 7-clean. When revisiting, drop the `openapi-typescript` → `typescript` entry in the `overrides` of the root and template `package.json` once openapi-typescript's own peer range covers the installed TypeScript |
| Read-only entity path in the playbook (a list/detail table with no create, edit or delete; today it always builds full CRUD) | The first real app needs a read-only table. Build it against that app's actual screen |
| Notion API as a data source: a thin backend that serves `openapi.yaml` from a Notion database instead of Postgres (`consuming.md` compares the two) | A real project picks Notion as its source of truth. Build it against that project's database and property types |
| Row virtualization | A table exceeds ~5k rows |
| `AppError` kinds for 403 (`forbidden`) and 409 (`conflict`); both render as the generic `server` error today | A backend actually returns either. None does: another user's widget is a deliberate 404, and a duplicate email is a 422 |
| Dependency-allowlist enforcement for `backend/pyproject.toml`, mirroring `ui-foundation check-deps` on the npm side | The backend gains a second contributor or session where an unreviewed Python dependency is a real risk |
| Column-level documentation convention for the Postgres backend (`COMMENT ON TABLE`/`COMMENT ON COLUMN` wherever a column's meaning isn't obvious). Found planning a Game List table that a second, context-free agent reads with direct Postgres access | That app's migration ships `COMMENT ON` for real. Once proven there, decide whether it becomes a Hard Rule with a check |
| **The `<nav>` landmark doesn't contain the nav at phone width.** `AppShell` wraps `<Sidebar>` in `<nav aria-label="Primary">`, but below the mobile breakpoint the sidebar renders into a Sheet portaled to `document.body`, so the landmark is empty there. axe doesn't flag it and the links are reachable and labelled, so this is a semantics quirk. The a11y suite reads the links from the sheet on mobile | `AppShell`'s nav markup changes for another reason, or a screen-reader pass on a phone is actually done. Confirm first how it reads in a real mobile screen reader |
| **Phone width is asserted, not designed.** The `mobile-chrome` project proves the app works at 393px, but that is inherited from shadcn, not chosen: the first viewport is all filters, and every column past the second is off-screen with no column-visibility or density control | An app is genuinely used on a phone and someone complains. Decide first between "usable at 393px" (today) and "designed for 393px" (column priority, density, a card layout) |
| **Nothing covers the mobile sidebar sheet's own behaviour.** `shell.spec.ts` is excluded from `mobile-chrome` (it asserts the persistent sidebar), and the a11y suite opens the sheet but doesn't assert that it opens, closes on navigation and traps focus | The sheet breaks, or the shell spec is touched for another reason. Small and self-contained |
| **No worked example of a frozen-clock test.** `cell-patterns.md`'s "date, relative" entry says to freeze the clock with Playwright's `page.clock`, but nothing here shows it, and this repo has no relative-date cell. The Game List app has one (`e2e/games-table.spec.ts` pins 2026-06-01 and asserts one past and one future value) | A relative or duration cell is added here, or the cell-patterns catalogue is next edited: extend the entry to a short worked example |

## Excluded

- **Per-app edits to package components.** Configure through props, build
  on top, or raise the change here (`consuming.md` "Changing the
  foundation").
- **Custom primitives.** shadcn's are the base; the package patches them
  where needed.
- **Theme switcher UI.** Build the token architecture, not the feature.
- **SSR / SEO tooling.** Irrelevant for personal database applications.
