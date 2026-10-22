"""Set a user's password — the fix APP_ENV=production's startup check asks
for when the seeded account still has the published default password.

    cd backend && .venv/Scripts/python -m foundation_backend.scripts.set_password dev@example.com

Reads the new password with getpass (never an argument, so it stays out of
shell history and the process list), or from stdin when stdin isn't a
terminal (two lines: the password, then the same again) — on Windows getpass reads the console directly and would wait forever on a
pipe. Uses DATABASE_URL etc. from .env, same as the app. Also ends that
user's existing sessions.
"""

import asyncio
import getpass
import sys

from sqlmodel import col, delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from foundation_backend.db import engine
from foundation_backend.models import Session, User
from foundation_backend.security import hash_password

MIN_LENGTH = 8  # matches RegisterRequest.password in foundation_backend.schemas


def read_password(prompt: str) -> str:
    if sys.stdin.isatty():
        return getpass.getpass(prompt)
    return sys.stdin.readline().rstrip("\r\n")


async def set_password(email: str, password: str) -> bool:
    async with AsyncSession(engine) as session:
        result = await session.exec(select(User).where(User.email == email.lower()))
        user = result.first()
        if user is None:
            return False
        user.password_hash = hash_password(password)
        session.add(user)
        await session.exec(delete(Session).where(col(Session.user_id) == user.id))
        await session.commit()
    await engine.dispose()
    return True


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: python -m foundation_backend.scripts.set_password <email>", file=sys.stderr)
        return 2
    email = sys.argv[1]
    password = read_password(f"New password for {email}: ")
    if len(password) < MIN_LENGTH:
        print(f"Password must be at least {MIN_LENGTH} characters.", file=sys.stderr)
        return 1
    if read_password("Repeat it: ") != password:
        print("Passwords don't match.", file=sys.stderr)
        return 1
    if not asyncio.run(set_password(email, password)):
        print(f"No user with email {email}.", file=sys.stderr)
        return 1
    print(f"Password for {email} changed; their existing sessions were ended.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
