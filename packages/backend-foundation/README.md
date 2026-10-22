# ui-foundation-backend

The auth and security layer shared by the FastAPI + SQLModel backends of
apps built on [ui-foundation](https://github.com/Tristan2828/ui-foundation):
the half of every app's backend that apps never change on purpose. Import
package `foundation_backend`. Released with `@tristan2828/ui-foundation`,
under the same version number, from the same commit.

## What's in it

| Module | What it is |
|---|---|
| `config` | The settings it reads from the environment (database, cookies and sessions, sign-in limits, TOTP, error reporting, AI chats' OAuth, the seeded account) and `database_connect_args()` |
| `db` | The async engine and the `get_session` dependency |
| `models` | `User`, `Session`, `LoginFailure`, `RecoveryCode`, `PendingLogin`, `OAuthClient`, `OAuthCode`, `OAuthGrant` (table names `users`, `sessions`, …) |
| `schemas` | `CamelModel`, `Page`, the sign-in and error-envelope schemas |
| `security`, `totp`, `login_limits`, `rate_window` | Password and token hashing, the TOTP step, failed sign-in limits, an in-memory rate window |
| `errors`, `error_reporting`, `openapi_responses` | Error bodies pinned to the contract, `report_error`, the shared `responses=` fragments |
| `deploy_checks`, `spa` | What `APP_ENV=production` refuses to start with; the SPA mount with its client-route fallback |
| `routers.auth` | `router` (login, the TOTP step, logout, me) and `register_router` (`POST /auth/register`), with `get_current_user` |
| `routers.environment`, `routers.client_errors`, `routers.oauth` | `GET /environment`, `POST /client-errors`, AI chats' OAuth sign-in (off unless `MCP_ENABLED`) |
| `scripts.set_password`, `scripts.enable_totp`, `scripts.disable_totp` | Run as `python -m foundation_backend.scripts.<name> <email>` from the app's `backend/` |
| `testing.signed_in` | `session_cookie`, to sign a test client in for real |
| `migrations/` | Reference copies of the Alembic revisions that create these tables; never run from here ([`migrations/README.md`](src/foundation_backend/migrations/README.md)) |

An app keeps everything else: its entities, models, routers and
migrations, and, in the template, MCP's tools, scheduled jobs and Web
Push.

## How an app uses it

`backend/pyproject.toml` pins it to the release the app is on, the same
version as its `@tristan2828/ui-foundation`:

```toml
dependencies = [
  "ui-foundation-backend==4.25.0",
  ...
]
```

The app's own modules re-export it, so `from app.models import User`
keeps working (the template's `app/config.py`, `db.py`, `models.py`,
`schemas.py`, `openapi_responses.py`, `security.py`, `errors.py`, `spa.py`
do this), and its `main.py` includes the routers it offers:

```python
from foundation_backend.routers import auth, client_errors, environment, oauth

app.include_router(auth.router, prefix="/api")
app.include_router(auth.register_router, prefix="/api")  # only if people make their own accounts
app.include_router(client_errors.router, prefix="/api")
app.include_router(environment.router, prefix="/api")
app.include_router(oauth.router)  # only with AI chats (MCP)
```

**`register_router` is separate on purpose.** An app where accounts are
made by whoever runs it leaves it out, with `/auth/register` out of its
`openapi.yaml` (the path is `x-optional`) and `LoginRoute
registerPath={null}`. Including `router` alone serves sign-in with no way
to make an account through the API.

A setting the package reads is changed at runtime (a test's
`monkeypatch`) on `foundation_backend.config` or on the module that
imported it, never on the app's re-export, which is a copy.

Upgrading: bump the pin with the npm package, run the migrations the
[changelog](https://github.com/Tristan2828/ui-foundation/blob/main/CHANGELOG.md)
names for that release, then `npm run verify:backend`
([`docs/consuming.md`](https://github.com/Tristan2828/ui-foundation/blob/main/docs/consuming.md)).

## In this repo

`template/backend/` depends on `ui-foundation-backend` unpinned. Install
both editable **in one pip call**, so the dependency resolves to this
folder and never to PyPI:

```bash
cd template/backend
python -m venv .venv
.venv/Scripts/python -m pip install -e ../../packages/backend-foundation -e ".[dev]"   # .venv/bin/python elsewhere
```

`template/backend/scripts/dev.sh` and the cloud session hook do this.
Installing `template/backend` on its own would pull the published version
(or fail before the first release), and its tests would run against code
that isn't this commit's.

`npm run verify:backend` (repo root) runs this package's gate,
`scripts/verify.sh` (mypy strict, then pytest over SQLite against
`tests/minimal_app.py`, an app made of the package alone), then the
template's. On its own: `cd packages/backend-foundation && pytest`.

## Releasing

`.github/workflows/release.yml` builds it (`build-py`, with the release's
version written into `pyproject.toml`) and publishes it to PyPI by trusted
publishing (`publish-py`), beside the npm package, before tagging. The
committed version in `pyproject.toml` is a floor, like
`packages/ui-foundation/package.json`'s; keep the two the same.
