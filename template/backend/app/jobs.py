"""Scheduled jobs (issue #136): work that runs every so often inside the
app's own process, such as pulling from an outside service or a nightly
cleanup.

    async def sync_feeds(session: AsyncSession) -> str | None:
        ...
        return f"{added} new"

    register_job("sync-feeds", every=timedelta(minutes=15), run=sync_feeds)

Registered jobs start from main.py's lifespan when JOBS_ENABLED (on by
default with APP_ENV=production, off otherwise, so tests and a dev server
run a job only when asked). What every job gets without writing it:

- **One run at a time, across processes.** A lock per job in this process,
  and on Postgres an advisory lock (`pg_try_advisory_lock`) held on its own
  connection for the run. A second process skips rather than waits.
- **Once per interval, across processes.** A scheduled run that finds the
  job started less than `every` ago (another replica, or the process before
  a reload) skips too. Each process waits `every` after its own run, plus a
  jitter, so jobs started together don't fire on the same second.
- **Every run is a row in job_runs**: started, finished, outcome (ok,
  failed, skipped), the error, and the job's own summary ("12 new"). Rows
  older than JOB_RUNS_KEEP_DAYS are trimmed after each run.
- **A failure never stops the schedule.** An exception or the timeout is
  logged, sent through report_error and recorded; the next run is on time.
- **Run it now:** POST /api/jobs/{name}/run (409 while it's running);
  GET /api/jobs lists each job's schedule and last run (app/routers/jobs.py).

Not here, by decision: cron expressions, queues, retries with backoff, a
separate worker process.
"""

import asyncio
import hashlib
import logging
import random
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

from sqlalchemy import func, text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine
from sqlmodel import col, delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import JOB_RUNS_KEEP_DAYS
from foundation_backend.error_reporting import ErrorContext, report_error, scrub
from app.models import JobRunRecord

logger = logging.getLogger("app.jobs")

JobFn = Callable[[AsyncSession], Awaitable[str | None]]
Trigger = Literal["schedule", "manual"]
Outcome = Literal["ok", "failed", "skipped"]

MAX_SUMMARY = 500
MAX_JITTER_SECONDS = 60.0
_NAME = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")


@dataclass(frozen=True)
class Job:
    name: str
    every: timedelta
    run: JobFn
    run_at_start: bool
    timeout: timedelta


JOBS: dict[str, Job] = {}


def register_job(
    name: str,
    *,
    every: timedelta,
    run: JobFn,
    run_at_start: bool = False,
    timeout: timedelta = timedelta(minutes=5),
) -> Job:
    """Adds a job. `run` gets a session of its own and returns a short
    summary of what it did, or None. `run_at_start`: the first run comes
    soon after startup (after the jitter) rather than `every` later."""
    if not _NAME.match(name):
        raise ValueError(f"Job name {name!r} must be lowercase letters, digits and dashes (it's in a URL).")
    if name in JOBS:
        raise ValueError(f"A job named {name!r} is already registered.")
    if every <= timedelta(0) or timeout <= timedelta(0):
        raise ValueError(f"Job {name!r}: every and timeout must be more than zero.")
    job = Job(name=name, every=every, run=run, run_at_start=run_at_start, timeout=timeout)
    JOBS[name] = job
    return job


class AlreadyRunning(Exception):
    """The job is running, in this process or another."""


# ---------------------------------------------------------------- locking


@dataclass
class _Held:
    name: str
    conn: AsyncConnection | None


_local: dict[str, asyncio.Lock] = {}


def _lock_key(name: str) -> int:
    """The job's advisory-lock key: stable across processes and releases."""
    return int.from_bytes(hashlib.sha256(f"job:{name}".encode()).digest()[:8], "big", signed=True)


def _is_postgres(engine: AsyncEngine) -> bool:
    return engine.dialect.name == "postgresql"


