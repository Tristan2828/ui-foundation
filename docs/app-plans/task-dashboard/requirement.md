# Requirement — entity plan

Part of the Task Dashboard app (format:
`docs/foundation/entity-plan-template.md`). Replaces House Projects' Tags.

## Purpose

Something a task needs before I can do it: a person, a skill, a tool or my
own physical condition. Each one is marked available or not *right now*,
and tasks that need an unavailable one drop out of the "Ready now" view
until I mark it available again.

## Fields

| Field | Label | Type | Required | Options / rules | List | Filter |
|---|---|---|---|---|---|---|
| name | Name | text | yes | 1–100 chars; unique per user | column, sortable | search |
| kind | Kind | single choice | yes | person, skill, tool, physical (labels Person, Skill, Tool, Physical); default person | column, sortable | yes |
| isAvailable | Available Now | yes/no | yes | default on; filter labels Any, Available, Unavailable; flipped straight from its row, without opening the form | column, toggle | yes |

## List screen

- Default sort: kind, then name.
- Page size: 25.
- Row actions: edit, delete (with confirmation). Available Now flips in
  its own column (above), not from a row action.
  Deleting a requirement removes it from every task.

## Screens and access

- Screens: list, create, edit, delete.
- Ownership: **per-user**.
- Seeded for a new user (all available): Helper, Colin, Plumber (person);
  Woodworking (skill); Special tool, 3D printer (tool); Back OK
  (physical).

## Open questions

None.
