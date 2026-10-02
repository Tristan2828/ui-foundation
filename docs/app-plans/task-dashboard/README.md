# Task Dashboard — app plans

Entity plans for the Task Dashboard app, written before the app exists so
they aren't lost. **This folder is not part of the foundation.** Once the
app is created (`scripts/create-app.sh task-dashboard <tag>`), copy these
files to the app's `docs/entities/` and delete them here.

| Plan | Build order | Ready for the playbook? |
|---|---|---|
| [`category.md`](category.md) | 1 | Yes |
| [`trigger.md`](trigger.md) | 2 | No: needs a row toggle and a computed count |
| [`requirement.md`](requirement.md) | 3 | No: needs a row toggle |
| [`task.md`](task.md) | 4 | No: needs a computed field |

Yes/no fields shipped in foundation 3.4.0, multi reference in 3.5.0,
sub-records in 3.6.0.

## Decisions behind the plans

- **One `tasks` table with a `type` column**, not one table per Notion
  database. House projects are `type = project` in the Home category.
- **Free Time Activities is not part of this app.**
- **No dates of any kind.** It's a someday list; dated work lives in
  Todoist. Adding an optional date later is one column and one migration.
- **Focus is a flag on Doing tasks**, capped at 3 across the whole list.
- **Sub-tasks are a checklist** on the task, not full child tasks.
- **Requirements and triggers filter what's shown** through the computed
  readiness field.

## Moving the Notion data

The import itself is a separate job (not something the playbook builds).
How values map over:

| Notion | New |
|---|---|
| Stage Idea / Considering / Doing / Done | status idea / considering / doing / done |
| Stage Focus | status doing + isFocus on (3 tasks today, which fits the cap) |
| Learning Interested / Learning / Done / Gave Up | idea / doing / done / dropped |
| Impact Low / Med / High / Critical | impact 1 / 2 / 3 / 4 |
| Learning Priority Could / Should / Must | impact 1 / 2 / 3 |
| Interest ⭐ to ⭐⭐⭐⭐⭐ | interest 1–5 |
| Project Goal, Learning Why? | goal |
| Area / Category (Life becomes Personal Admin; Area "Idea" is dropped) | categoryIds |
| Every House Projects row | type project + Home category |
| House Type Fix / Improvement | repairKind |
| House Cost | costBand |
| Tags: Extra Hands Needed, Colin's Expertise, Plumbers Expertise | requirements Helper, Colin, Plumber |
| Tags: Wood Work Needed, Special Tool Needed, 3D Print Parts Needed, Need Stable Back | requirements Woodworking, Special tool, 3D printer, Back OK |
| Tag: Cut Down Trees First | a new task "Cut down trees", which the landscaping task is blocked by |
| Activation Trigger (4 values) | 4 triggers, none happened yet |
| Key Resource, page links | links |
| Page body | notes; its checkboxes become checklist items |
| Assignee, Deadline, Created/Last edited | dropped |
