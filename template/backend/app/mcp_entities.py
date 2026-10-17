"""The entities an AI chat can reach through MCP (issue #132), described
once, the way EntityView and EntityForm describe them on screen. The tools
in app/mcp_tools.py are generated from `ENTITIES`; they hold no entity
names of their own.

Each entry points at the entity's own router functions, so a chat's create
and update go through exactly the validation the API applies, and every
read is scoped to the signed-in user the same way. An entity with no
`create` or `update` is read-only to chats. There is no delete.

Adding an entity: one `McpEntity` below (docs/foundation/add-an-entity.md).
"""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel, ConfigDict
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import User, Widget, WidgetCategory, WidgetChecklistState, WidgetStatus, WidgetTag
from app.routers import widget_categories as widget_categories_router
from app.routers import widgets as widgets_router
from app.schemas import CamelModel, WidgetCategoryOut, WidgetCreate, WidgetOut, WidgetUpdate


@dataclass(frozen=True)
class ListArgs:
    offset: int
    limit: int
    sort: str | None
    search: str | None
    filters: dict[str, Any]


@dataclass(frozen=True)
class McpEntity:
    # The URL segment: the record's address is /<name>/<id>.
    name: str
    # What the entity is called in a sentence ("widget").
    singular: str
    out: type[CamelModel]
    # The out field that names a record.
    title: str
    get: Callable[[AsyncSession, User, int], Awaitable[Any]]
    list: Callable[[AsyncSession, User, ListArgs], Awaitable[tuple[list[Any], int]]]
    # Fields (by wire name) shown beside the title in a list.
    summary: tuple[str, ...] = ()
    # `search` finds records by their title.
    searchable: bool = True
    # `list`'s `filters`, validated before the list runs; None means none.
    filters: type[BaseModel] | None = None
    # `list`'s `sort`, e.g. ("name", "price"); each as "field:asc|desc".
    sorts: tuple[str, ...] = ()
    # Wire names of fields holding another entity's ids, to that entity's name:
    # `fetch` prints the records' titles beside the ids.
    relations: dict[str, str] = field(default_factory=dict)
    create_schema: type[CamelModel] | None = None
    create: Callable[[AsyncSession, User, Any], Awaitable[Any]] | None = None
    update_schema: type[CamelModel] | None = None
    update: Callable[[AsyncSession, User, int, Any], Awaitable[Any]] | None = None


class WidgetFilters(CamelModel):
    model_config = ConfigDict(extra="forbid")

    status: WidgetStatus | None = None
    category_id: int | None = None
    tags: list[WidgetTag] | None = None
    in_stock: bool | None = None
    checklist_state: WidgetChecklistState | None = None
    extra_category_ids: list[int] | None = None


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
