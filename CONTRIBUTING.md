# Contributing

This is a small, invite-only project. If you have push access, here's the
workflow.

## Setup

```
npm ci
npx playwright install --with-deps
```

## Workflow

1. Push to `main` directly, or branch off it and open a PR. `main` needs
   no review and no passing checks (it only refuses force-pushes and
   deletion). Open a PR when a change touches anything `registry.json`
   ships: only a PR runs the install test before the release is tagged.
2. Make your change. Read `AGENTS.md` first; it has the hard rules this
   codebase enforces (semantic color tokens only, no hand-rolled shadcn
   components, kebab-case filenames, etc.) and where the reference
   implementations live.
3. Stop any running `npm run dev` / `npm run storybook` first — Playwright
   reuses a server already on its port instead of building your branch, and
   running servers lock files in `node_modules` on Windows. For dependency
   changes, also run a clean `npm ci` (see
   `docs/phases/maintenance-2026-09-18.md`).
4. Run `npm run verify` locally before pushing. It is the same check CI
   runs (`.github/workflows/verify.yml`, on every PR and every push to
   `main`), but nothing blocks a push on it any more, so a failure on
   `main` shows up only after it has landed.

## Scope

If a task is split into phases (see `docs/ARCHITECTURE.md` and `docs/phases/`),
stick to one phase per PR. If something's blocked or out of scope,
write it up in `docs/BLOCKERS.md` or `docs/DEFERRED.md` rather than
guessing or expanding scope.
