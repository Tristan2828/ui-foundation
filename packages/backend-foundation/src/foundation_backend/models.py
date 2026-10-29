"""The foundation's table models: accounts, sessions, sign-in limits, the
TOTP step, AI chats' OAuth and their audit log, scheduled jobs' runs, and
Web Push subscriptions and reminders. DB shape only. Column names stay
snake_case; JSON casing lives in schemas.py, never here. Table models are
never returned directly from a router.

Importing this module puts these tables on `SQLModel.metadata`, beside an
app's own (its `app/models.py` re-exports them). An app's migrations
create them; `migrations/` here holds reference copies.
"""

from datetime import date, datetime, time

from sqlalchemy import Column, DateTime, Text, Time
from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(max_length=255, unique=True, index=True)
    name: str = Field(max_length=200)
    password_hash: str = Field(max_length=255)
    # The TOTP secret (base32), or None when the account has no second
    # step. Stored as is: checking a code needs it, so it can't be hashed,
    # and a database dump contains it (docs/deploy.md: encrypt backups).
    totp_secret: str | None = Field(default=None, max_length=64)
    # The last 30-second step a code was accepted for, so a code is never
    # accepted twice. None until the first one.
    totp_last_step: int | None = Field(default=None)


class Session(SQLModel, table=True):
    __tablename__ = "sessions"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    # sha256 of the token in the browser's cookie — never the token itself,
    # so a DB dump can't be replayed as a live session. See security.py.
    token_hash: str = Field(max_length=64, unique=True, index=True)
    # SQLModel's default mapping for a bare `datetime` annotation is a
    # timezone-NAIVE column, regardless of the migration's own DDL — an
    # ORM-level type, not a live-schema one, so asyncpg rejects the
    # tz-aware `datetime.now(timezone.utc)` value the auth router inserts.
    # Explicit here so the ORM's understanding matches the migration's
    # `sa.DateTime(timezone=True)`.
    expires_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))


class LoginFailure(SQLModel, table=True):
    """One failed sign-in attempt, counted against two keys: the client's
    IP and the account. login_limits.py reads and prunes them."""

    __tablename__ = "login_failures"

    id: int | None = Field(default=None, primary_key=True)
    # "ip" or "account".
    kind: str = Field(max_length=16)
    # The client IP for "ip"; for "account", sha256 of the normalized
    # email, so the table holds no addresses.
    key: str = Field(max_length=64, index=True)
    failed_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))


class RecoveryCode(SQLModel, table=True):
    __tablename__ = "recovery_codes"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    # sha256 of the normalized code, never the code itself.
    code_hash: str = Field(max_length=64)
    used_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))


class PendingLogin(SQLModel, table=True):
    """A sign-in whose password was right and whose TOTP code is still to
    come. Single use, short-lived, and like sessions, only its hash is kept."""

    __tablename__ = "pending_logins"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    token_hash: str = Field(max_length=64, unique=True, index=True)
    expires_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    tries: int = Field(default=0)


class OAuthClient(SQLModel, table=True):
    """An AI chat that registered itself (RFC 7591) to ask for access to the
    app's records. Public client: no secret, PKCE instead (routers/oauth.py)."""

    __tablename__ = "oauth_clients"

    id: int | None = Field(default=None, primary_key=True)
    client_id: str = Field(max_length=64, unique=True, index=True)
    client_name: str = Field(max_length=200)
    # JSON list of the exact addresses it may be sent back to.
    redirect_uris: str
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))


class OAuthCode(SQLModel, table=True):
    """An authorization code: single use, short-lived, only its hash kept."""

    __tablename__ = "oauth_codes"

    id: int | None = Field(default=None, primary_key=True)
    code_hash: str = Field(max_length=64, unique=True, index=True)
    client_id: str = Field(max_length=64, foreign_key="oauth_clients.client_id", ondelete="CASCADE")
    user_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    redirect_uri: str
    code_challenge: str = Field(max_length=128)
    expires_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))


class OAuthGrant(SQLModel, table=True):
    """One approved connection: an access token and its refresh token, both
    only as hashes. A refresh replaces both and remembers the refresh token
    it replaced, so a reused one ends the whole connection."""

    __tablename__ = "oauth_grants"

    id: int | None = Field(default=None, primary_key=True)
    client_id: str = Field(max_length=64, foreign_key="oauth_clients.client_id", ondelete="CASCADE")
    user_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    access_hash: str = Field(max_length=64, unique=True, index=True)
    refresh_hash: str = Field(max_length=64, unique=True, index=True)
    previous_refresh_hash: str | None = Field(default=None, max_length=64, index=True)
    access_expires_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    refresh_expires_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))


class McpAuditEntry(SQLModel, table=True):
    """Every record an AI chat created, changed, deleted or restored through MCP."""

    __tablename__ = "mcp_audit_log"

    id: int | None = Field(default=None, primary_key=True)
    # Not a foreign key: the log outlives the account and the connection.
    user_id: int = Field(index=True)
    client_id: str = Field(max_length=64)
    # "create", "update", "delete" or "restore".
    action: str = Field(max_length=16)
    entity: str = Field(max_length=64)
    record_id: int
    at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    # JSON objects of the fields that changed, as the API names them; before
    # is null for a create. A delete or restore holds the whole record in
    # both, so the log alone can rebuild it.
    before: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    after: str = Field(sa_column=Column(Text, nullable=False))


class JobRunRecord(SQLModel, table=True):
    """One run of a scheduled job (foundation_backend.jobs), kept JOB_RUNS_KEEP_DAYS."""

    __tablename__ = "job_runs"

    id: int | None = Field(default=None, primary_key=True)
    # The name the job was registered under (register_job).
    job: str = Field(max_length=64, index=True)
    # "schedule" or "manual" (POST /jobs/{name}/run).
    trigger: str = Field(max_length=16)
    started_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False, index=True))
    finished_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    # "ok", "failed", or "skipped" (another process was running it).
    outcome: str = Field(max_length=16)
    # What went wrong, for a failed run (scrubbed like an error report).
    error: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    # What the job said it did ("12 new"), for an ok run.
    summary: str | None = Field(default=None, max_length=500)


class PushSubscription(SQLModel, table=True):
    """One device a user allowed reminders on (foundation_backend.push): where its push
    service takes messages for it, and the keys to encrypt them to."""

    __tablename__ = "push_subscriptions"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    # The push service's URL for this device. Unique: the same device
    # subscribing again (or under another account) replaces its row.
    endpoint: str = Field(max_length=2048, unique=True)
    # The browser's P-256 public key and auth secret, base64url.
    p256dh: str = Field(max_length=100)
    auth: str = Field(max_length=32)
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))


class Reminder(SQLModel, table=True):
    """A notification sent at a time the user chose, on the days they chose
    (foundation_backend.reminders, the send-reminders job)."""

    __tablename__ = "reminders"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    title: str = Field(max_length=100)
    body: str = Field(default="", max_length=300)
    # The app's own path the notification opens ("/routines/3").
    url: str = Field(default="/", max_length=500)
    # When, in the user's own time zone: "HH:MM" on these days.
    time_of_day: time = Field(sa_column=Column(Time(), nullable=False))
    # Comma-separated mon,tue,wed,thu,fri,sat,sun, in that order.
    days: str = Field(max_length=27)
    # IANA name ("America/Chicago"); the job reads the time in it.
    time_zone: str = Field(max_length=64)
    enabled: bool = Field(default=True)
    # The local date it was last sent on, so it goes once a day at most.
    last_sent_on: date | None = Field(default=None)
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
