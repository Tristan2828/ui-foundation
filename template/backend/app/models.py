"""SQLModel table models — DB shape only. Column names stay snake_case;
JSON casing lives in app/schemas.py, never here. Table models are never
returned directly from a router.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import Column, DateTime
from sqlmodel import Field, Relationship, SQLModel


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


class WidgetChecklistState(str, Enum):
    """The computed checklistState (openapi.yaml), in its sort order."""

    none = "none"
    open = "open"
    complete = "complete"


class WidgetTag(str, Enum):
    fragile = "fragile"
    bulky = "bulky"
    seasonal = "seasonal"
    featured = "featured"


class WidgetTagLink(SQLModel, table=True):
    """One row per (widget, tag) — the multi-choice field as a join table
    (migration 0004), not an array/JSON column: it filters the same way on
    Postgres and on SQLite (the pytest engine), and it's the plain
    relational shape any future multi-choice field can copy."""

    __tablename__ = "widget_tags"

    widget_id: int = Field(foreign_key="widgets.id", primary_key=True, ondelete="CASCADE")
    tag: WidgetTag = Field(primary_key=True)


class WidgetExtraCategoryLink(SQLModel, table=True):
    """One row per (widget, category) — the multi-reference field as a join
    table (migration 0007), the same shape as WidgetTagLink with a foreign
    key in place of the enum. Deleting either side deletes the link."""

    __tablename__ = "widget_extra_categories"

    widget_id: int = Field(foreign_key="widgets.id", primary_key=True, ondelete="CASCADE")
    category_id: int = Field(foreign_key="categories.id", primary_key=True, ondelete="CASCADE")


class WidgetChecklistItem(SQLModel, table=True):
    """One item of a widget's checklist — the sub-records pattern (migration
    0008). A child table with its own surrogate id and a `position`, since
    order is part of the data; the wire never sees either column (the list
    is read and written whole, in order)."""

    __tablename__ = "widget_checklist_items"

    id: int | None = Field(default=None, primary_key=True)
    widget_id: int = Field(foreign_key="widgets.id", index=True, ondelete="CASCADE")
    position: int
    text: str = Field(max_length=300)
    done: bool = Field(default=False)


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
    # Yes/no field (migration 0006). Never null; True when a create leaves it
    # out, matching the server_default existing rows were given.
    in_stock: bool = Field(default=True)
    # Per-user ownership (migration 0003). Never on the wire — WidgetOut and
    # openapi.yaml don't mention it; the router scopes every query to the
    # session's user instead, and another user's widget is a plain 404.
    owner_id: int = Field(foreign_key="users.id", index=True)
    # lazy="selectin": loaded with every widget query in one extra SELECT —
    # the async session can't lazy-load on attribute access later.
    tag_links: list[WidgetTagLink] = Relationship(
        sa_relationship_kwargs={"lazy": "selectin", "cascade": "all, delete-orphan"}
    )
    extra_category_links: list[WidgetExtraCategoryLink] = Relationship(
        sa_relationship_kwargs={"lazy": "selectin", "cascade": "all, delete-orphan"}
    )
    checklist_items: list[WidgetChecklistItem] = Relationship(
        sa_relationship_kwargs={
            "lazy": "selectin",
            "cascade": "all, delete-orphan",
            "order_by": "WidgetChecklistItem.position",
        }
    )

    @property
    def checklist_state(self) -> WidgetChecklistState:
        """The wire field (WidgetOut.checklistState), from the loaded items.
        Mirrors checklist_state_expr() in app/routers/widgets.py, which the
        list's filter and sort use; tests/test_widgets.py checks they agree."""
        if not self.checklist_items:
            return WidgetChecklistState.none
        if any(not item.done for item in self.checklist_items):
            return WidgetChecklistState.open
        return WidgetChecklistState.complete

    @property
    def checklist(self) -> list[WidgetChecklistItem]:
        """The wire field (WidgetOut.checklist), in saved order."""
        return sorted(self.checklist_items, key=lambda item: item.position)

    def set_checklist(self, items: list[tuple[str, bool]]) -> None:
        """Replace the whole list — PATCH semantics, like set_tags; the order
        given is the order stored."""
        self.checklist_items = [
            WidgetChecklistItem(position=position, text=text, done=done)
            for position, (text, done) in enumerate(items)
        ]

    @property
    def extra_category_ids(self) -> list[int]:
        """The wire field (WidgetOut.extraCategoryIds), ascending by id."""
        return sorted(link.category_id for link in self.extra_category_links)

    def set_extra_category_ids(self, ids: list[int]) -> None:
        """Replace the whole set — PATCH semantics, like set_tags. The router
        checks every id is a real category first."""
        self.extra_category_links = [WidgetExtraCategoryLink(category_id=category_id) for category_id in ids]

    @property
    def tags(self) -> list[WidgetTag]:
        """The wire field (WidgetOut.tags), in the enum's display order."""
        order = list(WidgetTag)
        return sorted((link.tag for link in self.tag_links), key=order.index)

    def set_tags(self, tags: list[WidgetTag]) -> None:
        """Replace the whole set — PATCH semantics for tags (openapi.yaml)."""
        self.tag_links = [WidgetTagLink(tag=tag) for tag in tags]
