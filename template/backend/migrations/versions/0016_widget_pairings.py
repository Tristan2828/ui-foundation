"""Widget pairings — sub-records whose items hold a reference (4.27.0).

The checklist's shape (0008): a child table, one row per item, with its
own id and a `position`, read and written whole, in order. Each item also
points at another table (widget_categories), so the API checks the id
exists before saving: a missing one is a 422 at the item's path, never a
foreign-key error. Deleting a widget deletes its pairings; so does
deleting the category an item points at.

Widget 1 gets the same two items the MSW mocks give it (src/mocks/data.ts).
Commented in the same migration (0005's rule); COMMENT ON is Postgres-only.

Revision ID: 0016
Revises: 0015
Create Date: 2026-10-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE_COMMENT = (
    "A widget's pairings: the categories it pairs with, one row per item, ordered by position. "
    "Deleted with its widget, or with the category it points at."
)
COLUMN_COMMENTS = {
    "id": "Primary key. Internal only: the API reads and writes the list whole.",
    "widget_id": "The widget the item belongs to (widgets.id). Cascades on widget delete.",
    "position": "The item's place in the list, from 0. The API returns items in this order.",
    "category_id": "The category paired with (widget_categories.id). The same one may appear in several items.",
    "note": "Optional text about the pairing, up to 100 characters. Empty string when none, never null.",
}


def _quote(value: str) -> str:
    # A SQL string literal: a ' inside the text (as in "item's") is doubled,
    # as in 0005. An unquoted apostrophe ends the literal early.
    return "'" + value.replace("'", "''") + "'"


def upgrade() -> None:
    items = op.create_table(
        "widget_pairings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("widget_id", sa.Integer(), sa.ForeignKey("widgets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "category_id",
            sa.Integer(),
            sa.ForeignKey("widget_categories.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("note", sa.String(length=100), nullable=False, server_default=""),
    )
    op.create_index("ix_widget_pairings_widget_id", "widget_pairings", ["widget_id"])
    op.create_index("ix_widget_pairings_category_id", "widget_pairings", ["category_id"])

    bind = op.get_bind()
    if bind.execute(sa.text("SELECT 1 FROM widgets WHERE id = 1")).first():
        op.bulk_insert(
            items,
            [
                {"widget_id": 1, "position": 0, "category_id": 3, "note": "Desk sets"},
                {"widget_id": 1, "position": 1, "category_id": 2, "note": ""},
            ],
        )

    if bind.dialect.name == "postgresql":
        op.execute(f"COMMENT ON TABLE widget_pairings IS {_quote(TABLE_COMMENT)}")
        for column, comment in COLUMN_COMMENTS.items():
            op.execute(f"COMMENT ON COLUMN widget_pairings.{column} IS {_quote(comment)}")


def downgrade() -> None:
    op.drop_index("ix_widget_pairings_category_id", table_name="widget_pairings")
    op.drop_index("ix_widget_pairings_widget_id", table_name="widget_pairings")
    op.drop_table("widget_pairings")
