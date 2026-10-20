"""Send a test notification to every device a user allowed reminders on,
to check push end to end (docs/deploy.md "Reminders (Web Push)").

    cd backend && .venv/Scripts/python scripts/send_test_push.py dev@example.com

Uses PUSH_ENABLED, VAPID_* and DATABASE_URL from .env, like the app.
Prints how it went: sent, gone (deleted), failed.
"""

import asyncio
import sys

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app import push
from app.db import engine
from app.models import User


async def send(email: str) -> int:
    problem = push.config_problem()
    if problem is not None:
        print(problem, file=sys.stderr)
        return 1
    async with AsyncSession(engine) as session:
        result = await session.exec(select(User).where(User.email == email.lower()))
        user = result.first()
        if user is None or user.id is None:
            print(f"No user {email}.", file=sys.stderr)
            return 1
        outcome = await push.send_push(session, user.id, "Test reminder", "Push works on this device.", "/")
    print(outcome.summary())
    return 0 if outcome.sent else 1


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: send_test_push.py <email>", file=sys.stderr)
        return 2
    return asyncio.run(send(sys.argv[1]))


if __name__ == "__main__":
    raise SystemExit(main())
