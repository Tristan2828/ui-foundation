"""/widgets — see openapi.yaml operationIds listWidgets, createWidget,
getWidget, updateWidget, deleteWidget. One router, no service layer (see
docs/BUILD-PLAN.md Phase 8 minimalism warning: stop and write
docs/BLOCKERS.md rather than growing this past ~60 lines).
"""

from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db import get_session
from app.models import Widget, WidgetStatus
from app.openapi_responses import (
    CREATE_RESPONSES,
    DELETE_RESPONSES,
    GET_RESPONSES,
    LIST_RESPONSES,
    UPDATE_RESPONSES,
)
from app.schemas import Page, WidgetCreate, WidgetOut, WidgetUpdate

router = APIRouter(tags=["widgets"])

SORT_COLUMNS: dict[str, Any] = {
    "name": Widget.name,
    "status": Widget.status,
    "availableFrom": Widget.available_from,
    "price": Widget.price,
}


async def _get_or_404(widget_id: int, session: AsyncSession) -> Widget:
    widget = await session.get(Widget, widget_id)
    if widget is None:
        raise HTTPException(status_code=404, detail="Widget not found")
    return widget


@router.get("/widgets", response_model=Page[WidgetOut], responses=LIST_RESPONSES)
async def list_widgets(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    sort: str | None = Query(default=None, pattern=r"^(name|status|availableFrom|price):(asc|desc)$"),
    status: WidgetStatus | None = None,
    categoryId: int | None = None,
    search: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> Page[Widget]:
    stmt = select(Widget)
    if status is not None:
        stmt = stmt.where(Widget.status == status)
    if categoryId is not None:
        stmt = stmt.where(Widget.category_id == categoryId)
    if search is not None:
        stmt = stmt.where(func.lower(Widget.name).contains(search.lower()))
    total = (await session.exec(select(func.count()).select_from(stmt.subquery()))).one()
    if sort is not None:
        field, direction = sort.split(":")
        column = SORT_COLUMNS[field]
        stmt = stmt.order_by(column.desc() if direction == "desc" else column.asc())
    stmt = stmt.offset(offset).limit(limit)
    items = (await session.exec(stmt)).all()
    return Page(items=list(items), total=total)


@router.post("/widgets", response_model=WidgetOut, status_code=201, responses=CREATE_RESPONSES)
async def create_widget(payload: WidgetCreate, session: AsyncSession = Depends(get_session)) -> Widget:
    widget = Widget(**payload.model_dump(exclude={"price"}), price=Decimal(payload.price))
    session.add(widget)
    await session.commit()
    await session.refresh(widget)
    return widget


@router.get("/widgets/{widget_id}", response_model=WidgetOut, responses=GET_RESPONSES)
async def get_widget(widget_id: int, session: AsyncSession = Depends(get_session)) -> Widget:
    return await _get_or_404(widget_id, session)


@router.patch("/widgets/{widget_id}", response_model=WidgetOut, responses=UPDATE_RESPONSES)
async def update_widget(
    widget_id: int, payload: WidgetUpdate, session: AsyncSession = Depends(get_session)
) -> Widget:
    widget = await _get_or_404(widget_id, session)
    updates = payload.model_dump(exclude_unset=True)
    if "price" in updates:
        updates["price"] = Decimal(updates["price"])
    for field, value in updates.items():
        setattr(widget, field, value)
    session.add(widget)
    await session.commit()
    await session.refresh(widget)
    return widget


@router.delete("/widgets/{widget_id}", status_code=204, responses=DELETE_RESPONSES)
async def delete_widget(widget_id: int, session: AsyncSession = Depends(get_session)) -> Response:
    widget = await _get_or_404(widget_id, session)
    await session.delete(widget)
    await session.commit()
    return Response(status_code=204)
