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
| hasHappened | Happened | yes/no | yes | default off; filter labels Any, Happened, Not yet; toggled straight from the list row (**not supported yet**) | column | yes |
| waitingCount | Tasks Waiting | computed | — | how many tasks list this trigger under Waiting On (a scalar subquery); sorts as a number | column, sortable | |

## List screen

- Default sort: name, A–Z.
- Page size: 25.
- Row actions: toggle happened, edit, delete (with confirmation). Deleting
  a trigger removes it from every task.

## Screens and access

- Screens: list, create, edit, delete.
- Ownership: **per-user**.

## Open questions

1. Toggling a yes/no straight from the list row (the field itself is
   supported since 3.4.0; today it's changed on the edit form).
