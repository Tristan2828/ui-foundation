"""The MCP tools (issue #132), generated from `ENTITIES` (app/mcp_entities.py).

fetch(url), search(query), list(entity, filters), create(entity, fields),
update(url, fields). No delete. Every answer is text a chat can read;
a refusal (an unknown record, a field the API would reject) is raised as
`ToolError` and goes back as a tool result marked as an error, with the
field errors in words, so the chat can fix its call and try again.

Writes go through the entity's own router function, so validation, the
per-user scoping and the 404 for another user's record are the API's. Each
write is then logged in `mcp_audit_log`: who, when, which chat, and the
changed fields before and after.
"""

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, ValidationError
from sqlmodel.ext.asyncio.session import AsyncSession

from app.mcp_entities import ENTITIES, ListArgs, McpEntity
from app.models import McpAuditEntry, User
from app.schemas import CamelModel

DEFAULT_LIMIT = 20
MAX_LIMIT = 100
SEARCH_PER_ENTITY = 5
_ADDRESS = re.compile(r"^/(?P<entity>[a-z][a-z0-9-]*)/(?P<id>\d+)$")


class ToolError(Exception):
    """A refusal the chat should read and act on, not a server fault."""


@dataclass(frozen=True)
class Caller:
    user: User
    client_id: str


# ---------------------------------------------------------------- helpers


def _entity(name: Any) -> McpEntity:
    if isinstance(name, str) and name in ENTITIES:
        return ENTITIES[name]
    raise ToolError(f"Unknown entity {name!r}. Entities: {', '.join(ENTITIES)}.")


def _address(entity: McpEntity, record_id: int) -> str:
    return f"/{entity.name}/{record_id}"


def _parse_address(value: Any) -> tuple[McpEntity, int]:
    path = urlparse(value).path.rstrip("/") if isinstance(value, str) else ""
    # The API's own prefix is accepted so a copied request URL still works.
    path = path.removeprefix("/api")
    found = _ADDRESS.match(path)
    if found is None or found["entity"] not in ENTITIES:
        raise ToolError(
            f"{value!r} isn't a record address. Use /<entity>/<id>, e.g. /widgets/3. "
            f"Entities: {', '.join(ENTITIES)}."
        )
    return ENTITIES[found["entity"]], int(found["id"])


def _label(key: str) -> str:
    words = re.sub(r"(?<!^)(?=[A-Z])", " ", re.sub(r"Ids?$", "", key) or key).lower()
    return words[:1].upper() + words[1:]


def _error_lines(errors: list[Any]) -> list[str]:
    lines = []
    for error in errors:
        where = ".".join(str(part) for part in error["loc"] if part != "body")
        lines.append(f"{where}: {error['msg']}" if where else str(error["msg"]))
    return lines


def _as_dict(value: Any, what: str) -> dict[str, Any]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise ToolError(f"{what} must be an object.")
    return value


def _int(value: Any, what: str, default: int, low: int, high: int) -> int:
    if value is None:
        return default
    if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
        raise ToolError(f"{what} must be a whole number from {low} to {high}.")
    return value


def _dump(entity: McpEntity, record: Any) -> dict[str, Any]:
    return entity.out.model_validate(record).model_dump(mode="json", by_alias=True)


async def _record(session: AsyncSession, user: User, entity: McpEntity, record_id: int) -> Any:
    try:
        record = await entity.get(session, user, record_id)
    except HTTPException as exc:
        if exc.status_code != 404:
            raise
        record = None
    if record is None:
        raise ToolError(f"No {entity.singular} at {_address(entity, record_id)}.")
    return record


def _format_value(value: Any) -> str:
    if value is None:
        return "(not set)"
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, list):
        if not value:
            return "(none)"
        if all(isinstance(item, dict) for item in value):
            return "\n" + "\n".join(f"  - {json.dumps(item, ensure_ascii=False)}" for item in value)
        return ", ".join(str(item) for item in value)
    return str(value)


