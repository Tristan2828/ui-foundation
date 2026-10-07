"""Wire schemas — the only shapes a router may return or accept. Table
models (app/models.py) never cross this boundary directly.

JSON is camelCase (alias_generator=to_camel + populate_by_name) so Python
stays snake_case internally while matching openapi.yaml on the wire.
"""

from datetime import datetime
from decimal import Decimal
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic.alias_generators import to_camel

from app.models import WidgetChecklistState, WidgetStatus, WidgetTag

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


class DataEnvironmentOut(CamelModel):
    """DataEnvironment in openapi.yaml: config.DATA_LABEL, null for production data."""

    data_label: str | None


class WidgetCategoryOut(CamelModel):
    id: int
    name: str


def _unique_tags(v: list[WidgetTag] | None) -> list[WidgetTag] | None:
    # openapi.yaml: tags has uniqueItems — a repeat is a 422, same shape as
    # any other field error, not silently deduplicated.
    if v is not None and len(set(v)) != len(v):
        raise ValueError("tags must be unique")
    return v


def _unique_ids(v: list[int] | None) -> list[int] | None:
    # openapi.yaml: extraCategoryIds has uniqueItems — a repeat is a 422.
    if v is not None and len(set(v)) != len(v):
        raise ValueError("extraCategoryIds must be unique")
    return v


def _not_null_ids(v: list[int] | None) -> list[int] | None:
    # Leaving extraCategoryIds out of a PATCH keeps the set; [] clears it;
    # null is a 422 rather than a silent clear.
    if v is None:
        raise ValueError("extraCategoryIds can't be null")
    return _unique_ids(v)


def _not_null(v: bool | None) -> bool | None:
    # openapi.yaml: inStock is a plain boolean. Leaving it out of a PATCH
    # keeps the stored value; an explicit null is a 422, never a NOT NULL
    # violation (a 500) at commit.
    if v is None:
        raise ValueError("inStock can't be null")
    return v


def _format_price(v: object) -> object:
    return f"{v:.2f}" if isinstance(v, Decimal) else v


class ChecklistItem(CamelModel):
    """openapi.yaml ChecklistItem — both directions. Surrounding spaces are
    trimmed before the length check, so "  " is a 422 on its text."""

    model_config = ConfigDict(str_strip_whitespace=True)

    text: str = Field(min_length=1, max_length=300)
    done: bool


def _not_null_checklist(v: list[ChecklistItem] | None) -> list[ChecklistItem] | None:
    # Leaving checklist out of a PATCH keeps it; [] clears it; null is a 422.
    if v is None:
        raise ValueError("checklist can't be null")
    return v


class WidgetOut(CamelModel):
    id: int
    name: str
    category_id: int
    status: WidgetStatus
    available_from: datetime
    assignee_email: str | None
    price: str
    description: str
    tags: list[WidgetTag]
    in_stock: bool
    extra_category_ids: list[int]
    checklist: list[ChecklistItem]
    # Computed on every read (Widget.checklist_state); never accepted on
    # create or update, so it's absent from WidgetCreate/WidgetUpdate.
    checklist_state: WidgetChecklistState

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
    tags: list[WidgetTag] = Field(default_factory=list, json_schema_extra={"uniqueItems": True})
    in_stock: bool = True
    extra_category_ids: list[int] = Field(default_factory=list, json_schema_extra={"uniqueItems": True})
    checklist: list[ChecklistItem] = Field(default_factory=list, max_length=50)

    _check_tags = field_validator("tags")(_unique_tags)
    _check_extra_category_ids = field_validator("extra_category_ids")(_unique_ids)


class WidgetUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    category_id: int | None = None
    status: WidgetStatus | None = None
    available_from: datetime | None = None
    assignee_email: EmailStr | None = None
    price: str | None = Field(default=None, pattern=PRICE_PATTERN)
    description: str | None = Field(default=None, max_length=2000)
    tags: list[WidgetTag] | None = Field(default=None, json_schema_extra={"uniqueItems": True})
    in_stock: bool | None = None
    extra_category_ids: list[int] | None = Field(default=None, json_schema_extra={"uniqueItems": True})
    checklist: list[ChecklistItem] | None = Field(default=None, max_length=50)

    _check_tags = field_validator("tags")(_unique_tags)
    _check_checklist = field_validator("checklist")(_not_null_checklist)
    _check_in_stock = field_validator("in_stock")(_not_null)
    _check_extra_category_ids = field_validator("extra_category_ids")(_not_null_ids)


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
