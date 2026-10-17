"""POST /auth/register, POST /auth/login, POST /auth/login/totp,
POST /auth/logout, GET /auth/me — see openapi.yaml operationIds register,
login, loginTotp, logout, getCurrentUser.
Session-cookie auth (same-origin deployment, stdlib-only, zero new
dependency); register reuses login's session-creation path via
`_start_session`.
`get_current_user` is exported for reuse as a router-level
`dependencies=[Depends(get_current_user)]` on widgets/widget-categories.
"""

import hmac
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app import login_limits, totp
from app.config import (
    COOKIE_SECURE,
    PENDING_LOGIN_MAX_TRIES,
    PENDING_LOGIN_TTL_SECONDS,
    SESSION_TTL_DAYS,
)
from app.db import get_session
from app.models import PendingLogin, RecoveryCode, User
from app.models import Session as UserSession
from app.openapi_responses import RATE_LIMITED, SERVER_ERROR, SIGN_IN_EXPIRED, UNAUTHORIZED, VALIDATION
from app.schemas import LoginNextStep, LoginRequest, RegisterRequest, TotpLoginRequest, UserOut
from app.security import (
    DUMMY_PASSWORD_HASH,
    generate_session_token,
    hash_password,
    hash_token,
    verify_password,
)

router = APIRouter(tags=["auth"])

COOKIE_NAME = "session_id"
# The sign-in waiting for its TOTP code. Sent only to the auth routes.
PENDING_COOKIE_NAME = "pending_login"
PENDING_COOKIE_PATH = "/api/auth"
LOGIN_RESPONSES = {
    202: {"model": LoginNextStep, "description": "The password is right; a TOTP code is next."},
    **UNAUTHORIZED,
    **VALIDATION,
    **RATE_LIMITED,
    **SERVER_ERROR,
}
LOGIN_TOTP_RESPONSES = {**UNAUTHORIZED, **SIGN_IN_EXPIRED, **VALIDATION, **RATE_LIMITED, **SERVER_ERROR}
SIGN_IN_TIMED_OUT = "Your sign-in timed out. Enter your email and password again."
TOO_MANY_CODES = "Too many wrong codes. Enter your email and password again."
REGISTER_RESPONSES = {**VALIDATION, **SERVER_ERROR}


async def get_current_user(
    session_id: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
) -> User:
    if session_id is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    stmt = select(UserSession).where(UserSession.token_hash == hash_token(session_id))
    result = await session.exec(stmt)
    user_session = result.first()
    if user_session is None:
        raise HTTPException(status_code=401, detail="Session expired or invalid")

    if _is_expired(user_session):
        await session.delete(user_session)
        await session.commit()
        raise HTTPException(status_code=401, detail="Session expired or invalid")

    user = await session.get(User, user_session.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    return user


def _is_expired(user_session: UserSession | PendingLogin) -> bool:
    # SQLite (the pytest fixture engine — see conftest.py) drops tzinfo on
    # round-trip even though the column is declared timezone-aware for
    # Postgres; normalize before comparing so this works under both.
    expires_at = user_session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at < datetime.now(timezone.utc)


async def _start_session(user: User, response: Response, session: AsyncSession) -> User:
    """Issue a session cookie for `user`. Shared by login and register so
    "register auto-logs you in" is literally the same code path as logging
    in, not a second implementation of it.

    Also prunes the user's expired sessions — nothing else removes a session
    that's never presented again, so without this the table only grows.
    """
    existing = await session.exec(select(UserSession).where(UserSession.user_id == user.id))
    for stale in existing.all():
        if _is_expired(stale):
            await session.delete(stale)

    token = generate_session_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)
    session.add(UserSession(user_id=user.id, token_hash=hash_token(token), expires_at=expires_at))
    await session.commit()
    # commit() expires every object in the session, including `user` (which
    # we only read, never modified) — re-fetch before serializing it, same
    # as create_widget's session.refresh(widget) in routers/widgets.py.
    await session.refresh(user)

    response.set_cookie(
        COOKIE_NAME,
        token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
    )
    return user


