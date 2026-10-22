"""GET /push/public-key, POST /push/subscriptions and DELETE
/push/subscriptions/{id} (openapi.yaml, the foundation's part: issue #167).

The browser subscribes with the app's VAPID public key, then hands over
where its push service takes messages and the keys to encrypt them to.
Each row is one device, the signed-in user's. Off unless PUSH_ENABLED (404
then). Sending is app/push.py's.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.exceptions import RequestValidationError
from sqlmodel import col, delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app import config, push
from app.db import get_session
from app.models import PushSubscription, User
from app.openapi_responses import NOT_FOUND, SERVER_ERROR, UNAUTHORIZED, VALIDATION
from foundation_backend.routers.auth import get_current_user
from app.schemas import PushPublicKeyOut, PushSubscriptionIn, PushSubscriptionOut


def require_enabled() -> None:
    if not config.PUSH_ENABLED:
        raise HTTPException(status_code=404, detail="Not Found")


router = APIRouter(tags=["push"], dependencies=[Depends(require_enabled)])

# Devices one user may have subscribed; past it, a new one replaces the
# oldest. Every send goes to each, so the list can't grow without end.
MAX_DEVICES_PER_USER = 20


def _invalid(field: str, message: str) -> RequestValidationError:
    # FastAPI's own 422 shape, so the gateway shows it like any other.
    return RequestValidationError([{"loc": ["body", field], "msg": message, "type": "value_error"}])


@router.get(
    "/push/public-key",
    response_model=PushPublicKeyOut,
    responses={**UNAUTHORIZED, **NOT_FOUND, **SERVER_ERROR},
)
async def get_push_public_key(_: User = Depends(get_current_user)) -> PushPublicKeyOut:
    return PushPublicKeyOut(public_key=push.vapid_public_key())


@router.post(
    "/push/subscriptions",
    status_code=201,
    response_model=PushSubscriptionOut,
    responses={**UNAUTHORIZED, **NOT_FOUND, **VALIDATION, **SERVER_ERROR},
)
async def save_push_subscription(
    body: PushSubscriptionIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PushSubscriptionOut:
    problem = push.endpoint_problem(body.endpoint)
    if problem is not None:
        raise _invalid("endpoint", problem)
    problem = push.subscription_key_problem(body.keys.p256dh, body.keys.auth)
    if problem is not None:
        raise _invalid("keys", problem)
    assert user.id is not None
    result = await session.exec(select(PushSubscription).where(col(PushSubscription.endpoint) == body.endpoint))
    row = result.first()
    if row is None:
        row = PushSubscription(user_id=user.id, endpoint=body.endpoint, p256dh="", auth="", created_at=datetime.now(timezone.utc))
    # The same device again: new keys, and the account now signed in on it.
    row.user_id = user.id
    row.p256dh = body.keys.p256dh
    row.auth = body.keys.auth
    row.created_at = datetime.now(timezone.utc)
    session.add(row)
    await session.flush()
    kept = await session.exec(
        select(col(PushSubscription.id))
        .where(col(PushSubscription.user_id) == user.id)
        .order_by(col(PushSubscription.created_at).desc(), col(PushSubscription.id).desc())
        .limit(MAX_DEVICES_PER_USER)
    )
    await session.exec(
        delete(PushSubscription).where(
            col(PushSubscription.user_id) == user.id, col(PushSubscription.id).not_in(kept.all())
        )
    )
    await session.commit()
    await session.refresh(row)
    assert row.id is not None
    return PushSubscriptionOut(id=row.id)


@router.delete(
    "/push/subscriptions/{subscription_id}",
    status_code=204,
    responses={**UNAUTHORIZED, **NOT_FOUND, **SERVER_ERROR},
)
async def delete_push_subscription(
    subscription_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    row = await session.get(PushSubscription, subscription_id)
    # Another user's device is a plain 404, as if it didn't exist.
    if row is None or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="No such subscription.")
    await session.delete(row)
    await session.commit()
    return Response(status_code=204)
