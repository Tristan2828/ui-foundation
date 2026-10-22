"""Turn off the TOTP second step for an account: the way back in when the
phone and the recovery codes are both lost (docs/deploy.md "Two-step sign-in").

    cd backend && .venv/Scripts/python -m foundation_backend.scripts.disable_totp person@example.com

Clears the secret, deletes the recovery codes and any sign-in waiting for a
code. The password alone signs in afterwards; run foundation_backend.scripts.enable_totp to turn it
on again. Uses DATABASE_URL etc. from .env, same as the app.
"""

import asyncio
import sys

from sqlmodel import col, delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from foundation_backend.db import engine
from foundation_backend.models import PendingLogin, RecoveryCode, User


async def disable(email: str) -> bool:
    async with AsyncSession(engine) as session:
        result = await session.exec(select(User).where(User.email == email.lower()))
        user = result.first()
        if user is None:
            return False
        user.totp_secret = None
        user.totp_last_step = None
        session.add(user)
        await session.exec(delete(RecoveryCode).where(col(RecoveryCode.user_id) == user.id))
        await session.exec(delete(PendingLogin).where(col(PendingLogin.user_id) == user.id))
        await session.commit()
    await engine.dispose()
    return True


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: python -m foundation_backend.scripts.disable_totp <email>", file=sys.stderr)
        return 2
    if not asyncio.run(disable(sys.argv[1])):
        print(f"No user with email {sys.argv[1]}.", file=sys.stderr)
        return 1
    print(f"TOTP is off for {sys.argv[1]}: the password alone signs in.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
