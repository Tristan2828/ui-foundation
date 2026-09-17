"""Auth: users, sessions — see docs/BUILD-PLAN.md Phase 10. Seeds one dev
user from SEED_USER_EMAIL/SEED_USER_PASSWORD (app/config.py) so
check-phase-10.sh and the two real-backend Playwright specs have someone
to log in as.

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.config import SEED_USER_EMAIL, SEED_USER_PASSWORD
from app.security import hash_password

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    users = op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_index("ix_sessions_token_hash", "sessions", ["token_hash"], unique=True)

    op.bulk_insert(
        users,
        [
            {
                "id": 1,
                "email": SEED_USER_EMAIL,
                "name": "Dev User",
                "password_hash": hash_password(SEED_USER_PASSWORD),
            }
        ],
    )
    op.execute("SELECT setval('users_id_seq', 1)")


def downgrade() -> None:
    op.drop_table("sessions")
    op.drop_table("users")
