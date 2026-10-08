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
    line), `long text` (say `Markdown` when it's written in Markdown, like
    notes or a write-up: the view renders its headings, lists, tables and
    links, the form and editing in place edit it as formatted text, and
    it's never a table column), `decimal` (fixed places — say how many),
    `date-time`, `email`, `yes/no` (a boolean that is always yes or no:
    say its default and the filter's three labels, e.g. Any stock /
    In stock / Out of stock), `single choice` (list the options, in display
    order, with a label for any whose wire value isn't fit to show, as for
    a multi choice; see the note below if it is *optional*), `multi choice` (list
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
    `computed` integer; say whether its column links to those records
    (cell pattern 20) and which of them it counts (`open tasks`).
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
  sort by it; blank if it's only on the form and the view. The title
  field's column links to the record's view. A `yes/no` can also say `toggle`:
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
- On the view: always shown: the done-count, then each item in order (a
  `url` item field opens in a new tab). Read-only, unless the View
  screen's `Quick actions` names the list: then its yes/no item field is a
  checkbox on each item, ticked in place. If its `Edit in place` names
  the list, its items are also added, edited, moved and removed there.

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
- Saved views (optional; delete if none): one row per view, a button
  above the filters that sets every filter and the sort in one press.
  Columns: blank for the table's usual columns, or the exact columns the
  view shows, for a view of one kind of record that shows a field only
  that kind uses. The columns last while the view's filters do; any other
  filter puts the usual columns back. If the usual columns should leave
  out a field only a view shows, say so here.

| View | Filters | Sort | Columns |
|---|---|---|---|
| All tasks | none | dueDate asc | |
| Bugs | kind = bug | dueDate asc | title, severity, assignee, dueDate |

- Width (optional): `content` for a table of a few short columns, so on a
  wide screen it takes the width they need rather than the whole page
  (cell pattern 18, "`width="content"`"). Leave it out for the full width.
- Anything else the table must show or do:

## View screen

The read-only page for one record (`/<entity>/:id`), opened by clicking
its title in the table. Edit and Delete live in its header, so the table
has no row actions. Every field it shows renders as its table cell does,
except the quick actions, if any.

- Title: the field that names a record, shown as the page heading and
  linked from the table: `title`.
- Badges beside the title: a few status-like fields, as badges: `status`,
  `priority`.
- Layout (optional; delete for one column): `rail` for a record with long
  content (notes written as Markdown, long lists). The page takes the
  screen's whole width, the short sections (a summary, label/value fields,
  a few links) sit in a narrow column on the right that stays in view, and
  the long ones fill the main column beside it. On a phone: one column,
  the rail's sections first. Without this line, every section is in one
  column, as wide as a long read.

  Layout: rail

- Sections, in order. Each lists its fields in the order they show. A
  section holding a single long text or a single sub-records list shows
  it under the section's heading, with no label of its own. With
  `Layout: rail`, Placement says which column each goes in (`rail` or
  `main`); otherwise delete the column.

| Section | Fields | Placement |
|---|---|---|
| Details | dueDate, project, tags | rail |
| Checklist | checklist | main |
| Notes | notes | main |

- "Not set" labels: what an empty optional field reads as on the view
  (`dueDate`: No due date; `checklist`: No items). A field not listed here
  reads "Not set". A `yes/no` is never empty: it reads Yes or No.
- Quick actions (optional; delete if none): the values the view changes
  with one click, each saved on its own the moment it changes, without
  the form: a `yes/no` (a switch), or a sub-records list (its yes/no item
  field ticked on each item). Only values people change often and can
  change back as easily.
  Say any rule the server enforces on one (it can refuse the change) and
  any side effect (another field the server changes with it), so each
  gets a test; the view always shows the record the server returns.

  Quick actions: checklist

- Edit in place (optional; delete if none): the fields that turn into
  their form control where the view shows them and save when you leave
  them (cell pattern 18): the title, a badge field, a field row, a long
  text, a sub-records list (its items added, edited, moved and removed on
  the view). Text, long text, a single choice, an integer or a rating, a
  yes/no, a single or multi reference, a sub-records list. Never a
  computed field. Every value not named here, or under Quick actions,
  stays read-only. Say any rule the server enforces on one (its refusal
  shows under the field) and any side effect:

  Edit in place: title, status (the server refuses Finished while the
  checklist has open items), dueDate, notes

## Screens and access

- Screens: list, view, create, edit, delete (the shape the playbook
  builds). Or, for a small entity (a name and a few fields, no page of
  its own): `list, edited in the row`, with no View screen section. Every
  field the table shows is edited in its cell, a new record is created
  from its name in the table's toolbar (say what every other field
  starts as), and delete is a row action (cell pattern 18, "In a table's
  rows").
- Ownership: **shared** (every signed-in user sees every record) or
  **per-user** (each user sees only their own).

## Open questions

Anything not decided yet. The playbook won't start while this section has
an unresolved item.
