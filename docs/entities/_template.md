# <Entity> — entity plan

The input to `/new-entity`. It builds exactly what this file says — no
invented fields, options or rules. Copy this file to
`docs/entities/<entity>.md` (kebab-case, singular: `game.md`) and fill it
in, or run `/new-entity <Name>` without one and it will talk it through
with you and write it. `docs/entities/widget.md` is a filled-in example.

## Purpose

One or two sentences: what one record is, and who uses the screens.

## Fields

| Field | Label | Type | Required | Options / rules | List | Filter |
|---|---|---|---|---|---|---|
| title | Title | text | yes | 1–200 chars | column, sortable | search |
| status | Status | single choice | yes | Backlog, Playing, Finished; default Backlog | column, sortable | yes |

- **Field**: camelCase, as it appears in the API (`releaseDate`).
- **Type** — what the foundation supports today:
  - *Demonstrated by the Widget reference* (copied directly): `text` (one
    line), `long text`, `decimal` (fixed places — say how many),
    `date-time`, `email`, `single choice` (list the options, in display
    order), `reference` (to another entity — name it; a searchable
    combobox).
  - *Close variants* (built by a small, stated change to the nearest
    pattern): `integer` (from decimal), `url` (from email — a format
    check), `date` (from date-time — no time part).
  - *Not supported yet:* multi choice, boolean, file, and anything else.
    Write it anyway with a note; `/new-entity` will stop and raise it
    rather than improvise.
- **Required**: `yes`, or `no` (then say whether empty means "unknown").
- **List**: `column` if it shows in the table, and `sortable` if you can
  sort by it; blank if it's form-only.
- **Filter**: `search` (the text search box), `yes` (a filter control), or
  blank.

## List screen

- Default sort:
- Page size: 10 unless there's a reason.
- Anything else the table must show or do:

## Screens and access

- Screens: list, create, edit, delete (the only shape `/new-entity` builds
  today).
- Ownership: **shared** (every signed-in user sees every record) or
  **per-user** (each user sees only their own).

## Open questions

Anything not decided yet. `/new-entity` won't start while this section has
an unresolved item.