async def _try_pg_lock(engine: AsyncEngine, name: str) -> AsyncConnection | None:
    """The connection holding the job's advisory lock, or None if another
    connection holds it. Committed at once: the lock is the connection's,
    not a transaction's, so nothing sits idle in a transaction for the run."""
    conn = await engine.connect()
    try:
        got = await conn.scalar(text("SELECT pg_try_advisory_lock(:key)"), {"key": _lock_key(name)})
        await conn.commit()
    except BaseException:
        await conn.close()
        raise
    if not got:
        await conn.close()
        return None
    return conn


async def _release_pg_lock(conn: AsyncConnection, name: str) -> None:
    try:
        await conn.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": _lock_key(name)})
        await conn.commit()
    except Exception:
        # A pooled connection must never keep the lock: drop it, and
        # Postgres releases the lock with the session.
        logger.exception("job %s: releasing its lock failed; dropping the connection", name)
        await conn.invalidate()
    finally:
        await conn.close()


async def _acquire(engine: AsyncEngine, name: str) -> _Held | None:
    lock = _local.setdefault(name, asyncio.Lock())
    if lock.locked():
        return None
    await lock.acquire()
    try:
        conn = await _try_pg_lock(engine, name) if _is_postgres(engine) else None
    except BaseException:
        lock.release()
        raise
    if _is_postgres(engine) and conn is None:
        lock.release()
        return None
    return _Held(name=name, conn=conn)


async def _release(held: _Held) -> None:
    try:
        if held.conn is not None:
            await _release_pg_lock(held.conn, held.name)
    finally:
        _local[held.name].release()


async def is_running(engine: AsyncEngine, name: str) -> bool:
    """Whether the job is running here or, on Postgres, in any process."""
    if _local.get(name, asyncio.Lock()).locked():
        return True
    if not _is_postgres(engine):
        return False
    conn = await _try_pg_lock(engine, name)
    if conn is None:
        return True
    await _release_pg_lock(conn, name)
    return False


# ---------------------------------------------------------------- running


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _record(
    engine: AsyncEngine,
    name: str,
    trigger: Trigger,
    started_at: datetime,
    outcome: Outcome,
    *,
    error: str | None = None,
    summary: str | None = None,
) -> JobRunRecord:
    """Writes the run, and trims the job's runs past JOB_RUNS_KEEP_DAYS."""
    finished_at = _now()
    async with AsyncSession(engine, expire_on_commit=False) as session:
        row = JobRunRecord(
            job=name,
            trigger=trigger,
            started_at=started_at,
            finished_at=finished_at,
            outcome=outcome,
            error=error,
            summary=summary,
        )
        session.add(row)
        cutoff = finished_at - timedelta(days=JOB_RUNS_KEEP_DAYS)
        await session.exec(
            delete(JobRunRecord).where(col(JobRunRecord.job) == name, col(JobRunRecord.started_at) < cutoff)
        )
        await session.commit()
        return row


def _context(job: Job, trigger: Trigger) -> ErrorContext:
    return ErrorContext(source="server", route=f"job {job.name}", tags={"job": job.name, "trigger": trigger})


async def _execute(engine: AsyncEngine, job: Job, trigger: Trigger) -> JobRunRecord:
    """Runs the job (its lock already held) and records how it went."""
    started_at = _now()
    seconds = job.timeout.total_seconds()
    deadline = asyncio.timeout(seconds)
    try:
        async with deadline:
            async with AsyncSession(engine) as session:
                result = await job.run(session)
    except Exception as exc:
        # A TimeoutError of the job's own (an HTTP call, say) is a failure
        # like any other; only the deadline expiring is the job's timeout.
        if isinstance(exc, TimeoutError) and deadline.expired():
            message = f"Timed out after {seconds:g} s."
            logger.error("job %s: %s", job.name, message)
            report_error(TimeoutError(f"Job {job.name} timed out after {seconds:g} s."), _context(job, trigger))
            return await _record(engine, job.name, trigger, started_at, "failed", error=message)
        logger.exception("job %s failed", job.name)
        report_error(exc, _context(job, trigger))
        return await _record(
            engine, job.name, trigger, started_at, "failed", error=scrub(f"{type(exc).__name__}: {exc}")
        )
    summary = result.strip()[:MAX_SUMMARY] if isinstance(result, str) and result.strip() else None
    return await _record(engine, job.name, trigger, started_at, "ok", summary=summary)


