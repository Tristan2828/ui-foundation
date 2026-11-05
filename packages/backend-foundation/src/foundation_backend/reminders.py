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
- **Channels beyond push** (email, a phone-alert app) are the app's
  senders, handed to `register(senders=...)`: the job still decides what's
  due and stamps it once, and says per channel whether it was sent or
  failed, and why (`ChannelResult`).
"""

import logging
from collections.abc import Awaitable, Callable, Iterable, Mapping
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone, tzinfo
from typing import Any, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import inspect
from sqlmodel import SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from foundation_backend import jobs, push
from foundation_backend.error_reporting import ErrorContext, report_error

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


PUSH = "push"
ChannelStatus = Literal["sent", "failed", "skipped"]


@dataclass
class ChannelResult:
    """How one reminder went on one channel: sent, failed (with `error`,
    why), or skipped (nothing to send to: push with no device subscribed).
    `detail` is the channel's own count or note ("2 sent, 1 gone")."""

    status: ChannelStatus
    error: str | None = None
    detail: str = ""


Sender = Callable[[AsyncSession, Any], Awaitable[ChannelResult | None]]
"""Sends one due reminder (a row of the job's model) on one channel. It
returns None when sent, or a ChannelResult; an exception it raises is a
failed result with the exception as its error. It may read the session
but shouldn't write it: the job commits the reminder's stamp."""

ChannelsOf = Callable[[Any], Iterable[str]]
"""The channels a reminder goes out on (a column of the app's, say). Left
out, every reminder goes on every channel: push and each extra sender."""

OnSent = Callable[[AsyncSession, Any, dict[str, ChannelResult]], Awaitable[None]]
"""Called with a reminder and its results by channel before the job marks
it sent and commits, so a last-sent time per channel lands in the same
commit."""


@dataclass
class ReminderSent:
    """A reminder the run sent (its id): the local day it was due on, and
    how each of its channels went."""

    reminder_id: Any
    on: date
    results: dict[str, ChannelResult]


@dataclass
class RemindersRun:
    """One run of the job: what was sent, rows skipped as unreadable, and
    push's device counts across every reminder."""

    sent: list[ReminderSent] = field(default_factory=list)
    unreadable: int = 0
    push_result: push.PushResult = field(default_factory=push.PushResult)

    def summary(self) -> str | None:
        """The job's line in the jobs record, None when nothing was due.
        Push-only runs read as before ("1 due: 2 sent"); each other
        channel adds its own count ("email: 1 sent, 1 failed")."""
        if not self.sent and not self.unreadable:
            return None
        counts: dict[str, dict[str, int]] = {}
        for item in self.sent:
            for channel, result in item.results.items():
                tally = counts.setdefault(channel, {})
                tally[result.status] = tally.get(result.status, 0) + 1
        parts = [self.push_result.summary()] if PUSH in counts or not counts else []
        for channel, tally in counts.items():
            if channel != PUSH:
                words = [f"{tally[status]} {status}" for status in ("sent", "failed", "skipped") if status in tally]
                parts.append(f"{channel}: {', '.join(words)}")
        summary = f"{len(self.sent)} due: {'; '.join(parts)}"
        return f"{summary}; {self.unreadable} unreadable" if self.unreadable else summary


def _push_sender(totals: push.PushResult) -> Sender:
    """The package's channel: every device the user allowed, counted into
    the run's totals."""

    async def send(session: AsyncSession, reminder: Any) -> ChannelResult:
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
        detail = outcome.summary()
        if outcome.sent:
            return ChannelResult("sent", detail=detail)
        if outcome.failed:
            return ChannelResult("failed", error=f"Every device failed ({detail}).", detail=detail)
        return ChannelResult("skipped", detail="No device subscribed.")

    return send


async def _loaded(session: AsyncSession, reminder: Any) -> Any:
    """The reminder with its columns loaded again after a commit (the
    previous reminder's stamp, or push dropping a gone subscription)
    expired them: an async session can't load them lazily."""
    if inspect(reminder).expired_attributes:
        await session.refresh(reminder)
    return reminder


