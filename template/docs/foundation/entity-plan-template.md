# <Entity> — entity plan

The input to the entity playbook (`docs/foundation/add-an-entity.md`, which any AI
tool can follow; Claude Code's `/new-entity` is a shortcut). It builds
exactly what this file says — no invented fields, options or rules. Copy
this file to `docs/entities/<entity>.md` (kebab-case, singular: `game.md`)
and fill it in, or ask your AI tool to plan the entity with you and it
will talk it through and write this file. `docs/entities/widget.md` (the
template's demo entity, until you delete it) is a filled-in example.

## Purpose

One or two sentences: what one record is, and who uses the screens.

## Fields

| Field | Label | Type | Required | Options / rules | List | Filter |
|---|---|---|---|---|---|---|
| title | Title | text | yes | 1–200 chars | column, sortable | search |
| status | Status | single choice | yes | Backlog, Playing, Finished; default Backlog | column, sortable | yes |
| priority | Priority | single choice | no | Low, Normal, High; empty means not set | column, sortable | yes |

- **Field**: camelCase, as it appears in the API (`releaseDate`).
- **Type** — what the foundation supports today:
  - *Demonstrated by the Widget reference* (copied directly): `text` (one
    line), `long text`, `decimal` (fixed places — say how many),
    `date-time`, `email`, `yes/no` (a boolean that is always yes or no:
    say its default and the filter's three labels, e.g. Any stock /
    In stock / Out of stock), `single choice` (list the options, in display
    order; see the note below if it is *optional*), `multi choice` (list
    the options, with a label for any whose wire value isn't fit to show,
    e.g. `quick_win` (Quick win); any number can be picked —
    chips on the form, badges in the table, an any-of filter), `reference`
    (to another entity — name it; a searchable combobox), `multi reference`
    (to any number of records of another entity — name it; chips with a
    searchable dropdown, names as badges in the table, an any-of filter;
    the other entity's list endpoint must also accept `ids`),
    `computed` (read-only: the server works it out from other data on
    every read and never stores it — give its rule, and if it's a choice,
    its values in sort order with a label for each; a read-only column, a filter and a sort the
    server evaluates, never on the form). A count of related records is a
    `computed` integer.
  - *Close variants* (built by a small, stated change to the nearest
    pattern): `integer` (from decimal), `url` (from email — a format
    check), `date` (from date-time — no time part).
  - *Not supported yet:* a yes/no that can also be unset (three states),
    file, and anything else.
    Write it anyway with a note; the playbook will stop and raise it
    rather than improvise.
- **Required**: `yes`, or `no` (then say whether empty means "unknown").
  An **optional `single choice`** needs one extra decision: the label for
  "not set" (`Not checked`, `Any`, `None`…), because the form shows it as
  a real option rather than a blank. Say it in the Options column. Widget
  has no optional choice field, so the playbook builds this one from the
  worked example in `docs/foundation/add-an-entity.md` step 6 rather than by copying
  a screen — a Base UI `Select` can't take `""` as an item value, so the
  pattern needs a sentinel and gets the display wrong without one.
- **List**: `column` if it shows in the table, and `sortable` if you can
  sort by it; blank if it's form-only. A `yes/no` can also say `toggle`:
  flipped straight from its row, saved on its own (cell pattern 15).
- **Filter**: `search` (the text search box), `yes` (a filter control), or
  blank.

## Sub-records

Optional. A list of small items that belong to one record alone and are
edited on its form, saved with it (a checklist, a set of links). One block
per list; delete the section if there are none.

### checklist — Checklist

- Most items: 50.
- In the table: a done-count (`2/6 done`), or blank if the list isn't
  shown.

| Field | Label | Type | Required | Options / rules |
|---|---|---|---|---|
| text | Text | text | yes | 1–300 chars, trimmed |
| done | Done | yes/no | yes | default no |

- Item fields use the same types as the main table (`text`, `url`,
  `yes/no`… — not another sub-record or a reference). Items have no screen
  of their own: they're added, edited, reordered and removed on the
  record's form, and the order is kept.

## List screen

- Default sort:
- Page size: 10 unless there's a reason.
- Anything else the table must show or do:

## Screens and access

- Screens: list, create, edit, delete (the only shape the playbook builds
  today).
- Ownership: **shared** (every signed-in user sees every record) or
  **per-user** (each user sees only their own).

## Open questions

Anything not decided yet. The playbook won't start while this section has
an unresolved item.
