"""Widget soft delete (issue #137).

A nullable `deleted_at`: null means live, a time means deleted then. DELETE
/widgets/{id} sets it, POST /widgets/{id}/restore clears it, and nothing
else reads a deleted widget. Existing rows are live (null), so no backfill.

Commented in the same migration (0005's rule; scripts/check_db_comments.py).
COMMENT ON is Postgres-only, so it is skipped on any other dialect.

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COMMENT = (
    "When the widget was deleted (timestamptz, UTC). Null means live. "
    "Set by DELETE /api/widgets/{id}, cleared by its restore; deleted widgets are left out of every read."
)


def upgrade() -> None:
    op.add_column("widgets", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    if op.get_bind().dialect.name == "postgresql":
        op.execute(f"COMMENT ON COLUMN widgets.deleted_at IS '{COMMENT}'")


def downgrade() -> None:
    op.drop_column("widgets", "deleted_at")
