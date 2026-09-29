# Push up the Game List app's forks (2026-09-28)

The first draining of the "push generic changes back up" backlog that
`DEFERRED.md` "Starter kit now, shared code later" asks for. The Game List
app's drift map declared four files as PUSH UP forks, logged here as three
rows. All three shipped in one PR.

## What shipped

| Row | What |
|---|---|
| `useTableUrlState` `setFilters()` / `applyView()` | Both added with the app's API unchanged. The URL-building logic moved to `src/hooks/table-url-changes.ts` (`applyUrlChanges`, `viewToUrlChanges`), unit-tested by `tests/table-url-changes.test.ts`. |
| Binary e2e MSW override | `bodyBase64` + `contentType` on `__E2E_MSW_OVERRIDE__`, in `src/mocks/e2e-hooks.ts` and `e2e/global.d.ts`. Tested in `e2e/msw-contract.spec.ts` by loading a stubbed 1x1 GIF through a real `<img>`. One sentence in `add-an-entity.md` step 8. |
| `DataTable` `pinLastColumn` | Ported as-is and turned on in `widgets-table.tsx`, whose last column is the row actions. |
| *(not a row)* `min-w-0` on `<SidebarInset>` | Needed for `pinLastColumn` to work at all. See below. |

## Decisions

- **`applyView` clears every filter the view doesn't set.** Confirmed with
  the developer this session, as the row asked, rather than copied without
  asking. Recorded in the comment on `viewToUrlChanges`.
- **`pinLastColumn` gets no second scrollbar.** The sticky bottom bar stays
  tied to `pinFirstColumn`, as in the app. Widening it would have been a
  behaviour change nobody had asked for.

## Deviations, and what the next session should not re-derive

**The lost-update bug is real in react-router 7.18.4.** `setSearchParams`
gives a functional updater `new URLSearchParams(searchParams)` from the
last render, not the result of the previous updater. Checked in
`node_modules/react-router/dist/development/chunk-*.mjs`, not just taken
from the app's comment. So every setter must stay one `update()` call.

**The hook's logic lives in a second file because of the test tsconfig.**
`tests/` is type-checked by `tsconfig.test.json`, which has no `jsx`. The
hook type-imports `SortingState` from `data-table.tsx`, so importing the
hook from a test broke `tsc -b` (TS6142). Adding `jsx` there would drag
every component into the test project. Instead the pure helpers moved to
`table-url-changes.ts`, which types sort structurally rather than
importing from the `.tsx`. There is no jsdom or testing-library here, and
both are off the allowlist, so the hook itself is not rendered in a test.
The one-call rule is enforced by the comments on the hook.

**`pinLastColumn` did not work in this repo until `app-shell.tsx` was
fixed.** At 800px the whole page overflowed sideways, because
`<SidebarInset>` is a flex item whose default `min-width:auto` floors it at
the table's width. The table's right edge, and with it the pinned column,
sat off-screen. `pinFirstColumn` hid this because it pins the *left* edge.
The Game List app had fixed it with `className="min-w-0"` and a regression
test ("a narrow window scrolls the table, not the whole page"). Both are
ported. The drift check never flagged it as PUSH UP because
`app-shell.tsx` is on its app-owned list, as the file holds the nav. That
gap is now a `DEFERRED.md` row.

**The opacity assertion was tightened past the app's version.** The app's
pinned-column tests only detect alpha written as `oklch(… / A)`. A cell
with no background at all serializes as `rgba(0, 0, 0, 0)` and would pass.
The new test reads alpha from both forms. Worth porting back to the Game
List app's two pinned-column tests.

## Negative controls (each seen failing, then restored)

- `viewToUrlChanges` merging instead of clearing: both view tests fail.
- The binary branch disabled in `e2e-hooks.ts`: the `<img>` reports
  `error`, not `loaded 1x1`.
- `min-w-0` removed: the page-overflow test and the actions-column test
  both fail.
- `pinLastColumn` removed from `widgets-table.tsx`: the actions-column test
  fails.
- Pinned cell with no background, and with `bg-muted/40`: the opacity check
  fails (alpha 0, then 0.4).

## For the Game List app

After it takes this release it can drop all four entries from its
`FORKED` map. Its `app-shell.tsx` `min-w-0` then matches the foundation
too. It also needs `src/hooks/table-url-changes.ts`: the shipped hook now
imports it.
