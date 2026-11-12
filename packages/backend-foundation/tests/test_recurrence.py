"""foundation_backend.recurrence (#326): rules, next occurrences in a zone,
the steps of a repeating reminder, and the send-reminders job on rows
that repeat.

The shared cases (`tests/fixtures/recurrence-cases.json` in the npm
package) are the ones the package's own tests/recurrence.test.ts checks,
so both sides agree on every next occurrence. They use real IANA zones,
read from the system's time zone database: on Windows that's the tzdata
package (`pip install tzdata` in the venv); CI's Linux has one.
"""

import json
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import pytest
from pydantic import ValidationError
from sqlalchemy import Column, DateTime, Time
from sqlmodel import Field, SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from foundation_backend import push, reminders
from foundation_backend.recurrence import (
    Nagging,
    OccurrenceState,
    Recurrence,
    as_utc,
    as_weekdays,
    done,
    from_weekdays,
    next_after,
    next_after_completion,
    occurrences,
    parse_rule,
    step,
)
from foundation_backend.recurrence_models import RecurringReminderFields

CASES_FILE = Path(__file__).resolve().parents[2] / "ui-foundation" / "tests" / "fixtures" / "recurrence-cases.json"
CASES: list[dict[str, Any]] = json.loads(CASES_FILE.read_text(encoding="utf-8"))["cases"]

try:
    ZoneInfo("America/Chicago")
except ZoneInfoNotFoundError:  # pragma: no cover — a Windows venv without tzdata
    pytest.skip("No time zone database: pip install tzdata", allow_module_level=True)

UTC = timezone.utc
GRACE = reminders.REMINDER_GRACE


