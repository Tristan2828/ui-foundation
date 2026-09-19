## Stack
Vite + React 19 + TypeScript, Tailwind v4, shadcn/ui (Base UI primitives),
React Router v7, TanStack Query. Contract-first: openapi.yaml is the source
of truth and is owned by this repo. In development, MSW serves the
contract — there may be no backend at all.

Pinned tool versions live in `deps-allowlist.json`. Do not use `@latest`
for any tool command in this repo.

## Hard Rules
Each rule names the check that enforces it. If you hit the check, the
check is right. Do not disable, skip, or work around it.

- NEVER hand-roll a component that exists in shadcn. Run
  `npx shadcn@4.21.0 add <name>` instead. (Enforced: dependency
  allowlist + registry diff at review.)
- NEVER add a dependency that is not in deps-allowlist.json. If you
  believe one is needed, write the case in docs/BLOCKERS.md and stop.
  (Enforced: scripts/check-deps.mjs fails verify.)
- NEVER hand-write an API type. All types come from src/api/schema.d.ts,
  which is generated. If a type is missing, run `npm run gen:api`.
  (Enforced: codegen diff in verify.)
- NEVER use a raw hex value or a Tailwind palette color (bg-blue-500).
  Semantic tokens only: bg-primary, text-muted-foreground.
  (Enforced: ESLint token rule; axe contrast in light and dark mode,
  e2e/a11y.spec.ts.)
- NEVER fetch in useEffect. All server state goes through TanStack Query.
  (Enforced: eslint-plugin-query + no-restricted-syntax on fetch.)
- NEVER read auth state outside useAuth(). auth-provider.tsx is the only
  file that knows how auth works. (Enforced: no-restricted-imports.)
- NEVER import from api/transport/ outside api/gateway/. Components and
  hooks consume the gateway. (Enforced: no-restricted-imports.)
- NEVER let a backend-shaped response reach a component. Paginated data is
  Page<T>. Failures are AppError. Queries are QuerySpec. The gateway
  translates; nothing above it knows the wire format. (Enforced: gateway
  return types are the contracts; tsc.)
- NEVER write a gateway test by reading the gateway. Tests come from
  openapi.yaml. (Enforced in Claude Code: the spec-tester subagent cannot
  read gateway/. In other tools: write them before the gateway exists —
  docs/add-an-entity.md step 3.)
- NEVER name a file in PascalCase or snake_case. Kebab-case everywhere —
  routes, components, hooks, tests (`widget-form.tsx`, not `WidgetForm.tsx`).
  (Enforced: eslint-plugin-check-file's filename-naming-convention rule.)

## Required States
Every data view handles: loading, empty, error, and success.
Use <Skeleton>, <Empty>, and the error boundary. Do not omit these.
Every screen has one Playwright test per state, forced via MSW overrides.

## Scope and Stopping
- Do the task you were given and nothing beyond it. A task is done when
  `npm run verify` passes — not when it feels complete.
- If verify cannot be made to pass without breaking a Hard Rule, or an
  instruction conflicts with current library docs, or the change would
  exceed the task's scope: write docs/BLOCKERS.md (what, why, what you
  tried), commit, and stop. Do not guess, do not widen scope, do not wait.
- Ideas that are out of scope go in docs/DEFERRED.md, not in code.

## Correct Patterns
```tsx
// Error handling — AppError, never a raw response
const { data, error } = useWidgets(query)
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
Look up current shadcn component APIs via the shadcn MCP server
(`npx shadcn@4.21.0 mcp init --client claude`) or `npx shadcn@4.21.0 view
<name>` before hand-guessing props — component APIs move between releases
and training data lags them.

## Before You Finish
Run `npm run verify`. It must pass. Do not report a task complete
on a failing gate — the developer does not review this code by reading it.
No hook enforces this; running `verify` before you stop is on you. CI runs
it again on every pull request.

## Reference Implementations — Copy These Patterns
- Data table:   src/routes/widgets/widgets-table.tsx (thin consumer of the
  `<DataTable>` composite, src/components/app/data-table.tsx)
- Create/edit:  src/routes/widgets/widget-form.tsx (thin consumer of the
  `<EntityForm>` composite, src/components/app/entity-form.tsx)
- Query hooks:  src/routes/widgets/use-widgets.ts, use-categories.ts
- Form schema:  src/routes/widgets/widget-schema.ts (zod schema + form ↔
  wire conversion functions)
- Error display: src/components/app/error-state.tsx (`<ErrorState>`,
  keyed by `AppError.kind`)
- App shell:    src/components/app/app-shell.tsx
- New entity:   docs/add-an-entity.md (any tool; `/new-entity <Name>` in
  Claude Code)

Copy the routes/widgets/* files per entity. Extend the composites
(data-table.tsx, entity-form.tsx) in place — they are shared, not
per-entity.

## Adding an Entity
In any AI tool, follow `docs/add-an-entity.md` — it's plain instructions,
not tied to one tool. It starts from the entity's plan,
`docs/entities/<entity>.md`: build exactly that, and if there's no plan,
work one out with the developer first. Never guess the fields. (Claude
Code's `/new-entity <Name>` is a shortcut to the same file.)

## Updating the Foundation
This app was installed from the `Tristan2828/ui-foundation` registry.
Never re-run `shadcn add .../starter --overwrite` here — it resets
openapi.yaml, routes, nav and mocks to the demo. Follow
https://github.com/Tristan2828/ui-foundation/blob/main/docs/consuming.md
(`--dry-run`, then `--diff` per file).

## Working in the ui-foundation Repo Itself
Skip this section in an app that installed this registry — it has no
`docs/ARCHITECTURE.md`, and everything it needs is above and in
`docs/add-an-entity.md`.

If `docs/ARCHITECTURE.md` exists, you are in the foundation repo:
- Read `docs/ARCHITECTURE.md` at the start of every session (its gates
  table says which checks a change needs), plus `docs/STATUS.md` and any
  open item in `docs/BLOCKERS.md`. `docs/BUILD-PLAN.md` is history — read
  the part you need, not the whole file.
- Work on the one task or phase named in the opening instruction. It is
  done when every gate that `docs/ARCHITECTURE.md` lists for that kind of
  change passes.
- A change to any path `registry.json` ships needs
  `scripts/consume-test.sh` against the **commit SHA** (never a branch)
  before merge, and a tag after it.
- At the end of the session, write `docs/phases/<name>.md`: what was
  built, what deviated and why, what the next session needs to know. The
  next session has no memory of this one.
