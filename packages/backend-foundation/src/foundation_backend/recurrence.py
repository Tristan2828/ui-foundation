"""Repeating schedules (#326): one rule, stored RRULE-shaped (RFC 5545),
the next occurrences after a moment, and the steps a reminder takes
through them. The package's `src/lib/recurrence.ts` is the same rules in
the browser; both read `tests/fixtures/recurrence-cases.json` in the npm
package, so they agree on every next occurrence.

A `Recurrence` is five things (the `Recurrence` schema in
openapi/foundation.yaml, camelCase on the wire):

- `rule`: RFC 5545's RRULE value without DTSTART, e.g.
  `FREQ=MONTHLY;BYDAY=2TU`. FREQ is DAILY, WEEKLY, MONTHLY or YEARLY;
  INTERVAL, BYDAY (with an nth for MONTHLY and YEARLY: `2TU`, `-1FR`),
  BYMONTHDAY (1 to 31, -1 the last day), BYMONTH, UNTIL (a date,
  `YYYYMMDD`, the last day it can fall on) and COUNT. Nothing else.
- `start`: the first day it can fall on (DTSTART's date).
- `times`: one or more times of day, `"HH:MM"`, each a separate
  occurrence on every day the rule falls on.
- `timeZone`: the IANA zone the days and times are read in.
- `fromCompletion`: repeat from when it was done (`every!`) rather than
  from the schedule.

**The days come from the rule; the times are put on them in the zone.**
python-dateutil's rrule (dateutil.rrule, the reference RFC 5545 engine)
walks the days, with no time and no zone, so its maths never meets a DST
change; each day's times then become instants in the zone. A time a DST
change skips (02:30 the night clocks spring forward) is read an hour on;
a time it repeats (01:30 the night they fall back) is the first of the
two. A day a month doesn't have is skipped, as RFC 5545 says: the 31st
falls only in months with 31 days, Feb 29 only in leap years, and -1 is
every month's last day. COUNT counts occurrences, each time of each day.

`fromCompletion` (`every!`) takes the rule's days counted from the day
it was done instead of from `start`: "every! 3 days" done on the 10th is
next due on the 13th, at the rule's times. COUNT means nothing there and
is refused.
"""

import re
from collections.abc import Iterable, Iterator
from dataclasses import dataclass, replace
from datetime import date, datetime, time, timedelta, timezone, tzinfo
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from dateutil import rrule as du
from pydantic import Field, field_validator, model_validator

from foundation_backend.schemas import CamelModel

FREQUENCIES = ("DAILY", "WEEKLY", "MONTHLY", "YEARLY")
WEEKDAYS = ("MO", "TU", "WE", "TH", "FR", "SA", "SU")
TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
_BYDAY = re.compile(r"^([+-]?[1-5])?(MO|TU|WE|TH|FR|SA|SU)$")
_UNTIL = re.compile(r"^(\d{4})(\d{2})(\d{2})$")
# How far ahead a rule must fall at least once (a 31st of February never does).
_HORIZON_YEARS = 28