def at(text: str) -> datetime:
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def iso(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def rule(text: str, start: str = "2026-11-01", times: list[str] | None = None, zone: str = "America/Chicago", **more: Any) -> Recurrence:
    return Recurrence.model_validate({"rule": text, "start": start, "times": times or ["09:00"], "timeZone": zone, **more})


# ------------------------------------------------------------- shared cases


@pytest.mark.parametrize("case", CASES, ids=[case["name"] for case in CASES])
def test_the_shared_cases(case: dict[str, Any]) -> None:
    recurrence = Recurrence.model_validate(case["recurrence"])
    # The fixture holds rules in their stored form.
    assert recurrence.rule == case["recurrence"]["rule"]
    assert [iso(each) for each in occurrences(recurrence, at(case["after"]), case["count"])] == case["next"]
    if "doneAt" in case:
        following = next_after_completion(recurrence, at(case["doneAt"]))
        assert (iso(following) if following else None) == case["nextAfterDone"]


def test_the_shared_cases_cover_what_they_must() -> None:
    names = " ".join(case["name"] for case in CASES)
    for needed in ("fall-back", "spring-forward", "31st", "feb 29", "last day", "count", "until", "every!"):
        assert needed in names


# ------------------------------------------------------------------- rules


def test_a_rule_is_stored_in_one_order_whatever_it_was_written_in() -> None:
    recurrence = rule("byday=fr,mo;freq=weekly;interval=1")
    assert recurrence.rule == "FREQ=WEEKLY;BYDAY=MO,FR"
    assert rule("FREQ=MONTHLY;BYMONTHDAY=-1,15,1;INTERVAL=2").rule == "FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=1,15,-1"
    assert rule("FREQ=YEARLY;BYMONTHDAY=1;BYMONTH=1").rule == "FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1"
    assert rule("FREQ=MONTHLY;BYDAY=-1FR").parts.by_day == ((-1, 4),)


def test_times_are_sorted_and_each_once() -> None:
    assert rule("FREQ=DAILY", times=["17:00", "09:00", "17:00"]).times == ["09:00", "17:00"]


@pytest.mark.parametrize(
    ("text", "message"),
    [
        ("FREQ=HOURLY", "FREQ must be one of"),
        ("INTERVAL=2", "FREQ must be one of"),
        ("FREQ=DAILY;INTERVAL=0", "INTERVAL 0 is out of range"),
        ("FREQ=WEEKLY;BYDAY=2TU", "needs FREQ=MONTHLY or YEARLY"),
        ("FREQ=MONTHLY;BYDAY=6TU", "isn't a weekday"),
        ("FREQ=MONTHLY;BYDAY=XX", "isn't a weekday"),
        ("FREQ=MONTHLY;BYMONTHDAY=32", "out of range"),
        ("FREQ=MONTHLY;BYMONTHDAY=0", "out of range"),
        ("FREQ=WEEKLY;BYMONTHDAY=3", "can't go with FREQ=WEEKLY"),
        ("FREQ=YEARLY;BYMONTH=13", "out of range"),
        ("FREQ=DAILY;UNTIL=2027-03-01", "UNTIL must be a date"),
        ("FREQ=DAILY;UNTIL=20270301;COUNT=3", "UNTIL or COUNT, not both"),
        ("FREQ=DAILY;BYHOUR=9", "BYHOUR isn't supported"),
        ("FREQ=DAILY;FREQ=WEEKLY", "FREQ appears twice"),
        ("FREQ", "isn't NAME=value"),
    ],
)
def test_a_rule_it_cant_read_is_refused_saying_why(text: str, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        parse_rule(text)


@pytest.mark.parametrize(
    ("value", "message"),
    [
        ({"times": []}, "at least 1"),
        ({"times": ["9am"]}, "A time is HH:MM"),
        ({"times": ["24:00"]}, "A time is HH:MM"),
        ({"timeZone": "Mars/Olympus_Mons"}, "Unknown time zone"),
        ({"rule": "FREQ=DAILY;COUNT=3", "fromCompletion": True}, "COUNT can't go with fromCompletion"),
        ({"rule": "FREQ=DAILY;UNTIL=20261001"}, "UNTIL is before the start"),
        ({"rule": "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30"}, "never falls on a day"),
    ],
)
def test_a_recurrence_that_cant_be_is_refused(value: dict[str, Any], message: str) -> None:
    whole = {"rule": "FREQ=DAILY", "start": "2026-11-01", "times": ["09:00"], "timeZone": "UTC", **value}
    with pytest.raises(ValidationError, match=message):
        Recurrence.model_validate(whole)


def test_the_wire_form_is_camel_case() -> None:
    recurrence = rule("FREQ=DAILY", from_completion=True)
    assert recurrence.model_dump(by_alias=True, mode="json") == {
        "rule": "FREQ=DAILY",
        "start": "2026-11-01",
        "times": ["09:00"],
        "timeZone": "America/Chicago",
        "fromCompletion": True,
    }


# ------------------------------------------------------- next occurrences


def test_dst_keeps_the_local_time_both_ways() -> None:
    daily = rule("FREQ=DAILY", start="2026-10-30", times=["08:00"])
    # 08:00 is 13:00 UTC in daylight time and 14:00 once the clocks go back (Sun Nov 1).
    assert [iso(each) for each in occurrences(daily, at("2026-10-30T00:00:00Z"), 4)] == [
        "2026-10-30T13:00:00Z",
        "2026-10-31T13:00:00Z",
        "2026-11-01T14:00:00Z",
        "2026-11-02T14:00:00Z",
    ]
    spring = rule("FREQ=DAILY", start="2027-03-13", times=["02:30"])
    # 02:30 doesn't exist on Mar 14: it's read an hour on, 03:30 daylight time.
    assert iso(occurrences(spring, at("2027-03-13T12:00:00Z"), 1)[0]) == "2027-03-14T08:30:00Z"
    assert occurrences(spring, at("2027-03-13T12:00:00Z"), 1)[0].astimezone(ZoneInfo("America/Chicago")).hour == 3


def test_month_ends_skip_a_month_without_the_day_and_minus_one_is_the_last() -> None:
    thirty_first = rule("FREQ=MONTHLY;BYMONTHDAY=31", start="2027-01-01", zone="UTC")
    days = [each.date() for each in occurrences(thirty_first, at("2027-01-01T00:00:00Z"), 4)]
    assert days == [date(2027, 1, 31), date(2027, 3, 31), date(2027, 5, 31), date(2027, 7, 31)]
    last = rule("FREQ=MONTHLY;BYMONTHDAY=-1", start="2028-01-05", zone="UTC")
    days = [each.date() for each in occurrences(last, at("2028-01-01T00:00:00Z"), 3)]
    assert days == [date(2028, 1, 31), date(2028, 2, 29), date(2028, 3, 31)]


def test_feb_29_comes_only_in_leap_years() -> None:
    leap = rule("FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29", start="2025-01-01", zone="UTC")
    assert [each.year for each in occurrences(leap, at("2025-01-01T00:00:00Z"), 3)] == [2028, 2032, 2036]
    # A yearly rule started on Feb 29 is the same rule.
    from_the_day = rule("FREQ=YEARLY", start="2028-02-29", zone="UTC")
    assert [each.year for each in occurrences(from_the_day, at("2028-03-01T00:00:00Z"), 2)] == [2032, 2036]


def test_count_and_until_end_the_rule() -> None:
    three = rule("FREQ=DAILY;COUNT=3", start="2026-11-20", zone="UTC")
    assert len(occurrences(three, at("2026-01-01T00:00:00Z"), 10)) == 3
    assert next_after(three, at("2026-11-22T09:00:00Z")) is None
    until = rule("FREQ=WEEKLY;BYDAY=MO;UNTIL=20261207", start="2026-11-12", zone="UTC")
    assert next_after(until, at("2026-12-07T08:59:00Z")) == at("2026-12-07T09:00:00Z")
    assert next_after(until, at("2026-12-07T09:00:00Z")) is None


def test_next_after_is_strictly_after() -> None:
    daily = rule("FREQ=DAILY", zone="UTC")
    assert next_after(daily, at("2026-11-05T09:00:00Z")) == at("2026-11-06T09:00:00Z")
    assert next_after(daily, at("2026-11-05T08:59:59Z")) == at("2026-11-05T09:00:00Z")
    # Before the start, the first is the start's.
    assert next_after(daily, at("2020-01-01T00:00:00Z")) == at("2026-11-01T09:00:00Z")


def test_every_from_completion_counts_from_the_day_it_was_done() -> None:
    every_three = rule("FREQ=DAILY;INTERVAL=3", from_completion=True)
    # Done on Nov 10 (local), the next is Nov 13 at 09:00, whatever the schedule said.
    assert next_after_completion(every_three, at("2026-11-10T20:00:00Z")) == at("2026-11-13T15:00:00Z")
    # Done at 22:30 local, already the 11th in UTC: still counted from the 10th.
    assert next_after_completion(every_three, at("2026-11-11T04:30:00Z")) == at("2026-11-13T15:00:00Z")
    monthly = rule("FREQ=MONTHLY;UNTIL=20270101", from_completion=True, zone="UTC")
    assert next_after_completion(monthly, at("2026-12-20T10:00:00Z")) is None
    # A schedule rule's next after done is just its next.
    assert next_after_completion(rule("FREQ=DAILY", zone="UTC"), at("2026-11-10T10:00:00Z")) == at("2026-11-11T09:00:00Z")


# -------------------------------------------- a weekday set and one time


def test_a_weekday_set_and_one_time_converts_with_no_loss() -> None:
    converted = from_weekdays("mon,wed,fri", time(7, 30), "America/Chicago", start=date(2026, 10, 1))
    assert converted.rule == "FREQ=WEEKLY;BYDAY=MO,WE,FR"
    assert converted.times == ["07:30"]
    assert as_weekdays(converted) == (frozenset({0, 2, 4}), time(7, 30))
    every_day = from_weekdays(range(7), "06:00", "UTC", start=date(2026, 10, 1))
    assert every_day.rule == "FREQ=DAILY"
    assert as_weekdays(every_day) == (frozenset(range(7)), time(6, 0))
    assert as_weekdays(rule("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO")) is None
    assert as_weekdays(rule("FREQ=DAILY", times=["09:00", "17:00"])) is None
    with pytest.raises(ValueError):
        from_weekdays("funday", "09:00", "UTC", start=date(2026, 10, 1))


@pytest.mark.parametrize("zone", ["UTC", "America/Chicago", "Australia/Sydney"])
def test_the_converted_rule_is_due_exactly_when_the_old_schedule_was(zone: str) -> None:
    """Every 10 minutes for three weeks across a DST change: the old
    due_on and the converted rule agree on whether a reminder is due."""
    days = reminders.parse_days("tue,sat,sun")
    converted = from_weekdays(days, time(2, 30), zone, start=date(2026, 9, 25))
    tz = reminders.zone(zone)
    now = at("2026-09-27T00:00:00Z")
    sent_on: date | None = None
    while now < at("2026-11-08T00:00:00Z"):
        old = reminders.due_on(time_of_day=time(2, 30), days=days, tz=tz, last_sent_on=sent_on, now=now)
        found = next_after(converted, now - GRACE - timedelta(microseconds=1))
        new = found is not None and found <= now
        assert (old is not None) == (new and found is not None and found.astimezone(tz).date() != sent_on), now
        if old is not None:
            sent_on = old
        now += timedelta(minutes=10)


# ------------------------------------------------------ a reminder's steps

DAILY_9_AND_5 = rule("FREQ=DAILY", times=["09:00", "17:00"], zone="UTC")


def test_due_in_the_grace_several_times_a_day_and_never_twice() -> None:
    state = OccurrenceState()
    first = step(DAILY_9_AND_5, state, at("2026-11-05T08:59:00Z"), grace=GRACE)
    assert first.send is None and first.state.next_at == at("2026-11-05T09:00:00Z")
    due = step(DAILY_9_AND_5, first.state, at("2026-11-05T09:05:00Z"), grace=GRACE)
    assert due.send == "first" and due.occurrence == at("2026-11-05T09:00:00Z")
    again = step(DAILY_9_AND_5, due.state, at("2026-11-05T09:06:00Z"), grace=GRACE)
    assert again.send is None
    # The 17:00 one comes round: the 09:00 one, not done, is left for it.
    evening = step(DAILY_9_AND_5, again.state, at("2026-11-05T17:00:00Z"), grace=GRACE)
    assert evening.send == "first" and evening.occurrence == at("2026-11-05T17:00:00Z")
    assert evening.left == 1 and evening.skipped == 0


def test_one_missed_past_the_grace_is_skipped_not_sent_late() -> None:
    pending = OccurrenceState(next_at=at("2026-11-05T09:00:00Z"))
    late = step(DAILY_9_AND_5, pending, at("2026-11-05T12:00:00Z"), grace=GRACE)
    assert late.send is None
    assert late.skipped == 1
    assert late.state.next_at == at("2026-11-05T17:00:00Z")
    # Down for days: every missed one is passed over at once, the next pending.
    long_gone = step(DAILY_9_AND_5, pending, at("2026-11-09T10:00:00Z"), grace=GRACE)
    assert long_gone.send is None and long_gone.state.next_at == at("2026-11-09T17:00:00Z")
    # A fresh row starts with the first occurrence inside the grace.
    fresh = step(DAILY_9_AND_5, OccurrenceState(), at("2026-11-05T09:10:00Z"), grace=GRACE)
    assert fresh.send == "first" and fresh.occurrence == at("2026-11-05T09:00:00Z")


def test_nagging_resends_until_done_up_to_its_limit() -> None:
    nag = Nagging(every=timedelta(minutes=10), limit=2)
    state = step(DAILY_9_AND_5, OccurrenceState(), at("2026-11-05T09:00:00Z"), grace=GRACE, nagging=nag).state
    assert step(DAILY_9_AND_5, state, at("2026-11-05T09:09:00Z"), grace=GRACE, nagging=nag).send is None
    first_nag = step(DAILY_9_AND_5, state, at("2026-11-05T09:10:00Z"), grace=GRACE, nagging=nag)
    assert first_nag.send == "nag" and first_nag.state.nag_count == 1
    second = step(DAILY_9_AND_5, first_nag.state, at("2026-11-05T09:20:00Z"), grace=GRACE, nagging=nag)
    assert second.send == "nag" and second.state.nag_count == 2
    capped = step(DAILY_9_AND_5, second.state, at("2026-11-05T09:30:00Z"), grace=GRACE, nagging=nag)
    assert capped.send is None
    # Done: no more nags, and the next is pending.
    finished = done(DAILY_9_AND_5, first_nag.state, at("2026-11-05T09:12:00Z"))
    assert finished.done_occurrence == at("2026-11-05T09:00:00Z")
    assert finished.done_at == at("2026-11-05T09:12:00Z")
    assert finished.next_at == at("2026-11-05T17:00:00Z")
    assert step(DAILY_9_AND_5, finished, at("2026-11-05T09:20:00Z"), grace=GRACE, nagging=nag).send is None


def test_from_completion_waits_for_done_and_counts_from_it() -> None:
    every_two = rule("FREQ=DAILY;INTERVAL=2", zone="UTC", from_completion=True)
    nag = Nagging(every=timedelta(hours=1), limit=10)
    sent = step(every_two, OccurrenceState(), at("2026-11-01T09:00:00Z"), grace=GRACE, nagging=nag)
    assert sent.send == "first"
    # Two days on, not done: it isn't replaced, it keeps nagging.
    waiting = step(every_two, sent.state, at("2026-11-03T09:00:00Z"), grace=GRACE, nagging=nag)
    assert waiting.send == "nag" and waiting.occurrence == at("2026-11-01T09:00:00Z")
    finished = done(every_two, waiting.state, at("2026-11-04T15:00:00Z"))
    assert finished.next_at == at("2026-11-06T09:00:00Z")
    # Missed altogether: the next counts from the missed one, as if done then.
    missed = step(every_two, OccurrenceState(next_at=at("2026-11-06T09:00:00Z")), at("2026-11-06T11:00:00Z"), grace=GRACE)
    assert missed.send is None and missed.skipped == 1 and missed.state.next_at == at("2026-11-08T09:00:00Z")


def test_an_ended_rule_has_nothing_pending() -> None:
    once = rule("FREQ=DAILY;COUNT=1", zone="UTC")
    sent = step(once, OccurrenceState(), at("2026-11-01T09:00:00Z"), grace=GRACE)
    finished = done(once, sent.state, at("2026-11-01T09:01:00Z"))
    assert finished.next_at is None
    assert step(once, finished, at("2026-11-02T09:00:00Z"), grace=GRACE).send is None


# ------------------------------------------------------------------ job


class RepeatingReminder(RecurringReminderFields, table=True):
    """An app's reminders table with the recurrence columns."""

    __tablename__ = "repeating_reminders"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id")
    title: str
    body: str = ""
    url: str = "/"
    time_of_day: time | None = Field(default=None, sa_column=Column(Time(), nullable=True))
    days: str | None = None
    time_zone: str = "UTC"
    enabled: bool = True
    last_sent_on: date | None = None
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))


