"""app/jobs.py and app/routers/jobs.py — scheduled jobs (issue #136).

On SQLite, so the lock under test is this process's. The advisory lock
across processes, and job_runs' timestamps on Postgres, are
scripts/check_jobs_live.py's (run by scripts/check-backend-postgres.sh).
"""

import asyncio
from collections.abc import AsyncGenerator, Iterator
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel import SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app import jobs
from app.db import get_session
from app.error_reporting import ErrorContext
from app.main import app
from app.models import JobRunRecord, User
from tests.signed_in import session_cookie
from app.routers.jobs import get_jobs_engine


@pytest_asyncio.fixture
async def engine(tmp_path: Path) -> AsyncGenerator[AsyncEngine, None]:
    # A file, not :memory:: a run cancelled mid-query (stop_jobs) drops its
    # connection, and a new in-memory connection would be an empty database.
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'jobs.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture(autouse=True)
def no_jobs_left_behind() -> Iterator[None]:
    before = dict(jobs.JOBS)
    yield
    jobs.JOBS.clear()
    jobs.JOBS.update(before)
    jobs._local.clear()


@pytest.fixture
def reported(monkeypatch: pytest.MonkeyPatch) -> list[tuple[BaseException, ErrorContext | None]]:
    seen: list[tuple[BaseException, ErrorContext | None]] = []
    monkeypatch.setattr(jobs, "report_error", lambda exc, context=None: seen.append((exc, context)))
    return seen


async def _runs(engine: AsyncEngine, name: str) -> list[JobRunRecord]:
    async with AsyncSession(engine) as session:
        result = await session.exec(
            select(JobRunRecord).where(col(JobRunRecord.job) == name).order_by(col(JobRunRecord.id))
        )
        return list(result.all())


def _says(summary: str) -> jobs.JobFn:
    async def run(_: AsyncSession) -> str:
        return summary

    return run


# ---------------------------------------------------------------- register


def test_register_refuses_a_name_that_cannot_be_in_a_url_or_is_taken() -> None:
    async def run(_: AsyncSession) -> None:
        return None

    jobs.register_job("sync-feeds", every=timedelta(minutes=5), run=run)
    for bad in ["Sync", "sync feeds", "", "-x", "sync/feeds"]:
        with pytest.raises(ValueError, match="lowercase"):
            jobs.register_job(bad, every=timedelta(minutes=5), run=run)
    with pytest.raises(ValueError, match="already registered"):
        jobs.register_job("sync-feeds", every=timedelta(minutes=5), run=run)
    with pytest.raises(ValueError, match="more than zero"):
        jobs.register_job("other", every=timedelta(0), run=run)


# ---------------------------------------------------------------- running


async def test_a_run_is_recorded_with_what_the_job_said(engine: AsyncEngine) -> None:
    seen: list[AsyncSession] = []

    async def run(session: AsyncSession) -> str:
        seen.append(session)
        user = await session.get(User, 1)
        return "  12 new  " if user is None else "unexpected"

    job = jobs.register_job("count", every=timedelta(minutes=5), run=run)
    row = await jobs.run_scheduled(engine, job)
    assert (row.outcome, row.trigger, row.summary, row.error) == ("ok", "schedule", "12 new", None)
    assert len(seen) == 1
    assert [r.outcome for r in await _runs(engine, "count")] == ["ok"]
    assert not await jobs.is_running(engine, "count")


async def test_a_failure_is_recorded_and_reported_and_raises_nothing(
    engine: AsyncEngine, reported: list[tuple[BaseException, ErrorContext | None]]
) -> None:
    async def run(_: AsyncSession) -> None:
        raise RuntimeError("the feed answered 503 for https://feeds.example/x?token=secret")

    job = jobs.register_job("broken", every=timedelta(minutes=5), run=run)
    row = await jobs.run_scheduled(engine, job)
    assert row.outcome == "failed"
    # Scrubbed like an error report: the query string is cut.
    assert row.error == "RuntimeError: the feed answered 503 for https://feeds.example/x"
    assert len(reported) == 1
    context = reported[0][1]
    assert context is not None and context.tags == {"job": "broken", "trigger": "schedule"}
    # The lock is released: the next run isn't blocked by this one.
    assert not await jobs.is_running(engine, "broken")


