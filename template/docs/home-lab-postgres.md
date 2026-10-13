# Self-Hosted Postgres

The other way to give the backend a real database: a Postgres container on
a server you run (a home server, a NAS, any Docker host), shared by several
apps. The hosted route is [`cloud-postgres.md`](cloud-postgres.md). The
backend code is the same for both; only `DATABASE_URL` and `DATABASE_SSL`
differ.

| | Hosted ([`cloud-postgres.md`](cloud-postgres.md)) | Self-hosted (this page) |
|---|---|---|
| You run | Nothing: the provider does | The container, its disk, its backups |
| Backups | The provider's (check what the free tier keeps) | Yours: nightly encrypted dumps off the server, plus a restore drill |
| Reachable from | Anywhere, over TLS | Your home network and the apps' Docker network only |
| Fits | An app that needs to be up when your house isn't | Several personal apps on one server you already run, with the data at home |

This page is a recipe, not files to copy. The stack serves every app on
the server, so it lives with the server's other configuration, not in any
one app's repo. Every piece below was proven on a real server; the
**Gotchas** at the end are the ones that cost time.

## Shape

```
desktop / phone (home network) ──► <server LAN address>:5432 ─┐
                                                              ▼
  app stacks ── shared Docker network ──► postgres ── data dir on fast local disk
                                            ▲
                         backup ────────────┘
                           │ nightly: pg_dump → restic (encrypted on the server)
                           ▼
                         cloud bucket
```

The rules:

- **One database per app, owned by its own login role**, and that role can
  connect to no other database. A bug or a leaked password in one app
  reaches one app's data.
- **Never reachable from the internet.** Publish the port on the server's
  LAN address only, never `0.0.0.0`, never through a tunnel, no router
  port-forward. The apps are public through their own tunnels; their
  database isn't.
- **scram-sha-256 for every connection**, the container's own socket
  included.
- **Backups leave the server.** A snapshot on the same disks is a rollback,
  not a backup. Nightly dumps, encrypted before they leave, in a bucket.
- **A snapshot before every production write**, so a bad write is a
  rollback, not a restore.
- **A restore drill**, monthly. A backup nobody restored is a hope.

## 1. The stack

One Compose stack: Postgres and a backup container. The essentials:

```yaml
name: db

services:
  postgres:
    image: postgres:18
    container_name: db-postgres
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?}
      POSTGRES_HOST_AUTH_METHOD: scram-sha-256
      POSTGRES_INITDB_ARGS: --auth-local=scram-sha-256 --auth-host=scram-sha-256
      APP_ONE_DB_PASSWORD: ${APP_ONE_DB_PASSWORD:?}   # read by the init script only
    ports:
      - "${POSTGRES_BIND_ADDRESS:?}:5432:5432"        # the LAN address, not 0.0.0.0
    volumes:
      - ${POSTGRES_DATA_DIR:?}:/var/lib/postgresql    # postgres:18: this path, not .../data
      - ./initdb:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d postgres"]
    networks: [db]

  backup:
    build: ./backup
    restart: unless-stopped
    init: true                    # so `docker stop` reaches the scheduler
    environment:
      PGHOST: postgres
      PGUSER: postgres
      PGPASSWORD: ${POSTGRES_PASSWORD:?}
      RESTIC_REPOSITORY: ${RESTIC_REPOSITORY:?}
      RESTIC_PASSWORD: ${RESTIC_PASSWORD:?}
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:-}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY:-}
    depends_on:
      postgres: { condition: service_healthy }
    networks: [db]

networks:
  db:
    name: db    # a fixed name, so each app's stack can join it as external
```

- **The data directory** goes on fast local disk. On Unraid: a share on
  the SSD cache pool with no secondary storage (the parity array is slow
  for a database), given by its pool path (`/mnt/cache/<share>`), never
  `/mnt/user/<share>` (a FUSE layer). On a btrfs pool, turn copy-on-write
  off for that share when you create it; Postgres 18 checksums its own
  pages by default.