@dataclass
class Sent:
    title: str
    tag: str | None


@pytest.fixture
def sent(monkeypatch: pytest.MonkeyPatch) -> list[Sent]:
    calls: list[Sent] = []

    async def send_push(
        _: AsyncSession, user_id: int, title: str, body: str = "", url: str = "/", *, tag: str | None = None
    ) -> push.PushResult:
        calls.append(Sent(title, tag))
        return push.PushResult(sent=1)

    monkeypatch.setattr(push, "send_push", send_push)
    return calls


def _row(**fields: Any) -> RepeatingReminder:
    values: dict[str, Any] = {
        "user_id": 1,
        "title": "Water the plants",
        "recurrence": {"rule": "FREQ=DAILY", "start": "2026-11-01", "times": ["09:00", "17:00"], "timeZone": "UTC"},
        "created_at": datetime(2026, 10, 1, tzinfo=UTC),
        **fields,
    }
    return RepeatingReminder.model_validate(values)


async def _run(session: AsyncSession, now: str) -> str | None:
    return await reminders.send_due_reminders(session, now=at(now), model=RepeatingReminder)


def utc(moment: datetime | None) -> datetime | None:
    """A stored time as UTC: SQLite gives them back naive."""
    return as_utc(moment) if moment else None


async def _stored(session: AsyncSession, title: str = "Water the plants") -> RepeatingReminder:
    session.expire_all()
    return (await session.exec(select(RepeatingReminder).where(RepeatingReminder.title == title))).one()


