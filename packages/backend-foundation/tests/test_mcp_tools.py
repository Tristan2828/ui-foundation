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
