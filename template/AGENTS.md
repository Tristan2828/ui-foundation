<!-- ui-foundation:start — synced from @tristan2828/ui-foundation by `npx ui-foundation sync`. Don't edit inside this block: your app's own notes go below it, and a change to the rules belongs in the foundation. -->

# Built on @tristan2828/ui-foundation

## Stack
Vite + React 19 + TypeScript, Tailwind v4, shadcn/ui (Base UI primitives),
React Router v7, TanStack Query. The shared layer — primitives, the
`DataTable`/`EntityView`/`EntityForm` composites, the app shell, auth,
the gateway error seam, design tokens, lint rules — is the npm package
`@tristan2828/ui-foundation`, updated by bumping its version. Everything in
`src/` is this app's own.

Contract-first: `openapi.yaml` is the source of truth and is owned by this
app. In development MSW serves the contract, so there may be no backend at
all.

Pinned tool versions live in `deps-allowlist.json` (`tools`). Never use
`@latest` for a tool command.

## Hard Rules
Each rule names the check that enforces it. If you hit the check, the check
is right. Do not disable, skip, or work around it.

- NEVER copy a file out of `node_modules/@tristan2828/ui-foundation` to
  change it, and never patch it in place. Configure it through its props, or
  raise the change for the foundation (see "Changing the Foundation"). A
  copied composite is a file maintained twice with nothing saying so.
  (Enforced: lint forbids importing the package's internals, and a shipped
  primitive from anywhere but the package.)
- NEVER hand-roll a component that exists in shadcn. Import it from
  `@tristan2828/ui-foundation/ui/<name>` if the package ships it; otherwise
  run `npx shadcn@<tools.shadcn> add <name>` into `src/components/ui/`. If
  that also writes a primitive the package ships (a dependency of the one
  you asked for), delete the copy and import the package's. (Enforced: lint
  rejects `@/components/ui/<name>` for any primitive the package ships.)
- NEVER add a dependency that is not in `deps-allowlist.json`. If you
  believe one is needed, write the case in `docs/BLOCKERS.md` and stop.
  (Enforced: `ui-foundation check-deps` in verify.)
- NEVER hand-write an API type. All types come from `src/api/schema.d.ts`,
  generated from `openapi.yaml`. If a type is missing, run `npm run gen:api`.
  (Enforced: codegen diff in verify.)
- NEVER change the foundation's part of `openapi.yaml` — the `/auth/*` paths
  and the error envelopes. The package's code calls exactly those shapes.
  (Enforced: `ui-foundation check-contract` in verify.)
- NEVER use a raw hex value or a Tailwind palette color (`bg-blue-500`).
  Semantic tokens only: `bg-primary`, `text-muted-foreground`. (Enforced:
  the foundation's ESLint token rule; axe contrast in light and dark mode,
  `e2e/a11y.spec.ts`.)
- NEVER fetch in `useEffect`. All server state goes through TanStack Query.
  (Enforced: eslint-plugin-query + the no-bare-fetch rule.)