async def test_a_run_past_its_timeout_is_a_failure(
    engine: AsyncEngine, reported: list[tuple[BaseException, ErrorContext | None]]
) -> None:
    async def run(_: AsyncSession) -> None:
        await asyncio.sleep(5)

    job = jobs.register_job("slow", every=timedelta(minutes=5), run=run, timeout=timedelta(milliseconds=50))
    row = await jobs.run_scheduled(engine, job)
    assert (row.outcome, row.error) == ("failed", "Timed out after 0.05 s.")
    assert isinstance(reported[0][0], TimeoutError)


async def test_a_timeout_inside_the_job_is_its_own_failure(
    engine: AsyncEngine, reported: list[tuple[BaseException, ErrorContext | None]]
) -> None:
    async def run(_: AsyncSession) -> None:
        raise TimeoutError("the feed didn't answer")

    job = jobs.register_job("feed", every=timedelta(minutes=5), run=run)
    row = await jobs.run_scheduled(engine, job)
    assert (row.outcome, row.error) == ("failed", "TimeoutError: the feed didn't answer")


async def test_one_run_at_a_time(engine: AsyncEngine) -> None:
    release = asyncio.Event()

    async def run(_: AsyncSession) -> str:
        await release.wait()
        return "done"

    job = jobs.register_job("long", every=timedelta(minutes=5), run=run)
    task = await jobs.start_job(engine, job)
    assert await jobs.is_running(engine, "long")

    # The schedule skips rather than waits; another manual run is refused.
    skipped = await jobs.run_scheduled(engine, job)
    assert (skipped.outcome, skipped.summary) == ("skipped", "Already running.")
    with pytest.raises(jobs.AlreadyRunning):
        await jobs.start_job(engine, job)

    release.set()
    finished = await task
    assert (finished.outcome, finished.trigger, finished.summary) == ("ok", "manual", "done")
    assert [r.outcome for r in await _runs(engine, "long")] == ["skipped", "ok"]
    assert not await jobs.is_running(engine, "long")


async def test_a_scheduled_run_skips_when_another_process_just_ran_it(engine: AsyncEngine) -> None:
    calls: list[int] = []

    async def run(_: AsyncSession) -> None:
        calls.append(1)

    job = jobs.register_job("once", every=timedelta(minutes=5), run=run)
    now = datetime.now(timezone.utc)
    async with AsyncSession(engine) as session:
        session.add(
            JobRunRecord(
                job="once", trigger="schedule", started_at=now - timedelta(minutes=1),
                finished_at=now - timedelta(minutes=1), outcome="ok",
            )
        )
        await session.commit()

    row = await jobs.run_scheduled(engine, job)
    assert row.outcome == "skipped"
    assert row.summary is not None and row.summary.startswith("Ran 6")
    assert calls == []

    # A manual run isn't held to the schedule.
    await (await jobs.start_job(engine, job))
    assert calls == [1]


async def test_runs_past_the_keep_window_are_trimmed(engine: AsyncEngine) -> None:
    job = jobs.register_job("tidy", every=timedelta(minutes=5), run=_says("ok"))
    old = datetime.now(timezone.utc) - timedelta(days=31)
    async with AsyncSession(engine) as session:
        for name in ["tidy", "other"]:
            session.add(JobRunRecord(job=name, trigger="schedule", started_at=old, finished_at=old, outcome="ok"))
        await session.commit()

    await jobs.run_scheduled(engine, job)
    assert len(await _runs(engine, "tidy")) == 1  # the old one is gone, the new one kept
    assert len(await _runs(engine, "other")) == 1  # another job's runs are its own


# ---------------------------------------------------------------- schedule


async def test_the_schedule_goes_on_after_failures(
    engine: AsyncEngine, reported: list[tuple[BaseException, ErrorContext | None]]
) -> None:
    async def run(_: AsyncSession) -> None:
        raise RuntimeError("always")

    jobs.register_job("flaky", every=timedelta(milliseconds=200), run=run, run_at_start=True)
    schedules = jobs.start_jobs(engine)
    try:
        for _ in range(200):
            if len(await _runs(engine, "flaky")) >= 3:
                break
            await asyncio.sleep(0.01)
    finally:
        await jobs.stop_jobs(schedules)
    runs = await _runs(engine, "flaky")
    assert len(runs) >= 3
    assert {r.outcome for r in runs} == {"failed"}
    assert all(task.done() for task in schedules)


