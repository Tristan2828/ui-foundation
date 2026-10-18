#!/usr/bin/env python
"""Scheduled jobs on real Postgres (scripts/check-backend-postgres.sh runs it
after `alembic upgrade head`, against the throwaway database).

pytest runs on SQLite, where the only lock is the process's own. This checks
what only Postgres has: the advisory lock holds across connections (as it
would across processes), the "ran less than `every` ago" check reads
job_runs' timestamps back correctly, and old runs are trimmed.

Usage: check_jobs_live.py   (DATABASE_URL names the database)
"""

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlmodel import col, delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import jobs  # noqa: E402
from app.db import engine  # noqa: E402
from app.models import JobRunRecord  # noqa: E402

NAME = "live-check"


def check(condition: bool, message: str) -> None:
    if not condition:
        print(f"check-jobs-live: {message}", file=sys.stderr)
        raise SystemExit(1)


async def runs() -> list[JobRunRecord]:
    async with AsyncSession(engine) as session:
        result = await session.exec(
            select(JobRunRecord).where(col(JobRunRecord.job) == NAME).order_by(col(JobRunRecord.id))
        )
        return list(result.all())


async def main() -> None:
    check(engine.dialect.name == "postgresql", f"DATABASE_URL is {engine.dialect.name}, not Postgres")
    async with AsyncSession(engine) as session:
        await session.exec(delete(JobRunRecord).where(col(JobRunRecord.job) == NAME))
        await session.commit()

    # The advisory lock, from two connections: the second is refused, and
    # sees the job as running though this process's own lock isn't held.
    held = await jobs._try_pg_lock(engine, NAME)
    check(held is not None, "the first connection didn't get the job's lock")
    assert held is not None
    check(await jobs._try_pg_lock(engine, NAME) is None, "a second connection got a lock another holds")
    check(await jobs.is_running(engine, NAME), "is_running is false while another connection holds the lock")
    await jobs._release_pg_lock(held, NAME)
    check(not await jobs.is_running(engine, NAME), "the lock wasn't released")

    # A run through the whole path: lock, run, record, trim.
    old = datetime.now(timezone.utc) - timedelta(days=31)
    async with AsyncSession(engine) as session:
        session.add(JobRunRecord(job=NAME, trigger="schedule", started_at=old, finished_at=old, outcome="ok"))
        await session.commit()

    async def run(_: AsyncSession) -> str:
        # While it runs, another connection is refused the lock.
        check(await jobs._try_pg_lock(engine, NAME) is None, "the lock wasn't held during the run")
        return "checked"

    job = jobs.register_job(NAME, every=timedelta(hours=1), run=run)
    first = await jobs.run_scheduled(engine, job)
    check((first.outcome, first.summary) == ("ok", "checked"), f"the run ended {first.outcome}: {first.error}")

    # Read back from Postgres: the old run trimmed, the times aware and in order.
    stored = await runs()
    check(len(stored) == 1, f"expected the old run trimmed, found {len(stored)} runs")
    check(stored[0].started_at.tzinfo is not None, "started_at came back without a time zone")
    check(stored[0].finished_at >= stored[0].started_at, "finished_at is before started_at")

    # The next tick, from a process that didn't run it, skips: it ran just now.
    jobs._local.clear()
    second = await jobs.run_scheduled(engine, job)
    check(second.outcome == "skipped", f"a run within the interval wasn't skipped: {second.outcome}")

    async with AsyncSession(engine) as session:
        await session.exec(delete(JobRunRecord).where(col(JobRunRecord.job) == NAME))
        await session.commit()
    await engine.dispose()
    print("check-jobs-live: PASS")


if __name__ == "__main__":
    asyncio.run(main())
