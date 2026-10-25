"""Sign a test client in for real: a `sessions` row and its cookie, so
the request runs the real `get_current_user` and gets the `User` loaded in
its own database session, as it does live.

A detached `User` stood in for `get_current_user` hides a bug that is a 500
live: a router that reads `user.id` after `session.commit()` (the commit
expires the user the request loaded, and reading it again is a lazy load,
`MissingGreenlet` under asyncio). With a real sign-in the test fails the
same way. See `docs/foundation/add-an-entity.md`, "After a commit, in the backend".
"""

from datetime import datetime, timedelta, timezone

from sqlmodel.ext.asyncio.session import AsyncSession

from foundation_backend.models import Session as UserSession
from foundation_backend.routers.auth import COOKIE_NAME
from foundation_backend.security import generate_session_token, hash_token


async def session_cookie(session: AsyncSession, user_id: int) -> dict[str, str]:
    """A live session for `user_id`, as the cookie a client sends with it."""
    token = generate_session_token()
    session.add(
        UserSession(
            user_id=user_id,
            token_hash=hash_token(token),
            expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        )
    )
    await session.commit()
    return {COOKIE_NAME: token}
