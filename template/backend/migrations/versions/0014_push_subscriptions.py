"""Web Push subscriptions (issue #167).

push_subscriptions: one row per device a user allowed reminders on
(POST /api/push/subscriptions). app/push.py sends to them and deletes the
ones the push service says are gone.

Commented in the same migration (0005's rule; scripts/check_db_comments.py).
COMMENT ON is Postgres-only, so it is skipped on any other dialect.

Revision ID: 0014
Revises: 0013
Create Date: 2026-10-20

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE_COMMENT = (
    "One row per device (a browser, or the app added to a phone's Home Screen) a user allowed "
    "reminders on. Written by POST /api/push/subscriptions; deleted by DELETE /api/push/subscriptions/{id}, "
    "with the user, or when the push service answers 404 or 410 to a send."
)
COLUMN_COMMENTS = {
    "id": "Primary key.",
    "user_id": "The user (users.id) the device belongs to. Deleted with the user.",
    "endpoint": (
        "The push service's URL for this device (Google's, Mozilla's, Apple's or Microsoft's). "
        "Unique: the same device subscribing again replaces its row."
    ),
    "p256dh": "The browser's P-256 public key, base64url: messages are encrypted to it (RFC 8291).",
    "auth": "The browser's 16-byte auth secret, base64url, used with p256dh to encrypt messages.",
    "created_at": "When the device was subscribed, or last subscribed again (timestamptz, UTC).",
}


def _quote(value: str) -> str:
    # A SQL string literal: a ' inside the text is doubled, as in 0005.
    return "'" + value.replace("'", "''") + "'"


def upgrade() -> None:
    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("endpoint", sa.String(length=2048), nullable=False, unique=True),
        sa.Column("p256dh", sa.String(length=100), nullable=False),
        sa.Column("auth", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_push_subscriptions_user_id", "push_subscriptions", ["user_id"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute(f"COMMENT ON TABLE push_subscriptions IS {_quote(TABLE_COMMENT)}")
        for column, comment in COLUMN_COMMENTS.items():
            op.execute(f"COMMENT ON COLUMN push_subscriptions.{column} IS {_quote(comment)}")


def downgrade() -> None:
    op.drop_index("ix_push_subscriptions_user_id", table_name="push_subscriptions")
    op.drop_table("push_subscriptions")
