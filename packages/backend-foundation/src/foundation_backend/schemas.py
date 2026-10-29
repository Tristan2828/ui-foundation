"""The foundation's wire schemas: accounts and sign-in, the data
environment, client error reports, scheduled jobs, Web Push, the error
envelopes, and the base every
app schema builds on (CamelModel, Page). Table models (models.py) never
cross this boundary directly.

JSON is camelCase (alias_generator=to_camel + populate_by_name) so Python
stays snake_case internally while matching openapi.yaml on the wire.
"""

from datetime import datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic.alias_generators import to_camel

T = TypeVar("T")

# PBKDF2 hashes a long password down first, so length costs little, but a
# request body still shouldn't be unbounded.
PASSWORD_MAX_LENGTH = 1024


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
    password: str = Field(min_length=8, max_length=PASSWORD_MAX_LENGTH)

    _email_lower = field_validator("email")(_normalize_email)


class LoginNextStep(CamelModel):
    """A 202 from POST /auth/login: the password was right, a code is next."""

    next: Literal["totp"]


class TotpLoginRequest(CamelModel):
    code: str = Field(min_length=1, max_length=64)


class RegisterRequest(CamelModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8, max_length=PASSWORD_MAX_LENGTH)

    _email_lower = field_validator("email")(_normalize_email)


class ClientErrorReport(CamelModel):
    """POST /client-errors: a failure the browser saw. Only these fields
    exist, so nothing else from the page can be sent."""

    source: Literal["route", "window", "unhandledrejection", "query", "mutation"]
    type: str = Field(min_length=1, max_length=200)
    message: str = Field(max_length=2000)
    stack: str | None = Field(default=None, max_length=16000)
    route: str | None = Field(default=None, max_length=300)
    method: str | None = Field(default=None, max_length=10)
    status: int | None = Field(default=None, ge=100, le=599)
    release: str | None = Field(default=None, max_length=100)


class HTTPErrorBody(CamelModel):
    detail: str


class ValidationErrorItem(CamelModel):
    loc: list[str | int]
    msg: str
    type: str


class ValidationErrorBody(CamelModel):
    detail: list[ValidationErrorItem]


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
