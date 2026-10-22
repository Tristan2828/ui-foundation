# Reference migrations

The Alembic revisions that create this package's tables, as the template
carries them: `0002_auth.py` (users, sessions, the seeded account),
`0010_login_limits_totp.py` (sign-in limits, TOTP, recovery codes,
pending sign-ins) and `0011_oauth.py` (the template's `0011_mcp.py`
without `mcp_audit_log`, which is the app's).

They are copies to take, never run from here: an app's migration chain is
its own (`backend/migrations/versions/`), so revision ids and
`down_revision` are the template's and need renumbering into another
chain. Tables and columns added to `0002`'s later (lower-case emails in
`0003`, the comments in `0005`) are in the template's own revisions.

`scripts/create-app.sh` copies them into a new app only once the template
stops carrying its own; until then, a new app gets the template's.
