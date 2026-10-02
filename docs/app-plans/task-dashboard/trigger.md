# Trigger — entity plan

Part of the Task Dashboard app (format:
`docs/foundation/entity-plan-template.md`). Replaces Task Projects'
Activation Trigger.

## Purpose

A life event some tasks are waiting on ("Health insurance change"). Until
it has happened, the tasks waiting on it stay in the "Waiting on life
events" view; once I mark it happened, they become doable.

## Fields

| Field | Label | Type | Required | Options / rules | List | Filter |
|---|---|---|---|---|---|---|
| name | Name | text | yes | 1–100 chars; unique per user | column, sortable | search |
| hasHappened | Happened | boolean (**not supported yet**) | yes | default off; toggled straight from the list row | column | yes |

## List screen

- Default sort: name, A–Z.
- Page size: 25.
- Row actions: toggle happened, edit, delete (with confirmation). Deleting
  a trigger removes it from every task.
- Each row shows how many tasks wait on it.

## Screens and access

- Screens: list, create, edit, delete.
- Ownership: **per-user**.

## Open questions

1. Boolean field (hasHappened), and toggling it from the list row: the
   same gap as `task.md` open question 1.
2. The "tasks waiting" count is a computed, read-only field: the same gap
   as `task.md` open question 4.
