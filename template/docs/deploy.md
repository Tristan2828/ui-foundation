# Deploying

The shape this foundation is built for: one process. FastAPI serves the API
under `/api` and the built SPA at `/` (`foundation_backend.spa`, from the backend's `ui-foundation-backend` package), so the app is
same-origin, needs no CORS, and uses a plain session cookie. Database setup
is in [`cloud-postgres.md`](cloud-postgres.md) (hosted) or
[`home-lab-postgres.md`](home-lab-postgres.md) (a server you run).

## Checklist

Do these in order. Steps 1 and 3–5 are enforced: with `APP_ENV=production`
the backend refuses to start until they're done (`foundation_backend.deploy_checks`).

1. **Build the frontend with `npm run build:real`** — never plain
   `npm run build`. `VITE_API` is baked in at build time (`src/main.tsx`),
   so a plain build ships MSW and the deployed app serves mock data instead
   of calling the backend. `build:real` uses Vite's `real` mode
   (`.env.real`), which leaves MSW out of the bundle entirely. FastAPI
   serves `dist/` from `STATIC_DIR`. The build writes
   `dist/build-info.json` (the foundation's Vite plugin, `vite.config.ts`),
   and production refuses to start when it's missing or says `"mock"`.
   Set `BUILD_COMMIT` and `BUILD_PR` for this build too ("Which build is
   live" below).
2. **Migrate:** `cd backend && .venv/Scripts/python -m alembic upgrade head`
   against the production `DATABASE_URL`. On a fresh database, set
   `SEED_USER_EMAIL`/`SEED_USER_PASSWORD` to real values *before* this
   runs — migration `0002` seeds that account once, at migration time.
3. **Change any published default password.** If the seed account was
   created with the default (`dev-password-123`, printed in the README):
   `cd backend && .venv/Scripts/python -m foundation_backend.scripts.set_password <email>`
   (prompts twice; or pipe the password in twice). This also ends that
   account's sessions.
4. **Serve over HTTPS and set `COOKIE_SECURE=true`**, so the session cookie
   is never sent over plain HTTP.
5. **Leave `DATA_LABEL` unset.** It names data that isn't production's
   (`dev`, `local`), and the app shows it in a banner on every screen. A
   `backend/.env` copied from local development carries one.
6. **Set `APP_ENV=production`.** Start the app; if it refuses, the error
   lists exactly what's left.

## Which build is live

The sidebar's footer names the build that's running: `Version 3655449 ·
PR #139`, linking to the PR, or to the commit when there's no PR. The
values are read at build time by the foundation's Vite plugin
(`buildInfo()` in `vite.config.ts`) from three variables, and also land
in `dist/build-info.json`:

| Variable | |
|---|---|
| `BUILD_COMMIT` | the commit being built. Unset or empty: no version entry |
| `BUILD_PR` | the PR's number, when the build comes from one |
| `BUILD_REPO_URL` | the repository's web address, `https://github.com/<owner>/<app>`. Or set `repoUrl` once in `vite.config.ts`. Without either, the commit shows unlinked |

In development (`npm run dev`) nothing is shown. Building in GitHub
Actions:

```yaml
- run: npm run build:real
  env:
    BUILD_COMMIT: ${{ github.event.pull_request.head.sha || github.sha }}
    BUILD_PR: ${{ github.event.pull_request.number }}
    BUILD_REPO_URL: ${{ github.server_url }}/${{ github.repository }}
```

A push to `main` from a merged PR has no PR number in its event; to name
the PR there, look it up first
(`gh pr list --state merged --search "$GITHUB_SHA" --json number -q '.[0].number'`)
or leave it, and the entry links to the commit. In a Dockerfile, the
same as build args, set before the build step:

```dockerfile
ARG BUILD_COMMIT=""
ARG BUILD_PR=""
ARG BUILD_REPO_URL=""
ENV BUILD_COMMIT=$BUILD_COMMIT BUILD_PR=$BUILD_PR BUILD_REPO_URL=$BUILD_REPO_URL
RUN npm run build:real
```

`docker build --build-arg BUILD_COMMIT=$(git rev-parse HEAD) --build-arg BUILD_PR=139 .`

**Which schema it migrates to.** With `alembic` (the template passes
`backend/migrations/versions`), `build-info.json` also says `schema`: the
head revision, read from the migration files. A live site whose
`/build-info.json` names the latest revision was built from those
migrations, so with `alembic upgrade head` run before the app starts, it
proves the deploy migrated. Two heads (a branch nobody merged) fail the
build, as `alembic upgrade head` would refuse them. A Docker build stage
that builds the frontend needs `backend/migrations/versions` copied in
before `npm run build:real`.

Anything else a build should say about itself goes in `extra`, a function
whose fields are merged into the file:
`buildInfo({ extra: () => ({ region: process.env.REGION ?? null }) })`.
It can't set the plugin's own fields (`api`, `commit`, `pr`, `builtAt`,
`schema`); the build fails if it tries.

The build's commit also suits `VITE_RELEASE` and `RELEASE` ("Error
reporting" below), so a report and the sidebar name the same build.

## Sign-in limits

`POST /api/auth/login` counts failed attempts in the database
(`login_failures`, `foundation_backend.login_limits`), so the counts survive a
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
- **Behind a CDN or tunnel that appends to `X-Forwarded-For`** (Cloudflare and
  `cloudflared`, most CDNs), uvicorn takes the left-most address, which the
  client wrote, so it can pick its own per-IP key and step around that limit
  (the per-account limit still holds). Set `CLIENT_IP_HEADER` to a header
  the provider always overwrites with the address it saw, e.g.
  `CLIENT_IP_HEADER=CF-Connecting-IP` (Cloudflare), `True-Client-IP`,
  `Fly-Client-IP`. The per-IP key is then that header's value, falling back
  to the usual address when it's missing. **Set it only if every request
  reaches the app through that proxy.** If the app can be reached another
  way (a published port, another proxy, a hostname that skips the CDN), the
  client can send the header itself and choose its key again, which is worse
  than the default. Unset, it's ignored.
- A rate-limit rule at a CDN or proxy in front still helps, but the
  backend doesn't rely on it.

## Two-step sign-in (TOTP)

An account can require a code from an authenticator app after its password
(RFC 6238, any authenticator app; `foundation_backend.totp`). It's per account,
off until turned on, and these apps create accounts with a script, so it's
turned on with one too:

```bash
cd backend && .venv/Scripts/python -m foundation_backend.scripts.enable_totp person@example.com
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
`python -m foundation_backend.scripts.disable_totp <email>`, run by whoever has the server. The
password alone signs in afterwards.

**Encrypt database backups.** A TOTP secret has to be readable to check a
code, so it's stored as is (`users.totp_secret`), and a database dump
contains every secret. Treat dumps like the secrets they are: encrypted
before they leave the server (restic, as in
[`home-lab-postgres.md`](home-lab-postgres.md)). Encrypting the column
itself with a key from the environment would need a crypto dependency; it's
in `DEFERRED.md` as a decision, not a default.

## AI chats (MCP)

Off by default. With **`MCP_ENABLED=true`** the backend lets an AI chat
(Claude on the web, phone, desktop or CLI, or any client that speaks the
Model Context Protocol) read and write the app's records, the way a
note-taking tool's own connector does: paste a record's link into the chat
and it reads it; ask it to change something and it writes back. Off, every
address below answers 404.

- **Turn it on:** `alembic upgrade head` (migration `0011`), then set
  `MCP_ENABLED=true` and **`MCP_PUBLIC_URL`** to the app's public https
  address with no path (`https://app.example.com`). Behind a proxy the app
  can't know that address, so `APP_ENV=production` refuses to start with MCP
  on and no https `MCP_PUBLIC_URL`.
- **Connect a chat:** in Claude, Settings → Connectors → add a custom
  connector with the address `https://app.example.com/mcp`. The chat
  registers itself, then opens the app's approval page. **Be signed in to the
  app in that browser first**; if you aren't, the page says so and links to
  `/login`, and you connect again afterwards. Approve, and the chat can use
  the tools. The approval page is behind the app's own sign-in, so its
  login limits and two-step sign-in apply.
- **What a chat can do:** `fetch` a record by its address
  (`/widgets/3`), `search` titles, `list` an entity with its filters, sort
  and paging, `create` and `update` a record, and `delete` and `restore`
  one that deletes softly. A chat acts as the user who
  approved, so it sees exactly that user's records. `create` and `update`
  run the entity's own router code, so the validation is the API's, and a
  refused field comes back to the chat as text. **`delete` only marks a
  record deleted** (`deleted_at`); `restore` brings it back, and `list`
  with `filters: {"deleted": true}` finds the deleted ones. It is marked
  destructive, so the chat asks before each call, and it takes one record
  per call. An entity that deletes for good (a row removed) gets no
  delete tool: leave `delete` and `restore` off its `McpEntity`.
  An entity is reachable only if it is listed in
  `backend/app/mcp_entities.py`; add each new entity there (its router
  functions, a title field, the fields shown in a list, the fields that
  point at other entities). A field only an importer or another script
  may write goes in its `script_only`: chats read it, and `create` and
  `update` refuse it (`docs/foundation/add-an-entity.md` "Fields only a
  script writes").
- **Addresses** are the records' pages in the app, so a link copied from
  a screen works as it is: `/widgets/3`, or the full link with the app's
  host. An entity whose pages sit under a section gives its `McpEntity` a
  `path`: with `path="/media/channels"`, a chat reads
  `/media/channels/3`, and every address the tools hand back (created,
  search, list) is that page. The API's own form (`/api/<entity>/<id>`)
  works too, so a copied request URL can be pasted; an API grouped by
  module gives the entity an `api_path` (`api_path="/api/media/channels"`
  reads `/api/media/channels/3`). Two entities can't share a path or an
  API path; the backend refuses to start if they do.
- **The log:** every create, update, delete and restore is a row in `mcp_audit_log`: the
  user, the chat, the time, the entity and record, and the changed fields
  before and after (JSON, as the API names them; the whole record for a
  delete or restore). Nothing prunes it.
  `SELECT at, action, entity, record_id, before, after FROM mcp_audit_log
  ORDER BY at DESC;` It is written right after the change is saved, so a
  database failing between the two would leave a change unlogged.
- **Ending a connection:** `DELETE FROM oauth_grants WHERE user_id = …`
  (or one `client_id`) ends it at once; the chat has to be approved again.
  A chat can also call `POST /oauth/revoke`. Access tokens last
  `MCP_ACCESS_TOKEN_TTL_SECONDS` (an hour); the refresh token behind them
  `MCP_REFRESH_TOKEN_TTL_DAYS` (30) and is replaced at every refresh. A
  refresh token used twice ends the connection.
- **Limits:** a chat is refused past `MCP_REQUESTS_PER_MINUTE` (120) on one
  connection (counted in each worker's memory), at most `MCP_MAX_CLIENTS`
  (50) chats can be registered at once (ones never approved are dropped
  after a day), and registration and token requests are limited per client
  address.
- **Behind an access proxy** (Cloudflare Access, an identity-aware proxy,
  a VPN gateway): the AI provider's servers call `/mcp` and the OAuth
  addresses themselves, not through your browser, so a proxy that demands
  its own sign-in blocks them. Let these paths through without it (a
  bypass policy for the path, or the provider's published egress addresses,
  which its documentation lists and which change):
  `/mcp`, `/oauth/register`, `/oauth/token`, `/oauth/revoke`,
  `/.well-known/oauth-authorization-server` and
  `/.well-known/oauth-protected-resource` (and the same with `/mcp` after
  it). `/oauth/authorize` and `/login` are opened by *you* in a browser, so
  the proxy can keep protecting them. Nothing else changes: every request
  to `/mcp` still needs an access token this app issued.
- **Redirect addresses:** a chat may register only `https` addresses and
  `http` on `localhost`, `127.0.0.1` or `[::1]`, matched exactly. `/mcp`
  also refuses a browser request whose `Origin` isn't the app's own.

## Scheduled jobs

Work that runs every so often inside the app's own process: pulling from
an outside service, a nightly cleanup. A job is an async function that
gets a database session of its own and returns a short summary of what it
did (or None), registered once at import time, e.g. in the module that
defines it, imported from `app/main.py`:

```python
from datetime import timedelta
from app.jobs import register_job

async def sync_feeds(session: AsyncSession) -> str | None:
    added = ...
    return f"{added} new"

register_job("sync-feeds", every=timedelta(minutes=15), run=sync_feeds)
# run_at_start=True: the first run soon after startup, not 15 minutes later.
# timeout=timedelta(minutes=5) is the default; a run past it fails.
```

- **When they run:** with **`JOBS_ENABLED`**, which is on by default with
  `APP_ENV=production` and off otherwise, so a dev server and the tests run
  a job only when asked. Each job waits `every` after its last run, plus a
  jitter (up to a tenth of `every`, at most a minute), so jobs started
  together don't fire on the same second.
- **One run at a time, once per interval, across processes.** On Postgres
  each run holds an advisory lock for the job. Another process (a second
  replica, a reload's overlap) skips rather than waits. A scheduled run
  also skips when the job started less than `every` ago anywhere. So with
  several replicas the job still runs about once per interval.
- **A failure never stops the schedule.** An exception, or the timeout, is
  logged, sent through `report_error` ("Error reporting" below, tagged
  with the job's name) and recorded; the next run comes on time.
- **What happened:** every run is a row in `job_runs` (started, finished,
  outcome `ok`/`failed`/`skipped`, the error, the job's summary), kept
  `JOB_RUNS_KEEP_DAYS` (30). `GET /api/jobs` lists each job's schedule,
  whether it's running and its last run (skipped ones left out);
  `SELECT * FROM job_runs ORDER BY started_at DESC` shows everything.
- **Run one now:** `POST /api/jobs/<name>/run`, signed in. It starts in the
  background and answers 202 with the job running, or 409 if it already
  is. A run started by hand isn't held to the schedule.

Not built in, by decision: cron expressions, queues, retries with
backoff, a separate worker process. A job that must retry does it inside
its own run.

## Reminders (Web Push)

Notifications at times users chose, reaching them with the app closed
(`docs/foundation/reminders.md`). Off by default; with it off `/api/push/*`
answers 404 and nothing else changes. To turn it on:

1. **Install the push extra** where the backend runs:
   `pip install -e ".[push]"` (PyCA's `cryptography`, with `cffi` and
   `pycparser`; prebuilt for Linux, macOS and Windows).
2. **Make the VAPID key pair, once:**
   `cd backend && .venv/Scripts/python scripts/generate_vapid_keys.py`.
   Set the `VAPID_PRIVATE_KEY` it prints as a secret in the deployment's
   environment, never in the repo. Keep it: every device subscribes with
   its public half, so a new key stops every device's reminders until each
   allows them again.
3. **Set `VAPID_SUBJECT`** to how a push service can reach whoever runs
   the app: `mailto:ops@example.com` or an `https://` page.
4. **Set `PUSH_ENABLED=true`.** The app refuses to start, in any
   environment, while the extra, the key or the subject is missing.
5. **Serve over HTTPS.** Browsers allow push only on a secure origin
   (`localhost` counts, for development).

- **Sending** goes only to the browsers' push services:
  `PUSH_ALLOWED_HOSTS` (default `fcm.googleapis.com`,
  `updates.push.services.mozilla.com`, `push.apple.com`,
  `notify.windows.com`, each with its subdomains). The endpoint comes from
  the browser, so anything else is refused when it's saved and when it's
  sent to, and a redirect is never followed.
- **The reminders job** (`send-reminders`, every minute) is registered
  with push on and runs with `JOBS_ENABLED` ("Scheduled jobs" above).
  `GET /api/jobs` shows its last run: "2 due: 3 sent, 1 gone".
- **Check it end to end:** allow reminders in the app, then
  `.venv/Scripts/python scripts/send_test_push.py <email>`. It prints
  `1 sent` when the push service took it.
- **A device that's gone** (the person unsubscribed, cleared site data or
  uninstalled) answers 404 or 410 to the next send, and its row is
  deleted. `SELECT * FROM push_subscriptions` lists every device.

## Error reporting

Every 500 the backend answers, and every failure the browser sees, goes
through one function, `report_error` (`foundation_backend.error_reporting`).
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
- **Noise it drops on its own** (4.29): `Script error.` from a script on
  another origin, and an uncaught error none of whose stack frames is in
  one of the app's scripts: every frame at a page's own address (a script
  the browser or an extension injected, such as Firefox for iOS's
  `__firefox__`) or in an extension (`chrome-extension://`, …). A screen
  that crashed and a failed request are never dropped this way. For a
  pattern of your own, pass `errorReporting={{ release, ignore: (report) => … }}`:
  return true to drop it.
- **After a deploy** (4.29), a tab still running the build before it can't
  load that build's lazy chunks any more. `FoundationProviders` handles
  it, reporting on or off: on Vite's `vite:preloadError` it reloads the
  page once onto the new build, and nothing is reported. If the chunk
  fails again within a minute of that reload (a file missing from the new
  build too), it's let through to the screen's error and reported. Don't
  add a listener of your own.

**What a report holds:** the error's type, message and stack; the route
**pattern** (`/widgets/:id`, `/api/widgets/{widget_id}`), never the URL; the
HTTP method and status; the release and `APP_ENV`; the user's **id**, never
their email.

**What it never holds:** request or response bodies, cookies, headers, form
values, query strings. The code building a report is never handed the
request, only those fields. Messages and stacks are scrubbed on top of
that: a query string or fragment in any URL is cut, and so is a database
error's SQL and bound parameters (which hold row values). Tests check
this: the backend package's `tests/test_error_reporting.py` sends a request with a body,
a cookie, a header and a query string and looks for each in the envelope.
An error's own message can still say something about a record ("no widget
named …"), since it's the message, so keep personal data out of exception
messages.