async def _render(session: AsyncSession, user: User, entity: McpEntity, data: dict[str, Any]) -> str:
    lines = [f"# {data[entity.title]}", f"Address: {_address(entity, data['id'])}"]
    for key, value in data.items():
        if key == "id":
            continue
        if key in entity.relations and value is not None:
            related = _entity(entity.relations[key])
            ids = value if isinstance(value, list) else [value]
            names = []
            for related_id in ids:
                try:
                    found = await related.get(session, user, related_id)
                except HTTPException:
                    found = None
                title = getattr(found, related.title) if found is not None else "(missing)"
                names.append(f"{title} ({_address(related, related_id)})")
            text = ", ".join(names) if names else "(none)"
        else:
            text = _format_value(value)
        lines.append(f"{_label(key)}:{text}" if text.startswith("\n") else f"{_label(key)}: {text}")
    return "\n".join(lines)


def _validate(schema: type[CamelModel], fields: dict[str, Any]) -> CamelModel:
    known = {info.alias or name for name, info in schema.model_fields.items()}
    known |= set(schema.model_fields)
    problems = [f"{key}: not a field of this entity" for key in fields if key not in known]
    model: CamelModel | None = None
    try:
        model = schema.model_validate(fields)
    except ValidationError as exc:
        problems += _error_lines(list(exc.errors()))
    if problems or model is None:
        raise ToolError("Nothing was saved.\n" + "\n".join(f"- {line}" for line in problems))
    return model


async def _audit(
    session: AsyncSession,
    caller: Caller,
    action: str,
    entity: McpEntity,
    record_id: int,
    before: dict[str, Any] | None,
    after: dict[str, Any],
) -> None:
    session.add(
        McpAuditEntry(
            user_id=caller.user.id or 0,
            client_id=caller.client_id,
            action=action,
            entity=entity.name,
            record_id=record_id,
            at=datetime.now(timezone.utc),
            before=None if before is None else json.dumps(before, ensure_ascii=False),
            after=json.dumps(after, ensure_ascii=False),
        )
    )
    await session.commit()


# ---------------------------------------------------------------- the tools


async def tool_fetch(session: AsyncSession, caller: Caller, args: dict[str, Any]) -> str:
    entity, record_id = _parse_address(args.get("url"))
    record = await _record(session, caller.user, entity, record_id)
    return await _render(session, caller.user, entity, _dump(entity, record))


def _list_line(entity: McpEntity, data: dict[str, Any]) -> str:
    extra = ", ".join(f"{_label(key).lower()}: {_format_value(data[key])}" for key in entity.summary)
    suffix = f" ({extra})" if extra else ""
    return f"- {data[entity.title]} — {_address(entity, data['id'])}{suffix}"


async def tool_search(session: AsyncSession, caller: Caller, args: dict[str, Any]) -> str:
    query = args.get("query")
    if not isinstance(query, str) or not query.strip():
        raise ToolError("query must be some text to look for.")
    sections = []
    for entity in ENTITIES.values():
        if not entity.searchable:
            continue
        items, total = await entity.list(
            session, caller.user, ListArgs(offset=0, limit=SEARCH_PER_ENTITY, sort=None, search=query.strip(), filters={})
        )
        if items:
            more = f" (showing {len(items)} of {total}; use list to see more)" if total > len(items) else ""
            lines = [_list_line(entity, _dump(entity, item)) for item in items]
            sections.append(f"{entity.name}{more}:\n" + "\n".join(lines))
    return "\n\n".join(sections) if sections else f"Nothing matches {query.strip()!r}."


async def tool_list(session: AsyncSession, caller: Caller, args: dict[str, Any]) -> str:
    entity = _entity(args.get("entity"))
    offset = _int(args.get("offset"), "offset", 0, 0, 1_000_000)
    limit = _int(args.get("limit"), "limit", DEFAULT_LIMIT, 1, MAX_LIMIT)
    search = args.get("search")
    if search is not None and not isinstance(search, str):
        raise ToolError("search must be text.")
    sort = args.get("sort")
    if sort is not None:
        choices = [f"{name}:{direction}" for name in entity.sorts for direction in ("asc", "desc")]
        if sort not in choices:
            allowed = ", ".join(choices) or "none (this entity has no sort)"
            raise ToolError(f"sort must be one of: {allowed}.")
    raw = _as_dict(args.get("filters"), "filters")
    filters: dict[str, Any] = {}
    if raw:
        if entity.filters is None:
            raise ToolError(f"{entity.name} has no filters.")
        try:
            parsed = entity.filters.model_validate(raw)
        except ValidationError as exc:
            raise ToolError("Filters not understood.\n" + "\n".join(f"- {line}" for line in _error_lines(list(exc.errors())))) from exc
        filters = parsed.model_dump(by_alias=True, exclude_unset=True)
    items, total = await entity.list(
        session, caller.user, ListArgs(offset=offset, limit=limit, sort=sort, search=search or None, filters=filters)
    )
    if not items:
        return f"No {entity.name} match." if total == 0 else f"No {entity.name} at offset {offset}; there are {total}."
    head = f"{entity.name} {offset + 1}–{offset + len(items)} of {total}:"
    return "\n".join([head, *(_list_line(entity, _dump(entity, item)) for item in items)])


