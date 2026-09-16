"""Initial schema: categories, widgets — matches openapi.yaml's Widget
schema exactly (six Phase 4 field types) and seeds the same three
categories / three widgets as src/mocks/data.ts, so the real backend and
MSW show identical demo data.

Revision ID: 0001
Revises:
Create Date: 2026-09-16

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

widget_status = sa.Enum("draft", "active", "archived", name="widgetstatus")


def upgrade() -> None:
    widget_status.create(op.get_bind(), checkfirst=True)

    categories = op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
    )

    widgets = op.create_table(
        "widgets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id"), nullable=False),
        sa.Column("status", widget_status, nullable=False, server_default="draft"),
        sa.Column("available_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("assignee_email", sa.String(), nullable=True),
        sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("description", sa.String(length=2000), nullable=False),
    )
    op.create_index("ix_widgets_category_id", "widgets", ["category_id"])
    op.create_index("ix_widgets_status", "widgets", ["status"])

    op.bulk_insert(
        categories,
        [
            {"id": 1, "name": "Electronics"},
            {"id": 2, "name": "Furniture"},
            {"id": 3, "name": "Stationery"},
        ],
    )
    op.bulk_insert(
        widgets,
        [
            {
                "id": 1,
                "name": "Wireless Mouse",
                "category_id": 1,
                "status": "active",
                "available_from": "2026-01-15T00:00:00Z",
                "assignee_email": "alice@example.com",
                "price": "24.99",
                "description": "A basic wireless mouse with a 2.4GHz USB receiver.",
            },
            {
                "id": 2,
                "name": "Standing Desk",
                "category_id": 2,
                "status": "draft",
                "available_from": "2026-03-01T00:00:00Z",
                "assignee_email": None,
                "price": "349.00",
                "description": "Electric height-adjustable desk, 120x60cm top.",
            },
            {
                "id": 3,
                "name": "Fountain Pen",
                "category_id": 3,
                "status": "archived",
                "available_from": "2025-06-01T00:00:00Z",
                "assignee_email": "bob@example.com",
                "price": "12.50",
                "description": "Fine-nib fountain pen, discontinued.",
            },
        ],
    )
    # Seeded rows use explicit ids — keep the sequences in step with them.
    op.execute("SELECT setval('categories_id_seq', 3)")
    op.execute("SELECT setval('widgets_id_seq', 3)")


def downgrade() -> None:
    op.drop_table("widgets")
    op.drop_table("categories")
    widget_status.drop(op.get_bind(), checkfirst=True)
