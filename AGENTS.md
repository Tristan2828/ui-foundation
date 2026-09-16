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
  (Enforced: PreToolUse hook blocks the install; check-deps fails verify.)
- NEVER hand-write an API type. All types come from src/api/schema.d.ts,
  which is generated. If a type is missing, run `npm run gen:api`.
  (Enforced: codegen diff in verify.)
- NEVER use a raw hex value or a Tailwind palette color (bg-blue-500).
  Semantic tokens only: bg-primary, text-muted-foreground.
  (Enforced: ESLint token rule; dark-mode screenshots.)
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
  openapi.yaml. (Enforced: the spec-tester subagent cannot read gateway/.)

## Required States
Every data view handles: loading, empty, error, and success.
Use <Skeleton>, <Empty>, and the error boundary. Do not omit these.
Every screen has one Playwright test per state, forced via MSW overrides.

## Scope and Stopping
- Work on exactly one phase per session. The phase is named in the
  session's opening instruction. Do not begin the next phase.
- A phase is done when `scripts/check-phase-N.sh` exits zero. Not before,
  not after. Your own judgment of completeness is not an input.
- If the check cannot be made to pass, or an instruction conflicts with
  current library docs, or a change would exceed this plan's scope:
  write docs/BLOCKERS.md (what, why, what you tried), commit, and stop.
  Do not guess, do not widen scope, do not wait.
- Ideas that are out of scope go in docs/DEFERRED.md, not in code.
- At the end of every session, write docs/phases/phase-N.md: what was
  built, what deviated from the plan and why, what the next session
  needs to know. The next session has no memory of this one.

## Correct Patterns
```tsx
// Error handling — AppError, never a raw response
const { data, error } = useWidgets(query)
if (error) return <ErrorState error={error} />   // error is AppError

// Validation — server field errors bind straight to the form
form.setError(field, { message: err.fieldErrors[field][0] })

// Color — semantic tokens only
<div className="bg-card text-card-foreground border-border" />
```

## Before You Finish
Run `npm run verify`. It must pass. Do not report a task complete
on a failing gate — the developer does not review this code by reading it.
(Enforced: the Stop hook runs verify:fast and will not let you stop on
a failure, once that hook is added — see docs/BUILD-PLAN.md Phase 0 table.)

## Reference Implementations — Copy These Patterns
- Data table:  src/routes/widgets/widgets-table.tsx
- Create/edit: src/routes/widgets/widget-form.tsx
- App shell:   src/components/app/app-shell.tsx
- New entity:  docs/add-an-entity.md  (invoke as /new-entity <Name>)

(These files do not exist yet as of Phase 0 — they land in Phases 3-4.)

## Full Plan
The complete build plan, including architecture, verification strategy,
and phase-by-phase detail, is at `docs/BUILD-PLAN.md`. Read it in full at
the start of every session.
