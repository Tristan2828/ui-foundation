"""GET /categories — see openapi.yaml operationId listCategories."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db import get_session
from app.models import Category
from app.openapi_responses import SERVER_ERROR
from app.schemas import CategoryOut

router = APIRouter(tags=["categories"])


@router.get("/categories", response_model=list[CategoryOut], responses=SERVER_ERROR)
async def list_categories(
    search: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
) -> list[Category]:
    stmt = select(Category)
    if search is not None:
        stmt = stmt.where(func.lower(Category.name).contains(search.lower()))
    stmt = stmt.limit(limit)
    result = await session.exec(stmt)
    return list(result.all())
