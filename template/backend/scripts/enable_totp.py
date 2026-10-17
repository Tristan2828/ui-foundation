"""Turn on the TOTP second step for an account (docs/deploy.md "Two-step sign-in").

    cd backend && .venv/Scripts/python scripts/enable_totp.py person@example.com

Prints the otpauth:// URI and the secret to put into an authenticator app,
then asks for one code from that app. Only a right code turns TOTP on, so a
mistyped secret can't lock the account. It then prints ten recovery codes,
once: each signs in once in place of a code. Running it again for an
account that has TOTP replaces the secret and the recovery codes.

Reads the code from the terminal, or from stdin when stdin isn't one. Uses
DATABASE_URL etc. from .env, same as the app. scripts/disable_totp.py is the
way back in when the phone and the recovery codes are both lost.
"""

import asyncio
import sys

from sqlmodel import col, delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app import totp
from app.config import TOTP_ISSUER
from app.db import engine
from app.models import PendingLogin, RecoveryCode, User


def read_line(prompt: str) -> str:
    if sys.stdin.isatty():
        return input(prompt)
    return sys.stdin.readline().strip()


async def run(email: str) -> int:
    async with AsyncSession(engine) as session:
        result = await session.exec(select(User).where(User.email == email.lower()))
        user = result.first()
        if user is None or user.id is None:
            print(f"No user with email {email}.", file=sys.stderr)
            return 1

        secret = totp.generate_secret()
        print("Add this account to an authenticator app, from the URI (as a QR code) or the secret:")
        print(f"  URI:    {totp.otpauth_uri(secret, user.email, TOTP_ISSUER)}")
        print(f"  Secret: {secret}")
        step = totp.verify(secret, read_line("Then enter the 6-digit code it shows: "), None)
        if step is None:
            print("That code isn't right, so nothing changed. Run this again.", file=sys.stderr)
            return 1

        codes = totp.generate_recovery_codes()
        user.totp_secret = secret
        user.totp_last_step = step
        session.add(user)
        await session.exec(delete(RecoveryCode).where(col(RecoveryCode.user_id) == user.id))
        await session.exec(delete(PendingLogin).where(col(PendingLogin.user_id) == user.id))
        for code in codes:
            session.add(RecoveryCode(user_id=user.id, code_hash=totp.hash_recovery_code(code)))
        await session.commit()
        print(f"TOTP is on for {email}. Recovery codes, each usable once (shown only now):")
        for code in codes:
            print(f"  {code}")
    return 0


async def main_async(email: str) -> int:
    try:
        return await run(email)
    finally:
        await engine.dispose()


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: python scripts/enable_totp.py <email>", file=sys.stderr)
        return 2
    return asyncio.run(main_async(sys.argv[1]))


if __name__ == "__main__":
    sys.exit(main())
