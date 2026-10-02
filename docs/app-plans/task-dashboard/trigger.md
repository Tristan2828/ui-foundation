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
| hasHappened | Happened | yes/no | yes | default off; filter labels Any, Happened, Not yet; flipped straight from its row | column, toggle | yes |
| waitingCount | Tasks Waiting | computed | — | how many tasks list this trigger under Waiting On (a scalar subquery); sorts as a number | column, sortable | |

## List screen

- Default sort: name, A–Z.
- Page size: 25.
- Row actions: edit, delete (with confirmation). Happened flips in its
  own column (above), not from a row action. Deleting
  a trigger removes it from every task.

## Screens and access

- Screens: list, create, edit, delete.
- Ownership: **per-user**.

## Open questions

None.
