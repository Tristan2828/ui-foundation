"""Error reporting: one seam, `report_error`, with one built-in destination.

Called by the unhandled-exception handler (every 500, errors.py), by
POST /client-errors (failures the browser saw), and usable by app code.
It always logs. With ERROR_REPORTING_DSN set it also sends the error, as a
Sentry envelope over plain HTTP (stdlib only, no SDK), to Sentry itself or
any Sentry-compatible server such as a self-hosted GlitchTip, which group,
count and email them. Unset, the default, it only logs.

**What a report holds, and only that:** the error's type, message and
stack; the route *pattern* (`/widgets/{widget_id}`, never the URL); the HTTP
method and status; the release; the environment; the user's id, never
their email. Never request or response bodies, cookies, headers, form
values or query strings: nothing here is given the request, only those
fields. Messages are scrubbed too: a database error's SQL and parameters,
and any query string in a URL, are cut (`scrub`).
"""

import json
import logging
import re
import threading
import traceback
import urllib.request
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal
from urllib.parse import urlsplit

from foundation_backend.config import APP_ENV, ERROR_REPORTING_DSN, RELEASE

logger = logging.getLogger("app.errors")

MAX_MESSAGE = 2000
MAX_STACK = 16000
SEND_TIMEOUT_SECONDS = 5

Source = Literal["server", "route", "window", "unhandledrejection", "query", "mutation"]


@dataclass
class ErrorContext:
    """Everything a report may carry besides the error itself."""

    source: Source = "server"
    route: str | None = None
    method: str | None = None
    status: int | None = None
    user_id: int | None = None
    # The browser's build, for a client report; the server's is RELEASE.
    release: str | None = None
    tags: dict[str, str] = field(default_factory=dict)


@dataclass
class ReportedError:
    """An error as reported: from a Python exception, or as the browser
    described one (POST /client-errors)."""

    type: str
    message: str
    frames: list[dict[str, Any]]
    platform: Literal["python", "javascript"]
    stack: str | None = None


# ------------------------------------------------------------------ scrub

_SQL_TAIL = re.compile(r"\s*\[(SQL|parameters):.*", re.DOTALL)
_SQLA_BACKGROUND = re.compile(r"\s*\(Background on this error at:.*", re.DOTALL)
# A query string or fragment, up to (not including) a stack frame's
# trailing :line:col, a space, a quote or a bracket.
_URL_QUERY = re.compile(
    r"(\b[a-z][a-z0-9+.-]*://[^\s?#\"'()]+|(?<![\w/])/[^\s?#\"'()]*)"
    r"[?#][^\s\"'()]*?(?=(?::\d+){1,2}(?=[\s\"'()]|$)|[\s\"'()]|$)",
    re.IGNORECASE,
)


def scrub(text: str, limit: int = MAX_MESSAGE) -> str:
    """Cuts what a message or stack must never carry: a database error's
    SQL and bound parameters (which hold row values), and every query
    string or fragment in a URL or path. Then caps the length."""
    text = _SQL_TAIL.sub("", text)
    text = _SQLA_BACKGROUND.sub("", text)
    text = _URL_QUERY.sub(r"\1", text)
    return text if len(text) <= limit else text[: limit - 1] + "…"


def from_exception(exc: BaseException) -> ReportedError:
    frames = [
        {"filename": frame.filename, "function": frame.name, "lineno": frame.lineno, "in_app": "/app/" in frame.filename.replace("\\", "/")}
        for frame in traceback.extract_tb(exc.__traceback__)
    ]
    return ReportedError(type=type(exc).__name__, message=scrub(str(exc)), frames=frames, platform="python")


# Chrome/V8 "    at fn (url:1:2)" or "    at url:1:2"; Firefox/Safari "fn@url:1:2".
_V8_FRAME = re.compile(r"^\s*at (?:(?P<fn>.+?) \()?(?P<file>[^()\s]+?):(?P<line>\d+):(?P<col>\d+)\)?$")
_GECKO_FRAME = re.compile(r"^(?P<fn>[^@]*)@(?P<file>.+?):(?P<line>\d+):(?P<col>\d+)$")


