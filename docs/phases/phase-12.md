# Phase 12 — Cloud Postgres Support

## What was built

- **`backend/app/config.py`**: `DATABASE_SSL` (bool, unchanged from the
  plan) plus a new `DATABASE_SSL_CA_FILE` (optional path) that the plan
  didn't anticipate — see Deviations. A shared `database_connect_args()`
  function turns these into the `connect_args` dict asyncpg needs, used
  by both `app/db.py` (the app's own engine) and `backend/migrations/
  env.py` (Alembic's independently-constructed engine) — a real shared
  helper, not duplicated conditionals, since the two call sites need
  byte-identical logic.
- **`backend/.env.example`**: a second, commented block with the
  cloud-Postgres shape — corrected mid-phase from the plan's original
  guess (see Deviations) to what actually works: the pooler host on its
  session-mode port, plus `DATABASE_SSL_CA_FILE`.
- **`docs/cloud-postgres.md`** (new): Supabase free-tier provisioning,
  the pooler-vs-direct-host gotcha, the CA-pinning gotcha (including a
  copy-pasteable `openssl s_client` recipe to extract a provider's root
  CA from a live connection instead of hunting for a download link), and
  what `check-phase-12.sh` automates.
- **`docker-compose.yml`**: header comment updated to say "the local
  option," not "the only option," pointing at the new doc.
- **`scripts/check-phase-12.sh`** (new): requires `CLOUD_DATABASE_URL`
  (and optionally `CLOUD_DATABASE_SSL_CA_FILE`), fails fast with a
  pointer to the doc if unset — same "a human must actually provision
  this" shape as Phase 8's Docker requirement. When set: `alembic
  upgrade head` against it, `backend/scripts/verify.sh` with the same
  env, a live `uvicorn` + `curl` round trip on a scratch port (`:8001`,
  to avoid colliding with `check-phase-8.sh`'s `:8000` later in the same
  run), then chains onto `check-phase-8.sh` to prove the local Docker
  path is unaffected. The cloud env vars are `export`ed inside a
  `set_cloud_env` function called only within subshells — not at the
  script's top level — specifically so they don't leak into
  `check-phase-8.sh`'s own environment when it runs later in the same
  process (see Deviations for why this needed a second pass).
- **`.gitignore`**: `backend/certs/` — where a developer's own
  downloaded/extracted provider CA file lives locally. Not shipped;
  every provider's is different.
- **`docs/DEFERRED.md`**: the "Cloud Postgres" row removed (its stated
  revisit condition, ✅ met by this phase existing).

## Deviations from plan

The plan (`docs/BUILD-PLAN.md` Phase 12) described this as: add
`DATABASE_SSL`, wire `connect_args={"ssl": True}` into `db.py` and
`migrations/env.py`, use the "direct connection port" for migrations,
document Supabase as the worked example. That's what got built first —
and it's exactly what Phase 8's and Phase 10's own write-ups already
warned this project to expect: **structural checks pass against every
broken version until you actually run the thing.** Running
`check-phase-12.sh` against a real, freshly-provisioned Supabase project
surfaced two real, unrelated failures the plan's text had no way to
anticipate, both fixed properly rather than worked around:

1. **Supabase's "direct connection" host (`db.<ref>.supabase.co`,
   the one the plan said to use for migrations) only has an IPv6 DNS
   record**, not IPv4, unless you pay for Supabase's IPv4 add-on.
   `asyncpg` failed with `socket.gaierror: [Errno 11001] getaddrinfo
   failed` on this network. Diagnosed with a plain `nslookup` — confirmed
   an `AAAA` record and no `A` record. Fix: use the connection pooler
   instead, specifically its **session-mode port (5432)**, not the
   dashboard-default transaction-mode port (6543) — transaction mode
   doesn't support the prepared statements Alembic's DDL needs, which was
   the *other* gotcha the plan's text already correctly anticipated, just
   attached to the wrong host. Confirmed via `nslookup` that the pooler
   host resolves over IPv4 on the same network where the direct host
   didn't.
2. **Supabase's Postgres TLS certificate chains to a private root CA**
   (`Supabase Root 2021 CA`), not a publicly-trusted one — unlike their
   HTTPS/dashboard endpoints, which do use a normal cert. `DATABASE_SSL=
   true` alone (the plan's entire design for this flag) verifies against
   the OS trust store and fails with `SSLCertVerificationError:
   self-signed certificate in certificate chain` — a message that reads
   like TLS interception/a MITM but isn't. Confirmed genuine (not a
   network attacker) by pulling the full chain with `openssl s_client
   -showcerts` and checking it verifies cleanly against its own root with
   `openssl verify -CAfile`. Fix: the new `DATABASE_SSL_CA_FILE`, not in
   the original plan, builds an explicit `ssl.SSLContext(cafile=...)`
   instead of asyncpg's default `ssl=True` context.

A third, smaller bug surfaced while wiring `check-phase-12.sh` itself,
caught before it ever produced a wrong result rather than by a broken
run: an array-expanded `"${CA_ARGS[@]}"` value that looks like
`NAME=value` is **not** re-parsed by bash as an env-var-assignment
prefix the way a literal token is — only lexical `VAR=val` tokens in the
command's own source get that treatment. The first version of the script
passed the CA file path this way and bash tried to execute
`DATABASE_SSL_CA_FILE=/path/to/cert.pem` as a command. Fixed by
`export`-ing inside a function called within each cloud-pointed
subshell instead. That fix introduced its own near-miss: the first
correction used a top-level `export`, which would have leaked
`DATABASE_URL` pointed at the cloud instance into `check-phase-8.sh`'s
environment when it runs later in the same script — silently pointing
the "prove local Docker still works" check at the cloud database
instead. Caught by tracing the variable's scope before running it again,
not by a failed run.

`docs/cloud-postgres.md` and `backend/.env.example` were both written
once already (before real testing) and then corrected in place — worth
noting only because it means anyone who read this repo's history mid-phase
would have seen since-fixed wrong guidance. The versions committed here
reflect what was actually verified to work.

## What the next session needs to know

- `npm run verify` (frontend) is unaffected — this phase touches no
  frontend or registry-shipped path. `backend/scripts/verify.sh` (mypy,
  pytest, spec conformance) passes clean with the new
  `database_connect_args()` helper.
- `scripts/check-phase-12.sh` **PASS**, run against a real, freshly
  provisioned free-tier Supabase project (org `ui-foundation`, project
  `ui-foundation-cloud-pg`, region `us-west-2`) — not simulated. Included
  the full chain: `alembic upgrade head` over the pooler with CA
  verification, `backend/scripts/verify.sh` against the same, a live
  `uvicorn`+`curl` round trip, and a clean `check-phase-8.sh` chain
  proving the local Docker path still works unmodified.
- **Not tagged** — same reasoning as Phase 8: `git diff` shows no
  registry-shipped path changed, so there's no registry release to
  version.
- **Merged — this phase is fully done.** Opened as PR #5
  (`phase-12-cloud-postgres` → `main`), following the Phase 9/10/11
  precedent of going through a PR under branch protection rather than a
  direct push. Merged by the developer (merge commit `60e01d4`); local
  `main` fast-forwarded, and the branch was deleted both locally and on
  GitHub (auto-deleted on merge).
- **Real, unresolved Supabase-platform oddity, not this repo's bug,
  worth knowing about if cloud-Postgres work continues here**: for a
  stretch of this session, the Supabase Management API (`GET /v1/
  organizations`, `supabase projects list`) returned an authenticated
  `200 OK` with an empty list for the developer's account, across three
  separately-generated personal access tokens (including one created
  with an explicit organization scope selected) — while the dashboard
  correctly showed the org and, later, the project. It started working
  partway through the session with no code-side change on our end; the
  most likely explanation is server-side propagation delay on Supabase's
  side after org/project creation, but this was never confirmed. If a
  future session hits `orgs list`/`projects list` returning empty despite
  the dashboard showing resources, this is a known false alarm — retry
  later rather than assuming the token or account is broken.
- The provisioned Supabase project (`ui-foundation-cloud-pg`) still
  exists on the developer's account, seeded with this repo's schema via
  the migration that ran during verification. It's free-tier and costs
  nothing sitting idle, but the developer should decide whether to keep
  it around for future cloud-Postgres testing or delete it.
- The developer's Supabase database password and several personal access
  tokens were shared in plaintext in this session's chat transcript
  (there was no browser-automation path available to avoid it, and no
  Supabase MCP server was connected). Worth rotating both after this
  session if that transcript's persistence is a concern — this is a
  one-time cleanup item, not a recurring one.
