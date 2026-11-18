"""Widget versions: `updated_at` (Roadmap 405, the RichTextEditor review's F4).

When the widget was last written. It's the widget's version: an update may
send the one it was built on (`baseUpdatedAt`), and one that no longer
matches is a 409, so a stale tab, a phone or an AI chat can't overwrite what
another writer saved (foundation_backend.versions). Existing rows get the
time of the migration.

Commented in the same migration (0005's rule; scripts/check_db_comments.py).
COMMENT ON is Postgres-only, so it is skipped on any other dialect.

Revision ID: 0017
Revises: 0016
Create Date: 2026-11-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COMMENT = (
    "When the widget was last written (timestamptz, UTC, to the microsecond): its version. "
    "Every create, update and restore sets it; an update that sends a different baseUpdatedAt is refused (409). "
    "Never null."
)


def upgrade() -> None:
    op.add_column(
        "widgets",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    if op.get_bind().dialect.name == "postgresql":
        op.execute(f"COMMENT ON COLUMN widgets.updated_at IS '{COMMENT}'")


def downgrade() -> None:
    op.drop_column("widgets", "updated_at")
