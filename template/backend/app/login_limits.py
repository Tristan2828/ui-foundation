"""Failed sign-in limits: per client IP and per account, counted in the
database (`login_failures`) so they survive a restart and hold across
worker processes. Stdlib only.

The check runs before the password is checked, so an answer over the
limit says nothing about the password. A wrong TOTP code counts as a
failure too. A session starting clears that account's and that IP's
failures; a right password alone doesn't when the account has a second
step, or a known password would reset the count for guessing codes.

The per-account limit lets anyone lock an account out for its window by
failing on purpose. That's the usual trade-off, kept short by the
defaults (docs/deploy.md).
"""

import hashlib
import math
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request
from sqlmodel import col, delete, or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import (
    LOGIN_ACCOUNT_WINDOW_SECONDS,
    LOGIN_IP_WINDOW_SECONDS,
    LOGIN_MAX_FAILURES_PER_ACCOUNT,
    LOGIN_MAX_FAILURES_PER_IP,
)
from app.models import LoginFailure

IP = "ip"
ACCOUNT = "account"


def client_ip(request: Request) -> str:
    # Right only behind a proxy uvicorn trusts (--proxy-headers,
    # FORWARDED_ALLOW_IPS), as the template's Dockerfile runs it.
    return request.client.host if request.client is not None else "unknown"


def account_key(email: str) -> str:
    """sha256 of the normalized email: an unknown email counts the same as
    a known one, and the table holds no addresses."""
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()


def _aware(moment: datetime) -> datetime:
    # SQLite (the pytest engine) drops tzinfo on the way back; Postgres keeps it.
    return moment if moment.tzinfo is not None else moment.replace(tzinfo=timezone.utc)


def _limits() -> list[tuple[str, int, int]]:
    return [
        (IP, LOGIN_MAX_FAILURES_PER_IP, LOGIN_IP_WINDOW_SECONDS),
        (ACCOUNT, LOGIN_MAX_FAILURES_PER_ACCOUNT, LOGIN_ACCOUNT_WINDOW_SECONDS),
    ]


async def retry_after(session: AsyncSession, ip: str, account: str) -> int | None:
    """Seconds until another attempt is allowed, or None if it is now."""
    now = datetime.now(timezone.utc)
    keys = {IP: ip, ACCOUNT: account}
    wait = 0.0
    for kind, limit, window in _limits():
        # Compared here, not in SQL: SQLite stores these without a zone.
        result = await session.exec(
            select(LoginFailure.failed_at).where(LoginFailure.kind == kind, LoginFailure.key == keys[kind])
        )
        cutoff = now - timedelta(seconds=window)
        recent = sorted(at for at in map(_aware, result.all()) if at > cutoff)
        if len(recent) >= limit:
            # Allowed again once enough of them fall out of the window to
            # leave one attempt.
            frees_at = recent[len(recent) - limit] + timedelta(seconds=window)
            wait = max(wait, (frees_at - now).total_seconds())
    return max(1, math.ceil(wait)) if wait > 0 else None


async def refuse_if_limited(session: AsyncSession, ip: str, account: str) -> None:
    wait = await retry_after(session, ip, account)
    if wait is None:
        return
    minutes = max(1, math.ceil(wait / 60))
    raise HTTPException(
        status_code=429,
        detail=f"Too many sign-in attempts. Try again in {minutes} minute{'s' if minutes != 1 else ''}.",
        headers={"Retry-After": str(wait)},
    )


async def record_failure(session: AsyncSession, ip: str, account: str) -> None:
    """Adds one failure for each key and prunes what no window still needs.
    Commits."""
    now = datetime.now(timezone.utc)
    oldest_needed = now - timedelta(seconds=max(window for _, _, window in _limits()))
    await session.exec(delete(LoginFailure).where(col(LoginFailure.failed_at) < oldest_needed))
    session.add(LoginFailure(kind=IP, key=ip, failed_at=now))
    session.add(LoginFailure(kind=ACCOUNT, key=account, failed_at=now))
    await session.commit()


async def clear_failures(session: AsyncSession, ip: str, account: str) -> None:
    """Forgets this IP's and this account's failures. Doesn't commit: the
    session that starts commits it."""
    await session.exec(
        delete(LoginFailure).where(
            or_(
                (col(LoginFailure.kind) == IP) & (col(LoginFailure.key) == ip),
                (col(LoginFailure.kind) == ACCOUNT) & (col(LoginFailure.key) == account),
            )
        )
    )
