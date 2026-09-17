"""POST /auth/register, POST /auth/login, POST /auth/logout, GET /auth/me —
see openapi.yaml operationIds register, login, logout, getCurrentUser.
Session-cookie auth chosen in docs/BUILD-PLAN.md Phase 10 (same-origin
deployment, stdlib-only, zero new dependency); register added in Phase 11
and reuses login's session-creation path via `_start_session`.
`get_current_user` is exported for reuse as a router-level
`dependencies=[Depends(get_current_user)]` on widgets/categories.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from fastapi.exceptions import RequestValidationError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import COOKIE_SECURE, SESSION_TTL_DAYS
from app.db import get_session
from app.models import Session as UserSession
from app.models import User
from app.openapi_responses import SERVER_ERROR, UNAUTHORIZED, VALIDATION
from app.schemas import LoginRequest, RegisterRequest, UserOut
from app.security import generate_session_token, hash_password, hash_token, verify_password

router = APIRouter(tags=["auth"])

COOKIE_NAME = "session_id"
LOGIN_RESPONSES = {**UNAUTHORIZED, **VALIDATION, **SERVER_ERROR}
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

    # SQLite (the pytest fixture engine — see conftest.py) drops tzinfo on
    # round-trip even though the column is declared timezone-aware for
    # Postgres; normalize before comparing so this works under both.
    expires_at = user_session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired or invalid")

    user = await session.get(User, user_session.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    return user


async def _start_session(user: User, response: Response, session: AsyncSession) -> User:
    """Issue a session cookie for `user`. Shared by login and register so
    "register auto-logs you in" is literally the same code path as logging
    in, not a second implementation of it.
    """
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

    user = User(email=body.email, name=body.name, password_hash=hash_password(body.password))
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return await _start_session(user, response, session)


@router.post("/auth/login", response_model=UserOut, responses=LOGIN_RESPONSES)
async def login(
    body: LoginRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> User:
    stmt = select(User).where(User.email == body.email)
    result = await session.exec(stmt)
    user = result.first()
    if user is None or not verify_password(body.password, user.password_hash):
        # Deliberately generic — never confirm whether the email exists.
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return await _start_session(user, response, session)


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
