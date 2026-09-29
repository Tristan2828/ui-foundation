"""Widget tags — the multi-choice field (Phase G).

A join table, one row per (widget, tag), rather than an array or JSON
column: "has any of these tags" filters the same way on Postgres and on the
SQLite engine the pytest suite uses, and it's the relational shape a future
multi-choice field copies. Deleting a widget deletes its tag rows.

The seeded widgets from 0001 get the same tags the MSW mocks give them
(src/mocks/data.ts), so both backends show the same demo data.

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PGEnum

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Same pattern as 0001's widget_status: the postgres-specific ENUM so
# create_type=False actually takes effect, with the type created explicitly.
widget_tag = PGEnum("fragile", "bulky", "seasonal", "featured", name="widgettag", create_type=False)


def upgrade() -> None:
    widget_tag.create(op.get_bind(), checkfirst=True)

    widget_tags = op.create_table(
        "widget_tags",
        sa.Column("widget_id", sa.Integer(), sa.ForeignKey("widgets.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag", widget_tag, primary_key=True),
    )

    # Only tag the demo widgets that still exist (a dev database may have
    # deleted some since 0001 seeded them).
    existing = {row[0] for row in op.get_bind().execute(sa.text("SELECT id FROM widgets WHERE id IN (1, 2)"))}
    seed = [
        {"widget_id": 1, "tag": "fragile"},
        {"widget_id": 2, "tag": "bulky"},
        {"widget_id": 2, "tag": "featured"},
    ]
    op.bulk_insert(widget_tags, [row for row in seed if row["widget_id"] in existing])


def downgrade() -> None:
    op.drop_table("widget_tags")
    widget_tag.drop(op.get_bind(), checkfirst=True)
