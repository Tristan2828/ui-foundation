"""POST /client-errors (openapi.yaml operationId reportClientError): a
failure the browser saw, forwarded to error reporting (app/error_reporting.py).

Needs a session, so the public can't post into it; the user is the
session's, never something the page says. Duplicates (the same error from
the same session) go through at most once a minute, and a session sends at
most CLIENT_ERRORS_PER_MINUTE a minute; the rest answer 204 and are dropped,
so a page stuck in a loop can't flood the destination. Both are counted in
this process's memory: a restart forgets them, and with several workers
each counts its own.
"""

import time
from collections import deque

from fastapi import APIRouter, Cookie, Depends

from app import error_reporting
from app.config import CLIENT_ERRORS_PER_MINUTE
from app.models import User
from app.openapi_responses import SERVER_ERROR, UNAUTHORIZED, VALIDATION
from app.routers.auth import get_current_user
from app.schemas import ClientErrorReport
from app.security import hash_token

router = APIRouter(tags=["errors"])

WINDOW_SECONDS = 60.0
# session -> the times of its recent reports; (session, error) -> last sent.
_recent: dict[str, deque[float]] = {}
_last_seen: dict[tuple[str, str], float] = {}


def reset() -> None:
    """Forgets every count (tests)."""
    _recent.clear()
    _last_seen.clear()


def _admit(session_key: str, signature: str, now: float) -> bool:
    for key, at in list(_last_seen.items()):
        if now - at >= WINDOW_SECONDS:
            del _last_seen[key]
    if (session_key, signature) in _last_seen:
        return False
    times = _recent.setdefault(session_key, deque())
    while times and now - times[0] >= WINDOW_SECONDS:
        times.popleft()
    if len(times) >= CLIENT_ERRORS_PER_MINUTE:
        return False
    times.append(now)
    _last_seen[(session_key, signature)] = now
    return True


@router.post(
    "/client-errors",
    status_code=204,
    responses={**UNAUTHORIZED, **VALIDATION, **SERVER_ERROR},
)
async def report_client_error(
    body: ClientErrorReport,
    user: User = Depends(get_current_user),
    session_id: str | None = Cookie(default=None),
) -> None:
    session_key = hash_token(session_id or f"user:{user.id}")
    signature = "\x1f".join([body.source, body.type, body.message, body.route or ""])
    if not _admit(session_key, signature, time.monotonic()):
        return
    error_reporting.report(
        error_reporting.from_client(body.type, body.message, body.stack),
        error_reporting.ErrorContext(
            source=body.source,
            route=body.route,
            method=body.method,
            status=body.status,
            user_id=user.id,
            release=body.release,
        ),
    )
