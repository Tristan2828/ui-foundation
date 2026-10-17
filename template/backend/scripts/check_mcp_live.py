#!/usr/bin/env python
"""The MCP sign-in and tools against a live server on real Postgres
(scripts/check-backend-postgres.sh runs it with MCP_ENABLED=true).

pytest runs on SQLite, which can't see the timestamp-column class of bug
(oauth_codes.expires_at, oauth_grants.*, mcp_audit_log.at are written
through the ORM here). This walks the whole path once: register a chat,
approve as the signed-in user, trade the code, call every tool, refresh.

Usage: check_mcp_live.py <base url> <session_id cookie value>
"""

import base64
import hashlib
import re
import sys
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx

REDIRECT = "https://chat.example/callback"
VERIFIER = "live-check-" + "v" * 40
CHALLENGE = base64.urlsafe_b64encode(hashlib.sha256(VERIFIER.encode()).digest()).rstrip(b"=").decode()


def check(condition: bool, message: str) -> None:
    if not condition:
        print(f"check-mcp-live: {message}", file=sys.stderr)
        raise SystemExit(1)


def main(base: str, session_cookie: str) -> None:
    web = httpx.Client(base_url=base, cookies={"session_id": session_cookie})

    check(web.post("/mcp", json={}).status_code == 401, "/mcp without a token should be 401")
    metadata = web.get("/.well-known/oauth-authorization-server").json()
    check(metadata["token_endpoint"].endswith("/oauth/token"), f"bad metadata: {metadata}")

    registered = web.post("/oauth/register", json={"client_name": "Live check", "redirect_uris": [REDIRECT]})
    check(registered.status_code == 201, f"register returned {registered.status_code}: {registered.text}")
    client_id = registered.json()["client_id"]

    query = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": REDIRECT,
        "code_challenge": CHALLENGE,
        "code_challenge_method": "S256",
        "state": "live",
    }
    page = web.get("/oauth/authorize", params=query)
    check(page.status_code == 200, f"consent page returned {page.status_code}: {page.text[:200]}")
    form = dict(re.findall(r'name="([a-z_]+)" value="([^"]*)"', page.text))
    approved = web.post("/oauth/authorize", data={**form, "decision": "approve"})
    check(approved.status_code == 303, f"approve returned {approved.status_code}")
    code = parse_qs(urlparse(approved.headers["location"]).query).get("code", [""])[0]
    check(bool(code), f"no code in {approved.headers['location']}")

    exchanged = web.post(
        "/oauth/token",
        data={
            "grant_type": "authorization_code",
            "client_id": client_id,
            "code": code,
            "redirect_uri": REDIRECT,
            "code_verifier": VERIFIER,
        },
    )
    check(exchanged.status_code == 200, f"token returned {exchanged.status_code}: {exchanged.text}")
    tokens = exchanged.json()

    def call(access: str, name: str, arguments: dict[str, Any]) -> tuple[str, bool]:
        answer = web.post(
            "/mcp",
            headers={"Authorization": f"Bearer {access}"},
            json={"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": name, "arguments": arguments}},
        )
        check(answer.status_code == 200, f"{name} returned {answer.status_code}: {answer.text}")
        result = answer.json()["result"]
        return result["content"][0]["text"], bool(result.get("isError"))

    access = tokens["access_token"]
    created, failed = call(
        access,
        "create",
        {
            "entity": "widgets",
            "fields": {
                "name": "Live MCP widget",
                "categoryId": 1,
                "availableFrom": "2026-10-01T12:30:00Z",
                "price": "9.99",
                "description": "written by check_mcp_live",
                "tags": ["seasonal"],
            },
        },
    )
    check(not failed and created.startswith("Created widget /widgets/"), f"create failed: {created}")
    address = re.search(r"/widgets/\d+", created)
    check(address is not None, created)
    assert address is not None

    updated, failed = call(access, "update", {"url": address[0], "fields": {"price": "10.50", "inStock": False}})
    check(not failed and "Changed price, inStock." in updated, f"update failed: {updated}")
    fetched, failed = call(access, "fetch", {"url": address[0]})
    check(not failed and "Price: 10.50" in fetched and "Category:" in fetched, f"fetch failed: {fetched}")
    listed, failed = call(access, "list", {"entity": "widgets", "filters": {"inStock": False}})
    check(not failed and address[0] in listed, f"list failed: {listed}")
    found, failed = call(access, "search", {"query": "Live MCP"})
    check(not failed and address[0] in found, f"search failed: {found}")
    refused, failed = call(access, "create", {"entity": "widgets", "fields": {"name": "x"}})
    check(failed and "categoryId: Field required" in refused, f"a refusal should be text: {refused}")

    refreshed = web.post(
        "/oauth/token",
        data={"grant_type": "refresh_token", "client_id": client_id, "refresh_token": tokens["refresh_token"]},
    )
    check(refreshed.status_code == 200, f"refresh returned {refreshed.status_code}: {refreshed.text}")
    check(call(refreshed.json()["access_token"], "fetch", {"url": address[0]})[1] is False, "refreshed token failed")
    check(web.post("/mcp", headers={"Authorization": f"Bearer {access}"}, json={"jsonrpc": "2.0", "id": 1, "method": "ping"}).status_code == 401,
          "the replaced access token should be refused")

    print("check-mcp-live: PASS")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