@dataclass(frozen=True)
class RuleParts:
    """A rule's parts, read and checked. `by_day` holds (nth or None,
    weekday, Monday 0)."""

    freq: Literal["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]
    interval: int = 1
    by_day: tuple[tuple[int | None, int], ...] = ()
    by_month_day: tuple[int, ...] = ()
    by_month: tuple[int, ...] = ()
    until: date | None = None
    count: int | None = None


def _integers(name: str, value: str, low: int, high: int, *, zero: bool = False) -> tuple[int, ...]:
    found: list[int] = []
    for part in value.split(","):
        if not re.fullmatch(r"[+-]?\d{1,3}", part):
            raise ValueError(f"{name} must be numbers; got {value!r}.")
        number = int(part)
        if not low <= number <= high or (number == 0 and not zero):
            raise ValueError(f"{name} {number} is out of range.")
        if number not in found:
            found.append(number)
    return tuple(found)


def parse_rule(text: str) -> RuleParts:
    """`FREQ=…;…` → its parts, or a ValueError saying what's wrong."""
    fields: dict[str, str] = {}
    for part in text.strip().upper().split(";"):
        if not part:
            continue
        name, sep, value = part.partition("=")
        if not sep or not value:
            raise ValueError(f"Rule part {part!r} isn't NAME=value.")
        if name in fields:
            raise ValueError(f"{name} appears twice.")
        fields[name] = value
    unknown = sorted(set(fields) - {"FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "BYMONTH", "UNTIL", "COUNT"})
    if unknown:
        raise ValueError(f"Rule part {unknown[0]} isn't supported.")
    freq = fields.get("FREQ")
    if freq not in FREQUENCIES:
        raise ValueError(f"FREQ must be one of {', '.join(FREQUENCIES)}.")
    interval = 1
    if "INTERVAL" in fields:
        (interval,) = _integers("INTERVAL", fields["INTERVAL"], 1, 999)
    by_day: list[tuple[int | None, int]] = []
    if "BYDAY" in fields:
        for part in fields["BYDAY"].split(","):
            match = _BYDAY.match(part)
            if not match or match.group(1) in ("0", "+0", "-0"):
                raise ValueError(f"BYDAY {part!r} isn't a weekday (MO to SU, with an nth of 1 to 5 or -1 to -5).")
            nth = int(match.group(1)) if match.group(1) else None
            if nth is not None and freq not in ("MONTHLY", "YEARLY"):
                raise ValueError("An nth weekday (2TU, -1FR) needs FREQ=MONTHLY or YEARLY.")
            entry = (nth, WEEKDAYS.index(match.group(2)))
            if entry not in by_day:
                by_day.append(entry)
    by_month_day = _integers("BYMONTHDAY", fields["BYMONTHDAY"], -31, 31) if "BYMONTHDAY" in fields else ()
    if by_month_day and freq == "WEEKLY":
        raise ValueError("BYMONTHDAY can't go with FREQ=WEEKLY.")
    by_month = _integers("BYMONTH", fields["BYMONTH"], 1, 12) if "BYMONTH" in fields else ()
    until: date | None = None
    if "UNTIL" in fields:
        match = _UNTIL.match(fields["UNTIL"])
        if not match:
            raise ValueError("UNTIL must be a date, YYYYMMDD.")
        until = date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
    count: int | None = None
    if "COUNT" in fields:
        (count,) = _integers("COUNT", fields["COUNT"], 1, 9999)
    if until is not None and count is not None:
        raise ValueError("A rule has UNTIL or COUNT, not both.")
    return RuleParts(
        freq=freq,  # type: ignore[arg-type]  # checked against FREQUENCIES above
        interval=interval,
        by_day=tuple(sorted(by_day, key=lambda entry: (entry[1], entry[0] or 0))),
        by_month_day=tuple(sorted(by_month_day, key=lambda day: (day < 0, day))),
        by_month=tuple(sorted(by_month)),
        until=until,
        count=count,
    )


def format_rule(parts: RuleParts) -> str:
    """The stored form, its parts always in one order (so two rules that
    mean the same are the same text): FREQ, INTERVAL (left out at 1),
    BYMONTH, BYMONTHDAY, BYDAY, UNTIL, COUNT."""
    out = [f"FREQ={parts.freq}"]
    if parts.interval != 1:
        out.append(f"INTERVAL={parts.interval}")
    if parts.by_month:
        out.append("BYMONTH=" + ",".join(str(month) for month in parts.by_month))
    if parts.by_month_day:
        out.append("BYMONTHDAY=" + ",".join(str(day) for day in parts.by_month_day))
    if parts.by_day:
        out.append("BYDAY=" + ",".join(f"{nth if nth is not None else ''}{WEEKDAYS[day]}" for nth, day in parts.by_day))
    if parts.until is not None:
        out.append(f"UNTIL={parts.until:%Y%m%d}")
    if parts.count is not None:
        out.append(f"COUNT={parts.count}")
    return ";".join(out)


def zone(name: str) -> tzinfo:
    """The IANA zone, read from the system's time zone database (on
    Windows, from the tzdata package: docs/foundation/reminders.md)."""
    if name == "UTC":
        return timezone.utc
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError(f"Unknown time zone {name!r}.") from exc


def _time(value: str) -> time:
    return time(int(value[:2]), int(value[3:]))


class Recurrence(CamelModel):
    """A repeating schedule: the `Recurrence` schema. Built from JSON
    (`Recurrence.model_validate(row.recurrence)`) it's checked and its
    rule and times are put in their stored form."""

    rule: str = Field(min_length=1, max_length=200)
    start: date
    times: list[str] = Field(min_length=1, max_length=24)
    time_zone: str = Field(min_length=1, max_length=64)
    from_completion: bool = False

    @field_validator("rule")
    @classmethod
    def _rule(cls, value: str) -> str:
        return format_rule(parse_rule(value))

    @field_validator("times")
    @classmethod
    def _times(cls, value: list[str]) -> list[str]:
        for each in value:
            if not TIME.match(each):
                raise ValueError(f"A time is HH:MM, 00:00 to 23:59; got {each!r}.")
        return sorted(set(value))

    @field_validator("time_zone")
    @classmethod
    def _zone(cls, value: str) -> str:
        zone(value)
        return value

    @model_validator(mode="after")
    def _whole(self) -> "Recurrence":
        parts = self.parts
        if parts.count is not None and self.from_completion:
            raise ValueError("COUNT can't go with fromCompletion: each next one counts from when it's done.")
        if parts.until is not None and parts.until < self.start:
            raise ValueError("UNTIL is before the start.")
        horizon = date(min(self.start.year + _HORIZON_YEARS, 9999), 12, 31)
        if next(iter(_days(parts, self.start, horizon)), None) is None:
            raise ValueError("The rule never falls on a day (no month has that day).")
        return self

    @property
    def parts(self) -> RuleParts:
        return parse_rule(self.rule)

    @property
    def tz(self) -> tzinfo:
        return zone(self.time_zone)


_FREQ: dict[str, Literal[0, 1, 2, 3]] = {"DAILY": du.DAILY, "WEEKLY": du.WEEKLY, "MONTHLY": du.MONTHLY, "YEARLY": du.YEARLY}


def _days(parts: RuleParts, start: date, stop: date | None = None) -> Iterator[date]:
    """The days the rule falls on from `start`, through UNTIL (and `stop`),
    with no times and no zone: dateutil's rrule does the walking."""
    end = parts.until if stop is None else min(stop, parts.until) if parts.until else stop
    weekdays = [du.weekday(day, nth) if nth is not None else du.weekday(day) for nth, day in parts.by_day]
    rule = du.rrule(
        _FREQ[parts.freq],
        dtstart=datetime.combine(start, time()),
        interval=parts.interval,
        byweekday=weekdays or None,
        bymonthday=list(parts.by_month_day) or None,
        bymonth=list(parts.by_month) or None,
        until=datetime.combine(end, time()) if end is not None else None,
        cache=False,
    )
    for moment in rule:
        yield moment.date()



def at_local(day: date, time_of_day: time, tz: tzinfo) -> datetime:
    """`day` at `time_of_day` in `tz`, as a UTC instant. A time a DST
    change skips is read an hour on; one it repeats is the first."""
    return datetime.combine(day, time_of_day, tzinfo=tz).astimezone(timezone.utc)


def _instants(recurrence: Recurrence, start: date, parts: RuleParts | None = None) -> Iterator[datetime]:
    """Every occurrence from `start` on, as UTC instants in order, COUNT
    applied (each time of each day is one)."""
    parts = parts or recurrence.parts
    tz = recurrence.tz
    times = [_time(each) for each in recurrence.times]
    left = parts.count
    for day in _days(parts, start):
        # Sorted per day: across a DST change a later time can be the earlier instant.
        for instant in sorted({at_local(day, each, tz) for each in times}):
            if left is not None:
                if left == 0:
                    return
                left -= 1
            yield instant
        if left == 0:
            return


def as_utc(moment: datetime) -> datetime:
    """An aware UTC datetime (a naive one, as SQLite returns, is UTC)."""
    return moment.replace(tzinfo=timezone.utc) if moment.tzinfo is None else moment.astimezone(timezone.utc)


def occurrences(recurrence: Recurrence, after: datetime, count: int) -> list[datetime]:
    """The next `count` occurrences strictly after `after`, as UTC instants."""
    after = as_utc(after)
    found: list[datetime] = []
    if count <= 0:
        return found
    for instant in _instants(recurrence, recurrence.start):
        if instant > after:
            found.append(instant)
            if len(found) == count:
                break
    return found


def next_after(recurrence: Recurrence, after: datetime) -> datetime | None:
    """The first occurrence strictly after `after`, or None when the rule
    has ended (UNTIL passed, COUNT used up)."""
    found = occurrences(recurrence, after, 1)
    return found[0] if found else None


def next_after_completion(recurrence: Recurrence, done_at: datetime) -> datetime | None:
    """For a `fromCompletion` rule, the next occurrence once it's done at
    `done_at`: the rule's days counted from the local day it was done, the
    first one after that day. (A schedule rule's is next_after.)"""
    if not recurrence.from_completion:
        return next_after(recurrence, done_at)
    done_day = as_utc(done_at).astimezone(recurrence.tz).date()
    for instant in _instants(recurrence, done_day):
        if instant.astimezone(recurrence.tz).date() > done_day:
            return instant
    return None


# ------------------------------------------------- a weekday set and one time

DAY_NAMES = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


def from_weekdays(
    days: Iterable[int] | str,
    time_of_day: time | str,
    time_zone: str,
    *,
    start: date,
) -> Recurrence:
    """The rule for a weekday set and one time (the reminders table's
    `days` and `time_of_day`), exactly: due on the same days at the same
    time, from `start` on. Every day of the week is FREQ=DAILY."""
    if isinstance(days, str):
        names = [part.strip().lower() for part in days.split(",") if part.strip()]
        if not names or any(name not in DAY_NAMES for name in names):
            raise ValueError(f"days must be some of {','.join(DAY_NAMES)}; got {days!r}.")
        chosen = sorted({DAY_NAMES.index(name) for name in names})
    else:
        chosen = sorted(set(days))
        if not chosen or any(not 0 <= day <= 6 for day in chosen):
            raise ValueError("days must be weekdays, Monday 0 to Sunday 6.")
    at = time_of_day if isinstance(time_of_day, str) else f"{time_of_day:%H:%M}"
    rule = "FREQ=DAILY" if len(chosen) == 7 else "FREQ=WEEKLY;BYDAY=" + ",".join(WEEKDAYS[day] for day in chosen)
    return Recurrence(rule=rule, start=start, times=[at], time_zone=time_zone)


def as_weekdays(recurrence: Recurrence) -> tuple[frozenset[int], time] | None:
    """The weekday set and one time a rule is, or None when it's more
    than that (an interval, an nth, months, an end, several times,
    from completion): the way back from from_weekdays."""
    parts = recurrence.parts
    if (
        len(recurrence.times) != 1
        or recurrence.from_completion
        or parts.interval != 1
        or parts.by_month_day
        or parts.by_month
        or parts.until is not None
        or parts.count is not None
    ):
        return None
    if parts.freq == "DAILY" and not parts.by_day:
        return frozenset(range(7)), _time(recurrence.times[0])
    if parts.freq == "WEEKLY" and parts.by_day and all(nth is None for nth, _ in parts.by_day):
        return frozenset(day for _, day in parts.by_day), _time(recurrence.times[0])
    return None


# ----------------------------------------------- a reminder through its occurrences


@dataclass(frozen=True)
class Nagging:
    """Re-send an occurrence that isn't done every `every`, at most
    `limit` times."""

    every: timedelta
    limit: int


@dataclass(frozen=True)
class OccurrenceState:
    """Where a repeating reminder is (columns of its row, docs/foundation/
    reminders.md): the occurrence pending (`next_at`), when it was first
    sent and last sent (a nag), how many nags, and the last one marked done
    (`done_occurrence`, at `done_at`)."""

    next_at: datetime | None = None
    sent_at: datetime | None = None
    last_sent_at: datetime | None = None
    nag_count: int = 0
    done_at: datetime | None = None
    done_occurrence: datetime | None = None


@dataclass(frozen=True)
class Step:
    """What the job does now: `send` is "first" (the occurrence is due),
    "nag" (sent, not done, time for another), or None. `skipped` counts
    the occurrences passed over unsent (missed past the grace), `left` the
    ones sent and not done when the next one came. `state` is the row's
    new state, to store whether or not anything is sent."""

    send: Literal["first", "nag"] | None
    occurrence: datetime | None
    skipped: int
    state: OccurrenceState
    left: int = 0


def _following(recurrence: Recurrence, occurrence: datetime, floor: datetime) -> datetime | None:
    """The occurrence after one left behind, none at or before `floor`. A
    `fromCompletion` rule counts from the one left behind, as if done then."""
    if recurrence.from_completion:
        found = next_after_completion(recurrence, occurrence)
        while found is not None and found <= floor:
            found = next_after_completion(recurrence, found)
        return found
    return next_after(recurrence, max(occurrence, floor))


def step(
    recurrence: Recurrence,
    state: OccurrenceState,
    now: datetime,
    *,
    grace: timedelta,
    nagging: Nagging | None = None,
) -> Step:
    """One run of the job for one repeating reminder at `now`.

    - With nothing pending yet, the pending one is the first occurrence
      after `now - grace`.
    - An occurrence is **due** from its time until `grace` has passed; once
      sent it isn't sent again. One missed past the grace is **skipped, not
      sent late**, and the next one is pending.
    - Sent and not done, it's **nagged** every `nagging.every`, at most
      `nagging.limit` times, until done (`done()`).
    - A schedule rule's next occurrence coming round ends the wait: the
      one not done is left, and the new one is pending. A `fromCompletion`
      rule has no next until it's done, so it keeps waiting.
    """
    now = as_utc(now)
    current = replace(
        state,
        next_at=as_utc(state.next_at) if state.next_at else None,
        last_sent_at=as_utc(state.last_sent_at) if state.last_sent_at else None,
    )
    if current.next_at is None and current.sent_at is None:
        current = replace(current, next_at=next_after(recurrence, now - grace))
    skipped = left = 0
    # Each pass moves on by an occurrence; the cap only guards a rule bug.
    for _ in range(1000):
        occurrence = current.next_at
        if occurrence is None or occurrence > now:
            return Step(None, occurrence, skipped, current, left)
        if current.sent_at is None:
            if now - occurrence > grace:
                skipped += 1
                current = replace(current, next_at=_following(recurrence, occurrence, now - grace))
                continue
            current = replace(current, sent_at=now, last_sent_at=now, nag_count=0)
            return Step("first", occurrence, skipped, current, left)
        if not recurrence.from_completion:
            later = next_after(recurrence, occurrence)
            if later is not None and later <= now:
                left += 1
                current = replace(current, next_at=later, sent_at=None, last_sent_at=None, nag_count=0)
                continue
        last = current.last_sent_at or now
        if nagging is not None and current.nag_count < nagging.limit and now - last >= nagging.every:
            current = replace(current, last_sent_at=now, nag_count=current.nag_count + 1)
            return Step("nag", occurrence, skipped, current, left)
        return Step(None, occurrence, skipped, current, left)
    raise RuntimeError("recurrence.step didn't settle")  # pragma: no cover


def done(recurrence: Recurrence, state: OccurrenceState, done_at: datetime) -> OccurrenceState:
    """The pending occurrence marked done at `done_at`: it's recorded
    (`done_occurrence`, `done_at`) and the next one is pending: the
    schedule's next, or for `fromCompletion` the next counted from
    `done_at`. Nothing pending (an ended rule) records the done time only."""
    done_at = as_utc(done_at)
    occurrence = as_utc(state.next_at) if state.next_at else None
    if recurrence.from_completion:
        following = next_after_completion(recurrence, done_at)
    else:
        following = next_after(recurrence, occurrence) if occurrence else None
    return OccurrenceState(next_at=following, done_at=done_at, done_occurrence=occurrence)
