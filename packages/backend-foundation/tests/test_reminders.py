"""foundation_backend.reminders: when a reminder is due, and the send-reminders job
(issue #167). Sending itself is tests/test_push.py's; here it's replaced.

Time zones are fixed offsets and UTC, so the tests need no time zone
database (Windows has none without tzdata). zone() reads real IANA names.
"""

import subprocess
import sys
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone

import pytest
from sqlalchemy import Column, DateTime, Time
from sqlmodel import Field, SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from foundation_backend import jobs, push, reminders
from foundation_backend.reminders_models import Reminder


class AppReminder(SQLModel, table=True):
    """An app's own reminders table (#247), under another name: in Postgres
    it would be another schema too, which SQLite has no plain form of."""

    __tablename__ = "app_reminders"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id")
    title: str
    body: str = ""
    url: str = "/"
    time_of_day: time = Field(sa_column=Column(Time(), nullable=False))
    days: str
    time_zone: str
    enabled: bool = True
    last_sent_on: date | None = None
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))

MON_WED_FRI = reminders.parse_days("mon,wed,fri")
CHICAGO_WINTER = timezone(timedelta(hours=-6))
# Wednesday 2026-10-21, 13:30 UTC: 07:30 in a UTC-6 zone.
WEDNESDAY_0730_LOCAL = datetime(2026, 10, 21, 13, 30, tzinfo=timezone.utc)


def _due(now: datetime, *, last_sent_on: date | None = None, days: frozenset[int] = MON_WED_FRI) -> date | None:
    return reminders.due_on(
        time_of_day=time(7, 30), days=days, tz=CHICAGO_WINTER, last_sent_on=last_sent_on, now=now
    )


def test_days_parse_in_any_order_and_store_in_week_order() -> None:
    assert reminders.parse_days("fri, MON,wed") == frozenset({0, 2, 4})
    assert reminders.format_days({4, 0, 2}) == "mon,wed,fri"
    for bad in ("", "monday", "mon,funday"):
        with pytest.raises(ValueError):
            reminders.parse_days(bad)


def test_due_from_its_local_time_until_the_grace_runs_out() -> None:
    assert _due(WEDNESDAY_0730_LOCAL - timedelta(minutes=1)) is None
    assert _due(WEDNESDAY_0730_LOCAL) == date(2026, 10, 21)
    assert _due(WEDNESDAY_0730_LOCAL + reminders.REMINDER_GRACE) == date(2026, 10, 21)
    assert _due(WEDNESDAY_0730_LOCAL + reminders.REMINDER_GRACE + timedelta(minutes=1)) is None


def test_not_due_on_another_day_or_once_sent_today() -> None:
    assert _due(WEDNESDAY_0730_LOCAL + timedelta(days=1)) is None
    assert _due(WEDNESDAY_0730_LOCAL, last_sent_on=date(2026, 10, 21)) is None
    assert _due(WEDNESDAY_0730_LOCAL, last_sent_on=date(2026, 10, 19)) == date(2026, 10, 21)


def test_the_day_is_the_local_one_not_utcs() -> None:
    # 23:30 on Tuesday in UTC-6 is already Wednesday in UTC.
    late_tuesday = datetime(2026, 10, 21, 5, 30, tzinfo=timezone.utc)
    tuesdays = reminders.parse_days("tue")
    assert (
        reminders.due_on(time_of_day=time(23, 30), days=tuesdays, tz=CHICAGO_WINTER, last_sent_on=None, now=late_tuesday)
        == date(2026, 10, 20)
    )


def test_an_unknown_time_zone_is_an_error() -> None:
    assert reminders.zone("UTC") is timezone.utc
    with pytest.raises(ValueError):
        reminders.zone("Mars/Olympus_Mons")


# ------------------------------------------------------------------ job


@dataclass
class Sent:
    user_id: int
    title: str
    body: str
    url: str
    tag: str | None


@pytest.fixture
def sent(monkeypatch: pytest.MonkeyPatch) -> list[Sent]:
    calls: list[Sent] = []

    async def send_push(
        _: AsyncSession, user_id: int, title: str, body: str = "", url: str = "/", *, tag: str | None = None
    ) -> push.PushResult:
        calls.append(Sent(user_id, title, body, url, tag))
        return push.PushResult(sent=2)

    monkeypatch.setattr(push, "send_push", send_push)
    return calls


def _reminder(**fields: object) -> Reminder:
    values: dict[str, object] = {
        "user_id": 1,
        "title": "Stretch",
        "body": "Two minutes.",
        "url": "/routines/3",
        "time_of_day": time(13, 30),
        "days": "mon,wed,fri",
        "time_zone": "UTC",
        "created_at": datetime(2026, 10, 1, tzinfo=timezone.utc),
        **fields,
    }
    return Reminder.model_validate(values)


