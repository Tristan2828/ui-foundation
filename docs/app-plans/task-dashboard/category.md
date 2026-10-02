# Category — entity plan

Part of the Task Dashboard app (format:
`docs/foundation/entity-plan-template.md`). Replaces Notion's Area
(Projects) and Category (Learning) options.

## Purpose

A part of my life a task belongs to (Home, Health, Finance…). A task can
have several. I add or rename them here instead of in code.

## Fields

| Field | Label | Type | Required | Options / rules | List | Filter |
|---|---|---|---|---|---|---|
| name | Name | text | yes | 1–50 chars; unique per user (a duplicate name is refused) | column, sortable | search |
| color | Color | single choice | yes | category-1 … category-8 (the foundation's categorical colour slots), shown as a swatch with its number; default category-1 | column | |

## List screen

- Default sort: name, A–Z.
- Page size: 25.
- Row actions: edit, delete (with confirmation). Deleting a category
  removes it from every task; the tasks themselves stay.

## Screens and access

- Screens: list, create, edit, delete.
- Ownership: **per-user**.
- Seeded for a new user, one colour slot each: Career, Health, Finance,
  Relationships, Personal Admin, Home, Technology, Hobby.

## Open questions

None for this entity on its own; the Task link to it waits on the
multi-reference gap in `task.md`.
