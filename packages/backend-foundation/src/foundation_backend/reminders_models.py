"""The package's reminders table, `reminders` in the default schema
(foundation_backend.reminders, the send-reminders job). Apart from
models.py (#247), so it reaches `SQLModel.metadata` only for an app that
uses it: importing this module, or running the job without a model of
the app's own, puts it there.

An app whose reminders live elsewhere (another schema, another table
name) defines its own table model with these columns and hands it to the
job: `reminders.register(model=MyReminder)`
(docs/foundation/reminders.md).
"""

from datetime import date, datetime, time

from sqlalchemy import Column, DateTime, Time
from sqlmodel import Field, SQLModel

# users, the table its user_id points at.
import foundation_backend.models  # noqa: F401


class Reminder(SQLModel, table=True):
    """A notification sent at a time the user chose, on the days they chose
    (foundation_backend.reminders, the send-reminders job)."""

    __tablename__ = "reminders"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    title: str = Field(max_length=100)
    body: str = Field(default="", max_length=300)
    # The app's own path the notification opens ("/routines/3").
    url: str = Field(default="/", max_length=500)
    # When, in the user's own time zone: "HH:MM" on these days.
    time_of_day: time = Field(sa_column=Column(Time(), nullable=False))
    # Comma-separated mon,tue,wed,thu,fri,sat,sun, in that order.
    days: str = Field(max_length=27)
    # IANA name ("America/Chicago"); the job reads the time in it.
    time_zone: str = Field(max_length=64)
    enabled: bool = Field(default=True)
    # The local date it was last sent on, so it goes once a day at most.
    last_sent_on: date | None = Field(default=None)
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