async def test_the_job_sends_each_occurrence_once_in_its_grace(session: AsyncSession, sent: list[Sent]) -> None:
    session.add(_row())
    session.add(_row(title="Old style", recurrence=None, days="thu", time_of_day=time(9, 0)))
    await session.commit()

    assert await _run(session, "2026-11-05T08:00:00Z") is None
    assert utc((await _stored(session)).next_at) == at("2026-11-05T09:00:00Z")
    # Thursday 09:02: the repeating row and the weekday-set row are both due.
    assert await _run(session, "2026-11-05T09:02:00Z") == "2 due: 2 sent"
    assert sorted(call.title for call in sent) == ["Old style", "Water the plants"]
    assert await _run(session, "2026-11-05T09:03:00Z") is None
    stored = await _stored(session)
    assert utc(stored.sent_at) == at("2026-11-05T09:02:00Z")
    # The evening's too, the same day.
    assert await _run(session, "2026-11-05T17:00:00Z") == "1 due: 1 sent"
    assert [call.title for call in sent].count("Water the plants") == 2


async def test_a_missed_occurrence_is_skipped_and_said_so(session: AsyncSession, sent: list[Sent]) -> None:
    session.add(_row(next_at=at("2026-11-05T09:00:00Z")))
    await session.commit()
    assert await _run(session, "2026-11-05T11:00:00Z") == "1 missed"
    assert sent == []
    assert utc((await _stored(session)).next_at) == at("2026-11-05T17:00:00Z")


