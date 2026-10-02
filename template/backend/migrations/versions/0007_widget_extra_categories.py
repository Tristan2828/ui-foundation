"""Widget extra categories — the multi-reference field (3.5.0).

A join table, one row per (widget, category), the same shape as 0004's
widget_tags with a foreign key in place of the enum. Deleting a widget or
a category deletes its links.

The seeded widgets from 0001 get the same links the MSW mocks give them
(src/mocks/data.ts), so both backends show the same demo data. Commented
in the same migration (0005's rule); COMMENT ON is Postgres-only.

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-02

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE_COMMENT = "The widget extraCategoryIds multi-reference field: one row per (widget, category). Deleted with either side."
COLUMN_COMMENTS = {
    "widget_id": "The linked widget (widgets.id). Cascades on widget delete.",
    "category_id": "The linked category (categories.id). Cascades on category delete.",
}


def upgrade() -> None:
    links = op.create_table(
        "widget_extra_categories",
        sa.Column("widget_id", sa.Integer(), sa.ForeignKey("widgets.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_index("ix_widget_extra_categories_category_id", "widget_extra_categories", ["category_id"])

    # Only link demo rows that still exist (a dev database may have deleted
    # some since 0001 seeded them).
    bind = op.get_bind()
    widgets = {row[0] for row in bind.execute(sa.text("SELECT id FROM widgets WHERE id IN (1, 2)"))}
    categories = {row[0] for row in bind.execute(sa.text("SELECT id FROM categories WHERE id IN (1, 3)"))}
    seed = [
        {"widget_id": 1, "category_id": 3},
        {"widget_id": 2, "category_id": 1},
        {"widget_id": 2, "category_id": 3},
    ]
    op.bulk_insert(links, [r for r in seed if r["widget_id"] in widgets and r["category_id"] in categories])

    if bind.dialect.name == "postgresql":
        op.execute(f"COMMENT ON TABLE widget_extra_categories IS '{TABLE_COMMENT}'")
        for column, comment in COLUMN_COMMENTS.items():
            op.execute(f"COMMENT ON COLUMN widget_extra_categories.{column} IS '{comment}'")


def downgrade() -> None:
    op.drop_index("ix_widget_extra_categories_category_id", table_name="widget_extra_categories")
    op.drop_table("widget_extra_categories")