def _report(channel: str, exc: BaseException) -> None:
    tags = {"job": JOB_NAME, "channel": channel}
    report_error(exc, ErrorContext(source="server", route=f"job {JOB_NAME}", tags=tags))


async def _send_on(session: AsyncSession, reminder: Any, channel: str, sender: Sender | None) -> ChannelResult:
    """One channel for one reminder, never raising: a failure is reported
    (error_reporting) and returned."""
    if sender is None:
        result = ChannelResult("failed", error=f"No sender for channel {channel!r}.")
    else:
        try:
            result = await sender(session, await _loaded(session, reminder)) or ChannelResult("sent")
        except Exception as exc:  # noqa: BLE001 — one channel failing never stops the others
            _report(channel, exc)
            return ChannelResult("failed", error=str(exc) or type(exc).__name__)
    if result.status == "failed":
        _report(channel, RuntimeError(f"Reminder {(await _loaded(session, reminder)).id} on {channel}: {result.error}"))
    return result


async def run_due_reminders(
    session: AsyncSession,
    now: datetime | None = None,
    *,
    model: type[SQLModel] | None = None,
    senders: Mapping[str, Sender] | None = None,
    channels: ChannelsOf | None = None,
    on_sent: OnSent | None = None,
) -> RemindersRun:
    """One run of the job: sends each due reminder on its channels, marks
    it sent today, and says how each channel went.

    `model` is the reminders table to read: the package's when left out,
    or an app's own with the same columns (id, user_id, title, body, url,
    time_of_day, days, time_zone, enabled, last_sent_on). `senders` adds
    channels beyond Web Push by name ({"email": send_email}); one named
    "push" replaces the package's. `channels` picks a reminder's channels
    (all of them when left out), and `on_sent` sees each reminder's results
    before it's stamped. A failed channel doesn't stop the others, and the
    reminder is done for the day either way: a channel that's down isn't
    tried again every minute."""
    now = now or datetime.now(timezone.utc)
    table: Any = model or _default_model()
    result = await session.exec(select(table).where(col(table.enabled).is_(True)))
    run = RemindersRun()
    due: list[tuple[Any, date]] = []
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
            run.unreadable += 1
            continue
        if on is not None:
            due.append((reminder, on))
    available: dict[str, Sender] = {PUSH: _push_sender(run.push_result), **(senders or {})}
    for reminder, on in due:
        reminder_id = (await _loaded(session, reminder)).id
        names = list(dict.fromkeys(channels(reminder))) if channels else list(available)
        results = {name: await _send_on(session, reminder, name, available.get(name)) for name in names}
        if on_sent is not None:
            try:
                await on_sent(session, await _loaded(session, reminder), results)
            except Exception as exc:  # noqa: BLE001 — stamped anyway, or it's sent again next minute
                _report("on_sent", exc)
        reminder.last_sent_on = on
        session.add(reminder)
        await session.commit()
        run.sent.append(ReminderSent(reminder_id, on, results))
    return run


async def send_due_reminders(
    session: AsyncSession,
    now: datetime | None = None,
    *,
    model: type[SQLModel] | None = None,
    senders: Mapping[str, Sender] | None = None,
    channels: ChannelsOf | None = None,
    on_sent: OnSent | None = None,
) -> str | None:
    """run_due_reminders as the job runs it: its summary line, or None
    when nothing was due."""
    run = await run_due_reminders(session, now, model=model, senders=senders, channels=channels, on_sent=on_sent)
    return run.summary()


def register(
    model: type[SQLModel] | None = None,
    *,
    senders: Mapping[str, Sender] | None = None,
    channels: ChannelsOf | None = None,
    on_sent: OnSent | None = None,
) -> None:
    """Adds the send-reminders job (main.py, when PUSH_ENABLED), reading
    `model`'s table (the package's `reminders` when left out) and sending
    on push and `senders`, as run_due_reminders says."""
    if JOB_NAME in jobs.JOBS:
        return

    async def run(session: AsyncSession) -> str | None:
        return await send_due_reminders(session, model=model, senders=senders, channels=channels, on_sent=on_sent)

    jobs.register_job(JOB_NAME, every=timedelta(minutes=1), run=run, timeout=timedelta(minutes=2))