async def test_the_job_sends_each_due_reminder_once_a_day(session: AsyncSession, sent: list[Sent]) -> None:
    session.add(_reminder())
    session.add(_reminder(title="Later", time_of_day=time(18, 0)))
    session.add(_reminder(title="Paused", enabled=False))
    await session.commit()

    assert await reminders.send_due_reminders(session, now=WEDNESDAY_0730_LOCAL) == "1 due: 2 sent"
    assert [(call.title, call.url, call.tag) for call in sent] == [("Stretch", "/routines/3", "reminder-1")]
    stored = (await session.exec(select(Reminder).where(Reminder.title == "Stretch"))).one()
    assert stored.last_sent_on == date(2026, 10, 21)

    # A minute later, and again the same day: nothing more.
    assert await reminders.send_due_reminders(session, now=WEDNESDAY_0730_LOCAL + timedelta(minutes=1)) is None
    assert len(sent) == 1


async def test_a_row_written_wrong_is_skipped_and_said_so(session: AsyncSession, sent: list[Sent]) -> None:
    session.add(_reminder(time_zone="Mars/Olympus_Mons"))
    session.add(_reminder(title="Fine"))
    await session.commit()
    assert await reminders.send_due_reminders(session, now=WEDNESDAY_0730_LOCAL) == "1 due: 2 sent; 1 unreadable"
    assert [call.title for call in sent] == ["Fine"]


async def test_the_job_reads_the_apps_own_model(session: AsyncSession, sent: list[Sent]) -> None:
    created = datetime(2026, 10, 1, tzinfo=timezone.utc)
    session.add(AppReminder(user_id=1, title="Water", time_of_day=time(13, 30), days="wed", time_zone="UTC", created_at=created))
    session.add(_reminder(title="The package's"))
    await session.commit()

    assert await reminders.send_due_reminders(session, now=WEDNESDAY_0730_LOCAL, model=AppReminder) == "1 due: 2 sent"
    # Only the app's table was read; the package's row is left alone.
    assert [call.title for call in sent] == ["Water"]
    stored = (await session.exec(select(AppReminder))).one()
    assert stored.last_sent_on == date(2026, 10, 21)


async def test_the_registered_job_reads_the_model_it_was_given(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    models: list[object] = []

    async def send_due_reminders(
        _: AsyncSession, now: datetime | None = None, *, model: object = None, **hooks: object
    ) -> None:
        models.append(model)

    monkeypatch.setattr(reminders, "send_due_reminders", send_due_reminders)
    before = dict(jobs.JOBS)
    try:
        reminders.register(model=AppReminder)
        await jobs.JOBS[reminders.JOB_NAME].run(session)
    finally:
        jobs.JOBS.clear()
        jobs.JOBS.update(before)
    assert models == [AppReminder]


# ------------------------------------------------------------- senders


@pytest.fixture
def reported(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str]]:
    calls: list[tuple[str, str]] = []

    def report_error(exc: BaseException, context: object = None) -> None:
        calls.append((getattr(context, "tags", {}).get("channel", ""), str(exc)))

    monkeypatch.setattr(reminders, "report_error", report_error)
    return calls


async def test_extra_senders_go_beside_push_with_a_result_each(
    session: AsyncSession, sent: list[Sent], reported: list[tuple[str, str]]
) -> None:
    emailed: list[str] = []

    async def send_email(_: AsyncSession, reminder: Reminder) -> None:
        emailed.append(reminder.title)

    async def send_alert(_: AsyncSession, reminder: Reminder) -> reminders.ChannelResult:
        raise ConnectionError("alert service down")

    session.add(_reminder())
    await session.commit()
    run = await reminders.run_due_reminders(
        session, now=WEDNESDAY_0730_LOCAL, senders={"email": send_email, "alert": send_alert}
    )

    assert emailed == ["Stretch"] and [call.title for call in sent] == ["Stretch"]
    [item] = run.sent
    assert item.on == date(2026, 10, 21)
    assert item.results == {
        "push": reminders.ChannelResult("sent", detail="2 sent"),
        "email": reminders.ChannelResult("sent"),
        "alert": reminders.ChannelResult("failed", error="alert service down"),
    }
    # A failed channel is reported, and the reminder is still done for the day.
    assert reported == [("alert", "alert service down")]
    stored = await session.get(Reminder, item.reminder_id)
    assert stored is not None and stored.last_sent_on == date(2026, 10, 21)
    assert run.summary() == "1 due: 2 sent; email: 1 sent; alert: 1 failed"


async def test_each_reminder_picks_its_channels(
    session: AsyncSession, sent: list[Sent], reported: list[tuple[str, str]]
) -> None:
    emailed: list[str] = []

    async def send_email(_: AsyncSession, reminder: Reminder) -> None:
        emailed.append(reminder.title)

    picks = {"Email only": ["email"], "Both": ["push", "email", "push"], "Unknown": ["pager"]}
    for title in picks:
        session.add(_reminder(title=title))
    await session.commit()

    summary = await reminders.send_due_reminders(
        session,
        now=WEDNESDAY_0730_LOCAL,
        senders={"email": send_email},
        channels=lambda reminder: picks[reminder.title],
    )
    assert emailed == ["Email only", "Both"]
    # Push once, even when named twice.
    assert [call.title for call in sent] == ["Both"]
    assert reported == [("pager", "Reminder 3 on pager: No sender for channel 'pager'.")]
    assert summary == "3 due: 2 sent; email: 2 sent; pager: 1 failed"


