"""Wire schemas — the only shapes a router may return or accept. Table
models (app/models.py) never cross this boundary directly.

JSON is camelCase (alias_generator=to_camel + populate_by_name) so Python
stays snake_case internally while matching openapi.yaml on the wire.

The foundation's (sign-in, the data environment, client errors, the error
envelopes, CamelModel and Page) are `foundation_backend.schemas`,
re-exported here.
"""

from datetime import datetime
from decimal import Decimal
from typing import ClassVar, Literal

from pydantic import ConfigDict, EmailStr, Field, ValidationInfo, field_validator
from pydantic.alias_generators import to_camel

from app.models import WidgetChecklistState, WidgetStatus, WidgetTag
from foundation_backend.schemas import (
    CamelModel as CamelModel,
    Page as Page,
    DataEnvironmentOut as DataEnvironmentOut,
    UserOut as UserOut,
    PASSWORD_MAX_LENGTH as PASSWORD_MAX_LENGTH,
    LoginRequest as LoginRequest,
    LoginNextStep as LoginNextStep,
    TotpLoginRequest as TotpLoginRequest,
    RegisterRequest as RegisterRequest,
    ClientErrorReport as ClientErrorReport,
    HTTPErrorBody as HTTPErrorBody,
    ValidationErrorItem as ValidationErrorItem,
    ValidationErrorBody as ValidationErrorBody,
)

PRICE_PATTERN = r"^\d+\.\d{2}$"


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


def _format_price(v: object) -> object:
    return f"{v:.2f}" if isinstance(v, Decimal) else v


class ChecklistItem(CamelModel):
    """openapi.yaml ChecklistItem — both directions. Surrounding spaces are
    trimmed before the length check, so "  " is a 422 on its text."""

    model_config = ConfigDict(str_strip_whitespace=True)

    text: str = Field(min_length=1, max_length=300)
    done: bool


class WidgetPairing(CamelModel):
    """openapi.yaml WidgetPairing — both directions. The item carries the
    referenced id only; the router checks it exists (a 422 at
    ["body", "pairings", <i>, "categoryId"]). The note is trimmed."""

    model_config = ConfigDict(str_strip_whitespace=True)

    category_id: int
    note: str = Field(max_length=100)


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
    pairings: list[WidgetPairing]
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
    pairings: list[WidgetPairing] = Field(default_factory=list, max_length=20)

    _check_tags = field_validator("tags")(_unique_tags)
    _check_extra_category_ids = field_validator("extra_category_ids")(_unique_ids)


class WidgetUpdate(CamelModel):
    """PATCH: a field left out keeps its value. Only the fields in
    NULLABLE_FIELDS may be sent as null (to clear them); null for any other
    is a 422 on that field, never a NOT NULL violation (a 500) at commit.
    A new field is refused null unless it's added there."""

    NULLABLE_FIELDS: ClassVar[frozenset[str]] = frozenset({"assignee_email"})

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
    pairings: list[WidgetPairing] | None = Field(default=None, max_length=20)

    _check_tags = field_validator("tags")(_unique_tags)
    _check_extra_category_ids = field_validator("extra_category_ids")(_unique_ids)

    @field_validator("*", mode="before")
    @classmethod
    def _refuse_null(cls, v: object, info: ValidationInfo) -> object:
        # Runs only for fields the request sent: one left out isn't validated.
        if v is None and info.field_name not in cls.NULLABLE_FIELDS:
            raise ValueError(f"{to_camel(info.field_name or '')} can't be null")
        return v


class JobRunOut(CamelModel):
    """A run of a scheduled job (openapi.yaml JobRun)."""

    trigger: Literal["schedule", "manual"]
    started_at: datetime
    finished_at: datetime
    outcome: Literal["ok", "failed", "skipped"]
    error: str | None
    summary: str | None


class JobOut(CamelModel):
    """A scheduled job and its last run (openapi.yaml Job)."""

    name: str
    every_seconds: int
    timeout_seconds: int
    running: bool
    last_run: JobRunOut | None


class PushPublicKeyOut(CamelModel):
    """GET /push/public-key (openapi.yaml PushPublicKey)."""

    public_key: str


class PushSubscriptionKeys(CamelModel):
    p256dh: str = Field(min_length=1, max_length=100)
    auth: str = Field(min_length=1, max_length=32)


class PushSubscriptionIn(CamelModel):
    """POST /push/subscriptions: what the browser's PushSubscription.toJSON()
    holds. expirationTime (milliseconds, not always whole) is accepted and
    ignored."""

    endpoint: str = Field(min_length=1, max_length=2048)
    keys: PushSubscriptionKeys
    expiration_time: float | None = None


class PushSubscriptionOut(CamelModel):
    """openapi.yaml PushSubscriptionCreated."""

    id: int
