"""Uploaded pictures: `files` (one row per upload) and `file_contents`
(its bytes, apart, so reading a row never loads a picture).

The picture is the upload's whole request body; its type is read from its
first bytes (foundation_backend.uploads.image_type), JPEG, PNG or WebP
only, and at most 10 MB. The bytes are bytea in Postgres, so the database
backup covers them and the deploy needs no volume. Per user, as widgets
are. Nothing deletes a file yet: a soft-deleted record can come back, so
its pictures must outlive it.

Commented in the same migration (0005's rule); COMMENT ON is Postgres-only.

Revision ID: 0018
Revises: 0017
Create Date: 2026-11-27

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COMMENTS = {
    "files": (
        "Uploaded pictures, one row per upload (POST /api/files). The bytes are in file_contents, one row each. "
        "Each belongs to one user (owner_id) and is served only to them, at /api/files/<id>/content. "
        "Other rows point at one by id (a widget description's Markdown holds ![](/api/files/<id>/content)). "
        "Never deleted."
    ),
    "file_contents": (
        "The bytes of each uploaded picture, one row per files row, kept apart so reading a files row never loads them. "
        "Deleted with its files row."
    ),
}

COLUMN_COMMENTS = {
    "files": {
        "id": "Primary key; the id in /api/files/<id>.",
        "owner_id": "The user who uploaded it (users.id). Cascades on user delete. Never returned by the API.",
        "content_type": (
            "image/jpeg, image/png or image/webp, read from the bytes at upload, never from the file name "
            "or the browser. Served as this type."
        ),
        "byte_size": "Size of the stored bytes (file_contents.data), in bytes. At most 10 MB (10485760).",
        "sha256": "Hex sha256 of the stored bytes (64 characters). Not unique: the same picture uploaded twice is two rows.",
        "created_at": "When it was uploaded (UTC).",
    },
    "file_contents": {
        "file_id": "Primary key, and the file these bytes are (files.id). Cascades on file delete.",
        "data": "The picture's bytes exactly as uploaded (bytea).",
    },
}


def _quote(value: str) -> str:
    # A SQL string literal, ' doubled.
    return "'" + value.replace("'", "''") + "'"


def upgrade() -> None:
    op.create_table(
        "files",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content_type", sa.String(length=50), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "content_type IN ('image/jpeg', 'image/png', 'image/webp')", name="ck_files_content_type"
        ),
        sa.CheckConstraint("byte_size >= 0", name="ck_files_byte_size"),
    )
    op.create_index("ix_files_owner_id", "files", ["owner_id"])
    op.create_index("ix_files_sha256", "files", ["sha256"])
    op.create_table(
        "file_contents",
        sa.Column(
            "file_id", sa.Integer(), sa.ForeignKey("files.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("data", sa.LargeBinary(), nullable=False),
    )

    if op.get_bind().dialect.name == "postgresql":
        for table, comment in COMMENTS.items():
            op.execute(f"COMMENT ON TABLE {table} IS {_quote(comment)}")
            for column, column_comment in COLUMN_COMMENTS[table].items():
                op.execute(f"COMMENT ON COLUMN {table}.{column} IS {_quote(column_comment)}")


def downgrade() -> None:
    op.drop_table("file_contents")
    op.drop_table("files")
