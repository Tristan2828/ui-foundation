"""Every table and column in the live schema has a Postgres comment.

A second agent with database credentials and no repo (a reporting tool, a
data agent, psql) reads the schema alone: `\\d+ <table>` in psql, or
`obj_description()`/`col_description()` in SQL. Those comments are its only
documentation, so a migration that adds a table or column without
`COMMENT ON TABLE`/`COMMENT ON COLUMN` fails here.

Run against a database already at `alembic upgrade head`
(scripts/check-backend-postgres.sh does both). Reads DATABASE_URL like the
app does. Postgres only: SQLite has no comments, so pytest can't check this.
"""

import asyncio
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import DATABASE_URL, database_connect_args

# Alembic's own bookkeeping table, not app data.
IGNORED_TABLES = ("alembic_version",)

# A blank comment counts as missing: `COMMENT ON ... IS ''` removes it anyway.
MISSING = text(
    """
    SELECT c.relname AS table_name, NULL AS column_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relname <> ALL(:ignored)
      AND coalesce(obj_description(c.oid, 'pg_class'), '') = ''
    UNION ALL
    SELECT c.relname, a.attname
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relname <> ALL(:ignored)
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND coalesce(col_description(c.oid, a.attnum), '') = ''
    ORDER BY 1, 2 NULLS FIRST
    """
)


async def missing_comments() -> list[tuple[str, str | None]]:
    engine = create_async_engine(DATABASE_URL, connect_args=database_connect_args())
    try:
        async with engine.connect() as connection:
            rows = await connection.execute(MISSING, {"ignored": list(IGNORED_TABLES)})
            return [(row.table_name, row.column_name) for row in rows]
    finally:
        await engine.dispose()


def main() -> int:
    missing = asyncio.run(missing_comments())
    if not missing:
        print("check_db_comments: every table and column has a comment")
        return 0
    print("check_db_comments: no COMMENT ON for:", file=sys.stderr)
    for table, column in missing:
        print(f"  {table}" if column is None else f"  {table}.{column}", file=sys.stderr)
    print(
        "Add COMMENT ON TABLE / COMMENT ON COLUMN in a migration "
        "(AGENTS.md, Hard Rules; migrations/versions/0005_schema_comments.py shows how).",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
