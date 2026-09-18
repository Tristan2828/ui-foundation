"""Wire schemas — the only shapes a router may return or accept. Table
models (app/models.py) never cross this boundary directly; see
docs/BUILD-PLAN.md Phase 8's SQLModel warning.

JSON is camelCase (alias_generator=to_camel + populate_by_name) so Python
stays snake_case internally while matching openapi.yaml on the wire.
"""

from datetime import datetime
from decimal import Decimal
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic.alias_generators import to_camel

from app.models import WidgetStatus

T = TypeVar("T")

PRICE_PATTERN = r"^\d+\.\d{2}$"


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class Page(CamelModel, Generic[T]):
    """Matches WidgetListResponse in openapi.yaml: {items, total}. The
    gateway (src/api/gateway/widgets.ts) computes page/pageSize from
    offset/limit client-side — this wire shape is deliberately not the
    UI-owned Page<T> in src/api/contracts.ts.
    """

    items: list[T]
    total: int = Field(ge=0)


class CategoryOut(CamelModel):
    id: int
    name: str


def _format_price(v: object) -> object:
    return f"{v:.2f}" if isinstance(v, Decimal) else v


class WidgetOut(CamelModel):
    id: int
    name: str
    category_id: int
    status: WidgetStatus
    available_from: datetime
    assignee_email: str | None
    price: str
    description: str

    @field_validator("price", mode="before")
    @classmethod
    def _price_to_string(cls, v: object) -> object:
        return _format_price(v)


class WidgetCreate(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    category_id: int
    status: WidgetStatus = WidgetStatus.draft
    available_from: datetime
    assignee_email: EmailStr | None = None
    price: str = Field(pattern=PRICE_PATTERN)
    description: str = Field(max_length=2000)


class WidgetUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    category_id: int | None = None
    status: WidgetStatus | None = None
    available_from: datetime | None = None
    assignee_email: EmailStr | None = None
    price: str | None = Field(default=None, pattern=PRICE_PATTERN)
    description: str | None = Field(default=None, max_length=2000)


class UserOut(CamelModel):
    id: int
    email: str
    name: str


def _normalize_email(v: str) -> str:
    # Emails are stored lowercased (migration 0003), so login and register
    # must match on the same form — otherwise `Dev@Example.com` registers
    # as a second account alongside `dev@example.com`.
    return v.lower()


class LoginRequest(CamelModel):
    email: EmailStr
    password: str = Field(min_length=8)

    _email_lower = field_validator("email")(_normalize_email)


class RegisterRequest(CamelModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8)

    _email_lower = field_validator("email")(_normalize_email)


class HTTPErrorBody(CamelModel):
    detail: str


class ValidationErrorItem(CamelModel):
    loc: list[str | int]
    msg: str
    type: str


class ValidationErrorBody(CamelModel):
    detail: list[ValidationErrorItem]