async def test_push_without_a_device_is_skipped_and_without_push_isnt_counted(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch, reported: list[tuple[str, str]]
) -> None:
    async def no_devices(*_: object, **__: object) -> push.PushResult:
        return push.PushResult()

    async def send_email(_: AsyncSession, reminder: Reminder) -> reminders.ChannelResult:
        return reminders.ChannelResult("skipped", detail="no address")

    monkeypatch.setattr(push, "send_push", no_devices)
    session.add(_reminder())
    await session.commit()
    run = await reminders.run_due_reminders(session, now=WEDNESDAY_0730_LOCAL, senders={"email": send_email})
    assert run.sent[0].results["push"] == reminders.ChannelResult("skipped", detail="No device subscribed.")
    assert run.summary() == "1 due: 0 sent; email: 1 skipped"
    assert reported == []

    session.add(_reminder(title="Email only", days="wed"))
    await session.commit()
    emailed = await reminders.send_due_reminders(
        session, now=WEDNESDAY_0730_LOCAL, senders={"email": send_email}, channels=lambda _: ["email"]
    )
    assert emailed == "1 due: email: 1 skipped"


async def test_on_sent_sees_the_results_before_the_stamp_is_committed(
    session: AsyncSession, sent: list[Sent], reported: list[tuple[str, str]]
) -> None:
    seen: list[tuple[str, date | None, dict[str, str]]] = []

    async def on_sent(_: AsyncSession, reminder: Reminder, results: dict[str, reminders.ChannelResult]) -> None:
        seen.append((reminder.title, reminder.last_sent_on, {name: r.status for name, r in results.items()}))
        if reminder.title == "Breaks":
            raise ValueError("the app's hook broke")

    session.add(_reminder())
    session.add(_reminder(title="Breaks"))
    await session.commit()
    assert await reminders.send_due_reminders(session, now=WEDNESDAY_0730_LOCAL, on_sent=on_sent) == "2 due: 4 sent"
    assert seen == [("Stretch", None, {"push": "sent"}), ("Breaks", None, {"push": "sent"})]
    # A hook that raises is reported, and the reminder is still stamped:
    # otherwise it would go out again every minute of its grace.
    assert reported == [("on_sent", "the app's hook broke")]
    stamped = (await session.exec(select(Reminder).where(Reminder.title == "Breaks"))).one()
    assert stamped.last_sent_on == date(2026, 10, 21)


async def test_a_sender_named_push_replaces_the_packages(session: AsyncSession, sent: list[Sent]) -> None:
    async def own_push(_: AsyncSession, reminder: Reminder) -> None:
        return None

    session.add(_reminder())
    await session.commit()
    run = await reminders.run_due_reminders(session, now=WEDNESDAY_0730_LOCAL, senders={"push": own_push})
    assert sent == [] and run.sent[0].results == {"push": reminders.ChannelResult("sent")}


async def test_the_registered_job_passes_its_senders_on(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[dict[str, object]] = []

    async def send_due_reminders(_: AsyncSession, now: datetime | None = None, **options: object) -> None:
        calls.append(options)

    async def send_email(_: AsyncSession, reminder: Reminder) -> None:
        return None

    def channels(_: object) -> list[str]:
        return ["email"]

    monkeypatch.setattr(reminders, "send_due_reminders", send_due_reminders)
    before = dict(jobs.JOBS)
    try:
        reminders.register(senders={"email": send_email}, channels=channels)
        await jobs.JOBS[reminders.JOB_NAME].run(session)
    finally:
        jobs.JOBS.clear()
        jobs.JOBS.update(before)
    assert calls == [{"model": None, "senders": {"email": send_email}, "channels": channels, "on_sent": None}]


def test_push_and_reminder_tables_are_registered_only_when_used() -> None:
    # A fresh interpreter: this suite has imported both models already.
    script = (
        "from sqlmodel import SQLModel\n"
        "import foundation_backend.models, foundation_backend.jobs\n"
        "tables = set(SQLModel.metadata.tables)\n"
        "assert 'users' in tables and 'reminders' not in tables and 'push_subscriptions' not in tables, tables\n"
        # The reminders module sends through push, so it brings push's table.
        "import foundation_backend.reminders\n"
        "assert 'push_subscriptions' in SQLModel.metadata.tables\n"
        "assert 'reminders' not in SQLModel.metadata.tables\n"
        "from foundation_backend.models import Reminder\n"
        "assert Reminder.__tablename__ in SQLModel.metadata.tables\n"
    )
    subprocess.run([sys.executable, "-c", script], check=True)


def test_the_job_registers_once_every_minute() -> None:
    before = dict(jobs.JOBS)
    try:
        reminders.register()
        reminders.register()
        job = jobs.JOBS[reminders.JOB_NAME]
        assert job.every == timedelta(minutes=1)
    finally:
        jobs.JOBS.clear()
        jobs.JOBS.update(before)
