# Phase F — Entity Plans, New-App Setup, Data-Source Choice (2026-09-18)

First of two follow-ups the developer asked for after mapping a real
project (a Notion "Multiplayer Game List") onto the foundation. Phase G
(multi-select) is next. Branch `feat/entity-plans`, stacked on PR #25.

## Why

`/new-entity Invoice` handed the agent a name and nothing else, so every
Fresh UI Build's Invoice fields were whatever the agent thought an invoice
has. The developer will always come with a plan or talk one out — never
let the agent guess.

## What was built

- **`docs/entities/_template.md`** — the plan format: purpose, a field
  table (field, label, type, required, options/rules, list, filter), list
  screen, screens/ownership, open questions. Field types are split into
  *demonstrated by the Widget reference*, *close variants* (integer from
  decimal, url from email, date from date-time) and *not supported yet*
  (multi choice until Phase G, boolean, file) — an unsupported type stops
  the build instead of being improvised.
- **`docs/entities/widget.md`** — the demo entity as a filled-in plan,
  checked field by field against `openapi.yaml`.
- **The playbook's plan gate** (`docs/add-an-entity.md`, before Step 0):
  a plan file is the approved spec, built exactly; no plan means plan it
  with the developer, write the file, and wait for a go-ahead; open
  questions or unsupported types stop it. Steps 1 and 6 now derive the
  spec, columns, filters and form fields from the plan. The skill says the
  same in one line.
- **`consume-test.sh`** hands the Fresh UI Build agent a plan
  (`scripts/fixtures/entity-plans/invoice.md`, copied in as
  `docs/entities/invoice.md`), and `KEEP_APP=1` keeps an install for
  hand-run agent tests.
- **`docs/consuming.md`**: "Starting a new app" — the full scaffold
  (Vite, Tailwind, alias, `shadcn init` flags, `add starter`, MSW, git),
  which until now existed only inside `consume-test.sh` — and "Choosing a
  data source: Postgres or the Notion API". The Notion adapter is deferred
  (`DEFERRED.md`) until a project picks it; either way the frontend is
  identical, and a Notion-backed app still needs a thin server (the token
  is a secret; Notion's API can't be called from a browser).

## Evidence

- **Negative control — no plan:** a fresh agent in a fresh install given
  `/new-entity Game` read the playbook, found no `docs/entities/game.md`,
  read the template and example, asked for purpose/fields/list/ownership,
  and **changed no files** (5 turns). Its suggested fields were explicitly
  offered for the developer to correct, not built.
- **Fresh UI Build — with the Invoice plan** (pinned to `52f4f33`): PASS,
  68 vitest + 55 Playwright in the consuming app. The transcript shows the
  agent read `docs/entities/invoice.md`, and the spec it wrote matches the
  plan exactly: the seven planned fields and no others, the planned
  required set (dueDate and notes optional), status `draft/sent/paid`, and
  `search` + `status` as the only filters. No workarounds reported.
- The name "dogfood" was replaced by **Fresh UI Build** in every live doc
  and in `consume-test.sh`'s output (the developer's call; historical
  phase notes keep the old word).

## What the next session needs to know

- Phase G adds multi choice as a supported type; move it from "not
  supported" to "demonstrated" in `_template.md` when it lands.
- Any new Fresh UI Build entity needs a fixture in `scripts/fixtures/entity-plans/`.
