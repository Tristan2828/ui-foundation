"""The columns a repeating reminder adds to an app's reminders table
(foundation_backend.recurrence, the send-reminders job; #326). A base
with no table of its own: an app's table model inherits it, and its
migration adds the columns (docs/foundation/reminders.md lists them).

    class Reminder(RecurringReminderFields, table=True): ...

A row whose `recurrence` is set follows it; one whose `recurrence` is
null keeps `days` and `time_of_day`, as before.
"""

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime
from sqlmodel import Field, SQLModel


class RecurringReminderFields(SQLModel):
    """The rule and where the reminder is in it (recurrence.OccurrenceState)."""

    # The Recurrence, as its JSON (camelCase, the contract's shape).
    recurrence: dict[str, Any] | None = Field(default=None, sa_type=JSON)
    # The occurrence pending: the next to send, or the one sent and not done.
    next_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))  # type: ignore[call-overload]
    # When the pending occurrence was first sent, and last sent (a nag).
    sent_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))  # type: ignore[call-overload]
    last_sent_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))  # type: ignore[call-overload]
    nag_count: int = Field(default=0)
    # Re-send every so many minutes until done, at most nag_limit times (null: no nagging).
    nag_every_minutes: int | None = Field(default=None)
    nag_limit: int | None = Field(default=None)
    # The last occurrence marked done, and when.
    done_occurrence: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))  # type: ignore[call-overload]
    done_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))  # type: ignore[call-overload]