- **Secrets** go in the stack's `.env` (gitignored, `chmod 600`), each
  generated rather than typed: `openssl rand -base64 36 | tr -d '/+='`.
  **No `$` in any value:** Compose reads `$name` in `.env` as a variable.
- **Run it from its folder** with `docker compose up -d --build`, so the
  relative paths (`./initdb`, `./backup`) resolve.

## 2. Databases and roles

An init script in `initdb/` runs once, on the first start against an empty
data directory. Write it as a `.sh` that feeds SQL to psql: passwords go in
as psql variables and are read as `:'name'`, which psql turns into a quoted
literal, so no password is ever written into a file.

```bash
#!/usr/bin/env bash
set -euo pipefail
export PGPASSWORD="${PGPASSWORD:-$POSTGRES_PASSWORD}"
psql --no-psqlrc --quiet -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
  -v app_one_password="$APP_ONE_DB_PASSWORD" <<'SQL'
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;

SELECT 'CREATE ROLE app_one'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_one') \gexec
ALTER ROLE app_one WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  PASSWORD :'app_one_password';
SELECT 'CREATE DATABASE app_one OWNER app_one'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'app_one') \gexec
REVOKE ALL ON DATABASE app_one FROM PUBLIC;   -- only the owner (and superusers) connect
SQL
```

The `\gexec` guards make it safe to rerun by hand
(`docker exec db-postgres /docker-entrypoint-initdb.d/<script>.sh`), which
is also how a changed password in `.env` reaches its role. Repeat the block
per app. The owner can't drop its own database: it can't connect anywhere
else to do it.

**A read-only role** (for agents or reports) needs only:

```sql
GRANT pg_read_all_data TO app_one_ro;
GRANT CONNECT ON DATABASE app_one TO app_one_ro;
ALTER ROLE app_one_ro SET default_transaction_read_only = on;
```

It reads every table in `app_one`, today's and future ones, and nothing
elsewhere (it can connect nowhere else). Postgres refuses its writes by
privilege even if it switches read-only mode off.

**The app** connects as its owner role, over the shared network: its stack
joins `db` as `external: true`, and its `.env` has

```
DATABASE_URL=postgresql+asyncpg://app_one:<password>@postgres:5432/app_one
DATABASE_SSL=false
```

`DATABASE_SSL=false` because the traffic never leaves the server's private
Docker network. Its Alembic migrations then create tables the owner owns.

## 3. Nightly backups

The backup image is `postgres:18` (client tools of the server's major
version) plus restic, which encrypts on the server and talks to any bucket
provider, so the provider is a line in `.env`:

```dockerfile
FROM restic/restic:0.18.0 AS restic
FROM postgres:18
COPY --from=restic /usr/bin/restic /usr/local/bin/restic
# postgres:18 ships no CA certificates: without these restic can't verify
# the bucket's HTTPS ("x509: certificate signed by unknown authority").
COPY --from=restic /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
```

One run, per database:

```bash
restic backup --host db-server --tag "db:$db" --stdin-filename "$db.dump" \
  --stdin-from-command -- pg_dump --format=custom --dbname="$db"
```

then retention, once for all:

```bash
restic forget --host db-server --group-by host,paths \
  --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
```

- `--stdin-from-command` lets restic run `pg_dump` itself and keep **no**
  snapshot when it fails, so a half-written dump never counts as a backup.
- A **fixed `--host`**, not the container's hostname, so retention groups
  survive a rebuild.
- Schedule it inside the container (a loop that sleeps until a set time,
  with `TZ` set) or from the host's scheduler; either way, log each run.
- `restic init` once, by hand, so a wrong bucket URL fails loudly instead
  of creating a second repository.
- **The restic password is the only key to every backup.** Keep it in a
  password manager, away from the server.

## 4. Snapshot before write

A script on the server, run before any write to a production database,
that prints what it made so it can be rolled back:

- **`pg_dump` mode** (any filesystem): `pg_dump --format=custom` of the
  one database into a snapshots folder, written to a temporary name and
  renamed only when it's complete and non-empty. Keep the newest N per
  database, pruning only after a good dump.
