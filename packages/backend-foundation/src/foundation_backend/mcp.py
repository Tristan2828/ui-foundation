"""What an AI chat can reach through MCP (issues #132, #230): `McpEntity`,
one per entity an app hands to chats, and the registry the tools
(mcp_tools.py) are generated from. An app describes its entities in its
own `app/mcp_entities.py` and calls `register_entities` once, at import.

Each entry points at the entity's own router functions, so a chat's create
and update go through exactly the validation the API applies, and every
read is scoped to the signed-in user the same way. An entity with no
`create` or `update` is read-only to chats. A chat can delete only an entity
that deletes softly (`delete` and `restore`, issue #137): the record is
marked, not removed, and `restore` brings it back. An entity that deletes for
good gets no delete tool, so a chat that read planted instructions can't
destroy data a backup alone would return.
"""

import re
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from foundation_backend.models import User
from foundation_backend.schemas import CamelModel


@dataclass(frozen=True)
class ListArgs:
    offset: int
    limit: int
    sort: str | None
    search: str | None
    filters: dict[str, Any]


@dataclass(frozen=True)
class McpEntity:
    # The entity's name in tools, and its API's URL segment (/api/<name>/<id>)
    # unless `api_path` says otherwise.
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
    # Wire names of fields the API takes from an importer or another script,
    # never from a chat (a source record's id that a re-run matches on).
    # Chats read them; `create` and `update` refuse a call naming one, and
    # the tool descriptions leave them out.
    script_only: tuple[str, ...] = ()
    # Where the record's page is in the app, before /<id>: "/media/channels"
    # for an app that groups screens under a section. Empty means /<name>.
    # The address a chat pastes and the one the tools hand back.
    path: str = ""
    # Where the record is in the API, before /<id>: "/api/media/channels" for
    # an API grouped by module. Empty means /api/<name>. Read only from a
    # pasted address, so a copied request URL works too.
    api_path: str = ""

    @property
    def page_path(self) -> str:
        return self.path or f"/{self.name}"

    @property
    def api_base(self) -> str:
        return self.api_path or f"/api/{self.name}"


_PATH = re.compile(r"^(/[a-z0-9][a-z0-9-]*)+$")


def _check_path(entity: McpEntity, option: str, value: str, example: str) -> None:
    if not _PATH.match(value):
        raise ValueError(
            f"MCP entity {entity.name!r}: {option} {value!r} must be lowercase segments, "
            f"each after a /, with no trailing / (e.g. {example})."
        )


def _wire_names(schema: type[CamelModel] | None) -> set[str]:
    return set() if schema is None else {info.alias or name for name, info in schema.model_fields.items()}


def _check_script_only(entity: McpEntity) -> None:
    writable = _wire_names(entity.create_schema) | _wire_names(entity.update_schema)
    for name in entity.script_only:
        if name not in writable:
            raise ValueError(
                f"MCP entity {entity.name!r}: script_only {name!r} isn't a field of its create or update "
                f"schema (by its wire name, e.g. categoryId)."
            )
        schema = entity.create_schema
        if schema is not None and any(
            (info.alias or key) == name and info.is_required() for key, info in schema.model_fields.items()
        ):
            raise ValueError(
                f"MCP entity {entity.name!r}: script_only {name!r} is required to create one, so a chat "
                f"never could; leave create off instead."
            )


def check_entities(entities: Mapping[str, McpEntity]) -> None:
    """Refuses, at startup, a registry whose addresses can't be told apart:
    a malformed path, two entities with the same page path or API path, a
    page path under /api, which is where the API's form of an address
    starts, or an API path outside it. And a `script_only` name that isn't
    a field a chat could otherwise write, or that create requires."""
    pages: dict[str, str] = {}
    apis: dict[str, str] = {}
    for key, entity in entities.items():
        if key != entity.name:
            raise ValueError(f"MCP entity {entity.name!r} is registered as {key!r}.")
        page = entity.page_path
        _check_path(entity, "path", page, "/media/channels")
        if page == "/api" or page.startswith("/api/"):
            raise ValueError(f"MCP entity {entity.name!r}: path {page!r} is under /api, the API's own addresses.")
        if page in pages:
            raise ValueError(f"MCP entities {pages[page]!r} and {entity.name!r} share the address {page}/<id>.")
        pages[page] = entity.name
        api = entity.api_base
        _check_path(entity, "api_path", api, "/api/media/channels")
        if not api.startswith("/api/"):
            raise ValueError(f"MCP entity {entity.name!r}: api_path {api!r} must be under /api/.")
        if api in apis:
            raise ValueError(f"MCP entities {apis[api]!r} and {entity.name!r} share the API address {api}/<id>.")
        apis[api] = entity.name
        _check_script_only(entity)


# The registered entities, by name: what the tools offer. One dict for the
# process, filled in place, so the tools (which hold it) see every
# registration and a test can swap it with monkeypatch.
ENTITIES: dict[str, McpEntity] = {}


def register_entities(entities: Mapping[str, McpEntity]) -> None:
    """Checks the app's entities (check_entities) and makes them the ones
    the tools offer, replacing any registered before."""
    check_entities(entities)
    ENTITIES.clear()
    ENTITIES.update(entities)
