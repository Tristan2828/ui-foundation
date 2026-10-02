# Task — entity plan

The Task Dashboard app's main entity (format:
`docs/foundation/entity-plan-template.md`). Replaces three Notion
databases: Task Projects, House Projects and Learning List.

## Purpose

One thing I'd like to do someday: a project (including house projects,
which are projects in the Home category) or a topic to learn. It's a
personal "someday" list: no due dates and no assignee. Anything with a
date lives in Todoist. Used by me alone, to pick what to work on next given
what's possible right now.

## Fields

| Field | Label | Type | Required | Options / rules | List | Filter |
|---|---|---|---|---|---|---|
| title | Title | text | yes | 1–200 chars | column, sortable | search |
| type | Type | single choice | yes | project, learning (labels Project, Learning); default project | column, sortable | yes |
| status | Status | single choice | yes | idea, considering, doing, done, dropped (labels Idea, Considering, Doing, Done, Dropped), in that display order; default idea | column, sortable | yes |
| isFocus | Focus | boolean (**not supported yet**) | yes | default off. Only allowed while status is doing. At most 3 tasks across the whole list can have it on: turning on a 4th is refused with "You already have 3 focus tasks; unfocus one first." Moving status to done or dropped turns it off | column | yes |
| goal | Goal | text | no | up to 500 chars; empty means no goal written yet | column | |
| notes | Notes | long text | no | up to 20000 chars; I write Markdown in it; shown as plain text for now | | |
| effort | Effort | single choice | no | quick_win, small, large (labels Quick win, Small, Large). Quick win = minutes to about an hour; Small = one session of a few hours; Large = several sessions. Not set label: "Not sized" | column, sortable | yes |
| impact | Impact | integer | no | 1–4, picked from a list labelled Low, Medium, High, Critical and shown by label. Not set label: "Not rated" | column, sortable | yes |
| interest | Interest | integer | no | 1–5, picked from a list and shown as 1–5 stars. Meant for learning tasks but allowed on any. Not set label: "Not rated" | column, sortable | |
| costBand | Cost | single choice | no | free, under_50, from_50_to_250, from_250_to_1k, over_1k (labels Free, Under $50, $50–250, $250–1k, $1k+). Estimated materials/parts cost, not actual spend. Not set label: "Unknown" | column, sortable | yes |
| repairKind | Fix or Improvement | single choice | no | fix, improvement (labels Fix, Improvement). Fix = something broken; Improvement = an upgrade, nothing broken. Not set label: "Neither" | column | yes |
| categoryIds | Categories | multi reference → Category (**not supported yet**) | no | any number, no repeats; none means uncategorised | column | yes (any of) |
| requirementIds | Needs | multi reference → Requirement (**not supported yet**) | no | any number, no repeats; none means nothing special needed | column | yes (any of) |
| triggerIds | Waiting On | multi reference → Trigger (**not supported yet**) | no | any number, no repeats; none means not waiting on a life event | column | |
| blockedByIds | Blocked By | multi reference → Task (**not supported yet**) | no | other tasks that must be done first; can't include itself; no loops (A waits on B waits on A is refused) | column | |
| readiness | Can Do Now | computed, read-only (**not supported yet**) | — | worked out by the server, never stored. **waiting** if any trigger hasn't happened; else **blocked** if any blocked-by task isn't done; else **needs** if any requirement is unavailable; else **ready**. Labels: Ready, Needs…, Waiting, Blocked; "Needs…" names the missing requirements | column | yes |

Sub-records edited on the task's own page (**not supported yet**: the
playbook builds flat records only):

- **Checklist items**: text (1–300 chars), done (boolean), order. The
  list shows progress as "4/6"; a task with no items shows nothing.
- **Links**: url (required), label (optional, up to 100 chars), order.

## List screen

- Default sort: impact, highest first.
- Default filter: status is idea, considering or doing (done and dropped
  hidden).
- Page size: 25. A personal list of ~80 rows reads better in fewer pages.
- Saved views (`applyView`):
  - **Focus**: isFocus on.
  - **Ready now**: status doing or considering, readiness ready.
  - **Waiting on life events**: readiness waiting.
  - **Ideas**: status idea.
  - **Learning**: type learning.
  - **Done**: status done or dropped.
- Row actions: edit, delete (with confirmation).

## Screens and access

- Screens: list, create, edit, delete.
- Ownership: **per-user** (single user in practice).

## Open questions

These are foundation gaps, not product decisions. Each is marked
**not supported yet** above, so the playbook will stop on them until it
can build them:

1. **Boolean field** (isFocus; also the checklist's done, Requirement's
   isAvailable and Trigger's hasHappened).
2. **Multi reference field** (categoryIds, requirementIds, triggerIds,
   blockedByIds): today only a single `reference` or an enum
   `multi choice` exists.
3. **Sub-records edited on the parent's page** (checklist items, links).
4. **Computed, read-only field** shown and filtered in the list
   (readiness).
