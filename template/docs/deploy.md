# Deploying

The shape this foundation is built for: one process. FastAPI serves the API
under `/api` and the built SPA at `/` (`backend/app/spa.py`), so the app is
same-origin, needs no CORS, and uses a plain session cookie. Database setup
is in [`cloud-postgres.md`](cloud-postgres.md) (hosted) or
[`home-lab-postgres.md`](home-lab-postgres.md) (a server you run).

## Checklist

Do these in order. Steps 3–5 are enforced: with `APP_ENV=production` the
backend refuses to start until they're done (`backend/app/deploy_checks.py`).

1. **Build the frontend with `npm run build:real`** — never plain
   `npm run build`. `VITE_API` is baked in at build time (`src/main.tsx`),
   so a plain build ships MSW and the deployed app serves mock data instead
   of calling the backend. `build:real` uses Vite's `real` mode
   (`.env.real`), which leaves MSW out of the bundle entirely. FastAPI
   serves `dist/` from `STATIC_DIR`.
2. **Migrate:** `cd backend && .venv/Scripts/python -m alembic upgrade head`
   against the production `DATABASE_URL`. On a fresh database, set
   `SEED_USER_EMAIL`/`SEED_USER_PASSWORD` to real values *before* this
   runs — migration `0002` seeds that account once, at migration time.
3. **Change any published default password.** If the seed account was
   created with the default (`dev-password-123`, printed in the README):
   `cd backend && .venv/Scripts/python scripts/set_password.py <email>`
   (prompts twice; or pipe the password in twice). This also ends that
   account's sessions.
4. **Serve over HTTPS and set `COOKIE_SECURE=true`**, so the session cookie
   is never sent over plain HTTP.
5. **Leave `DATA_LABEL` unset.** It names data that isn't production's
   (`dev`, `local`), and the app shows it in a banner on every screen. A
   `backend/.env` copied from local development carries one.
6. **Set `APP_ENV=production`.** Start the app; if it refuses, the error
   lists exactly what's left.

## Sign-in limits

`POST /api/auth/login` counts failed attempts in the database
(`login_failures`, `backend/app/login_limits.py`), so the counts survive a
restart and hold across worker processes. Over either limit it answers
**429** with `Retry-After` (seconds), and the login screen says so and holds
its button until then. The check runs before the password is checked, so an
answer over the limit says nothing about the password.

| Setting | Default | |
|---|---|---|
| `LOGIN_MAX_FAILURES_PER_IP`, `LOGIN_IP_WINDOW_SECONDS` | 10 in 900 (15 minutes) | one source guessing many passwords or accounts |
| `LOGIN_MAX_FAILURES_PER_ACCOUNT`, `LOGIN_ACCOUNT_WINDOW_SECONDS` | 20 in 3600 (1 hour), from any IP | one account guessed from many IPs |

A session starting clears that account's and that IP's failures. A wrong
email counts the same as a wrong password, and the table stores a hash of
the email, never the address.

- **The lockout trade-off.** Anyone who knows an email can fail on purpose
  and lock that account out for up to its window (an hour by default).
  That's the usual price of a per-account limit; the window is what keeps
  it short. Lower it if a lockout costs more than guessing does.
- **Behind a proxy, uvicorn must trust it**, or every request appears to
  come from the proxy and the per-IP limit becomes one limit for everyone:
  `uvicorn app.main:app --proxy-headers --forwarded-allow-ips=<the proxy's IP>`
  (or `FORWARDED_ALLOW_IPS`). Only list the proxy itself: whoever can reach
  uvicorn directly can otherwise send any `X-Forwarded-For` they like.
- A rate-limit rule at a CDN or proxy in front still helps, but the
  backend doesn't rely on it.

## Two-step sign-in (TOTP)

An account can require a code from an authenticator app after its password
(RFC 6238, any authenticator app; `backend/app/totp.py`). It's per account,
off until turned on, and these apps create accounts with a script, so it's
turned on with one too:

```bash
cd backend && .venv/Scripts/python scripts/enable_totp.py person@example.com
```

