"""Widget checklist — the sub-records pattern (3.6.0).

A child table: one row per item, with its own id and a `position`,
because order is part of the data. The API reads and writes the list
whole, in order, so neither column reaches the wire. Deleting a widget
deletes its items.

Widget 1 gets the same two items the MSW mocks give it (src/mocks/data.ts).
Commented in the same migration (0005's rule); COMMENT ON is Postgres-only.

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-02

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE_COMMENT = "The widget checklist sub-records: one row per item, ordered by position. Deleted with its widget."
COLUMN_COMMENTS = {
    "id": "Primary key. Internal only: the API reads and writes the list whole.",
    "widget_id": "The widget the item belongs to (widgets.id). Cascades on widget delete.",
    "position": "The item's place in the list, from 0. The API returns items in this order.",
    "text": "What to do, up to 300 characters. Never blank.",
    "done": "Whether the item is ticked off.",
}


def _quote(value: str) -> str:
    # A SQL string literal: a ' inside the text (as in "item's") is doubled,
    # as in 0005. An unquoted apostrophe ends the literal early.
    return "'" + value.replace("'", "''") + "'"


def upgrade() -> None:
    items = op.create_table(
        "widget_checklist_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("widget_id", sa.Integer(), sa.ForeignKey("widgets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("text", sa.String(length=300), nullable=False),
        sa.Column("done", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_widget_checklist_items_widget_id", "widget_checklist_items", ["widget_id"])

    bind = op.get_bind()
    if bind.execute(sa.text("SELECT 1 FROM widgets WHERE id = 1")).first():
        op.bulk_insert(
            items,
            [
                {"widget_id": 1, "position": 0, "text": "Charge the battery", "done": True},
                {"widget_id": 1, "position": 1, "text": "Pair the receiver", "done": False},
            ],
        )

    if bind.dialect.name == "postgresql":
        op.execute(f"COMMENT ON TABLE widget_checklist_items IS {_quote(TABLE_COMMENT)}")
        for column, comment in COLUMN_COMMENTS.items():
            op.execute(f"COMMENT ON COLUMN widget_checklist_items.{column} IS {_quote(comment)}")


def downgrade() -> None:
    op.drop_index("ix_widget_checklist_items_widget_id", table_name="widget_checklist_items")
    op.drop_table("widget_checklist_items")