- **ZFS mode** (if the data directory is on its own dataset): `zfs
  snapshot`, instant, but it covers every database at once and a rollback
  rewinds them all.

Run the dump inside the Postgres container
(`docker exec db-postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump …'`),
so the script never handles a password. Check the database name against a
strict pattern before it reaches SQL or a shell.

**Rolling back:** rename, then restore. `pg_restore --clean` fails when a
table was created after the snapshot, so instead: stop the app, rename the
database aside (`ALTER DATABASE app_one RENAME TO app_one_rolled_back_<time>`),
rerun the init script (it makes a fresh, empty `app_one` with the right
owner and walls), then `pg_restore` the snapshot into it. The renamed copy
keeps the bad state for checking; drop it when you're sure. Restoring a
backup from the bucket is the same three steps.

## 5. Restore drill

Monthly, and after any change to the backup job: restore each database's
latest backup into a scratch database (`<db>_restore_drill`) and print
every table's row count next to production's:

```sql
SELECT format('%s.%s', table_schema, table_name),
       (xpath('/row/n/text()', query_to_xml(
          format('SELECT count(*) AS n FROM %I.%I', table_schema, table_name),
          false, true, '')))[1]::text
FROM information_schema.tables
WHERE table_type = 'BASE TABLE'
  AND table_schema NOT IN ('pg_catalog', 'information_schema');
```

Pull the dump with `restic dump --host db-server --path "/$db.dump" latest
"/$db.dump"` into a file first: `pg_restore` can't seek in a pipe, which
rules out parallel (`-j`) and selective restores. Counts that differ by the day's writes are normal;
fail the drill when a restore fails or a table exists on only one side.
Drop the scratch database at the end.

## 6. Agents (optional)

If agents get access to production from a desktop, keep the guard rules
the hosted route has (reads allowed, writes ask, destructive things
denied):

- **Two MCP servers**, because one SQL tool can't tell a read from a
  write: one logs in as the read-only role (allowed), one as the owner
  (asks every time; its non-SQL tools denied).
- **The snapshot enforced, not remembered:** a Claude Code PreToolUse hook
  on the write server's SQL tool runs the snapshot script over SSH and
  blocks the call (exit 2) when no snapshot was taken, including on a
  timeout shorter than the hook's own.
- **Desktop only:** register them in Claude Code's `local` scope, not
  `.mcp.json`. Cloud sessions start a repo's `.mcp.json` servers without
  asking, and they have no route to a home database. Keep the connection
  strings in the desktop's environment, not in any config file.
- **Pin the server and its dependencies.** An MCP server that hasn't been
  released in a while can break on a newer version of its own SDK.

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Postgres refuses to start: data "in … (unused mount/volume)" | `postgres:18` expects one mount at `/var/lib/postgresql`, not `.../data` | Mount the parent |
| The init script didn't run | It only runs on an empty data directory | Run it by hand (`docker exec`); it's idempotent |
| A password with `$` in it is wrong | Compose interpolates `.env` | Letters and digits only |
| `restic init`: `x509: certificate signed by unknown authority` | `postgres:18` has no CA bundle | Copy the restic image's (§3) |
| Retention keeps everything after a rebuild | `--host` defaulted to the container's hostname | A fixed `--host` |
| `docker stop` takes 10 s on the backup container | The scheduler sleeps as PID 1 and ignores SIGTERM | `init: true`, and `sleep … & wait $!` with a trap |
| A rollback with `pg_restore --clean` fails | Objects created after the snapshot depend on what it drops | Rename, recreate, restore (§4) |
| `ALTER DATABASE … RENAME` refuses | Something is still connected | Stop the app; `DROP DATABASE … WITH (FORCE)` for a scratch one |
| Times in the logs or the schedule are off by hours | `TZ` unset, or not a full IANA name (a wrong one silently falls back to UTC) | A full name like `Europe/London`, not `GMT` |
| The app can't connect after the server's address changed | The port is bound to the LAN address | A DHCP reservation for the server |
