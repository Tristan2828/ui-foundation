# Cloud Postgres

`docker-compose.yml`'s local Postgres stays the default for day-to-day
development. This page covers the alternative: pointing the backend at a
hosted instance, which a real deployment needs anyway. The code is
provider-agnostic — it only requires standard Postgres reachable over
SSL — but the steps below use Supabase's free tier as the concrete worked
example, since that's what this repo has actually verified against
end-to-end (`scripts/check-phase-12.sh`).

## 1. Provision a free-tier Supabase project

1. Create an organization and a project at
   [supabase.com/dashboard](https://supabase.com/dashboard) (no card
   required on the free tier).
2. Copy your database password (set at project creation, or reset it from
   **Project Settings → Database**).

## 2. Use the pooler, not the "direct connection" host

Supabase's dashboard shows a "direct connection" string
(`db.<ref>.supabase.co`, port 5432) alongside a pooled one. **Use the
pooler, not the direct host** — confirmed the hard way while building this
feature: `db.<ref>.supabase.co` only has an IPv6 (`AAAA`) DNS record, not
an IPv4 (`A`) one, unless you pay for Supabase's IPv4 add-on. On a
network without IPv6 connectivity, `asyncpg` fails with
`socket.gaierror: [Errno 11001] getaddrinfo failed` (or the Linux/macOS
equivalent) trying to resolve it — a DNS failure, not a credentials
problem, and easy to misread as one.

The pooler host (shown on the same dashboard page, named something like
`aws-0-<region>.pooler.supabase.com`) resolves over IPv4 and works from
any network. It has two ports:

- **6543 — transaction mode** (Supabase's own dashboard default). Does
  **not** support prepared statements, which Alembic's migration DDL
  needs. `alembic upgrade head` against this port fails.
- **5432 — session mode**, same host. Behaves like a direct per-client
  connection and **does** support prepared statements. **Use this one.**

The pooler username has a different shape than the direct connection's
too: `postgres.<project-ref>`, not just `postgres`.

```bash
DATABASE_URL=postgresql+asyncpg://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
DATABASE_SSL=true
```

`DATABASE_SSL=true` makes `backend/app/config.py`'s `database_connect_args()`
pass SSL settings to `create_async_engine` — asyncpg's own SSL flag. This
is not the same thing as libpq's `sslmode=` query parameter, which
`postgresql+asyncpg://` URLs don't parse at all; don't try to put
`?sslmode=require` on the URL, it's silently ignored.

## 3. Certificate verification needs Supabase's own root CA

The second real gotcha, also only visible once you actually connect:
`DATABASE_SSL=true` alone verifies against the OS's public trust store,
and that fails against Supabase specifically —

```
ssl.SSLCertVerificationError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: self-signed certificate in certificate chain
```

This looks alarming (like a network doing TLS interception) but isn't —
Supabase's Postgres endpoints serve a cert chain rooted at their own
private CA (`Supabase Root 2021 CA`), separate from the publicly-trusted
cert their HTTPS dashboard uses. Verifying it means giving asyncpg that
root cert explicitly, via the optional `DATABASE_SSL_CA_FILE` env var
(`backend/app/config.py`'s `database_connect_args()` builds an
`ssl.SSLContext` from it instead of the default context when set).

To get the cert: your project's dashboard has it under **Project
Settings → Database → SSL Configuration** (a direct download). Or, since
it's just what the server presents during the TLS handshake, pull it
straight from a live connection with `openssl`, which also serves as a way
to sanity-check the chain:

```bash
echo | openssl s_client -connect aws-0-<region>.pooler.supabase.com:5432 \
  -starttls postgres -showcerts 2>/dev/null > /tmp/chain.txt

# splits the concatenated PEM blocks in chain.txt into cert1.pem, cert2.pem, ...
awk 'BEGIN{c=0} /-----BEGIN CERTIFICATE-----/{c++} {print > ("cert" c ".pem")}' /tmp/chain.txt

# the root is whichever cert has issuer == subject (self-signed)
for f in cert*.pem; do openssl x509 -in "$f" -noout -subject -issuer; done
```

Save the self-signed one (subject equals issuer) somewhere local — e.g.
`backend/certs/supabase-root-ca.pem` (this path is gitignored; it's not
committed, since it's specific to whichever provider you're using, not a
general-purpose default) — and set:

```bash
DATABASE_SSL_CA_FILE=./certs/supabase-root-ca.pem
```

A provider whose Postgres cert already chains to a public CA (some
managed providers do) needs `DATABASE_SSL=true` alone — leave
`DATABASE_SSL_CA_FILE` unset in that case.

## 4. Verify

`scripts/check-phase-12.sh` automates all of the above: it requires
`CLOUD_DATABASE_URL` (and optionally `CLOUD_DATABASE_SSL_CA_FILE`) to
already point at a provisioned instance — this script cannot provision one
for you — runs `alembic upgrade head` against it, runs
`backend/scripts/verify.sh` with the same env pointed at it, and curls a
live endpoint to confirm the app actually serves requests against the
hosted database. It also re-runs `check-phase-8.sh` to confirm the local
Docker Compose path still works unmodified — this feature is additive,
not a replacement.
