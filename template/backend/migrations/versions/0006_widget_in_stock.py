"""Widget in_stock — the yes/no field (3.4.0).

A plain NOT NULL boolean with a server default of true, so existing rows
(the 0001 seed, anything a dev database holds) are in stock without a
backfill, matching what a create that leaves inStock out gets.

Commented in the same migration (0005's rule; scripts/check_db_comments.py).
COMMENT ON is Postgres-only, so it is skipped on any other dialect.

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-02

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COMMENT = "Whether the widget is in stock (yes/no). Never null; true by default."


def upgrade() -> None:
    op.add_column(
        "widgets",
        sa.Column("in_stock", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    if op.get_bind().dialect.name == "postgresql":
        op.execute(f"COMMENT ON COLUMN widgets.in_stock IS '{COMMENT}'")


def downgrade() -> None:
    op.drop_column("widgets", "in_stock")
