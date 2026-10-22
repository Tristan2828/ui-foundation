"""AI chats' OAuth sign-in (issue #132): the template's 0011_mcp.py
without mcp_audit_log, which belongs to the app's MCP tools, not to the
package.

- oauth_clients: chats that registered themselves (RFC 7591).
- oauth_codes: authorization codes, single use, hashed.
- oauth_grants: approved connections, access and refresh tokens hashed.

Nothing is used until MCP_ENABLED is true. Commented in the same migration
(0005's rule); COMMENT ON is Postgres-only.

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE_COMMENTS = {
    "oauth_clients": (
        "AI chats that registered themselves through POST /oauth/register (MCP_ENABLED). "
        "Public clients: no secret, PKCE proves each sign-in. Capped at MCP_MAX_CLIENTS; "
        "chats with no connection are pruned a day after registering."
    ),
    "oauth_codes": (
        "OAuth authorization codes: issued when a signed-in user approves a chat, exchanged once "
        "at POST /oauth/token, then deleted. Expire after ten minutes."
    ),
    "oauth_grants": (
        "Approved connections between a user and an AI chat: one access token and one refresh "
        "token, stored as hashes. A refresh replaces both; presenting a replaced refresh token "
        "deletes the connection."
    ),
}
COLUMN_COMMENTS = {
    "oauth_clients": {
        "id": "Primary key.",
        "client_id": "The identifier the chat uses in the OAuth flow (random, public).",
        "client_name": "The name the chat gave itself; shown on the approval page. Not verified.",
        "redirect_uris": "JSON list of the exact addresses the chat may be sent back to after approval.",
        "created_at": "When the chat registered (UTC).",
    },
    "oauth_codes": {
        "id": "Primary key.",
        "code_hash": "sha256 (hex) of the authorization code. Never the code.",
        "client_id": "The chat the code was issued to (oauth_clients.client_id). Cascades on client delete.",
        "user_id": "The user who approved (users.id). Cascades on user delete.",
        "redirect_uri": "The address the code was sent to; the token request must repeat it.",
        "code_challenge": "PKCE S256 challenge from the authorization request.",
        "expires_at": "When the code stops working (UTC).",
    },
    "oauth_grants": {
        "id": "Primary key.",
        "client_id": "The chat holding the connection (oauth_clients.client_id). Cascades on client delete.",
        "user_id": "The user whose records the chat acts on (users.id). Cascades on user delete.",
        "access_hash": "sha256 (hex) of the access token. Never the token.",
        "refresh_hash": "sha256 (hex) of the refresh token. Never the token.",
        "previous_refresh_hash": (
            "sha256 (hex) of the refresh token the last refresh replaced; presenting it deletes the connection."
        ),
        "access_expires_at": "When the access token stops working (UTC), MCP_ACCESS_TOKEN_TTL_SECONDS after issue.",
        "refresh_expires_at": "When the refresh token stops working (UTC), MCP_REFRESH_TOKEN_TTL_DAYS after issue.",
        "created_at": "When the connection was approved or last refreshed (UTC).",
    },
}


def _quote(value: str) -> str:
    # A SQL string literal: a ' inside the text is doubled, as in 0005.
    return "'" + value.replace("'", "''") + "'"


def upgrade() -> None:
    op.create_table(
        "oauth_clients",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("client_id", sa.String(length=64), nullable=False),
        sa.Column("client_name", sa.String(length=200), nullable=False),
        sa.Column("redirect_uris", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_oauth_clients_client_id", "oauth_clients", ["client_id"], unique=True)

    op.create_table(
        "oauth_codes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "client_id",
            sa.String(length=64),
            sa.ForeignKey("oauth_clients.client_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("redirect_uri", sa.String(), nullable=False),
        sa.Column("code_challenge", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_oauth_codes_code_hash", "oauth_codes", ["code_hash"], unique=True)
    op.create_index("ix_oauth_codes_user_id", "oauth_codes", ["user_id"])

    op.create_table(
        "oauth_grants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "client_id",
            sa.String(length=64),
            sa.ForeignKey("oauth_clients.client_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("access_hash", sa.String(length=64), nullable=False),
        sa.Column("refresh_hash", sa.String(length=64), nullable=False),
        sa.Column("previous_refresh_hash", sa.String(length=64), nullable=True),
        sa.Column("access_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("refresh_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_oauth_grants_user_id", "oauth_grants", ["user_id"])
    op.create_index("ix_oauth_grants_access_hash", "oauth_grants", ["access_hash"], unique=True)
    op.create_index("ix_oauth_grants_refresh_hash", "oauth_grants", ["refresh_hash"], unique=True)
    op.create_index("ix_oauth_grants_previous_refresh_hash", "oauth_grants", ["previous_refresh_hash"])

    if op.get_bind().dialect.name == "postgresql":
        for table, comment in TABLE_COMMENTS.items():
            op.execute(f"COMMENT ON TABLE {table} IS {_quote(comment)}")
        for table, columns in COLUMN_COMMENTS.items():
            for column, comment in columns.items():
                op.execute(f"COMMENT ON COLUMN {table}.{column} IS {_quote(comment)}")


def downgrade() -> None:
    op.drop_index("ix_oauth_grants_previous_refresh_hash", table_name="oauth_grants")
    op.drop_index("ix_oauth_grants_refresh_hash", table_name="oauth_grants")
    op.drop_index("ix_oauth_grants_access_hash", table_name="oauth_grants")
    op.drop_index("ix_oauth_grants_user_id", table_name="oauth_grants")
    op.drop_table("oauth_grants")
    op.drop_index("ix_oauth_codes_user_id", table_name="oauth_codes")
    op.drop_index("ix_oauth_codes_code_hash", table_name="oauth_codes")
    op.drop_table("oauth_codes")
    op.drop_index("ix_oauth_clients_client_id", table_name="oauth_clients")
    op.drop_table("oauth_clients")