async def test_the_schedule_goes_on_when_a_run_cannot_be_recorded(
    engine: AsyncEngine, monkeypatch: pytest.MonkeyPatch, reported: list[tuple[BaseException, ErrorContext | None]]
) -> None:
    ticks: list[str] = []
    real = jobs.run_scheduled

    async def run_scheduled(engine: AsyncEngine, job: jobs.Job) -> JobRunRecord:
        ticks.append(job.name)
        if len(ticks) == 1:
            raise ConnectionError("database down")
        return await real(engine, job)

    monkeypatch.setattr(jobs, "run_scheduled", run_scheduled)
    jobs.register_job("steady", every=timedelta(milliseconds=20), run=_says("fine"), run_at_start=True)
    schedules = jobs.start_jobs(engine)
    try:
        for _ in range(200):
            if len(ticks) >= 2:
                break
            await asyncio.sleep(0.01)
    finally:
        await jobs.stop_jobs(schedules)
    assert len(ticks) >= 2
    assert isinstance(reported[0][0], ConnectionError)


async def test_nothing_runs_on_a_schedule_until_the_first_interval(engine: AsyncEngine) -> None:
    jobs.register_job("later", every=timedelta(hours=1), run=_says("x"))
    schedules = jobs.start_jobs(engine)
    await asyncio.sleep(0.05)
    await jobs.stop_jobs(schedules)
    assert await _runs(engine, "later") == []


# ---------------------------------------------------------------- the API


@pytest_asyncio.fixture
async def api(engine: AsyncEngine) -> AsyncGenerator[AsyncClient, None]:
    async def session_override() -> AsyncGenerator[AsyncSession, None]:
        async with AsyncSession(engine) as session:
            yield session

    # Signed in for real (tests/signed_in.py), not a stand-in user.
    async with AsyncSession(engine) as session:
        session.add(User(id=1, email="test@example.com", name="Test User", password_hash="unused"))
        await session.commit()
        cookies = await session_cookie(session, 1)
    app.dependency_overrides[get_jobs_engine] = lambda: engine
    app.dependency_overrides[get_session] = session_override
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", cookies=cookies) as client:
        yield client
    app.dependency_overrides.clear()


async def test_get_jobs_lists_each_schedule_and_its_last_run(api: AsyncClient, engine: AsyncEngine) -> None:
    job = jobs.register_job("sync-feeds", every=timedelta(minutes=15), run=_says("12 new"))
    assert (await api.get("/api/jobs")).json() == [
        {"name": "sync-feeds", "everySeconds": 900, "timeoutSeconds": 300, "running": False, "lastRun": None}
    ]
    await jobs.run_scheduled(engine, job)
    await jobs.run_scheduled(engine, job)  # skipped: it just ran; not the last run
    listed = (await api.get("/api/jobs")).json()
    assert listed[0]["lastRun"]["outcome"] == "ok"
    assert listed[0]["lastRun"]["summary"] == "12 new"
    assert set(listed[0]["lastRun"]) == {"trigger", "startedAt", "finishedAt", "outcome", "error", "summary"}


async def test_post_runs_a_job_now_and_refuses_a_second_while_it_runs(api: AsyncClient, engine: AsyncEngine) -> None:
    release = asyncio.Event()

    async def run(_: AsyncSession) -> str:
        await release.wait()
        return "done"

    jobs.register_job("now", every=timedelta(hours=1), run=run)
    started = await api.post("/api/jobs/now/run")
    assert started.status_code == 202
    assert started.json()["running"] is True

    again = await api.post("/api/jobs/now/run")
    assert again.status_code == 409
    assert again.json() == {"detail": "now is already running."}

    release.set()
    await asyncio.gather(*jobs._manual)
    listed = (await api.get("/api/jobs")).json()
    assert listed[0]["running"] is False
    assert (listed[0]["lastRun"]["trigger"], listed[0]["lastRun"]["summary"]) == ("manual", "done")


async def test_post_an_unknown_job_is_a_404(api: AsyncClient) -> None:
    response = await api.post("/api/jobs/nothing/run")
    assert response.status_code == 404
    assert response.json() == {"detail": "No job named 'nothing'."}


async def test_jobs_need_a_session(engine: AsyncEngine) -> None:
    jobs.register_job("private", every=timedelta(hours=1), run=_says("x"))
    app.dependency_overrides[get_jobs_engine] = lambda: engine
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as anonymous:
            assert (await anonymous.get("/api/jobs")).status_code == 401
            assert (await anonymous.post("/api/jobs/private/run")).status_code == 401
    finally:
        app.dependency_overrides.clear()
    assert await _runs(engine, "private") == []
