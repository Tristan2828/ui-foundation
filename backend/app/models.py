"""SQLModel table models — DB shape only. Column names stay snake_case;
JSON casing lives in app/schemas.py, never here. See docs/BUILD-PLAN.md
Phase 8 warning: table models are never returned directly from a router.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum

from sqlmodel import Field, SQLModel


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
    available_from: datetime
    assignee_email: str | None = Field(default=None)
    price: Decimal = Field(max_digits=10, decimal_places=2)
    description: str = Field(max_length=2000)