@router.post("/auth/register", response_model=UserOut, responses=REGISTER_RESPONSES)
async def register(
    body: RegisterRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> User:
    stmt = select(User).where(User.email == body.email)
    result = await session.exec(stmt)
    if result.first() is not None:
        # Shaped like FastAPI's own RequestValidationError so it lands on
        # the same 422/ValidationErrorBody path every other field error
        # uses — a duplicate email is a validation failure, not a 409.
        raise RequestValidationError(
            [{"loc": ("body", "email"), "msg": "email already registered", "type": "value_error.email_exists"}]
        )

    # PBKDF2 at 600k iterations is deliberately slow CPU work; run inline in
    # an async handler it stalls every other request on the event loop.
    password_hash = await run_in_threadpool(hash_password, body.password)
    user = User(email=body.email, name=body.name, password_hash=password_hash)
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return await _start_session(user, response, session)


@router.post("/auth/login", response_model=UserOut, responses=LOGIN_RESPONSES)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> User | JSONResponse:
    ip = login_limits.client_ip(request)
    account = login_limits.account_key(body.email)
    # Before the password: an answer over the limit says nothing about it.
    await login_limits.refuse_if_limited(session, ip, account)

    stmt = select(User).where(User.email == body.email)
    result = await session.exec(stmt)
    user = result.first()
    # A missing user still runs the hash, against a dummy, so the response
    # time doesn't reveal whether the email has an account.
    stored = user.password_hash if user is not None else DUMMY_PASSWORD_HASH
    if not await run_in_threadpool(verify_password, body.password, stored) or user is None:
        await login_limits.record_failure(session, ip, account)
        # Deliberately generic — never confirm whether the email exists.
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.totp_secret is not None:
        # No session yet, and the failures stay: a known password mustn't
        # reset the count for guessing codes.
        return await _start_pending_login(user, session)

    await login_limits.clear_failures(session, ip, account)
    return await _start_session(user, response, session)


async def _start_pending_login(user: User, session: AsyncSession) -> JSONResponse:
    """The 202: a single-use pending sign-in, its token in a cookie only the
    auth routes see, and only its hash in the database (as for sessions)."""
    assert user.id is not None
    existing = await session.exec(select(PendingLogin).where(PendingLogin.user_id == user.id))
    for stale in existing.all():
        if _is_expired(stale):
            await session.delete(stale)
    token = generate_session_token()
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=PENDING_LOGIN_TTL_SECONDS)
    session.add(PendingLogin(user_id=user.id, token_hash=hash_token(token), expires_at=expires_at))
    await session.commit()

    answer = JSONResponse(status_code=202, content=LoginNextStep(next="totp").model_dump(by_alias=True))
    answer.set_cookie(
        PENDING_COOKIE_NAME,
        token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="strict",
        max_age=PENDING_LOGIN_TTL_SECONDS,
        path=PENDING_COOKIE_PATH,
    )
    return answer


@router.post("/auth/login/totp", response_model=UserOut, responses=LOGIN_TOTP_RESPONSES)
async def login_totp(
    body: TotpLoginRequest,
    request: Request,
    response: Response,
    pending_login: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
) -> User:
    pending = await _live_pending_login(pending_login, session)
    user = await session.get(User, pending.user_id)
    if user is None or user.totp_secret is None:
        await session.delete(pending)
        await session.commit()
        raise HTTPException(status_code=410, detail=SIGN_IN_TIMED_OUT)

    ip = login_limits.client_ip(request)
    account = login_limits.account_key(user.email)
    await login_limits.refuse_if_limited(session, ip, account)

    if not _accept_code(user, body.code, await _recovery_codes(user, session)):
        pending.tries += 1
        out_of_tries = pending.tries >= PENDING_LOGIN_MAX_TRIES
        if out_of_tries:
            await session.delete(pending)
        else:
            session.add(pending)
        # Counts toward the IP and account limits; commits the tries too.
        await login_limits.record_failure(session, ip, account)
        if out_of_tries:
            raise HTTPException(status_code=410, detail=TOO_MANY_CODES)
        raise HTTPException(status_code=401, detail="That code isn't right. Check it and try again.")

    await session.delete(pending)
    await login_limits.clear_failures(session, ip, account)
    response.delete_cookie(PENDING_COOKIE_NAME, path=PENDING_COOKIE_PATH)
    return await _start_session(user, response, session)


async def _live_pending_login(token: str | None, session: AsyncSession) -> PendingLogin:
    """The pending sign-in the cookie names, or a 410: start again."""
    if token is None:
        raise HTTPException(status_code=410, detail=SIGN_IN_TIMED_OUT)
    result = await session.exec(select(PendingLogin).where(PendingLogin.token_hash == hash_token(token)))
    pending = result.first()
    if pending is None:
        raise HTTPException(status_code=410, detail=SIGN_IN_TIMED_OUT)
    if _is_expired(pending):
        await session.delete(pending)
        await session.commit()
        raise HTTPException(status_code=410, detail=SIGN_IN_TIMED_OUT)
    return pending


async def _recovery_codes(user: User, session: AsyncSession) -> list[RecoveryCode]:
    result = await session.exec(select(RecoveryCode).where(RecoveryCode.user_id == user.id))
    return list(result.all())


def _accept_code(user: User, code: str, recovery_codes: list[RecoveryCode]) -> bool:
    """A TOTP code for a step not used before, or an unused recovery code.
    Marks it used on the objects; the caller's commit saves that."""
    assert user.totp_secret is not None
    if totp.is_totp_code(code):
        step = totp.verify(user.totp_secret, code, user.totp_last_step)
        if step is None:
            return False
        user.totp_last_step = step
        return True
    code_hash = totp.hash_recovery_code(code)
    for recovery in recovery_codes:
        if recovery.used_at is None and hmac.compare_digest(recovery.code_hash, code_hash):
            recovery.used_at = datetime.now(timezone.utc)
            return True
    return False


@router.post("/auth/logout", status_code=204, responses=SERVER_ERROR)
async def logout(
    response: Response,
    session_id: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
) -> None:
    if session_id is not None:
        stmt = select(UserSession).where(UserSession.token_hash == hash_token(session_id))
        result = await session.exec(stmt)
        user_session = result.first()
        if user_session is not None:
            await session.delete(user_session)
            await session.commit()
    response.delete_cookie(COOKIE_NAME)


@router.get("/auth/me", response_model=UserOut, responses={**UNAUTHORIZED, **SERVER_ERROR})
async def me(user: User = Depends(get_current_user)) -> User:
    return user
