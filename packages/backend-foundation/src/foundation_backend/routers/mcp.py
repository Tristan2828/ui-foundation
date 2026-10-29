"""POST /mcp: the Model Context Protocol over streamable HTTP (issue #132),
so an AI chat (web, phone, desktop, CLI) can read and write the app's
records. Stdlib and FastAPI only. Off unless MCP_ENABLED (404 then).

Stateless JSON-RPC: every POST carries one message (or a batch) and gets
one JSON answer. There is no server-to-chat stream, so GET answers 405, as
the spec allows. The tools are mcp_tools.py's; the caller is the user
and chat an OAuth access token (foundation_backend.routers.oauth) belongs to, so a
chat sees and changes exactly what that user can.
"""

import json
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from sqlmodel.ext.asyncio.session import AsyncSession

from foundation_backend import config, rate_window
from foundation_backend.db import get_session
from foundation_backend.mcp_tools import Caller, ToolError, call_tool, tool_definitions
from foundation_backend.routers.oauth import authenticate_bearer, public_base, require_enabled

PROTOCOL_VERSIONS = ("2025-06-18", "2025-03-26", "2024-11-05")
MAX_BODY_BYTES = 1_000_000
INSTRUCTIONS = (
    "Records are addressed /<entity>/<id>. Use search or list to find them and fetch to read one. "
    "create and update are checked like the app's own forms: if a field is refused, the answer says why. "
    "Nothing can be deleted."
)

router = APIRouter(include_in_schema=False, dependencies=[Depends(require_enabled)])


def _rpc_error(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def _unauthorized(request: Request, description: str) -> HTTPException:
    metadata = f"{public_base(request)}/.well-known/oauth-protected-resource"
    return HTTPException(
        status_code=401,
        detail=description,
        headers={"WWW-Authenticate": f'Bearer resource_metadata="{metadata}"'},
    )


def _check_origin(request: Request) -> None:
    # A browser page on another site must not drive this endpoint (DNS
    # rebinding). The chats' servers send no Origin at all.
    origin = request.headers.get("origin")
    if origin is not None and urlparse(origin).netloc != urlparse(public_base(request)).netloc:
        raise HTTPException(status_code=403, detail="Origin not allowed.")


async def _handle(message: Any, caller: Caller, session: AsyncSession) -> dict[str, Any] | None:
    if not isinstance(message, dict) or message.get("jsonrpc") != "2.0":
        return _rpc_error(None, -32600, "Not a JSON-RPC 2.0 message.")
    method = message.get("method")
    if method is None or "id" not in message:
        # A notification (notifications/initialized, …) or a reply: nothing to say back.
        return None
    request_id = message["id"]
    params = message.get("params")
    params = params if isinstance(params, dict) else {}

    if method == "initialize":
        wanted = params.get("protocolVersion")
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "protocolVersion": wanted if wanted in PROTOCOL_VERSIONS else PROTOCOL_VERSIONS[0],
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": {"name": "app-records", "version": "1.0.0"},
                "instructions": INSTRUCTIONS,
            },
        }
    if method == "ping":
        return {"jsonrpc": "2.0", "id": request_id, "result": {}}
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": request_id, "result": {"tools": tool_definitions()}}
    if method == "tools/call":
        name = params.get("name")
        arguments = params.get("arguments")
        if not isinstance(name, str) or not (arguments is None or isinstance(arguments, dict)):
            return _rpc_error(request_id, -32602, "tools/call needs a name and an arguments object.")
        try:
            text = await call_tool(session, caller, name, arguments or {})
        except ToolError as exc:
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {"content": [{"type": "text", "text": str(exc)}], "isError": True},
            }
        if text is None:
            return _rpc_error(request_id, -32602, f"Unknown tool {name!r}.")
        return {"jsonrpc": "2.0", "id": request_id, "result": {"content": [{"type": "text", "text": text}]}}
    return _rpc_error(request_id, -32601, f"Method not found: {method}")


@router.post("/mcp")
async def mcp_endpoint(request: Request, session: AsyncSession = Depends(get_session)) -> Response:
    _check_origin(request)
    scheme, _, bearer = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not bearer.strip():
        raise _unauthorized(request, "Missing access token.")
    found = await authenticate_bearer(bearer.strip(), session)
    if found is None:
        raise _unauthorized(request, "Invalid or expired access token.")
    user, grant = found
    request.state.user_id = user.id
    version = request.headers.get("mcp-protocol-version")
    if version is not None and version not in PROTOCOL_VERSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported MCP-Protocol-Version {version!r}.")
    wait = rate_window.hit("mcp", str(grant.id), config.MCP_REQUESTS_PER_MINUTE, 60)
    if wait is not None:
        raise HTTPException(status_code=429, detail="Too many requests.", headers={"Retry-After": str(wait)})

    body = await request.body()
    if len(body) > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="Request too large.")
    try:
        payload = json.loads(body)
    except ValueError:
        return JSONResponse(_rpc_error(None, -32700, "Parse error."), status_code=400)

    caller = Caller(user=user, client_id=grant.client_id)
    if isinstance(payload, list):
        if not payload:
            return JSONResponse(_rpc_error(None, -32600, "Empty batch."), status_code=400)
        answers = [a for a in [await _handle(m, caller, session) for m in payload] if a is not None]
        return JSONResponse(answers) if answers else Response(status_code=202)
    answer = await _handle(payload, caller, session)
    return JSONResponse(answer) if answer is not None else Response(status_code=202)


@router.get("/mcp")
@router.delete("/mcp")
async def mcp_no_stream() -> Response:
    # No server-to-chat stream and no sessions to end (the spec allows 405).
    return Response(status_code=405, headers={"Allow": "POST"})
