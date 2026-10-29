"""The entities an AI chat can reach through MCP (issue #132), described
once, the way EntityView and EntityForm describe them on screen. The tools
(foundation_backend.mcp_tools, #230) are generated from `ENTITIES`; they
hold no entity names of their own. `McpEntity` says what each field
means.

Each entry points at the entity's own router functions, so a chat's create
and update go through exactly the validation the API applies, and every
read is scoped to the signed-in user the same way. An entity with no
`create` or `update` is read-only to chats. A chat can delete only an entity
that deletes softly (`delete` and `restore` below, issue #137): the record is
marked, not removed, and `restore` brings it back. An entity that deletes for
good gets no delete tool, so a chat that read planted instructions can't
destroy data a backup alone would return.

Adding an entity: one `McpEntity` below (docs/foundation/add-an-entity.md).
"""

from typing import Any

from pydantic import ConfigDict
from sqlmodel.ext.asyncio.session import AsyncSession

from foundation_backend.mcp import ListArgs, McpEntity, register_entities

from app.models import User, Widget, WidgetCategory, WidgetChecklistState, WidgetStatus, WidgetTag
from app.routers import widget_categories as widget_categories_router
from app.routers import widgets as widgets_router
from app.schemas import CamelModel, WidgetCategoryOut, WidgetCreate, WidgetOut, WidgetUpdate


class WidgetFilters(CamelModel):
    model_config = ConfigDict(extra="forbid")

    status: WidgetStatus | None = None
    category_id: int | None = None
    tags: list[WidgetTag] | None = None
    in_stock: bool | None = None
    checklist_state: WidgetChecklistState | None = None
    extra_category_ids: list[int] | None = None
    # True lists only the deleted widgets, to find one to restore.
    deleted: bool | None = None


async def _get_widget(session: AsyncSession, user: User, record_id: int) -> Widget:
    return await widgets_router.get_widget(record_id, user, session)


async def _list_widgets(session: AsyncSession, user: User, args: ListArgs) -> tuple[list[Any], int]:
    # Every parameter passed: the router's defaults are Query() markers,
    # meant for FastAPI to resolve, not for a direct call.
    params: dict[str, Any] = {
        "status": None,
        "categoryId": None,
        "tags": None,
        "inStock": None,
        "checklistState": None,
        "extraCategoryIds": None,
        "deleted": False,
        **args.filters,
    }
    page = await widgets_router.list_widgets(
        offset=args.offset,
        limit=args.limit,
        sort=args.sort,
        search=args.search,
        user=user,
        session=session,
        **params,
    )
    return list(page.items), page.total


async def _create_widget(session: AsyncSession, user: User, payload: WidgetCreate) -> Widget:
    return await widgets_router.create_widget(payload, user, session)


async def _update_widget(session: AsyncSession, user: User, record_id: int, payload: WidgetUpdate) -> Widget:
    return await widgets_router.update_widget(record_id, payload, user, session)


async def _delete_widget(session: AsyncSession, user: User, record_id: int) -> None:
    await widgets_router.delete_widget(record_id, user, session)


async def _restore_widget(session: AsyncSession, user: User, record_id: int) -> Widget:
    return await widgets_router.restore_widget(record_id, user, session)


async def _get_category(session: AsyncSession, _: User, record_id: int) -> WidgetCategory | None:
    return await session.get(WidgetCategory, record_id)


async def _list_categories(session: AsyncSession, _: User, args: ListArgs) -> tuple[list[Any], int]:
    # The API lists categories by name search and limit only (the form's
    # picker); paging here is over the first 100.
    found = await widget_categories_router.list_widget_categories(
        search=args.search, ids=None, limit=100, session=session
    )
    return found[args.offset : args.offset + args.limit], len(found)


ENTITIES: dict[str, McpEntity] = {
    entity.name: entity
    for entity in (
        McpEntity(
            name="widgets",
            singular="widget",
            out=WidgetOut,
            title="name",
            get=_get_widget,
            list=_list_widgets,
            summary=("status", "price"),
            filters=WidgetFilters,
            sorts=("name", "status", "availableFrom", "price", "checklistState"),
            relations={"categoryId": "widget-categories", "extraCategoryIds": "widget-categories"},
            create_schema=WidgetCreate,
            create=_create_widget,
            update_schema=WidgetUpdate,
            update=_update_widget,
            delete=_delete_widget,
            restore=_restore_widget,
        ),
        McpEntity(
            name="widget-categories",
            singular="widget category",
            out=WidgetCategoryOut,
            title="name",
            get=_get_category,
            list=_list_categories,
        ),
    )
}

# Checked (foundation_backend.mcp.check_entities) and handed to the tools.
register_entities(ENTITIES)