It prints the `otpauth://` URI (paste it into a QR code generator, or into
the app) and the secret to type in by hand, then asks for one code from the
app. Only a right code turns TOTP on, so a mistyped secret can't lock the
account. It then prints **ten recovery codes, once**: each signs in once in
place of a code. Keep them somewhere other than the phone. Running it again
replaces the secret and the codes. `TOTP_ISSUER` names the account in the
app.

Signing in then takes the password, then the code. Between the two, no
session exists: the server holds a pending sign-in for
`PENDING_LOGIN_TTL_SECONDS` (5 minutes) with `PENDING_LOGIN_MAX_TRIES` (5)
wrong codes, after which it starts again from the password. Wrong codes
also count toward the sign-in limits above, and a right password alone
never clears them, so a known password doesn't buy more guesses at codes.

**Lost the phone and the recovery codes:** the way back in is
`scripts/disable_totp.py <email>`, run by whoever has the server. The
password alone signs in afterwards.

**Encrypt database backups.** A TOTP secret has to be readable to check a
code, so it's stored as is (`users.totp_secret`), and a database dump
contains every secret. Treat dumps like the secrets they are: encrypted
before they leave the server (restic, as in
[`home-lab-postgres.md`](home-lab-postgres.md)). Encrypting the column
itself with a key from the environment would need a crypto dependency; it's
in `DEFERRED.md` as a decision, not a default.

## Error reporting

Every 500 the backend answers, and every failure the browser sees, goes
through one function, `report_error` (`backend/app/error_reporting.py`).
It always logs. With **`ERROR_REPORTING_DSN`** set, it also sends the error to
a Sentry-compatible server, which groups them, counts them and emails you.
Unset, the default, errors are logged and nothing is sent.

- **The DSN** is the project's address from that server's settings:
  `https://<key>@<host>/<project id>`. Use Sentry itself (hosted), or run
  your own Sentry-compatible server, such as
  [GlitchTip](https://glitchtip.com): one container with Postgres and
  Redis, e.g. beside the database in
  [`home-lab-postgres.md`](home-lab-postgres.md). Its project settings show
  the DSN the same way. The backend speaks Sentry's envelope protocol over
  plain HTTP (a small JSON POST, stdlib only, no SDK), in a background
  thread, so a failed request never waits on the destination and an
  unreachable one is only logged.
- **`RELEASE`** (the backend) and **`VITE_RELEASE`** (at frontend build
  time) name the build a report came from: set both to the commit.
- **The browser's reports** come from `FoundationProviders`'
  `errorReporting` (on in this template's `src/main.tsx`). That covers a
  crashed screen, an uncaught error or unhandled rejection, and a server
  failure (kind `server`) of a query or a save. Never a sign-in refused, a
  missing record, a validation error, too many attempts, or the network.
  The page posts them to its own backend, `POST /api/client-errors`, which
  forwards them, so the DSN never ships in the bundle. It needs a session,
  so nothing is sent from a signed-out page and the public can't post into
  it. The same error from one session goes through at most once a minute,
  and a session sends at most `CLIENT_ERRORS_PER_MINUTE` (10) a minute.
  Both are counted in each worker's memory. It needs a data router
  (`createBrowserRouter`), as the template has, to know the route.

**What a report holds:** the error's type, message and stack; the route
**pattern** (`/widgets/:id`, `/api/widgets/{widget_id}`), never the URL; the
HTTP method and status; the release and `APP_ENV`; the user's **id**, never
their email.

**What it never holds:** request or response bodies, cookies, headers, form
values, query strings. The code building a report is never handed the
request, only those fields. Messages and stacks are scrubbed on top of
that: a query string or fragment in any URL is cut, and so is a database
error's SQL and bound parameters (which hold row values). Tests check
this: `backend/tests/test_error_reporting.py` sends a request with a body,
a cookie, a header and a query string and looks for each in the envelope.
An error's own message can still say something about a record ("no widget
named …"), since it's the message, so keep personal data out of exception
messages.

