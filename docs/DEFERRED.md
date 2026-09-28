# Deferred and Excluded

Out-of-scope ideas land here, never in code. See `docs/BUILD-PLAN.md` for the
full rationale behind each row.

A row is **removed when it ships** — this is a queue of what is left, not a
log of what was done. 33 rows were drained on 2026-09-27/28 (semantic
tones, the cell-pattern catalogue, the column-options step, the release
automation, the `<SelectValue>` defect and the phone-width project); what
each became, and what deviated, is in
[`phases/design-language-batch.md`](phases/design-language-batch.md). Their
full text is in git history.

## Direction (decided 2026-09-20, while building the Game List app)

Set by the developer, and it supersedes the "don't extend speculatively" framing wherever the two conflict. Rows below marked **Met** or **Decided** follow from it.

- **Two tracks.** *Design language* — tokens, semantic tones, `Badge`/variant styles, cell patterns, typography, density, themes — grows freely and does not wait for a second app or a second use. *Structure* — composites, new registry items, backend, auth, infrastructure — stays need-driven: built against a real app, not in advance. Why the split: design language is cheap to review by looking at results and is exactly what a consuming app cannot get right alone (contrast, both themes, consistency); structure is where "building forever" is a real risk.
- **The "basic" look was a v1 leftover, not a design position.** BUILD-PLAN's non-goal ("This foundation does not need to be good. It needs to be reusable. Polish is what the first real application is for") and its v1.0 scope budget (exactly three composites, three registry items, six field types) were ship guards. v1 shipped, a real application now exists, and it wants polish — so both stop capping design-language work.
- **Review model.** The developer reviews *results* (the running app, the per-column options pages), not every line of code. Mechanical gates remain the safety net; the goal is a foundation strong enough that line-by-line review isn't needed. See the "Docs that still describe the old stance" row.
- **Process ceremony is negotiable.** The consume-test/tag/README release routine and the pixel screenshot baselines are up for slimming or replacement — see the two process rows.
- **Unchanged:** the Hard Rules (semantic tokens only, shadcn before hand-rolling, gateway boundaries, dependency allowlist). Every design-language addition still ships with axe contrast coverage in both themes. Stronger tokens make the token rule more useful, not less.

## Deferred

| Item | Revisit when |
|---|---|
| Login rate limiting / lockout on repeated failed attempts | The app is exposed somewhere a brute-force attempt is a real threat model, not a personal/local deployment. **Still deferred as of Phase 11** (docs/phases/phase-11.md) — flagged there as a real gap self-service registration widens, not yet picked up |
| Additional themes | **No longer gated on a second app** (see Direction) — themes are design language. Pick up when the developer wants a distinct look; the token architecture already supports it. Still no theme-switcher UI (see Excluded) |
| Monorepo | Two or more consuming apps share a release cycle |
| TypeScript 7 (native compiler) | typescript-eslint, openapi-typescript and Storybook's react-docgen-typescript all support it. TS 7's package exposes no classic JS API (`require('typescript')` has only `version`), and all three are built on that API — typescript-eslint caps at `<6.1` even in its v9 alpha. The tsconfigs are already TS 7-clean (no `baseUrl`, which TS 7 drops). When revisiting, also drop the `openapi-typescript` → `typescript` entry in `package.json`'s `overrides` once openapi-typescript's own peer range covers the installed TypeScript |
| Read-only entity path in the playbook (`/new-entity` for a list/detail table with no create, edit or delete — today it always builds full CRUD, and the near-term focus is display tables; see `docs/ARCHITECTURE.md` "Focus") | The first real app needs a read-only table. Build it against that app's actual screen, not in advance |
| Notion API as a data source — a thin backend that serves `openapi.yaml` from a Notion database instead of Postgres (the choice is documented in `docs/consuming.md`) | A real project picks Notion as its source of truth. Build it against that project's actual database and property types, not a hypothetical one |
| Row virtualization | A table exceeds ~5k rows |
| `AppError` kinds for 403 (`forbidden`) and 409 (`conflict`) — today both render as the generic `server` error | A backend actually returns either. None does now: another user's widget is a deliberate 404 and a duplicate email is a 422. Considered and not built in audit Phase D (`docs/phases/audit-phase-d.md`) |
| Error reporting | An app is actually deployed |
| Dependency-allowlist enforcement for `backend/pyproject.toml`, mirroring `deps-allowlist.json`/`check-deps.mjs` on the npm side | The backend gains a second contributor/session where an unreviewed Python dependency is a real risk — Phase 8 pinned versions by hand with no mechanical gate |
| Column-level documentation convention for the Postgres backend — `COMMENT ON TABLE`/`COMMENT ON COLUMN` on every table, required whenever a column's meaning isn't obvious from its name/type. No existing convention (zero `COMMENT ON` usage anywhere in `backend/` today) and no mechanical check. Found while planning a Game List app whose `game_ratings` table needs to be understood by a second, context-free agent with direct read-write Postgres access and no view of `openapi.yaml` or this repo | That app's migration actually ships `COMMENT ON` for real (its own plan documents the convention and a Row-Level Security policy alongside it); once proven there, decide whether it graduates to a Hard Rule with a mechanical check across `backend/`, the way other Hard Rules are enforced |

