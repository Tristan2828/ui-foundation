# Audit Phase B — Auth Robustness (2026-09-18)

Second of five remediation phases — see `docs/AUDIT-2026-09-18.md`.
Branch `fix/auth-robustness`. Registry-shipped files changed (auth
boundary, app shell, login/register, `e2e/auth.spec.ts`), so this needs a
tag after merge.

## What was built

All of it lives in `src/auth/auth-provider.tsx` (still the only file that
knows how auth works) plus the two routes and the shell that consume it.

- **Session-scoped cache.** `startSession()`/`endSession()` drop every
  cached query except `['auth', …]` on login, register, logout and expiry.
  Widgets are per-user on the backend, so before this a second user on the
  same tab saw the first user's cached rows.
- **Mid-session expiry.** `AuthProvider` subscribes to the query and
  mutation caches; any non-auth request failing with `kind: 'auth'` ends
  the session, and `AppShell` redirects to `/login`. Previously each
  screen showed "Not authorized" inside a shell that still looked logged
  in.
- **Return-to.** `AppShell` passes `{ from }` as router state; login and
  register navigate back to it through `src/routes/return-path.ts`, which
  only accepts in-app paths (unit-tested against `//host` and absolute
  URLs). The "Create account"/"Sign in" links carry the state across.
- **Outage ≠ logged out.** `AuthStatus` gains `'unavailable'` (network or
  server error on `/auth/me` with no cached user); `AppShell` shows an
  `<ErrorState>` with retry. A 401 always means logged out, even with a
  cached user — a background refetch after expiry.
- `AuthContextValue` gains `error` and `retry`.

## Deviations

- **A deliberate logout must not record a return path.** The first
  version sent the next person to sign in back to the previous user's
  page, because `AppShell`'s redirect recorded `from` on logout too — the
  cache test caught it. A follow-up `navigate('/login')` after `logout()`
  doesn't work: it runs before React re-renders, and the `<Navigate>` that
  render produces starts a second navigation that wins (confirmed via
  `history.state`). Fixed with an `isLoggingOut` state flag set before
  logout starts.
- **Cache clearing uses `removeQueries` with a predicate, not `clear()`.**
  `clear()` also removes the auth query `AuthProvider`'s own observer is
  bound to, and the observer doesn't attach to the replacement that
  `setQueryData` creates.

## What the next session needs to know

- Negative control done: with cache clearing disabled, the cache test
  fails (previous rows render instantly, no loading state).
- Dogfood evidence is in the PR.
- After merge: tag `v1.9.0`, `consume-test.sh --install-only v1.9.0`,
  README tag.
- Next is **Phase C — backend correctness and deploy safety**. It needs
  Docker running (`check-phase-8.sh` forces the local Postgres).
