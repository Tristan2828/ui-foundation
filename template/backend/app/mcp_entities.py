"""The entities an AI chat can reach through MCP (issue #132), described
once, the way EntityView and EntityForm describe them on screen. The tools
in app/mcp_tools.py are generated from `ENTITIES`; they hold no entity
names of their own.

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

import re
from collections.abc import Awaitable, Callable, Mapping
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
    # The API's URL segment (/api/<name>/<id>), and the entity's name in tools.
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
    # Soft delete: `delete` marks a live record deleted, `restore` clears the
    # mark and returns the record. Set both or neither, and only for an
    # entity whose deletes are soft (a nullable deleted_at).
    delete: Callable[[AsyncSession, User, int], Awaitable[None]] | None = None
    restore: Callable[[AsyncSession, User, int], Awaitable[Any]] | None = None
    # Where the record's page is in the app, before /<id>: "/media/channels"
    # for an app that groups screens under a section. Empty means /<name>.
    # The address a chat pastes and the one the tools hand back.
    path: str = ""

    @property
    def page_path(self) -> str:
        return self.path or f"/{self.name}"


_PATH = re.compile(r"^(/[a-z0-9][a-z0-9-]*)+$")


def check_entities(entities: Mapping[str, McpEntity]) -> None:
    """Refuses, at startup, a registry whose addresses can't be told apart:
    a malformed path, or two entities with the same page path or API
    segment, or a page path under /api, which is where the API's form of an
    address starts."""
    pages: dict[str, str] = {}
    for key, entity in entities.items():
        if key != entity.name:
            raise ValueError(f"MCP entity {entity.name!r} is registered as {key!r}.")
        page = entity.page_path
        if not _PATH.match(page):
            raise ValueError(
                f"MCP entity {entity.name!r}: path {page!r} must be lowercase segments, "
                "each after a /, with no trailing / (e.g. /media/channels)."
            )
        if page == "/api" or page.startswith("/api/"):
            raise ValueError(f"MCP entity {entity.name!r}: path {page!r} is under /api, the API's own addresses.")
        if page in pages:
            raise ValueError(f"MCP entities {pages[page]!r} and {entity.name!r} share the address {page}/<id>.")
        pages[page] = entity.name


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

check_entities(ENTITIES)
