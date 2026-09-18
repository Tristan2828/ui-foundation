# Maintenance — Post-v1.5.0 Review and Dependency Upgrades (2026-09-18)

Not a numbered phase: a review of the "done" project, the fixes it found,
and a round of dependency upgrades. One session, PRs #7–#15, tags `v1.6.0`
and `v1.7.0`. The *what* is summarized in `docs/STATUS.md` ("Post-v1.5.0
Maintenance" and "Dependency Upgrades"); this file is the *why* and what the
next session needs to know.

## What was built

| PR | Change | Tag |
|---|---|---|
| #7 | Per-user widget ownership (migration `0003`), SPA deep-link fallback (`backend/app/spa.py`), lowercase emails, expired-session cleanup, doc drift fixes | — |
| #8 | Supabase is the default dev database; Docker Compose kept for `dev.sh --local` and `check-phase-8.sh` | — |
| #9 | npm minor/patch updates within current majors | — |
| #10 | zod 3 → 4; `registry.json` pins `zod@^4.6.5` | `v1.6.0` |
| #11 | vite 7 → 8, @vitejs/plugin-react 5 → 6 | — |
| #12 | eslint 9 → 10, @eslint/js 10, globals 17, react-refresh 0.5 | — |
| #13 | TypeScript 5.9 → 6.0, `baseUrl` removed; TypeScript 7 deferred | `v1.7.0` |
| #14, #15 | README tag bump; Supabase setup recorded in `docs/BLOCKERS.md` | — |

## Deviations from plan

- **TypeScript 7 was the target; 6.0 shipped instead.** TS 7's package has
  no classic JS API, which typescript-eslint, openapi-typescript and
  react-docgen-typescript all need. Recorded in `docs/DEFERRED.md` with
  revisit conditions, rather than forced.
- **One `overrides` entry now exists** in `package.json`
  (`openapi-typescript` → `typescript: $typescript`), because
  openapi-typescript 7.13 still declares `typescript@^5.x` and `npm ci`
  rejects the mismatch. Approved by the developer. Remove it when the peer
  range catches up.
- **Per-user ownership was a behavior change, not just a doc note.** The
  review first proposed documenting "single-tenant"; the developer chose to
  fix it. Categories stayed shared on purpose.

## What the next session needs to know

**Open item:** the developer's own Supabase setup and applying migration
`0003` there — see `docs/BLOCKERS.md`. It needs the database password, so
an agent can't do it.

**Dependency-upgrade checklist** (each step caught a real problem this
session):

1. Upgrade one major per PR.
2. **Clean-install check before pushing.** `npm update`/`npm install` can
   leave a lockfile that local installs accept but CI's `npm ci` rejects
   (#9 failed CI this way — a nested `ajv-formats` out of range). Run
   `npm ci --dry-run`, or better a real `npm ci` in a fresh
   `git worktree`.
3. **`consume-test.sh --install-only <branch>`** whenever registry-shipped
   files change. It caught #10's unversioned `zod` resolving to zod 3 in a
   fresh app — nothing else would have.
4. **After a lint or compiler major, prove the checks still fire.** A clean
   pass can mean rules silently stopped running (Phase 4's `tsc` no-op).
   #12 linted a throwaway file with one deliberate violation per custom rule.
5. **ERESOLVE on an in-place upgrade isn't always real.** #11's
   `@babel/core@8` conflict came only from the old lockfile's tree;
   uninstall-then-install (or a no-lockfile resolve) was clean, so no
   `overrides` were needed there.
6. Tag after merge when registry-shipped content changed, then
   install-test the tag itself.

**Local verify gotchas (Windows):**

- **Stop `npm run dev` / `npm run storybook` before `npm run verify`.**
  Playwright's `reuseExistingServer` (outside CI) will test a running
  Storybook on :6006 instead of building the branch — all 24 Storybook
  screenshot tests failed on dark mode that way. Running servers also lock
  native files in `node_modules` (`lightningcss`, `esbuild`), so `npm ci`
  fails with EPERM and leaves `node_modules` half-deleted (`npm install`
  repairs it).
- The working copy uses CRLF; git normalizes to LF. Edit-by-script must
  match `\r\n` and read/write UTF-8 explicitly (Python's Windows default is
  cp1252, which corrupts em dashes).

**Still outdated on purpose:** TypeScript 7 (deferred) and `@types/node` 26
(tracks Node 26; CI runs Node 22 — upgrade together with Node).