def from_client(type_: str, message: str, stack: str | None) -> ReportedError:
    stack = scrub(stack, MAX_STACK) if stack else None
    frames: list[dict[str, Any]] = []
    for line in (stack or "").splitlines():
        match = _V8_FRAME.match(line) or _GECKO_FRAME.match(line.strip())
        if match:
            frames.append(
                {
                    "filename": match["file"],
                    "function": (match["fn"] or "?").strip() or "?",
                    "lineno": int(match["line"]),
                    "colno": int(match["col"]),
                }
            )
    # Sentry lists frames oldest first; a JS stack is newest first.
    frames.reverse()
    return ReportedError(type=type_, message=scrub(message), frames=frames, platform="javascript", stack=stack)


# ------------------------------------------------------------------- send


def parse_dsn(dsn: str) -> tuple[str, str]:
    """`https://<key>@host[:port]/[path/]<project>` → (envelope URL, key)."""
    parts = urlsplit(dsn)
    if not parts.scheme or not parts.hostname or not parts.username or not parts.path.strip("/"):
        raise ValueError("ERROR_REPORTING_DSN should look like https://<key>@<host>/<project id>")
    path, _, project = parts.path.strip("/").rpartition("/")
    host = parts.hostname + (f":{parts.port}" if parts.port else "")
    prefix = f"/{path}" if path else ""
    return f"{parts.scheme}://{host}{prefix}/api/{project}/envelope/", parts.username


def build_event(error: ReportedError, context: ErrorContext) -> dict[str, Any]:
    tags = {"source": context.source, **context.tags}
    if context.route:
        tags["route"] = context.route
    if context.method:
        tags["method"] = context.method
    if context.status is not None:
        tags["status"] = str(context.status)
    event: dict[str, Any] = {
        "event_id": uuid.uuid4().hex,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "platform": error.platform,
        "level": "error",
        "logger": "app.errors",
        "environment": APP_ENV,
        "exception": {
            "values": [
                {
                    "type": error.type,
                    "value": error.message,
                    **({"stacktrace": {"frames": error.frames}} if error.frames else {}),
                }
            ]
        },
        "tags": tags,
    }
    release = context.release or RELEASE
    if release:
        event["release"] = release
    if context.route:
        event["transaction"] = context.route
    if context.user_id is not None:
        event["user"] = {"id": str(context.user_id)}
    if error.stack and not error.frames:
        # A stack the parser didn't recognise still reaches the report.
        event["extra"] = {"stack": error.stack}
    return event


def build_envelope(event: dict[str, Any], dsn: str) -> bytes:
    payload = json.dumps(event, separators=(",", ":")).encode()
    header = {"event_id": event["event_id"], "dsn": dsn, "sent_at": event["timestamp"]}
    item = {"type": "event", "content_type": "application/json", "length": len(payload)}
    return b"\n".join([json.dumps(header).encode(), json.dumps(item).encode(), payload]) + b"\n"


def _post(url: str, key: str, body: bytes) -> None:
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/x-sentry-envelope",
            "X-Sentry-Auth": f"Sentry sentry_version=7, sentry_key={key}, sentry_client=ui-foundation/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=SEND_TIMEOUT_SECONDS):  # noqa: S310 — the DSN's own https URL
        pass


def _send(dsn: str, event: dict[str, Any]) -> None:
    try:
        url, key = parse_dsn(dsn)
        _post(url, key, build_envelope(event, dsn))
    except Exception:  # noqa: BLE001 — reporting must never take the app down
        logger.warning("error reporting: could not send event %s", event["event_id"], exc_info=True)


def _dispatch(dsn: str, event: dict[str, Any]) -> None:
    # A thread per report: the request that failed never waits on the
    # destination. Tests replace this with a direct call.
    threading.Thread(target=_send, args=(dsn, event), daemon=True).start()


def report(error: ReportedError, context: ErrorContext) -> None:
    """Logs `error` and, with ERROR_REPORTING_DSN set, sends it in the
    background: the request that failed never waits on the destination."""
    event = build_event(error, context)
    logger.error(
        "%s: %s (source=%s route=%s status=%s user=%s)",
        error.type,
        error.message,
        context.source,
        context.route,
        context.status,
        context.user_id,
    )
    if ERROR_REPORTING_DSN:
        _dispatch(ERROR_REPORTING_DSN, event)


def report_error(exc: BaseException, context: ErrorContext | None = None) -> None:
    """The seam for Python exceptions: app code may call it too."""
    report(from_exception(exc), context or ErrorContext())
