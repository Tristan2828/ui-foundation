"""Failed sign-in limits and TOTP sign-in (4.0.0, issues #124 and #125).

- login_failures: one row per failed sign-in, counted per client IP and
  per account (app/login_limits.py).
- users.totp_secret, users.totp_last_step: an account's TOTP second step
  (app/totp.py). Null secret means the account has none; every existing
  account starts that way, so sign-in is unchanged until
  scripts/enable_totp.py turns it on.
- recovery_codes: one-time codes in place of a TOTP code, hashed.
- pending_logins: sign-ins whose password was right, waiting for the code.

Commented in the same migration (0005's rule); COMMENT ON is Postgres-only.

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-16

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE_COMMENTS = {
    "login_failures": (
        "Failed sign-in attempts, one row per failure, counted for the sign-in limits "
        "(LOGIN_MAX_FAILURES_PER_IP / _PER_ACCOUNT). Rows older than the longest window are "
        "pruned as new ones are written; a successful sign-in deletes that IP's and that account's."
    ),
    "recovery_codes": (
        "One-time recovery codes for an account's TOTP sign-in, ten made by scripts/enable_totp.py. "
        "Each works once in place of a TOTP code."
    ),
    "pending_logins": (
        "Sign-ins whose password was right and whose TOTP code is still to come. "
        "Single use: deleted when the code is accepted, when it runs out of tries, or found expired."
    ),
}
COLUMN_COMMENTS = {
    "login_failures": {
        "id": "Primary key.",
        "kind": "Which limit the row counts toward: 'ip' or 'account'.",
        "key": (
            "For 'ip', the client IP as uvicorn saw it. For 'account', sha256 (hex) of the "
            "lower-cased email, so no address is stored and an unknown email counts like a known one."
        ),
        "failed_at": "When the attempt failed (UTC).",
    },
    "users": {
        "totp_secret": (
            "The account's TOTP secret (base32), or null when sign-in has no second step. "
            "Stored as is because checking a code needs it: database backups must be encrypted."
        ),
        "totp_last_step": (
            "The last 30-second TOTP step (unix time / 30) a code was accepted for, so no code "
            "is accepted twice. Null until the first."
        ),
    },
    "recovery_codes": {
        "id": "Primary key.",
        "user_id": "The account the code belongs to (users.id). Cascades on user delete.",
        "code_hash": "sha256 (hex) of the code, lower-cased with spaces and dashes removed. Never the code.",
        "used_at": "When the code was used to sign in (UTC); null while it is still unused.",
    },
    "pending_logins": {
        "id": "Primary key.",
        "user_id": "The account signing in (users.id). Cascades on user delete.",
        "token_hash": "sha256 (hex) of the token in the pending_login cookie. Never the token.",
        "expires_at": "When the sign-in stops waiting for its code (UTC), PENDING_LOGIN_TTL_SECONDS after the password.",
        "tries": "Wrong codes so far. At PENDING_LOGIN_MAX_TRIES the row is deleted and sign-in starts again.",
    },
}


def _quote(value: str) -> str:
    # A SQL string literal: a ' inside the text is doubled, as in 0005.
    return "'" + value.replace("'", "''") + "'"


def upgrade() -> None:
    op.create_table(
        "login_failures",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("failed_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_login_failures_key", "login_failures", ["key"])

    op.add_column("users", sa.Column("totp_secret", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("totp_last_step", sa.Integer(), nullable=True))

    op.create_table(
        "recovery_codes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_recovery_codes_user_id", "recovery_codes", ["user_id"])

    op.create_table(
        "pending_logins",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tries", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_pending_logins_user_id", "pending_logins", ["user_id"])
    op.create_index("ix_pending_logins_token_hash", "pending_logins", ["token_hash"], unique=True)

    if op.get_bind().dialect.name == "postgresql":
        for table, comment in TABLE_COMMENTS.items():
            op.execute(f"COMMENT ON TABLE {table} IS {_quote(comment)}")
        for table, columns in COLUMN_COMMENTS.items():
            for column, comment in columns.items():
                op.execute(f"COMMENT ON COLUMN {table}.{column} IS {_quote(comment)}")


def downgrade() -> None:
    op.drop_index("ix_pending_logins_token_hash", table_name="pending_logins")
    op.drop_index("ix_pending_logins_user_id", table_name="pending_logins")
    op.drop_table("pending_logins")
    op.drop_index("ix_recovery_codes_user_id", table_name="recovery_codes")
    op.drop_table("recovery_codes")
    op.drop_column("users", "totp_last_step")
    op.drop_column("users", "totp_secret")
    op.drop_index("ix_login_failures_key", table_name="login_failures")
    op.drop_table("login_failures")
