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

## Known gaps before exposing it publicly

Tracked in [`DEFERRED.md`](DEFERRED.md) — fine for a personal or internal
deployment, not for an open one:

- **No error reporting.** Server errors go to uvicorn's log only.
