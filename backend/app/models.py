"""SQLModel table models — DB shape only. Column names stay snake_case;
JSON casing lives in app/schemas.py, never here. See docs/BUILD-PLAN.md
Phase 8 warning: table models are never returned directly from a router.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import Column, DateTime
from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(max_length=255, unique=True, index=True)
    name: str = Field(max_length=200)
    password_hash: str = Field(max_length=255)


class Session(SQLModel, table=True):
    __tablename__ = "sessions"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    # sha256 of the token in the browser's cookie — never the token itself,
    # so a DB dump can't be replayed as a live session. See app/security.py.
    token_hash: str = Field(max_length=64, unique=True, index=True)
    # SQLModel's default mapping for a bare `datetime` annotation is a
    # timezone-NAIVE column, regardless of the migration's own DDL — an
    # ORM-level type, not a live-schema one, so asyncpg rejects the
    # tz-aware `datetime.now(timezone.utc)` value the auth router inserts.
    # Explicit here so the ORM's understanding matches the migration's
    # `sa.DateTime(timezone=True)`.
    expires_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))


class WidgetStatus(str, Enum):
    draft = "draft"
    active = "active"
    archived = "archived"


class Category(SQLModel, table=True):
    __tablename__ = "categories"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=100)


class Widget(SQLModel, table=True):
    __tablename__ = "widgets"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=200)
    category_id: int = Field(foreign_key="categories.id", index=True)
    status: WidgetStatus = Field(default=WidgetStatus.draft, index=True)
    # Explicitly tz-aware, same as Session.expires_at above: the bare
    # `datetime` annotation mapped tz-naive at the ORM level, so every
    # widget create/update 500'd against real Postgres (asyncpg rejects a
    # tz-aware value for a naive parameter). SQLite-backed pytest can't see
    # this; scripts/check-backend-postgres.sh now writes a widget to catch it.
    available_from: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    assignee_email: str | None = Field(default=None)
    price: Decimal = Field(max_digits=10, decimal_places=2)
    description: str = Field(max_length=2000)
    # Per-user ownership (migration 0003). Never on the wire — WidgetOut and
    # openapi.yaml don't mention it; the router scopes every query to the
    # session's user instead, and another user's widget is a plain 404.
    owner_id: int = Field(foreign_key="users.id", index=True)
