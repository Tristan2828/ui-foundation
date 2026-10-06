# Widget — entity plan

The demo entity the foundation ships with, written up as a filled-in plan
(format: `docs/foundation/entity-plan-template.md`). Its code in `src/routes/widgets/` is what
the entity playbook copies for every new entity.

## Purpose

A throwaway record with one field of each kind, so every UI pattern the
foundation supports has a working, tested reference.

## Fields

| Field | Label | Type | Required | Options / rules | List | Filter |
|---|---|---|---|---|---|---|
| name | Name | text | yes | 1–200 chars | column, sortable | search |
| categoryId | Category | reference → WidgetCategory | yes | picked from a searchable list | column | |
| status | Status | single choice | yes | draft (Draft), active (Active), archived (Archived); default draft | column, sortable | yes |
| availableFrom | Available From | date-time | yes | picked with a calendar; shown as a date | column, sortable | |
| assigneeEmail | Assignee Email | email | no | empty means unassigned | column | |
| price | Price | decimal | yes | 2 places, e.g. 19.99 | column, sortable | |
| description | Description | long text, Markdown | yes | up to 2000 chars | | |
| tags | Tags | multi choice | no | fragile (Fragile), bulky (Bulky), seasonal (Seasonal), featured (Featured); any number, no repeats; none means untagged | column | yes (any of) |
| extraCategoryIds | Extra Categories | multi reference → WidgetCategory | no | any number, no repeats; picked from a searchable list; none means no extra categories | column | yes (any of) |
| checklistState | Progress | computed | — | from the checklist: none (no items), open (any item not done), complete (all done); sorts in that order | column, sortable | yes |
| inStock | In Stock | yes/no | yes | default yes; filter labels Any stock, In stock, Out of stock | column, toggle | yes |

## Sub-records

### checklist — Checklist

- Most items: 50.
- In the table: a done-count (`1/2 done`); an em dash when empty.
- On the view: the done-count, then each item, read-only.

| Field | Label | Type | Required | Options / rules |
|---|---|---|---|---|
| text | Text | text | yes | 1–300 chars, trimmed |
| done | Done | yes/no | yes | default no |

## List screen

- Default sort: none (server order).
- Page size: 10.

## View screen

- Title: `name`.
- Badges beside the title: `status`, `checklistState`, `inStock`.
- Sections, in order:

| Section | Fields |
|---|---|
| Details | categoryId, extraCategoryIds, tags, availableFrom, price, assigneeEmail |
| Description | description |
| Checklist | checklist |

- "Not set" labels: `extraCategoryIds`: No extra categories; `tags`:
  Untagged; `assigneeEmail`: Unassigned; `checklist`: No items.
- Quick actions: `inStock`, `checklist`. Ticking an item can change
  `checklistState` (the server works it out), so the header's progress
  badge follows the tick once the save answers.
- Edit in place: `name` (the title), `status` (its header badge), `price`,
  `description` (Markdown, as rich text), `extraCategoryIds`.

## Screens and access

- Screens: list, view, create, edit, delete.
- Ownership: **per-user** — each user sees only the widgets they created.
  Widget categories are **shared** and read-only (seeded).

## Open questions

None.
