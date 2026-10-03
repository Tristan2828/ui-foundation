"""GET /widget-categories — see openapi.yaml operationId listWidgetCategories."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db import get_session
from app.models import WidgetCategory
from app.openapi_responses import SERVER_ERROR, UNAUTHORIZED
from app.routers.auth import get_current_user
from app.schemas import WidgetCategoryOut

router = APIRouter(tags=["widget-categories"], dependencies=[Depends(get_current_user)])

LIST_RESPONSES = {**UNAUTHORIZED, **SERVER_ERROR}


@router.get("/widget-categories", response_model=list[WidgetCategoryOut], responses=LIST_RESPONSES)
async def list_widget_categories(
    search: str | None = None,
    ids: list[int] | None = Query(default=None, max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
) -> list[WidgetCategory]:
    stmt = select(WidgetCategory)
    if search is not None:
        stmt = stmt.where(func.lower(WidgetCategory.name).contains(search.lower()))
    if ids:
        # Exactly these (openapi.yaml): how a form names references it holds.
        stmt = stmt.where(col(WidgetCategory.id).in_(ids))
    stmt = stmt.limit(limit)
    result = await session.exec(stmt)
    return list(result.all())
