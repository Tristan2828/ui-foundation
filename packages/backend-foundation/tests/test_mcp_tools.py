"""The MCP tools against the package alone (#230): an app's entities are
registered (`register_entities`), checked, and the tools are generated
from them and call their functions. A stand-in entity here, kept in a
list, with no table of its own; the OAuth sign-in and /mcp over HTTP, and
a real entity's create, update, delete and audit rows, are the template's
tests/test_mcp.py, through its own entities.
"""

from collections.abc import Iterator
from dataclasses import replace
from typing import Any

import pytest
from fastapi import HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession

from foundation_backend import mcp, mcp_tools
from foundation_backend.mcp import ListArgs, McpEntity, check_entities, register_entities
from foundation_backend.mcp_tools import Caller, ToolError, call_tool, tool_definitions
from foundation_backend.models import User
from foundation_backend.routers import mcp as mcp_router
from foundation_backend.schemas import CamelModel


class NoteOut(CamelModel):
    id: int
    title: str
    pinned: bool


NOTES = [NoteOut(id=1, title="Shopping", pinned=True), NoteOut(id=2, title="Garden plan", pinned=False)]


async def _get(_session: AsyncSession, _user: User, record_id: int) -> NoteOut:
    for note in NOTES:
        if note.id == record_id:
            return note
    raise HTTPException(status_code=404)


async def _list(_session: AsyncSession, _user: User, args: ListArgs) -> tuple[list[Any], int]:
    found = [note for note in NOTES if not args.search or args.search.lower() in note.title.lower()]
    return found[args.offset : args.offset + args.limit], len(found)


NOTE = McpEntity(name="notes", singular="note", out=NoteOut, title="title", get=_get, list=_list, summary=("pinned",))


@pytest.fixture(autouse=True)
def registry() -> Iterator[None]:
    """Each test registers its own; the registry is emptied after."""
    yield
    mcp.ENTITIES.clear()


@pytest.fixture
def caller() -> Caller:
    return Caller(user=User(id=1, email="test@example.com", name="Test User", password_hash="unused"), client_id="chat")


def test_register_entities_checks_them_and_hands_them_to_the_tools() -> None:
    register_entities({"notes": NOTE})
    # The tools hold the registry itself, so they see what's registered.
    assert mcp_tools.ENTITIES is mcp.ENTITIES
    assert list(mcp_tools.ENTITIES) == ["notes"]
    with pytest.raises(ValueError, match="registered as"):
        register_entities({"memos": NOTE})
    # A refused registration leaves the last good one.
    assert list(mcp.ENTITIES) == ["notes"]


def test_check_entities_refuses_addresses_that_cant_be_told_apart() -> None:
    with pytest.raises(ValueError, match="share the address"):
        check_entities({"notes": NOTE, "memos": replace(NOTE, name="memos", path="/notes")})
    with pytest.raises(ValueError, match="under /api"):
        check_entities({"notes": replace(NOTE, path="/api/notes")})


def test_a_read_only_entity_gets_read_tools_only() -> None:
    register_entities({"notes": NOTE})
    names = {tool["name"] for tool in tool_definitions()}
    assert {"fetch", "search", "list"} <= names
    assert names.isdisjoint({"create", "update", "delete", "restore"})


async def test_the_tools_call_the_entitys_own_functions(session: AsyncSession, caller: Caller) -> None:
    register_entities({"notes": NOTE})
    listed = await call_tool(session, caller, "list", {"entity": "notes"})
    assert listed is not None and listed.startswith("notes 1–2 of 2:")
    assert "Shopping" in listed and "Garden plan" in listed
    fetched = await call_tool(session, caller, "fetch", {"url": "/notes/2"})
    assert fetched is not None and "Garden plan" in fetched
    # A write tool the entity doesn't offer isn't a tool at all.
    assert await call_tool(session, caller, "create", {"entity": "notes", "fields": {}}) is None


async def test_an_unknown_entity_is_a_refusal_naming_the_ones_there_are(session: AsyncSession, caller: Caller) -> None:
    register_entities({"notes": NOTE})
    with pytest.raises(ToolError, match="Entities: notes"):
        await call_tool(session, caller, "list", {"entity": "widgets"})


class ShelfOut(CamelModel):
    id: int
    shelf_name: str


class BookOut(CamelModel):
    id: int
    title: str
    shelf_id: int


SHELF = McpEntity(
    name="shelves",
    singular="shelf",
    out=ShelfOut,
    title="shelfName",
    get=lambda _s, _u, record_id: _found(ShelfOut(id=record_id, shelf_name="Top")),
    list=lambda _s, _u, _a: _found(([], 0)),
)
BOOK = McpEntity(
    name="books",
    singular="book",
    out=BookOut,
    title="title",
    get=lambda _s, _u, record_id: _found(BookOut(id=record_id, title="Dune", shelf_id=3)),
    list=lambda _s, _u, _a: _found(([], 0)),
    relations={"shelfId": "shelves"},
)


async def _found(value: Any) -> Any:
    return value


class NoteFilters(CamelModel):
    pinned: bool


async def test_a_related_records_camel_case_title_is_read_by_its_wire_name(session: AsyncSession, caller: Caller) -> None:
    # A title like "shelfName" is the out field's wire name; the related
    # record is an out model, whose attribute is shelf_name.
    register_entities({"books": BOOK, "shelves": SHELF})
    fetched = await call_tool(session, caller, "fetch", {"url": "/books/1"})
    assert fetched is not None and "Shelf: Top (/shelves/3)" in fetched, fetched


async def test_a_required_filter_left_out_is_a_refusal(session: AsyncSession, caller: Caller) -> None:
    register_entities({"notes": replace(NOTE, filters=NoteFilters)})
    with pytest.raises(ToolError, match="Filters not understood.\n- pinned"):
        await call_tool(session, caller, "list", {"entity": "notes"})


async def test_an_error_in_an_entity_is_a_failed_tool_naming_it(session: AsyncSession, caller: Caller, monkeypatch: pytest.MonkeyPatch) -> None:
    # Not a 500 (a chat's connector says only "isn't responding"): the
    # tool fails with the error's class and message, and it is reported.
    reported: list[BaseException] = []
    monkeypatch.setattr(mcp_router, "report_error", lambda exc, _context: reported.append(exc))

    async def _broken(_session: AsyncSession, _user: User, _record_id: int) -> NoteOut:
        raise AttributeError("'NoteOut' object has no attribute 'shelf'")

    register_entities({"notes": replace(NOTE, get=_broken)})
    message = {"jsonrpc": "2.0", "id": 7, "method": "tools/call", "params": {"name": "fetch", "arguments": {"url": "/notes/1"}}}
    answer = await mcp_router._handle(message, caller, session)
    assert answer is not None and answer["result"]["isError"] is True
    text = answer["result"]["content"][0]["text"]
    assert text == "The fetch tool failed with an error in the app: AttributeError: 'NoteOut' object has no attribute 'shelf'"
    assert len(reported) == 1 and isinstance(reported[0], AttributeError)
