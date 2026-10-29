"""Reminders (issue #167): a notification at a time of day the user chose,
on the days they chose, sent through Web Push (push.py) by the
scheduled-jobs runner (jobs.py). No scheduler of its own.

A reminder is a row in `reminders`: the time ("07:30"), the days
("mon,wed,fri"), the user's time zone, the text and the path it opens. An
app gives it an API and screens like any entity of its own
(docs/foundation/reminders.md). The table is the package's
(reminders_models.Reminder) unless the app hands the job its own model
(#247): `register(model=MyReminder)`, any table model with those columns,
in whatever schema or table name the app keeps them. Importing this
module registers no table: the package's model is loaded only when the
job runs without one of the app's.

The send-reminders job runs every minute (registered when PUSH_ENABLED, so
it needs JOBS_ENABLED to run on its own). Each run sends every enabled
reminder that's due:

- **Due** means: today, in its time zone, is one of its days; the time has
  come; it wasn't already sent today; and it isn't more than
  REMINDER_GRACE late. So a reminder is never sent twice a day, and a
  backend that was down at 07:30 doesn't send the morning's at noon.
- **Sent or not, it's done for the day.** A user with no device
  subscribed gets nothing, and the job doesn't try again every minute.
"""

import logging
from collections.abc import Iterable
from datetime import date, datetime, time, timedelta, timezone, tzinfo
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlmodel import SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from foundation_backend import jobs, push

logger = logging.getLogger("app.reminders")

DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
# How late a reminder may still go out: a job run missed by a restart or a
# slow run is caught up, a backend down for hours isn't.
REMINDER_GRACE = timedelta(minutes=15)
JOB_NAME = "send-reminders"


def parse_days(value: str) -> frozenset[int]:
    """"mon,wed" → {0, 2} (Monday is 0, as in date.weekday())."""
    names = [part.strip().lower() for part in value.split(",") if part.strip()]
    unknown = [name for name in names if name not in DAYS]
    if unknown or not names:
        raise ValueError(f"days must be some of {','.join(DAYS)}; got {value!r}.")
    return frozenset(DAYS.index(name) for name in names)


def format_days(days: Iterable[int]) -> str:
    """The stored form: the days' names, in week order."""
    return ",".join(DAYS[day] for day in sorted(set(days)))


def zone(name: str) -> tzinfo:
    """The IANA zone, read from the system's time zone database (on
    Windows, from the tzdata package: docs/foundation/reminders.md)."""
    if name == "UTC":
        return timezone.utc
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError(f"Unknown time zone {name!r}.") from exc


def due_on(
    *,
    time_of_day: time,
    days: frozenset[int],
    tz: tzinfo,
    last_sent_on: date | None,
    now: datetime,
    grace: timedelta = REMINDER_GRACE,
) -> date | None:
    """The local date a reminder is due on at `now` (UTC), or None."""
    local_now = now.astimezone(tz)
    today = local_now.date()
    if today.weekday() not in days or last_sent_on == today:
        return None
    # The scheduled moment today, as the zone has it. A time skipped by a
    # DST change (02:30 on the spring-forward night) resolves an hour on.
    scheduled = datetime.combine(today, time_of_day, tzinfo=tz)
    late = local_now - scheduled
    if late < timedelta(0) or late > grace:
        return None
    return today


def _default_model() -> type[SQLModel]:
    from foundation_backend.reminders_models import Reminder

    return Reminder


async def send_due_reminders(
    session: AsyncSession, now: datetime | None = None, *, model: type[SQLModel] | None = None
) -> str | None:
    """One run of the job: sends each due reminder, marks it sent today.

    `model` is the reminders table to read: the package's when left out,
    or an app's own with the same columns (id, user_id, title, body, url,
    time_of_day, days, time_zone, enabled, last_sent_on)."""
    now = now or datetime.now(timezone.utc)
    table: Any = model or _default_model()
    result = await session.exec(select(table).where(col(table.enabled).is_(True)))
    due: list[tuple[Any, date]] = []
    skipped = 0
    for reminder in result.all():
        try:
            on = due_on(
                time_of_day=reminder.time_of_day,
                days=parse_days(reminder.days),
                tz=zone(reminder.time_zone),
                last_sent_on=reminder.last_sent_on,
                now=now,
            )
        except ValueError:
            # A row an app wrote wrong: skipped, and said so in the summary.
            logger.warning("reminder %s: unreadable days or time zone", reminder.id)
            skipped += 1
            continue
        if on is not None:
            due.append((reminder, on))
    totals = push.PushResult()
    for reminder, on in due:
        outcome = await push.send_push(
            session,
            reminder.user_id,
            reminder.title,
            reminder.body,
            reminder.url,
            tag=f"reminder-{reminder.id}",
        )
        totals.sent += outcome.sent
        totals.removed += outcome.removed
        totals.failed += outcome.failed
        reminder.last_sent_on = on
        session.add(reminder)
        await session.commit()
    if not due and not skipped:
        return None
    summary = f"{len(due)} due: {totals.summary()}"
    return f"{summary}; {skipped} unreadable" if skipped else summary


def register(model: type[SQLModel] | None = None) -> None:
    """Adds the send-reminders job (main.py, when PUSH_ENABLED), reading
    `model`'s table: the package's `reminders` when left out."""
    if JOB_NAME in jobs.JOBS:
        return

    async def run(session: AsyncSession) -> str | None:
        return await send_due_reminders(session, model=model)

    jobs.register_job(JOB_NAME, every=timedelta(minutes=1), run=run, timeout=timedelta(minutes=2))
