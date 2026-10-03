# Recipe — entity plan

Fixture for `scripts/consume-test.sh Recipe`: the Fresh UI Build agent gets
this plan (as `docs/entities/recipe.md`). It uses every field type added
in 3.4–3.8 (yes/no with a row toggle, multi reference, sub-records,
computed), so a run proves a fresh agent can follow those playbook steps.

## Purpose

A recipe I might cook, with what it needs and whether I have it.

## Fields

| Field | Label | Type | Required | Options / rules | List | Filter |
|---|---|---|---|---|---|---|
| title | Title | text | yes | 1–200 chars | column, sortable | search |
| favorite | Favorite | yes/no | yes | default no; filter labels Any, Favorites, Others | column, toggle | yes |
| categoryIds | Categories | multi reference → WidgetCategory | no | any number, no repeats; picked from a searchable list; none means uncategorised | column | yes (any of) |
| notes | Notes | long text | no | up to 2000 chars | | |
| pantryState | Can Cook | computed | — | from the ingredients: none (no ingredients), missing (any ingredient not on hand), ready (all on hand), labelled No ingredients, Missing items, Ready to cook; sorts in that order | column, sortable | yes |

## Sub-records

### ingredients — Ingredients

- Most items: 30.
- In the table: an on-hand count (`3/5 on hand`); an em dash when empty.

| Field | Label | Type | Required | Options / rules |
|---|---|---|---|---|
| name | Name | text | yes | 1–100 chars, trimmed |
| onHand | On Hand | yes/no | yes | default no |

## List screen

- Default sort: none (server order).
- Page size: 10.
- Row actions: edit, delete (with confirmation).

## Screens and access

- Screens: list, create, edit, delete.
- Ownership: frontend only in this run (no backend); follow the Widget
  reference. The mocks compute `pantryState`.

## Open questions

None.