async def tool_create(session: AsyncSession, caller: Caller, args: dict[str, Any]) -> str:
    entity = _entity(args.get("entity"))
    if entity.create is None or entity.create_schema is None:
        raise ToolError(f"{entity.name} can't be created through MCP.")
    payload = _validate(entity.create_schema, _as_dict(args.get("fields"), "fields"))
    try:
        created = await entity.create(session, caller.user, payload)
    except RequestValidationError as exc:
        raise ToolError("Nothing was saved.\n" + "\n".join(f"- {line}" for line in _error_lines(list(exc.errors())))) from exc
    # The router committed, which expired the user the later reads scope by.
    await session.refresh(caller.user)
    data = _dump(entity, created)
    text = await _render(session, caller.user, entity, data)
    await _audit(session, caller, "create", entity, data["id"], None, data)
    return f"Created {entity.singular} {_address(entity, data['id'])}.\n\n{text}"


async def tool_update(session: AsyncSession, caller: Caller, args: dict[str, Any]) -> str:
    entity, record_id = _parse_address(args.get("url"))
    if entity.update is None or entity.update_schema is None:
        raise ToolError(f"{entity.name} can't be changed through MCP.")
    fields = _as_dict(args.get("fields"), "fields")
    if not fields:
        raise ToolError("fields is empty; name at least one field to change.")
    record = await _record(session, caller.user, entity, record_id)
    before_all = _dump(entity, record)
    payload = _validate(entity.update_schema, fields)
    try:
        updated = await entity.update(session, caller.user, record_id, payload)
    except RequestValidationError as exc:
        raise ToolError("Nothing was saved.\n" + "\n".join(f"- {line}" for line in _error_lines(list(exc.errors())))) from exc
    await session.refresh(caller.user)
    after_all = _dump(entity, updated)
    changed = [key for key in after_all if after_all[key] != before_all.get(key)]
    text = await _render(session, caller.user, entity, after_all)
    await _audit(
        session,
        caller,
        "update",
        entity,
        record_id,
        {key: before_all.get(key) for key in changed},
        {key: after_all[key] for key in changed},
    )
    summary = f"Changed {', '.join(changed)}." if changed else "Nothing changed; the record already had these values."
    return f"Updated {entity.singular} {_address(entity, record_id)}. {summary}\n\n{text}"


# ------------------------------------------------------------ definitions


def _type_of(prop: dict[str, Any], defs: dict[str, Any]) -> str:
    if "$ref" in prop:
        return _type_of(defs[prop["$ref"].rsplit("/", 1)[-1]], defs)
    if "anyOf" in prop:
        parts = [_type_of(p, defs) for p in prop["anyOf"] if p.get("type") != "null"]
        return " or ".join(parts) + (" or null" if any(p.get("type") == "null" for p in prop["anyOf"]) else "")
    if "enum" in prop:
        return "one of " + "|".join(str(v) for v in prop["enum"])
    kind: str = prop.get("type", "any")
    if kind == "array":
        return f"list of {_type_of(prop.get('items', {}), defs)}"
    if kind == "object":
        inner = ", ".join(f"{k}: {_type_of(v, defs)}" for k, v in prop.get("properties", {}).items())
        return "{" + inner + "}"
    if prop.get("format"):
        kind = f"{kind} ({prop['format']})"
    if "pattern" in prop:
        kind += f" matching {prop['pattern']}"
    return kind


def _describe_fields(schema: type[BaseModel], only_required: bool) -> str:
    json_schema = schema.model_json_schema(by_alias=True)
    defs = json_schema.get("$defs", {})
    required = set(json_schema.get("required", []))
    parts = []
    for name, prop in json_schema["properties"].items():
        note = ", required" if name in required and not only_required else ""
        parts.append(f"{name} ({_type_of(prop, defs)}{note})")
    return "; ".join(parts)


