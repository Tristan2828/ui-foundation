"""Rename categories to widget_categories (3.9.0).

The demo's reference entity was a plain Category: the schema, the
/categories path and this table. An app whose own entity is a Category
collided with all three, and had to rename the demo's first. It is now
WidgetCategory, named for the widget it belongs to, so no app's entity
name meets it. Rows, ids and foreign keys are unchanged: both
dialects repoint widgets.category_id and widget_extra_categories.category_id
to the renamed table on their own.

On Postgres the id sequence and the primary key's index are renamed to
match, and the two comments that name the table are rewritten (0005's
rule: comments change in the migration that makes them wrong).

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-03

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _comment_references(table: str) -> None:
    op.execute(f"COMMENT ON COLUMN widgets.category_id IS 'The widget''s category ({table}.id).'")
    op.execute(
        "COMMENT ON COLUMN widget_extra_categories.category_id IS "
        f"'The linked category ({table}.id). Cascades on category delete.'"
    )


def upgrade() -> None:
    op.rename_table("categories", "widget_categories")
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER SEQUENCE categories_id_seq RENAME TO widget_categories_id_seq")
        op.execute("ALTER INDEX categories_pkey RENAME TO widget_categories_pkey")
        _comment_references("widget_categories")


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        _comment_references("categories")
        op.execute("ALTER INDEX widget_categories_pkey RENAME TO categories_pkey")
        op.execute("ALTER SEQUENCE widget_categories_id_seq RENAME TO categories_id_seq")
    op.rename_table("widget_categories", "categories")
