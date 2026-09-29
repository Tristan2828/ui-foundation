"""Per-user widget ownership, case-insensitive emails.

Phase 11's self-service registration meant any new account could read and
edit every widget. widgets.owner_id scopes them to the user who created
them; existing rows (the 0001 seed data plus anything created since) go to
the seeded dev user from 0002, id 1. Categories stay shared reference data.

Emails are lowercased so `Dev@Example.com` and `dev@example.com` can no
longer register as two accounts — app/schemas.py normalizes new input the
same way. If two existing accounts differ only by case, the unique index on
users.email makes this migration fail loudly rather than silently merge
them; resolve that by hand first.

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEED_USER_ID = 1


def upgrade() -> None:
    op.add_column("widgets", sa.Column("owner_id", sa.Integer(), nullable=True))
    op.execute(sa.text("UPDATE widgets SET owner_id = :owner").bindparams(owner=SEED_USER_ID))
    op.alter_column("widgets", "owner_id", nullable=False)
    op.create_foreign_key("fk_widgets_owner_id_users", "widgets", "users", ["owner_id"], ["id"])
    op.create_index("ix_widgets_owner_id", "widgets", ["owner_id"])

    op.execute("UPDATE users SET email = lower(email) WHERE email <> lower(email)")


def downgrade() -> None:
    op.drop_index("ix_widgets_owner_id", table_name="widgets")
    op.drop_constraint("fk_widgets_owner_id_users", "widgets", type_="foreignkey")
    op.drop_column("widgets", "owner_id")
