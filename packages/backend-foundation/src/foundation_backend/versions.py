"""Saves that don't overwrite: a record's version, checked on update.

A record that more than one writer edits (a tab, a phone, an AI chat
through MCP) carries its `updated_at`, and an update may send the one it
was built on (`baseUpdatedAt` on the wire). When that's no longer the
record's, someone else saved in between: the update is refused with a 409
(`VersionConflict`, the foundation's ConflictError), nothing is written,
and the client fetches the record again and lets the person choose. An
update that sends no version isn't checked (an app's older clients, a
script), so adding this is additive.

Why `updated_at` and not a counter or an ETag: most tables already have
one, a person or an AI reading the row can tell what it means, and it
rides in the JSON body, where an MCP tool call can send it back too (an
`If-Match` header can't reach an AI chat). It's compared for equality,
never ordered, so clocks never matter; a write sets it to a new instant
(`touch`), microseconds included.

docs/foundation/add-an-entity.md "Saves that don't overwrite" has the
whole pattern; the template's Widgets entity uses it.
"""

import threading
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException

CONFLICT_DETAIL = "This changed since you opened it (another tab, device or chat saved it). Nothing was saved."


class VersionConflict(HTTPException):
    """The 409 for an update built on a version that's no longer the record's."""

    def __init__(self, detail: str = CONFLICT_DETAIL) -> None:
        super().__init__(status_code=409, detail=detail)


def _utc(value: datetime) -> datetime:
    # SQLite hands a timestamptz back naive; it was written in UTC.
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def same_version(current: datetime | None, base: datetime | None) -> bool:
    """Whether `base` is the record's version `current` (as instants)."""
    if current is None or base is None:
        return current is None and base is None
    return _utc(current) == _utc(base)


def check_version(current: datetime | None, base: datetime | None, *, detail: str = CONFLICT_DETAIL) -> None:
    """Raises `VersionConflict` (409) when the update sent a version
    (`base`) and it isn't the record's (`current`). No version sent: no
    check. Call it after the 404 check and before changing anything."""
    if base is not None and not same_version(current, base):
        raise VersionConflict(detail)


_touch_lock = threading.Lock()
_last_touch: datetime | None = None


def touch() -> datetime:
    """The new version for a record being written: now, in UTC, and strictly
    later than the last one this process returned. (Windows' clock moves only
    about every 1.6 ms, so two quick writes would otherwise share a version,
    and a stale save could slip past the 409 check.)"""
    global _last_touch
    with _touch_lock:
        now = datetime.now(timezone.utc)
        if _last_touch is not None and now <= _last_touch:
            now = _last_touch + timedelta(microseconds=1)
        _last_touch = now
        return now


def pop_base_version(updates: dict[str, Any], key: str = "base_updated_at") -> datetime | None:
    """Takes the version an update was built on out of its fields (it's
    not a column to set), returning it or None."""
    value = updates.pop(key, None)
    return value if isinstance(value, datetime) or value is None else None