async def test_nags_until_marked_done_then_the_next(session: AsyncSession, sent: list[Sent]) -> None:
    session.add(_row(nag_every_minutes=15, nag_limit=1))
    await session.commit()
    assert await _run(session, "2026-11-05T09:00:00Z") == "1 due: 1 sent"
    assert await _run(session, "2026-11-05T09:15:00Z") == "1 due: 1 sent"
    assert await _run(session, "2026-11-05T09:30:00Z") is None
    assert [call.tag for call in sent] == ["reminder-1", "reminder-1"]

    stored = await _stored(session)
    assert stored.nag_count == 1
    state = reminders.mark_done(stored, at("2026-11-05T09:40:00Z"))
    session.add(stored)
    await session.commit()
    assert state.next_at == at("2026-11-05T17:00:00Z")
    stored = await _stored(session)
    assert utc(stored.done_occurrence) == at("2026-11-05T09:00:00Z")
    assert stored.nag_count == 0 and stored.sent_at is None


async def test_repeat_from_completion_sets_the_next_from_the_done_time(session: AsyncSession, sent: list[Sent]) -> None:
    every_three = {"rule": "FREQ=DAILY;INTERVAL=3", "start": "2026-11-01", "times": ["09:00"], "timeZone": "UTC", "fromCompletion": True}
    session.add(_row(recurrence=every_three))
    await session.commit()
    assert await _run(session, "2026-11-01T09:00:00Z") == "1 due: 1 sent"
    stored = await _stored(session)
    reminders.mark_done(stored, at("2026-11-02T20:00:00Z"))
    session.add(stored)
    await session.commit()
    assert utc((await _stored(session)).next_at) == at("2026-11-05T09:00:00Z")
    assert await _run(session, "2026-11-04T09:00:00Z") is None
    assert await _run(session, "2026-11-05T09:00:00Z") == "1 due: 1 sent"


async def test_a_rule_written_wrong_is_unreadable_and_a_changed_one_starts_again(
    session: AsyncSession, sent: list[Sent]
) -> None:
    session.add(_row(title="Broken", recurrence={"rule": "FREQ=HOURLY", "start": "2026-11-01", "times": ["09:00"], "timeZone": "UTC"}))
    session.add(_row())
    await session.commit()
    assert await _run(session, "2026-11-05T09:00:00Z") == "1 due: 1 sent; 1 unreadable"

    stored = await _stored(session)
    stored.recurrence = {"rule": "FREQ=DAILY", "start": "2026-11-01", "times": ["12:00"], "timeZone": "UTC"}
    reminders.schedule_changed(stored)
    session.add(stored)
    await session.commit()
    assert (await _stored(session)).next_at is None
    assert await _run(session, "2026-11-05T12:00:00Z") == "1 due: 1 sent; 1 unreadable"


def test_the_columns_base_registers_no_table() -> None:
    assert not hasattr(RecurringReminderFields, "__table__")
    assert isinstance(SQLModel.metadata.tables["repeating_reminders"].c.recurrence.type.python_type, type)