- NEVER read auth state outside `useAuth()`. The package exports nothing
  else that knows how auth works. (Enforced: the package's exports.)
- NEVER import `@tristan2828/ui-foundation/gateway` outside
  `src/api/gateway/`. Components and hooks call a gateway module through
  TanStack Query. (Enforced: no-restricted-imports.)
- NEVER add a database table or column without a comment. The migration
  that creates it also runs `COMMENT ON TABLE` / `COMMENT ON COLUMN`,
  saying what it holds in words someone with only database access can use:
  units, what null means, which table an id points at. A second agent with
  credentials and no repo reads the schema alone. Applies to an app with a
  Postgres backend. (Enforced: `backend/scripts/check_db_comments.py`, run
  by `scripts/check-backend-postgres.sh` after `alembic upgrade head`.)
- NEVER let a backend-shaped response reach a component. Paginated data is
  `Page<T>`. Failures are `AppError`. Queries are `QuerySpec`. The gateway
  translates; nothing above it knows the wire format. (Enforced: gateway
  return types are the contracts; tsc.)
- NEVER write a gateway test by reading the gateway. Tests come from
  `openapi.yaml`. (Enforced in Claude Code: the spec-tester subagent cannot
  read `src/api/gateway/`. In other tools: write them before the gateway
  exists — `docs/foundation/add-an-entity.md` step 3.)
- NEVER name a file in PascalCase or snake_case. Kebab-case everywhere —
  routes, components, hooks, tests (`widget-form.tsx`, not
  `WidgetForm.tsx`). (Enforced: eslint-plugin-check-file.)
- NEVER edit a synced file: this block, `docs/foundation/`, and the agent
  files under `.claude/` and `.codex/` that `ui-foundation sync` writes.
  (Enforced: `ui-foundation sync --check` in verify.)

## Required States
Every data view handles: loading, empty, error, and success. Use
`<Skeleton>`, `<Empty>`, and the error boundary — `DataTable` already does,
and `EntityView` (one record) adds not found: a plain 404, never a retry.
Every screen has one Playwright test per state, forced via MSW overrides
(`@tristan2828/ui-foundation/testing`).

## Design Language
Colour, tone, badges, cell patterns and density follow
`docs/foundation/design-language.md` and `docs/foundation/cell-patterns.md`.
A pattern the foundation lacks is worth raising there: the design language
grows in the package so every app gets it, with axe contrast coverage in
both themes.

## Scope and Stopping
- Do the task you were given and nothing beyond it. A task is done when
  `npm run verify` passes — not when it feels complete.
- If verify cannot pass without breaking a Hard Rule, an instruction
  conflicts with current library docs, or the change would exceed the
  task's scope: write `docs/BLOCKERS.md` (what, why, what you tried) and
  stop. Do not guess, do not widen scope.
- Ideas that are out of scope go in the app's backlog, not in code.

## Correct Patterns
```tsx
// Error handling — AppError, never a raw response
const { data, error } = useWidgetsQuery(query)
if (error) return <ErrorState error={error} />   // error is AppError

// Validation — server field errors bind straight to the form
form.setError(field, { message: err.fieldErrors[field][0] })

// Color — semantic tokens only
<div className="bg-card text-card-foreground border-border" />

// Forms — FieldGroup wraps every field, never a bare <label>+<input> stack
<FieldGroup>
  <Field>
    <FieldLabel htmlFor="name">Name</FieldLabel>
    <Input id="name" {...register('name')} />
  </Field>
</FieldGroup>
```

## Tooling
Look up shadcn component APIs with `npx shadcn@<tools.shadcn> view <name>`
before guessing props — component APIs move between releases and training
data lags them. The package's own props are in its type declarations
(`node_modules/@tristan2828/ui-foundation/dist/**/*.d.ts`).

## Before You Finish
Run `npm run verify`. It must pass. Do not report a task complete on a
failing gate. The developer reviews results — the running app, a
screenshot, an options page — not every line, so the gates are the safety
net.

## Adding an Entity
Follow `docs/foundation/add-an-entity.md` (in Claude Code, `/new-entity
<Name>` is a shortcut to it). It builds from the entity's plan,
`docs/entities/<entity>.md`; if there's no plan, work one out with the
developer first. Never guess the fields. The files it copies are the
Widgets demo's until the app removes it; after that, the `### Reference
files` section below names the app's own.

## Upgrading the Foundation
```bash
npm install @tristan2828/ui-foundation@<version>
npx ui-foundation sync
npm run verify
```
Read the release notes between your version and the new one first
(https://github.com/Tristan2828/ui-foundation/releases). `sync` rewrites
this block, `docs/foundation/` and the agent files; commit what it writes.

## Changing the Foundation
The package is shared by every app. When this app needs something it
doesn't do:
1. Prefer a prop or slot the package already has.
2. If the change is generic — another app would want it — raise it in the
   foundation repo (an issue, or a PR against `packages/ui-foundation`), and
   build this app's screen once the release ships. That's the path a fix
   takes to reach every app.
3. If it is truly this app's alone, build it in `src/` on top of the
   package's exports — a new component, not a modified copy of one.

<!-- ui-foundation:end -->

## This app

The foundation's template: a working app with one demo entity, Widgets
(`src/routes/widgets/`, `docs/entities/widget.md`), which is the reference
to copy when adding an entity. Replace this section with what the app is,
and anything an agent needs that the rules above don't cover.

- Screens: `src/routes/`; routes in `src/App.tsx`; sidebar in `src/nav.ts`.
- Data: `openapi.yaml` → `src/api/schema.d.ts` (generated) →
  `src/api/gateway/` → TanStack Query hooks beside each screen.
- Mocks: `src/mocks/` (MSW), validated against `openapi.yaml` by
  `tests/mocks/conformance.test.ts`.
- Backend: `backend/`, a reference implementation of `openapi.yaml`
  (`npm run verify:backend`; `scripts/check-backend-postgres.sh` against
  real Postgres).

### Reference files

What `docs/foundation/add-an-entity.md` copies for each pattern. Here, the
Widgets demo. Before deleting the demo, rewrite each row to name this
app's own file for that pattern, and drop a row only if no entity here
uses the pattern (the playbook then stops and asks).

| Pattern | Copy |
|---|---|
| Gateway module and its contract tests | `src/api/gateway/widgets.ts`, `tests/gateway/widgets.test.ts` |
| Query hooks, mutations, saving one field (`useSaveWidgetField`) | `src/routes/widgets/use-widgets.ts` |
| Form schema, form ↔ wire conversion | `src/routes/widgets/widget-schema.ts` |
| Table, toolbar filters, URL state | `src/routes/widgets/widgets-table.tsx` |
| Saved views, columns per view | `VIEWS` and the "Saved views" group in `widgets-table.tsx` |
| Columns, stable column definitions, title linking to the view | `src/routes/widgets/widgets-columns.tsx`, `category-names.tsx` |
| Values shared by table and view (badge maps, formatters) | `src/routes/widgets/widget-format.ts` |
| View: sections, not-set labels, Markdown | `src/routes/widgets/widget-view.tsx` |
| Quick actions on the view (status picker, yes/no switch, ticking sub-record items) | `src/routes/widgets/widget-quick-actions.tsx` |
| Delete with a confirm dialog, in the view's header | `src/routes/widgets/delete-widget-action.tsx` |
| Form, returning to the view | `src/routes/widgets/widget-form.tsx` |
| `reference` (searchable combobox) | Category in `widget-form.tsx`, over `src/routes/widgets/use-widget-categories.ts` |
| `multi reference`, lookup by ids | Extra Categories in `widget-form.tsx` and `widgets-table.tsx`; `src/api/gateway/widget-categories.ts` (`getWidgetCategoriesByIds`) |
| `single choice` | Status in `widget-form.tsx` and `widgets-table.tsx` |
| `multi choice`, option labels | Tags in `widget-form.tsx`, `widgets-table.tsx`, `widgets-columns.tsx`; `WIDGET_TAG_LABELS` in `widget-schema.ts` |
| `yes/no` marked `toggle` | `src/routes/widgets/in-stock-toggle.tsx` |
| `computed` | Progress (`checklistState`): `widget-schema.ts`, `widgets-columns.tsx`, the backend's `routers/widgets.py` |
| Sub-records | Checklist in `widget-form.tsx` (edited) and `widget-quick-actions.tsx` (ticked on the view; the read-only markup is in `docs/foundation/add-an-entity.md`) |
| Mocks | `src/mocks/data.ts`, `src/mocks/handlers.ts` |
| Screen states and specs | `e2e/widgets-table.spec.ts`, `e2e/widget-view.spec.ts`, `e2e/widget-form.spec.ts` |
| Backend router, model, migration | `backend/app/routers/widgets.py`, `backend/app/models.py`, `backend/migrations/versions/` |
