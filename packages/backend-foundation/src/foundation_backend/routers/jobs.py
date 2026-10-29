"""GET /jobs and POST /jobs/{name}/run (openapi.yaml listJobs, runJob):
the scheduled jobs (jobs.py), when each last ran and how it went, and
a way to run one now.

Signed in, like every other read here; jobs aren't anyone's own, so any
signed-in user sees and runs them all. A run started here goes on in the
background, so a long job never holds the request: the answer is the job
with `running: true`, and GET shows the run once it's done.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from foundation_backend import db, jobs
from foundation_backend.models import JobRunRecord, User
from foundation_backend.openapi_responses import CONFLICT, NOT_FOUND, SERVER_ERROR, UNAUTHORIZED
from foundation_backend.routers.auth import get_current_user
from foundation_backend.schemas import JobOut, JobRunOut

router = APIRouter(tags=["jobs"])


def get_jobs_engine() -> AsyncEngine:
    """The engine jobs run on: a dependency, so tests can point it elsewhere."""
    return db.engine


async def _status(engine: AsyncEngine, job: jobs.Job) -> JobOut:
    async with AsyncSession(engine) as session:
        result = await session.exec(
            select(JobRunRecord)
            .where(col(JobRunRecord.job) == job.name, col(JobRunRecord.outcome) != "skipped")
            .order_by(col(JobRunRecord.started_at).desc(), col(JobRunRecord.id).desc())
            .limit(1)
        )
        last = result.first()
    return JobOut(
        name=job.name,
        every_seconds=int(job.every.total_seconds()),
        timeout_seconds=int(job.timeout.total_seconds()),
        running=await jobs.is_running(engine, job.name),
        last_run=JobRunOut.model_validate(last) if last is not None else None,
    )


@router.get("/jobs", response_model=list[JobOut], responses={**UNAUTHORIZED, **SERVER_ERROR})
async def list_jobs(
    _: User = Depends(get_current_user),
    engine: AsyncEngine = Depends(get_jobs_engine),
) -> list[JobOut]:
    return [await _status(engine, job) for job in jobs.JOBS.values()]


@router.post(
    "/jobs/{name}/run",
    status_code=202,
    response_model=JobOut,
    responses={**UNAUTHORIZED, **NOT_FOUND, **CONFLICT, **SERVER_ERROR},
)
async def run_job(
    name: str,
    _: User = Depends(get_current_user),
    engine: AsyncEngine = Depends(get_jobs_engine),
) -> JobOut:
    job = jobs.JOBS.get(name)
    if job is None:
        raise HTTPException(status_code=404, detail=f"No job named {name!r}.")
    try:
        await jobs.start_job(engine, job)
    except jobs.AlreadyRunning:
        raise HTTPException(status_code=409, detail=f"{name} is already running.") from None
    return await _status(engine, job)
