"""Reminders (issue #167).

reminders: a notification a user asked for at a time of day, on chosen
days, in their own time zone. The send-reminders job (app/reminders.py)
sends each one that's due through Web Push, at most once a day.

Commented in the same migration (0005's rule; scripts/check_db_comments.py).
COMMENT ON is Postgres-only, so it is skipped on any other dialect.

Revision ID: 0015
Revises: 0014
Create Date: 2026-10-20

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE_COMMENT = (
    "A notification a user asked for at a time of day, on chosen days, in their own time zone. "
    "The send-reminders job (app/reminders.py) sends each due one by Web Push to every device in "
    "push_subscriptions for that user, at most once a day."
)
COLUMN_COMMENTS = {
    "id": "Primary key.",
    "user_id": "The user (users.id) it is for, and whose devices it is sent to. Deleted with the user.",
    "title": "The notification's title, as shown on the device.",
    "body": "The line of text under the title. Empty for none.",
    "url": "The app's own path opened when the notification is tapped, e.g. /routines/3. Starts with /.",
    "time_of_day": "When it is sent, as a local time of day in time_zone (time without time zone).",
    "days": "Which days it is sent: comma-separated mon,tue,wed,thu,fri,sat,sun, in that order.",
    "time_zone": "The IANA time zone time_of_day and days are read in, e.g. America/Chicago.",
    "enabled": "False pauses it: not sent until true again.",
    "last_sent_on": (
        "The local date (in time_zone) it was last sent, so it goes at most once a day. Null until first sent."
    ),
    "created_at": "When it was created (timestamptz, UTC).",
}


def _quote(value: str) -> str:
    # A SQL string literal: a ' inside the text is doubled, as in 0005.
    return "'" + value.replace("'", "''") + "'"


def upgrade() -> None:
    op.create_table(
        "reminders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("body", sa.String(length=300), nullable=False, server_default=""),
        sa.Column("url", sa.String(length=500), nullable=False, server_default="/"),
        sa.Column("time_of_day", sa.Time(), nullable=False),
        sa.Column("days", sa.String(length=27), nullable=False),
        sa.Column("time_zone", sa.String(length=64), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_sent_on", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_reminders_user_id", "reminders", ["user_id"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute(f"COMMENT ON TABLE reminders IS {_quote(TABLE_COMMENT)}")
        for column, comment in COLUMN_COMMENTS.items():
            op.execute(f"COMMENT ON COLUMN reminders.{column} IS {_quote(comment)}")


def downgrade() -> None:
    op.drop_index("ix_reminders_user_id", table_name="reminders")
    op.drop_table("reminders")
