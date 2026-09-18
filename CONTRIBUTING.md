# Contributing

This is a small, invite-only project. If you have push access, here's the
workflow.

## Setup

```
npm ci
npx playwright install --with-deps
```

## Workflow

1. Branch off `main` — no direct pushes to `main`, it's protected.
2. Make your change. Read `AGENTS.md` first; it has the hard rules this
   codebase enforces (semantic color tokens only, no hand-rolled shadcn
   components, kebab-case filenames, etc.) and where the reference
   implementations live.
3. Stop any running `npm run dev` / `npm run storybook` first — Playwright
   reuses a server already on its port instead of building your branch, and
   running servers lock files in `node_modules` on Windows. For dependency
   changes, also run a clean `npm ci` (see
   `docs/phases/maintenance-2026-09-18.md`).
4. Run `npm run verify` locally before opening a PR. This is the same
   check CI runs, and it's required to pass before merge.
5. Open a PR into `main`. CI (`.github/workflows/verify.yml`) runs
   automatically; it must pass and the PR must get one approving review
   before it can merge.

## Scope

If a task is split into phases (see `docs/BUILD-PLAN.md` if present),
stick to one phase per PR. If something's blocked or out of scope,
write it up in `docs/BLOCKERS.md` or `docs/DEFERRED.md` rather than
guessing or expanding scope.
