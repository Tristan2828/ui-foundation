"""Static mount for the built SPA with a client-side-routing fallback.

Plain `StaticFiles(html=True)` only serves index.html for directory URLs,
so a hard refresh (or a pasted link) on any React Router route other than
`/` — `/widgets`, `/widgets/3/edit`, `/login` — 404s in the single-deployable
setup (docs/BUILD-PLAN.md Phase 8 item 8). This falls back to index.html for
those, but never for `api/...` paths (an unknown API route must stay a JSON
404, not an HTML page) or for paths with a file extension (a missing
`/assets/foo.js` must stay a 404, not silently become HTML).
"""

import posixpath

from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code != 404 or not _is_client_route(path):
                raise
            return await super().get_response("index.html", scope)


def _is_client_route(path: str) -> bool:
    normalized = path.replace("\\", "/").lstrip("/")
    if normalized == "api" or normalized.startswith("api/"):
        return False
    return posixpath.splitext(normalized)[1] == ""
