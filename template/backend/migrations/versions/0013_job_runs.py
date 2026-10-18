"""Scheduled jobs' runs (issue #136).

job_runs: one row per run of a job registered with app/jobs.py's
register_job, including the runs a process skipped because another was
running it. Trimmed by the app to JOB_RUNS_KEEP_DAYS (30) per job.

Commented in the same migration (0005's rule; scripts/check_db_comments.py).
COMMENT ON is Postgres-only, so it is skipped on any other dialect.

Revision ID: 0013
Revises: 0012
Create Date: 2026-10-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE_COMMENT = (
    "One row per run of a scheduled job (app/jobs.py), including runs skipped because another "
    "process was running the job. Written by the app; rows older than JOB_RUNS_KEEP_DAYS (30) are deleted."
)
COLUMN_COMMENTS = {
    "id": "Primary key.",
    "job": "The job's registered name (register_job), e.g. sync-feeds. Not a foreign key: jobs live in code.",
    "trigger": "'schedule' (its timer) or 'manual' (POST /api/jobs/{name}/run by a signed-in user).",
    "started_at": "When the run started, or was skipped (timestamptz, UTC).",
    "finished_at": "When the run ended (timestamptz, UTC). Equal to started_at, near enough, for a skipped run.",
    "outcome": "'ok', 'failed' (an error or the job's timeout), or 'skipped' (already running, or just ran in another process).",
    "error": "For a failed run, the error's type and message, scrubbed of SQL parameters and query strings. Null otherwise.",
    "summary": "What the job said it did ('12 new'), or why a run was skipped. Null when it said nothing.",
}


def _quote(value: str) -> str:
    # A SQL string literal: a ' inside the text is doubled, as in 0005.
    return "'" + value.replace("'", "''") + "'"


def upgrade() -> None:
    op.create_table(
        "job_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("job", sa.String(length=64), nullable=False),
        sa.Column("trigger", sa.String(length=16), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("outcome", sa.String(length=16), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("summary", sa.String(length=500), nullable=True),
    )
    op.create_index("ix_job_runs_job", "job_runs", ["job"])
    op.create_index("ix_job_runs_started_at", "job_runs", ["started_at"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute(f"COMMENT ON TABLE job_runs IS {_quote(TABLE_COMMENT)}")
        for column, comment in COLUMN_COMMENTS.items():
            op.execute(f"COMMENT ON COLUMN job_runs.{column} IS {_quote(comment)}")


def downgrade() -> None:
    op.drop_index("ix_job_runs_started_at", table_name="job_runs")
    op.drop_index("ix_job_runs_job", table_name="job_runs")
    op.drop_table("job_runs")
