"""Pictures a person uploads: what type the bytes are, reading an upload
with a size limit, and serving the bytes back safely. Standard library
and FastAPI only, so an app takes no image or multipart library to store
a photo.

The upload is the picture itself as the request body (the browser sends
the `File`, no multipart form), so there is no form to parse. Its type is
read from its first bytes: the name and the browser's type are never
trusted. JPEG, PNG and WebP only. Never SVG, HTML or GIF: an SVG or HTML
file served from the app's own domain can run script there.

Serving sends the stored type with `X-Content-Type-Options: nosniff`, an
inline `Content-Disposition` under a name made from the id, a CSP that
allows nothing (`default-src 'none'; sandbox`), so a file opened on its
own address runs nothing, `Cross-Origin-Resource-Policy: same-origin`,
and a private, immutable cache: a stored file never changes, a new
picture is a new id.

The template's `app/routers/files.py` is the reference that uses them
(docs/foundation/add-an-entity.md "An image on a record").
"""

import re

from fastapi import HTTPException, Request
from fastapi.responses import Response

# What an upload may be, by the type its bytes say.
IMAGE_TYPES: tuple[str, ...] = ("image/jpeg", "image/png", "image/webp")

# The largest upload, in bytes: 10 MB. A browser that shrinks the picture
# first (the package's `shrinkImage`) sends a few hundred kilobytes.
IMAGE_MAX_BYTES = 10 * 1024 * 1024

# The name a served file goes under: its id with the type's extension.
EXTENSIONS: dict[str, str] = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

CACHE_CONTROL = "private, max-age=31536000, immutable"
CONTENT_SECURITY_POLICY = "default-src 'none'; sandbox"

_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
# What a file id may be, so the name it gives the header is only that.
_SAFE_ID = re.compile(r"[A-Za-z0-9_-]+")


def image_type(data: bytes) -> str | None:
    """The picture's type from its first bytes: `image/jpeg`, `image/png`,
    `image/webp`, or None for anything else (a GIF, an SVG, HTML, a PDF,
    text, nothing)."""
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == _PNG_SIGNATURE:
        return "image/png"
    # A RIFF container (little-endian size after the tag) whose form is WEBP.
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


class UploadTooLarge(HTTPException):
    """The 413 for an upload over its limit."""

    def __init__(self, max_bytes: int) -> None:
        super().__init__(status_code=413, detail=f"The file is over {_megabytes(max_bytes)}.")


def _megabytes(size: int) -> str:
    mb = size / (1024 * 1024)
    return f"{mb:g} MB" if mb >= 1 else f"{size} bytes"


async def read_upload(request: Request, max_bytes: int = IMAGE_MAX_BYTES) -> bytes:
    """The request's body, read no further than `max_bytes`: a declared
    `Content-Length` over it is refused before a byte is read, and a body
    that runs past it (chunked, or a length that lied) is refused as soon
    as it does. Either way an `UploadTooLarge` (413)."""
    declared = request.headers.get("content-length")
    if declared is not None and declared.isdigit() and int(declared) > max_bytes:
        raise UploadTooLarge(max_bytes)
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > max_bytes:
            raise UploadTooLarge(max_bytes)
        chunks.append(chunk)
    return b"".join(chunks)


def image_response(data: bytes, content_type: str, file_id: int | str) -> Response:
    """The stored picture as a response, with every header the module's
    docstring lists. `content_type` is the one sniffed at upload (one of
    `IMAGE_TYPES`; anything else is a ValueError, never served)."""
    extension = EXTENSIONS.get(content_type)
    if extension is None:
        raise ValueError(f"Not a picture type this serves: {content_type!r}")
    # The id alone names it: never the uploader's own name, which could
    # carry quotes or path characters into the header.
    if not _SAFE_ID.fullmatch(str(file_id)):
        raise ValueError(f"A file id must be letters, digits, - or _: {file_id!r}")
    name = f"{file_id}.{extension}"
    return Response(
        content=data,
        media_type=content_type,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": f'inline; filename="{name}"',
            "Content-Security-Policy": CONTENT_SECURITY_POLICY,
            "Cross-Origin-Resource-Policy": "same-origin",
            "Cache-Control": CACHE_CONTROL,
        },
    )
