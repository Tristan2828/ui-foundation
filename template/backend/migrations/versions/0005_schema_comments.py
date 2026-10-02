"""Postgres comments on every table and column.

A second agent with database credentials and no repo reads the schema
alone (`\\d+ widgets` in psql, `col_description()` in SQL), so the comments
are its documentation. scripts/check_db_comments.py fails on any table or
column without one. A later migration that adds a table or column comments
it in the same migration.

Postgres only: SQLite (the pytest engine) has no COMMENT ON, and pytest
builds its schema from the models, never from these migrations.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-02

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = {
    "users": "People who can sign in. Created by POST /api/auth/register or the seed in migration 0002.",
    "sessions": "One row per signed-in browser session. Deleted on logout; expired rows are rejected at use.",
    "categories": "Lookup table of widget categories (the typeahead on the widget form). Shared by all users.",
    "widgets": "The demo entity. Each row belongs to one user (owner_id) and is visible only to them.",
    "widget_tags": "The widget tags multi-choice field: one row per (widget, tag). Deleted with its widget.",
}

COLUMNS = {
    "users": {
        "id": "Primary key.",
        "email": "Sign-in email, stored lowercase. Unique (ix_users_email), so matching is case-insensitive.",
        "name": "Display name shown in the app's sidebar.",
        "password_hash": "Password hash (app/security.py). Never the password itself; never sent to the client.",
    },
    "sessions": {
        "id": "Primary key.",
        "user_id": "The signed-in user (users.id).",
        "token_hash": "sha256 of the session cookie's token, never the token itself, so a dump can't be replayed as a live session.",
        "expires_at": "When the session stops being accepted (timestamptz, UTC).",
    },
    "categories": {
        "id": "Primary key.",
        "name": "Category name as shown in the app.",
    },
    "widgets": {
        "id": "Primary key.",
        "name": "Widget name. Searched case-insensitively by the table's name filter.",
        "category_id": "The widget's category (categories.id).",
        "status": "Lifecycle: draft (default), active or archived (the widgetstatus enum).",
        "available_from": "When the widget becomes available (timestamptz, UTC).",
        "assignee_email": "Email of the person the widget is assigned to. Null when unassigned. Not a users reference.",
        "price": "Price, two decimal places. Currency is not stored.",
        "description": "Free-text description, up to 2000 characters.",
        "owner_id": "The user who owns the widget (users.id). The API shows a widget only to its owner and never returns this column.",
    },
    "widget_tags": {
        "widget_id": "The tagged widget (widgets.id). Cascades on widget delete.",
        "tag": "One tag (the widgettag enum: fragile, bulky, seasonal, featured).",
    },
}


def _quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def upgrade() -> None:
    for table, comment in TABLES.items():
        op.execute(f"COMMENT ON TABLE {table} IS {_quote(comment)}")
    for table, columns in COLUMNS.items():
        for column, comment in columns.items():
            op.execute(f"COMMENT ON COLUMN {table}.{column} IS {_quote(comment)}")


def downgrade() -> None:
    for table in TABLES:
        op.execute(f"COMMENT ON TABLE {table} IS NULL")
    for table, columns in COLUMNS.items():
        for column in columns:
            op.execute(f"COMMENT ON COLUMN {table}.{column} IS NULL")
