"""Static mount for the built SPA with a client-side-routing fallback.

Plain `StaticFiles(html=True)` only serves index.html for directory URLs,
so a hard refresh (or a pasted link) on any React Router route other than
`/` — `/widgets`, `/widgets/3/edit`, `/login` — 404s in the single-deployable
setup. This falls back to index.html for
those, but never for `api/...` paths (an unknown API route must stay a JSON
404, not an HTML page) or for paths with a file extension (a missing
`/assets/foo.js` must stay a 404, not silently become HTML).

Every file it serves says how long a browser may keep it
(`Cache-Control`), so a deploy shows on the app's next launch:

- Vite's content-hashed build files under `assets/` get a new name
  whenever they change, so they are kept for a year without asking again
  (`public, max-age=31536000, immutable`).
- Everything else (`index.html`, also when it answers a client route, the
  web app manifest, `push-sw.js`, icons, `favicon.svg`, `build-info.json`)
  keeps its name between builds, so it is `no-cache`: the browser may keep
  it but asks the server (by ETag) before every use. With no header at
  all, Safari guesses a lifetime and can keep an old `index.html`, which
  names the old build's assets, long after a deploy.

A missing file is still the `HTTPException` 404 it always was, with no
caching header, so a missing hashed asset is never cached as immutable.
"""

import posixpath

from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

#: Vite's default `build.assetsDir`: where its content-hashed files go.
HASHED_ASSETS_DIR = "assets"
IMMUTABLE = "public, max-age=31536000, immutable"
REVALIDATE = "no-cache"


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            response = await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code != 404 or not _is_client_route(path):
                raise
            response = await super().get_response("index.html", scope)
            path = "index.html"
        response.headers["Cache-Control"] = _cache_control(path, response.status_code)
        return response


def _normalize(path: str) -> str:
    return path.replace("\\", "/").lstrip("/")


def _is_client_route(path: str) -> bool:
    normalized = _normalize(path)
    if normalized == "api" or normalized.startswith("api/"):
        return False
    return posixpath.splitext(normalized)[1] == ""


def _cache_control(path: str, status_code: int) -> str:
    """Immutable only for a file actually served from the hashed assets
    directory (a 200, a range's 206, or a revalidation's 304); `no-cache`
    for everything else, a `404.html` page included."""
    normalized = posixpath.normpath(_normalize(path))
    hashed = normalized.startswith(HASHED_ASSETS_DIR + "/")
    if hashed and status_code in (200, 206, 304):
        return IMMUTABLE
    return REVALIDATE