async def _run_held(engine: AsyncEngine, job: Job, trigger: Trigger, held: _Held) -> JobRunRecord:
    try:
        return await _execute(engine, job, trigger)
    finally:
        await _release(held)


async def _last_started(engine: AsyncEngine, name: str) -> datetime | None:
    async with AsyncSession(engine) as session:
        result = await session.exec(
            select(func.max(JobRunRecord.started_at)).where(
                col(JobRunRecord.job) == name, col(JobRunRecord.outcome) != "skipped"
            )
        )
        last = result.one()
    # SQLite hands back a naive time; every time stored here is UTC.
    return last.replace(tzinfo=timezone.utc) if last is not None and last.tzinfo is None else last


async def run_scheduled(engine: AsyncEngine, job: Job) -> JobRunRecord:
    """One tick of the schedule: run the job, or record why it was skipped."""
    started_at = _now()
    held = await _acquire(engine, job.name)
    if held is None:
        return await _record(engine, job.name, "schedule", started_at, "skipped", summary="Already running.")
    last = await _last_started(engine, job.name)
    # Less than `every` ago means another process ran it. The slack is for
    # this process's own timer, which can wake a little early (by a clock
    # tick, ~16 ms on Windows): at most a second, a tenth of a short interval.
    slack = min(timedelta(seconds=1), job.every / 10)
    if last is not None and started_at - last < job.every - slack:
        await _release(held)
        ago = int((started_at - last).total_seconds())
        return await _record(
            engine, job.name, "schedule", started_at, "skipped", summary=f"Ran {ago} s ago, in another process."
        )
    return await _run_held(engine, job, "schedule", held)


_manual: set[asyncio.Task[JobRunRecord]] = set()


async def start_job(engine: AsyncEngine, job: Job) -> asyncio.Task[JobRunRecord]:
    """Starts a run now, in the background; AlreadyRunning if it's running."""
    held = await _acquire(engine, job.name)
    if held is None:
        raise AlreadyRunning(job.name)
    task = asyncio.create_task(_run_held(engine, job, "manual", held))
    _manual.add(task)
    task.add_done_callback(_manual.discard)
    return task


# ---------------------------------------------------------------- schedule


def _jitter(job: Job) -> float:
    return random.uniform(0, min(MAX_JITTER_SECONDS, job.every.total_seconds() / 10))


async def _loop(engine: AsyncEngine, job: Job) -> None:
    delay = _jitter(job) if job.run_at_start else job.every.total_seconds() + _jitter(job)
    while True:
        await asyncio.sleep(delay)
        try:
            await run_scheduled(engine, job)
        except Exception as exc:
            # Recording failed (the database is down, say): the run is
            # lost, the schedule isn't.
            logger.exception("job %s: the run couldn't be recorded", job.name)
            report_error(exc, _context(job, "schedule"))
        delay = job.every.total_seconds() + _jitter(job)


def start_jobs(engine: AsyncEngine) -> list[asyncio.Task[None]]:
    """Starts every registered job's schedule (main.py's lifespan)."""
    return [asyncio.create_task(_loop(engine, job), name=f"job:{job.name}") for job in JOBS.values()]


async def stop_jobs(tasks: list[asyncio.Task[None]]) -> None:
    """Cancels the schedules and any run started by hand."""
    pending = [*tasks, *_manual]
    for task in pending:
        task.cancel()
    await asyncio.gather(*pending, return_exceptions=True)
