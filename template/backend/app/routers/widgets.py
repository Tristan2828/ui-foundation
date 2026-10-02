"""/widgets — see openapi.yaml operationIds listWidgets, createWidget,
getWidget, updateWidget, deleteWidget. One router, no service layer on
purpose: stop and write docs/BLOCKERS.md rather than growing a router past
~60 lines.
"""

from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.exceptions import RequestValidationError
from sqlalchemy import func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db import get_session
from app.models import Category, User, Widget, WidgetExtraCategoryLink, WidgetStatus, WidgetTag, WidgetTagLink
from app.openapi_responses import (
    CREATE_RESPONSES,
    DELETE_RESPONSES,
    GET_RESPONSES,
    LIST_RESPONSES,
    UPDATE_RESPONSES,
)
from app.routers.auth import get_current_user
from app.schemas import Page, WidgetCreate, WidgetOut, WidgetUpdate

router = APIRouter(tags=["widgets"], dependencies=[Depends(get_current_user)])

SORT_COLUMNS: dict[str, Any] = {
    "name": Widget.name,
    "status": Widget.status,
    "availableFrom": Widget.available_from,
    "price": Widget.price,
}


async def _check_categories_exist(ids: list[int], session: AsyncSession) -> None:
    # A multi reference to a missing record is a field error, the same 422
    # shape as any other (openapi.yaml), never a foreign-key 500 at commit.
    if not ids:
        return
    found = set((await session.exec(select(Category.id).where(col(Category.id).in_(ids)))).all())
    if missing := [i for i in ids if i not in found]:
        raise RequestValidationError(
            [{"loc": ("body", "extraCategoryIds"), "msg": f"unknown category ids: {missing}", "type": "value_error.foreign_key"}]
        )


async def _get_or_404(widget_id: int, user: User, session: AsyncSession) -> Widget:
    widget = await session.get(Widget, widget_id)
    # Someone else's widget is indistinguishable from a missing one — a 403
    # would confirm the id exists.
    if widget is None or widget.owner_id != user.id:
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
    tags: list[WidgetTag] | None = Query(default=None),
    inStock: bool | None = None,
    extraCategoryIds: list[int] | None = Query(default=None),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Page[Widget]:
    stmt = select(Widget).where(Widget.owner_id == user.id)
    if status is not None:
        stmt = stmt.where(Widget.status == status)
    if categoryId is not None:
        stmt = stmt.where(Widget.category_id == categoryId)
    if search is not None:
        stmt = stmt.where(func.lower(Widget.name).contains(search.lower()))
    if tags:
        # Any of the given tags (openapi.yaml) — a subquery on the join
        # table, identical on Postgres and SQLite.
        tagged = select(WidgetTagLink.widget_id).where(col(WidgetTagLink.tag).in_(tags))
        stmt = stmt.where(col(Widget.id).in_(tagged))
    if inStock is not None:
        stmt = stmt.where(Widget.in_stock == inStock)
    if extraCategoryIds:
        linked = select(WidgetExtraCategoryLink.widget_id).where(
            col(WidgetExtraCategoryLink.category_id).in_(extraCategoryIds)
        )
        stmt = stmt.where(col(Widget.id).in_(linked))
    total = (await session.exec(select(func.count()).select_from(stmt.subquery()))).one()
    if sort is not None:
        field, direction = sort.split(":")
        column = SORT_COLUMNS[field]
        stmt = stmt.order_by(column.desc() if direction == "desc" else column.asc())
    stmt = stmt.offset(offset).limit(limit)
    items = (await session.exec(stmt)).all()
    return Page(items=list(items), total=total)


@router.post("/widgets", response_model=WidgetOut, status_code=201, responses=CREATE_RESPONSES)
async def create_widget(
    payload: WidgetCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Widget:
    await _check_categories_exist(payload.extra_category_ids, session)
    widget = Widget(
        **payload.model_dump(exclude={"price", "tags", "extra_category_ids", "checklist"}),
        price=Decimal(payload.price),
        owner_id=user.id,
    )
    widget.set_tags(payload.tags)
    widget.set_extra_category_ids(payload.extra_category_ids)
    widget.set_checklist([(item.text, item.done) for item in payload.checklist])
    session.add(widget)
    await session.commit()
    await session.refresh(widget)
    return widget


@router.get("/widgets/{widget_id}", response_model=WidgetOut, responses=GET_RESPONSES)
async def get_widget(
    widget_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Widget:
    return await _get_or_404(widget_id, user, session)


@router.patch("/widgets/{widget_id}", response_model=WidgetOut, responses=UPDATE_RESPONSES)
async def update_widget(
    widget_id: int,
    payload: WidgetUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Widget:
    widget = await _get_or_404(widget_id, user, session)
    updates = payload.model_dump(exclude_unset=True)
    if "tags" in updates:
        # Sent → replaces the whole set ([] clears it); omitted → unchanged.
        widget.set_tags(updates.pop("tags") or [])
    if "extra_category_ids" in updates:
        ids = updates.pop("extra_category_ids")
        await _check_categories_exist(ids, session)
        widget.set_extra_category_ids(ids)
    if "checklist" in updates:
        updates.pop("checklist")
        widget.set_checklist([(item.text, item.done) for item in payload.checklist or []])
    if "price" in updates:
        updates["price"] = Decimal(updates["price"])
    for field, value in updates.items():
        setattr(widget, field, value)
    session.add(widget)
    await session.commit()
    await session.refresh(widget)
    return widget


@router.delete("/widgets/{widget_id}", status_code=204, responses=DELETE_RESPONSES)
async def delete_widget(
    widget_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    widget = await _get_or_404(widget_id, user, session)
    await session.delete(widget)
    await session.commit()
    return Response(status_code=204)