| **The `<nav>` landmark does not contain the nav at phone width.** `app-shell.tsx` wraps `<Sidebar>` in `<nav aria-label="Primary">`, but below the sidebar's mobile breakpoint the sidebar renders into a Sheet that is *portaled to document.body* — so the links land outside the landmark, which is then an empty `<nav>`. axe does not flag it (an empty landmark is legal, and the links are reachable and labelled), and the new `mobile-chrome` Playwright project passes with zero violations, so this is a semantics quirk rather than a defect. Fixing it means either moving the `<nav>` inside the sidebar's own content or dropping the wrapper and letting the sheet carry the landmark — both touch a registry-shipped file and a shadcn-owned one, so it wants a deliberate look rather than a drive-by. `e2e/a11y.spec.ts` documents the behaviour and reads the links from the sheet on mobile. Found while adding the phone-width project | Someone changes `app-shell.tsx`'s nav markup for another reason, or a screen-reader pass on a phone is actually done. Don't fix it blind — confirm first how it reads in a real mobile screen reader, since the current shape may well be fine in practice |
| **Phone-width is asserted, but nothing is *designed* for it.** The new `mobile-chrome` project proves the app works at 393px — the sidebar becomes a sheet, the toolbar wraps, `DataTable` scrolls behind its pinned column — but all of that is inherited from shadcn, not chosen. `src/routes` and `src/components/app` still contain **zero** `sm:`/`md:`/`lg:` breakpoints. What a phone user actually gets: the whole first viewport is filters before any row appears, and every column past the second is off-screen with no column-visibility or density control. This is *structure*, so it stays need-driven | A consuming app is genuinely used on a phone and someone complains about the scrolling, not before. Decide the target first — "usable at 393px" (today) versus "designed for 393px" (column priority, a density toggle, or a card layout under a breakpoint). Only the second is real work, and it belongs to whichever app needs it |
| **The `mobile-chrome` project excludes `shell.spec.ts`, and nothing covers the sheet's own behaviour.** That spec asserts the persistent sidebar and its expand/collapse cookie, which below the breakpoint is a different component (a Sheet), not a narrower one — so running it there tested nothing meaningful. `a11y.spec.ts` opens the sheet and axe-checks it, but no test asserts the sheet *works*: opens on the trigger, closes on navigation, traps focus. Found while adding the phone-width project | The sheet breaks, or `shell.spec.ts` is touched for another reason. Small and self-contained whenever picked up |

## Excluded

- **npm package** — forfeits open-code editability, the reason for this stack
- **Custom primitives** — shadcn's are already yours to edit
- **Theme switcher UI** — build the token architecture, not the feature
- **SSR / SEO tooling** — irrelevant for personal database applications