def tool_definitions() -> list[dict[str, Any]]:
    names = list(ENTITIES)
    creatable = [e for e in ENTITIES.values() if e.create is not None and e.create_schema is not None]
    changeable = [e for e in ENTITIES.values() if e.update is not None and e.update_schema is not None]
    filterable = [e for e in ENTITIES.values() if e.filters is not None]
    read_only = {"readOnlyHint": True, "openWorldHint": False}
    write = {"readOnlyHint": False, "destructiveHint": False, "openWorldHint": False}
    tools: list[dict[str, Any]] = [
        {
            "name": "fetch",
            "title": "Fetch a record",
            "description": (
                "Read one record by its address in the app (/<entity>/<id>, e.g. /widgets/3, or the full "
                "link): its fields, with the titles of the records it points at."
            ),
            "inputSchema": {
                "type": "object",
                "properties": {"url": {"type": "string", "description": "The record's address or link."}},
                "required": ["url"],
            },
            "annotations": {**read_only, "title": "Fetch a record"},
        },
        {
            "name": "search",
            "title": "Search records",
            "description": "Find records whose title contains some text, across every entity: " + ", ".join(names) + ".",
            "inputSchema": {
                "type": "object",
                "properties": {"query": {"type": "string", "description": "Text to look for."}},
                "required": ["query"],
            },
            "annotations": {**read_only, "title": "Search records"},
        },
        {
            "name": "list",
            "title": "List records",
            "description": (
                "Page through one entity's records, optionally filtered, sorted and searched by title. "
                + " ".join(
                    f"{e.name} filters: {_describe_fields(e.filters, True)}." for e in filterable if e.filters is not None
                )
                + " "
                + " ".join(f"{e.name} sorts: {', '.join(e.sorts)} (each as field:asc or field:desc)." for e in ENTITIES.values() if e.sorts)
            ).strip(),
            "inputSchema": {
                "type": "object",
                "properties": {
                    "entity": {"type": "string", "enum": names},
                    "filters": {"type": "object", "description": "Field filters for the entity (see above)."},
                    "search": {"type": "string", "description": "Text the title contains."},
                    "sort": {"type": "string", "description": "field:asc or field:desc"},
                    "offset": {"type": "integer", "minimum": 0},
                    "limit": {"type": "integer", "minimum": 1, "maximum": MAX_LIMIT, "description": f"Default {DEFAULT_LIMIT}."},
                },
                "required": ["entity"],
            },
            "annotations": {**read_only, "title": "List records"},
        },
    ]
    if creatable:
        tools.append(
            {
                "name": "create",
                "title": "Create a record",
                "description": (
                    "Create a record, checked exactly as the app's own form is. If a field is refused the "
                    "answer says which and why; nothing is saved. "
                    + " ".join(f"{e.name}: {_describe_fields(e.create_schema, False)}." for e in creatable if e.create_schema is not None)
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "entity": {"type": "string", "enum": [e.name for e in creatable]},
                        "fields": {"type": "object", "description": "The record's fields, named as above."},
                    },
                    "required": ["entity", "fields"],
                },
                "annotations": {**write, "idempotentHint": False, "title": "Create a record"},
            }
        )
    if changeable:
        tools.append(
            {
                "name": "update",
                "title": "Change a record",
                "description": (
                    "Change some fields of a record; fields left out keep their value. Checked as the app's "
                    "own form is. There is no delete. "
                    + " ".join(f"{e.name}: {_describe_fields(e.update_schema, True)}." for e in changeable if e.update_schema is not None)
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "url": {"type": "string", "description": "The record's address (/<entity>/<id>)."},
                        "fields": {"type": "object", "description": "Only the fields to change."},
                    },
                    "required": ["url", "fields"],
                },
                "annotations": {**write, "idempotentHint": True, "title": "Change a record"},
            }
        )
    return tools


HANDLERS = {
    "fetch": tool_fetch,
    "search": tool_search,
    "list": tool_list,
    "create": tool_create,
    "update": tool_update,
}


async def call_tool(session: AsyncSession, caller: Caller, name: str, args: dict[str, Any]) -> str | None:
    """The tool's text, or None if there is no such tool."""
    handler = HANDLERS.get(name)
    if handler is None or name not in {tool["name"] for tool in tool_definitions()}:
        return None
    text: str = await handler(session, caller, args)
    return text
