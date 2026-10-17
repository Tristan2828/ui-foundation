"""OAuth 2.1 for AI chats (issue #132), the authorization the MCP spec
describes and custom connectors require. Stdlib and FastAPI only. Off
unless MCP_ENABLED: every route here answers 404 then.

- `/.well-known/oauth-protected-resource` and
  `/.well-known/oauth-authorization-server`: where the chat finds the rest.
- `POST /oauth/register`: a chat registers itself (RFC 7591). Public
  clients only, redirect addresses https or loopback http, a cap on how
  many exist.
- `GET/POST /oauth/authorize`: the person, signed in the app's usual way
  (the session cookie, so its rate limits and two-step sign-in apply),
  sees who is asking and approves or refuses. PKCE (S256) is required.
- `POST /oauth/token`: the code (once, with its verifier) or a refresh
  token (rotated; a reused one ends the connection) for an access token.
- `POST /oauth/revoke`: ends a connection.

Codes and tokens are random and stored only as hashes, as sessions are.
"""

import base64
import hashlib
import hmac
import html
import json
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app import config, rate_window
from app.db import get_session
from app.models import OAuthClient, OAuthCode, OAuthGrant, User
from app.routers.auth import get_current_user
from app.security import generate_session_token, hash_token

CODE_TTL_SECONDS = 600
SCOPE = "mcp"
# A chat that registered and never got approved is dropped after this.
UNUSED_CLIENT_DAYS = 1
LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}
_CHALLENGE_CHARS = frozenset("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
_VERIFIER_CHARS = _CHALLENGE_CHARS | frozenset(".~")


def require_enabled() -> None:
    if not config.MCP_ENABLED:
        raise HTTPException(status_code=404, detail="Not Found")


router = APIRouter(include_in_schema=False, dependencies=[Depends(require_enabled)])


def public_base(request: Request) -> str:
    """The app's public origin: MCP_PUBLIC_URL, else (development) the request's."""
    return config.MCP_PUBLIC_URL or str(request.base_url).rstrip("/")


def _aware(moment: datetime) -> datetime:
    # SQLite (the pytest engine) drops tzinfo on the way back; Postgres keeps it.
    return moment if moment.tzinfo is not None else moment.replace(tzinfo=timezone.utc)


def _expired(moment: datetime) -> bool:
    return _aware(moment) < datetime.now(timezone.utc)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _client_ip(request: Request) -> str:
    return request.client.host if request.client is not None else "unknown"


def _throttle(request: Request, bucket: str, limit: int, window: float) -> None:
    wait = rate_window.hit(bucket, _client_ip(request), limit, window)
    if wait is not None:
        raise HTTPException(status_code=429, detail="Too many requests.", headers={"Retry-After": str(wait)})


def _oauth_error(error: str, description: str, status: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": error, "error_description": description},
        headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
    )


# ------------------------------------------------------------ discovery


@router.get("/.well-known/oauth-protected-resource")
@router.get("/.well-known/oauth-protected-resource/mcp")
async def protected_resource(request: Request) -> dict[str, Any]:
    base = public_base(request)
    return {
        "resource": f"{base}/mcp",
        "authorization_servers": [base],
        "scopes_supported": [SCOPE],
        "bearer_methods_supported": ["header"],
    }


@router.get("/.well-known/oauth-authorization-server")
async def authorization_server(request: Request) -> dict[str, Any]:
    base = public_base(request)
    return {
        "issuer": base,
        "authorization_endpoint": f"{base}/oauth/authorize",
        "token_endpoint": f"{base}/oauth/token",
        "registration_endpoint": f"{base}/oauth/register",
        "revocation_endpoint": f"{base}/oauth/revoke",
        "scopes_supported": [SCOPE],
        "response_types_supported": ["code"],
        "response_modes_supported": ["query"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "token_endpoint_auth_methods_supported": ["none"],
        "code_challenge_methods_supported": ["S256"],
        "authorization_response_iss_parameter_supported": True,
    }


# ------------------------------------------------------------ registration


def _redirect_uri_problem(uri: Any) -> str | None:
    if not isinstance(uri, str) or len(uri) > 2000:
        return "a redirect address must be text"
    parts = urlparse(uri)
    if parts.fragment or parts.username or parts.password or not parts.hostname:
        return f"{uri!r} must be an absolute address with no fragment or credentials"
    if parts.scheme == "https":
        return None
    if parts.scheme == "http" and parts.hostname in LOOPBACK_HOSTS:
        return None
    return f"{uri!r} must be https, or http on localhost"


@router.post("/oauth/register")
async def register(request: Request, session: AsyncSession = Depends(get_session)) -> Response:
    _throttle(request, "oauth-register", 20, 3600)
    try:
        body = await request.json()
    except ValueError:
        body = None
    if not isinstance(body, dict):
        return _oauth_error("invalid_client_metadata", "The body must be a JSON object.")
    uris = body.get("redirect_uris")
    if not isinstance(uris, list) or not 1 <= len(uris) <= 5:
        return _oauth_error("invalid_redirect_uri", "redirect_uris must list one to five addresses.")
    for uri in uris:
        if (problem := _redirect_uri_problem(uri)) is not None:
            return _oauth_error("invalid_redirect_uri", problem)
    if body.get("token_endpoint_auth_method", "none") != "none":
        return _oauth_error("invalid_client_metadata", "Only public clients (token_endpoint_auth_method none).")
    grants = body.get("grant_types", ["authorization_code"])
    if not isinstance(grants, list) or not set(grants) <= {"authorization_code", "refresh_token"}:
        return _oauth_error("invalid_client_metadata", "grant_types may be authorization_code and refresh_token.")
    name = body.get("client_name")
    client_name = name.strip()[:200] if isinstance(name, str) and name.strip() else "An AI chat"

    # Drop chats that registered and were never approved, then cap the rest.
    cutoff = _now() - timedelta(days=UNUSED_CLIENT_DAYS)
    for old in (await session.exec(select(OAuthClient))).all():
        if _aware(old.created_at) >= cutoff:
            continue
        used = (await session.exec(select(OAuthGrant.id).where(OAuthGrant.client_id == old.client_id))).first()
        if used is None:
            await session.delete(old)
    await session.commit()
    if len((await session.exec(select(OAuthClient.id))).all()) >= config.MCP_MAX_CLIENTS:
        return _oauth_error("temporarily_unavailable", "Too many chats are registered.", 429)

    client_id = secrets.token_urlsafe(24)
    issued_at = _now()
    session.add(
        OAuthClient(client_id=client_id, client_name=client_name, redirect_uris=json.dumps(uris), created_at=issued_at)
    )
    await session.commit()
    return JSONResponse(
        status_code=201,
        content={
            "client_id": client_id,
            "client_id_issued_at": int(issued_at.timestamp()),
            "client_name": client_name,
            "redirect_uris": uris,
            "token_endpoint_auth_method": "none",
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
        },
        headers={"Cache-Control": "no-store"},
    )


# ------------------------------------------------------------ authorization

_PAGE_HEADERS = {
    "Cache-Control": "no-store",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
}
_STYLE = (
    "body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;color:#1a1a1a;"
    "background:#fff}h1{font-size:1.25rem}button,a.button{font:inherit;padding:.5rem 1rem;margin-right:.5rem;"
    "border:1px solid #1a1a1a;border-radius:.375rem;background:#fff;color:#1a1a1a;text-decoration:none;cursor:pointer}"
    "button.primary{background:#1a1a1a;color:#fff}.muted{color:#555}"
    "@media(prefers-color-scheme:dark){body{background:#111;color:#eee}button,a.button{background:#111;color:#eee;"
    "border-color:#eee}button.primary{background:#eee;color:#111}.muted{color:#aaa}}"
)


def _page(title: str, body: str, status: int = 200) -> HTMLResponse:
    document = (
        f'<!doctype html><html lang="en"><head><meta charset="utf-8">'
        f'<meta name="viewport" content="width=device-width, initial-scale=1">'
        f"<title>{html.escape(title)}</title><style>{_STYLE}</style></head>"
        f"<body><main><h1>{html.escape(title)}</h1>{body}</main></body></html>"
    )
    return HTMLResponse(document, status_code=status, headers=_PAGE_HEADERS)


@dataclass(frozen=True)
class AuthRequest:
    # Plain values, not the row: a commit expires rows, and reading one then
    # would need the database again.
    client_id: str
    client_name: str
    redirect_uri: str
    code_challenge: str
    state: str | None


def _redirect(redirect_uri: str, base: str, params: dict[str, str | None]) -> RedirectResponse:
    query = urlencode({k: v for k, v in params.items() if v is not None} | {"iss": base})
    joiner = "&" if "?" in redirect_uri else "?"
    return RedirectResponse(f"{redirect_uri}{joiner}{query}", status_code=303, headers={"Cache-Control": "no-store"})


async def _parse_authorization(
    params: dict[str, str], base: str, session: AsyncSession
) -> AuthRequest | Response:
    """The request, or the response that refuses it: a page when the client
    or its redirect address can't be trusted (never redirect there), else a
    redirect carrying the OAuth error."""
    client_id = params.get("client_id", "")
    client = (await session.exec(select(OAuthClient).where(OAuthClient.client_id == client_id))).first()
    redirect_uri = params.get("redirect_uri", "")
    if client is None or redirect_uri not in json.loads(client.redirect_uris):
        return _page(
            "Can't connect",
            "<p>This connection request names an app or address this server doesn't know. "
            "Go back to the AI chat and start the connection again.</p>",
            400,
        )
    state = params.get("state")

    def refuse(error: str, description: str) -> Response:
        return _redirect(redirect_uri, base, {"error": error, "error_description": description, "state": state})

    if params.get("response_type") != "code":
        return refuse("unsupported_response_type", "response_type must be code.")
    challenge = params.get("code_challenge", "")
    if params.get("code_challenge_method") != "S256" or len(challenge) != 43 or not set(challenge) <= _CHALLENGE_CHARS:
        return refuse("invalid_request", "PKCE with code_challenge_method S256 is required.")
    resource = params.get("resource")
    if resource is not None and resource.rstrip("/") != f"{base}/mcp":
        return refuse("invalid_target", "resource must be this server's /mcp.")
    return AuthRequest(client_id=client.client_id, client_name=client.client_name, redirect_uri=redirect_uri, code_challenge=challenge, state=state)


async def _signed_in_user(request: Request, session_id: str | None, session: AsyncSession) -> User | None:
    try:
        return await get_current_user(request, session_id, session)
    except HTTPException:
        return None


def _csrf(session_id: str, auth: AuthRequest) -> str:
    message = "|".join(["oauth-consent", auth.client_id, auth.redirect_uri, auth.code_challenge, auth.state or ""])
    return hmac.new(session_id.encode(), message.encode(), hashlib.sha256).hexdigest()


def _hidden(**fields: str) -> str:
    return "".join(
        f'<input type="hidden" name="{html.escape(name)}" value="{html.escape(value, quote=True)}">'
        for name, value in fields.items()
    )


def _sign_in_page() -> HTMLResponse:
    return _page(
        "Sign in first",
        '<p>Sign in to this app, then go back to the AI chat and connect again.</p>'
        '<p><a class="button primary" href="/login">Sign in</a></p>',
        401,
    )


@router.get("/oauth/authorize")
async def authorize_page(
    request: Request,
    session_id: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
) -> Response:
    params = {key: values[0] for key, values in parse_qs(request.url.query).items()}
    parsed = await _parse_authorization(params, public_base(request), session)
    if not isinstance(parsed, AuthRequest):
        return parsed
    user = await _signed_in_user(request, session_id, session)
    if user is None or session_id is None:
        return _sign_in_page()
    host = urlparse(parsed.redirect_uri).netloc
    # Everything _parse_authorization reads comes back with the decision.
    form = _hidden(
        response_type="code",
        client_id=parsed.client_id,
        redirect_uri=parsed.redirect_uri,
        code_challenge=parsed.code_challenge,
        code_challenge_method="S256",
        state=parsed.state or "",
        csrf=_csrf(session_id, parsed),
    )
    if resource := request.query_params.get("resource"):
        form += _hidden(resource=resource)
    return _page(
        f"Connect {parsed.client_name}?",
        f"<p><strong>{html.escape(parsed.client_name)}</strong> wants to read and change the records "
        f"you can see in this app, signed in as {html.escape(user.email)}.</p>"
        "<p>It can create and edit records. It can't delete anything. Every change it makes is logged.</p>"
        f'<p class="muted">After you choose, you go to {html.escape(host)}. '
        "Approve only if you just started this connection yourself.</p>"
        f'<form method="post" action="/oauth/authorize">{form}'
        '<button class="primary" name="decision" value="approve">Approve</button>'
        '<button name="decision" value="deny">Cancel</button></form>',
    )


@router.post("/oauth/authorize")
async def authorize_decision(
    request: Request,
    session_id: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
) -> Response:
    params = {key: values[0] for key, values in parse_qs((await request.body()).decode(errors="replace")).items()}
    base = public_base(request)
    parsed = await _parse_authorization(params, base, session)
    if not isinstance(parsed, AuthRequest):
        return parsed
    user = await _signed_in_user(request, session_id, session)
    if user is None or session_id is None:
        return _sign_in_page()
    if not hmac.compare_digest(params.get("csrf", ""), _csrf(session_id, parsed)):
        return _page("Can't connect", "<p>This page expired. Go back to the AI chat and connect again.</p>", 400)
    state = parsed.state or None
    if params.get("decision") != "approve":
        return _redirect(parsed.redirect_uri, base, {"error": "access_denied", "state": state})

    assert user.id is not None
    code = generate_session_token()
    session.add(
        OAuthCode(
            code_hash=hash_token(code),
            client_id=parsed.client_id,
            user_id=user.id,
            redirect_uri=parsed.redirect_uri,
            code_challenge=parsed.code_challenge,
            expires_at=_now() + timedelta(seconds=CODE_TTL_SECONDS),
        )
    )
    await session.commit()
    return _redirect(parsed.redirect_uri, base, {"code": code, "state": state})


# ------------------------------------------------------------ tokens


def _pkce_matches(verifier: str, challenge: str) -> bool:
    digest = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return hmac.compare_digest(digest, challenge)


def _token_response(access: str, refresh: str) -> JSONResponse:
    return JSONResponse(
        {
            "access_token": access,
            "token_type": "Bearer",
            "expires_in": config.MCP_ACCESS_TOKEN_TTL_SECONDS,
            "refresh_token": refresh,
            "scope": SCOPE,
        },
        headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
    )


def _new_tokens(grant: OAuthGrant) -> tuple[str, str]:
    """Fresh access and refresh tokens on `grant`; returns them in the clear."""
    access, refresh = generate_session_token(), generate_session_token()
    now = _now()
    grant.access_hash = hash_token(access)
    grant.refresh_hash = hash_token(refresh)
    grant.access_expires_at = now + timedelta(seconds=config.MCP_ACCESS_TOKEN_TTL_SECONDS)
    grant.refresh_expires_at = now + timedelta(days=config.MCP_REFRESH_TOKEN_TTL_DAYS)
    grant.created_at = now
    return access, refresh


async def _form(request: Request) -> dict[str, str]:
    return {key: values[0] for key, values in parse_qs((await request.body()).decode(errors="replace")).items()}


@router.post("/oauth/token")
async def token(request: Request, session: AsyncSession = Depends(get_session)) -> Response:
    _throttle(request, "oauth-token", 60, 60)
    params = await _form(request)
    client_id = params.get("client_id", "")
    known = (await session.exec(select(OAuthClient.id).where(OAuthClient.client_id == client_id))).first()
    if known is None:
        return _oauth_error("invalid_client", "Unknown client_id.", 401)
    grant_type = params.get("grant_type")
    if grant_type == "authorization_code":
        return await _exchange_code(params, client_id, session)
    if grant_type == "refresh_token":
        return await _refresh(params, client_id, session)
    return _oauth_error("unsupported_grant_type", "grant_type must be authorization_code or refresh_token.")


async def _exchange_code(params: dict[str, str], client_id: str, session: AsyncSession) -> Response:
    code = (
        await session.exec(select(OAuthCode).where(OAuthCode.code_hash == hash_token(params.get("code", ""))))
    ).first()
    if code is None:
        return _oauth_error("invalid_grant", "That code is unknown or was already used.")
    # Single use, whatever follows: a wrong verifier burns the code too.
    issued_to, user_id, redirect_uri = code.client_id, code.user_id, code.redirect_uri
    challenge, expires_at = code.code_challenge, code.expires_at
    await session.delete(code)
    await session.commit()
    verifier = params.get("code_verifier", "")
    if (
        _expired(expires_at)
        or issued_to != client_id
        or redirect_uri != params.get("redirect_uri")
        or not 43 <= len(verifier) <= 128
        or not set(verifier) <= _VERIFIER_CHARS
        or not _pkce_matches(verifier, challenge)
    ):
        return _oauth_error("invalid_grant", "The code, redirect_uri or code_verifier doesn't match.")
    grant = OAuthGrant(
        client_id=client_id,
        user_id=user_id,
        access_hash="",
        refresh_hash="",
        access_expires_at=_now(),
        refresh_expires_at=_now(),
        created_at=_now(),
    )
    access, refresh = _new_tokens(grant)
    session.add(grant)
    for stale in (await session.exec(select(OAuthGrant).where(OAuthGrant.user_id == user_id))).all():
        if _expired(stale.refresh_expires_at):
            await session.delete(stale)
    await session.commit()
    return _token_response(access, refresh)


async def _refresh(params: dict[str, str], client_id: str, session: AsyncSession) -> Response:
    presented = hash_token(params.get("refresh_token", ""))
    grant = (await session.exec(select(OAuthGrant).where(OAuthGrant.refresh_hash == presented))).first()
    if grant is None:
        replaced = (
            await session.exec(select(OAuthGrant).where(OAuthGrant.previous_refresh_hash == presented))
        ).first()
        if replaced is not None and replaced.client_id == client_id:
            # A refresh token already traded in: someone holds a copy. End the connection.
            await session.delete(replaced)
            await session.commit()
        return _oauth_error("invalid_grant", "That refresh token is unknown, expired or was already used.")
    if grant.client_id != client_id:
        return _oauth_error("invalid_grant", "That refresh token is unknown, expired or was already used.")
    if _expired(grant.refresh_expires_at):
        await session.delete(grant)
        await session.commit()
        return _oauth_error("invalid_grant", "That refresh token is unknown, expired or was already used.")
    grant.previous_refresh_hash = grant.refresh_hash
    access, refresh = _new_tokens(grant)
    session.add(grant)
    await session.commit()
    return _token_response(access, refresh)


@router.post("/oauth/revoke")
async def revoke(request: Request, session: AsyncSession = Depends(get_session)) -> Response:
    _throttle(request, "oauth-token", 60, 60)
    params = await _form(request)
    hashed = hash_token(params.get("token", ""))
    grant = (
        await session.exec(
            select(OAuthGrant).where(
                (col(OAuthGrant.access_hash) == hashed) | (col(OAuthGrant.refresh_hash) == hashed),
                OAuthGrant.client_id == params.get("client_id", ""),
            )
        )
    ).first()
    if grant is not None:
        await session.delete(grant)
        await session.commit()
    # RFC 7009: the same answer whether or not the token was known.
    return Response(status_code=200, headers={"Cache-Control": "no-store"})


# ------------------------------------------------------------ bearer tokens


async def authenticate_bearer(token_value: str, session: AsyncSession) -> tuple[User, OAuthGrant] | None:
    """The user and connection an access token belongs to, or None."""
    grant = (await session.exec(select(OAuthGrant).where(OAuthGrant.access_hash == hash_token(token_value)))).first()
    if grant is None or _expired(grant.access_expires_at):
        return None
    user = await session.get(User, grant.user_id)
    return (user, grant) if user is not None else None
