# Phase G — Multi-Select Field (2026-09-18)

Second follow-up from mapping a real project (the Notion "Multiplayer
Game List", whose Mechanics field is multi-select) onto the foundation.
Branch `feat/multi-select`. Registry-shipped files changed, so this needs
a tag after merge.

## What was built

Multi choice is now a *demonstrated* field type (`docs/entities/_template.md`):
Widget gained `tags` (fragile, bulky, seasonal, featured), end to end, so
`/new-entity` has a tested pattern to copy.

| Layer | Change |
|---|---|
| Contract | `WidgetTag` enum; `Widget.tags` (array, `uniqueItems`, always present); optional on create (default `[]`) and update (replaces the set; `[]` clears); `tags` list filter, repeated param, *any of* |
| Gateway | Array filters are sent as a repeated parameter (`tags=a&tags=b`), empty arrays send nothing. `toAppError` keys a field error by the last *string* segment of `loc`, so a 422 at `["body","tags",0]` binds to `tags`, not a field named `"0"` — a gap for any array field |
| UI | `<MultiChoice>` (`src/components/app/multi-choice.tsx`, shadcn Combobox `multiple`, per its own example) — used on the form and as the table's tags filter; badges in the table; `useTableUrlState` gained multi-value filters (repeated in the URL) |
| Primitive | `combobox.tsx`: chip remove buttons named "Remove <tag>" — upstream's are icon-only (critical axe violation, found by `a11y.spec.ts` once it covered `/widgets/1/edit`) |
| Mocks | seed tags, `[]` default, replace on update, any-of filter, 422 on unknown/duplicate |
| Backend | `widget_tags` join table (migration `0004`, postgres enum `widgettag`, cascade delete) — not an array/JSON column, because "any of" then filters identically on Postgres and SQLite; `Widget.tags` property in display order; `set_tags()` replaces the set |

## Evidence

- Gateway tests by `spec-tester` (spec-only): 2 red → green for the
  repeated param / empty array; 2 red → green for array-`loc` field errors.
- Negative controls: without the tags filter in the table query, the
  filter e2e test fails; without the chip labels, the edit form's a11y
  test fails (`button-name`); without `tags` on `WidgetOut`, spec
  conformance fails on all three widget responses.
- pytest: 6 new tests (default/always present, display order, PATCH
  replace/unchanged/clear, any-of filter, 422s, delete cascade).
- `scripts/check-backend-postgres.sh` now PATCHes tags and filters by them
  against real Postgres — the enum and join table only exist there.
- The Fresh UI Build's Invoice plan gained a multi-choice `labels` field,
  so the build proves a fresh agent can copy the pattern. Result in the PR.

## What the next session needs to know

- Multi choice options are raw values in the UI (like Status). Display
  labels (e.g. "🔨 Build") would be a per-entity label map — not built.
- A second multi-choice field on the same entity would need its own join
  table (or a shared generic one) — decide against a real app.
