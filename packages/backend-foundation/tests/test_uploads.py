"""foundation_backend.uploads: a picture's type from its bytes, an upload
read with a limit, and the headers it is served with."""

from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI, Request
from fastapi.responses import Response
from httpx import ASGITransport, AsyncClient

from foundation_backend.uploads import (
    IMAGE_MAX_BYTES,
    UploadTooLarge,
    image_response,
    image_type,
    read_upload,
)

JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"\x00" * 20
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR" + b"\x00" * 20
WEBP = b"RIFF" + (30).to_bytes(4, "little") + b"WEBPVP8 " + b"\x00" * 20


@pytest.mark.parametrize(("data", "expected"), [(JPEG, "image/jpeg"), (PNG, "image/png"), (WEBP, "image/webp")])
def test_a_picture_is_named_by_its_bytes(data: bytes, expected: str) -> None:
    assert image_type(data) == expected


@pytest.mark.parametrize(
    "data",
    [
        b"GIF89a" + b"\x00" * 20,
        b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        b"<!doctype html><script>alert(1)</script>",
        b"%PDF-1.7\n",
        b"RIFF\x00\x00\x00\x00WAVEfmt ",  # a RIFF that isn't WebP
        b"RIFFWEBP",  # too short to be one
        b"\xff\xd8",  # a JPEG's first two bytes only
        b"just some text",
        b"",
    ],
)
def test_anything_else_is_none(data: bytes) -> None:
    assert image_type(data) is None


def _app(max_bytes: int) -> FastAPI:
    app = FastAPI()

    @app.post("/upload")
    async def upload(request: Request) -> dict[str, object]:
        data = await read_upload(request, max_bytes)
        return {"size": len(data), "type": image_type(data)}

    return app


async def _post(app: FastAPI, content: bytes | AsyncIterator[bytes], headers: dict[str, str] | None = None) -> tuple[int, object]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/upload", content=content, headers=headers)
        return response.status_code, response.json()


async def test_an_upload_within_the_limit_is_read_whole() -> None:
    status, body = await _post(_app(100), PNG)
    assert status == 200
    assert body == {"size": len(PNG), "type": "image/png"}


async def test_an_upload_at_the_limit_is_read() -> None:
    status, _ = await _post(_app(len(PNG)), PNG)
    assert status == 200


async def test_a_declared_length_over_the_limit_is_a_413() -> None:
    status, body = await _post(_app(10), PNG)
    assert status == 413
    assert body == {"detail": "The file is over 10 bytes."}


async def test_a_streamed_body_that_runs_past_the_limit_is_a_413() -> None:
    # Chunked, no Content-Length: the limit is counted as it arrives.
    async def chunks() -> AsyncIterator[bytes]:
        for _ in range(10):
            yield b"\x00" * 64

    status, _ = await _post(_app(300), chunks())
    assert status == 413


def test_the_limit_reads_as_megabytes() -> None:
    assert UploadTooLarge(IMAGE_MAX_BYTES).detail == "The file is over 10 MB."


def test_a_picture_is_served_with_every_header() -> None:
    response = image_response(PNG, "image/png", 42)
    assert isinstance(response, Response)
    assert response.body == PNG
    assert response.headers["content-type"] == "image/png"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["content-disposition"] == 'inline; filename="42.png"'
    assert response.headers["content-security-policy"] == "default-src 'none'; sandbox"
    assert response.headers["cross-origin-resource-policy"] == "same-origin"
    assert response.headers["cache-control"] == "private, max-age=31536000, immutable"


@pytest.mark.parametrize("content_type", ["image/svg+xml", "text/html", "image/gif", "application/octet-stream"])
def test_a_type_that_isnt_a_picture_is_never_served(content_type: str) -> None:
    with pytest.raises(ValueError):
        image_response(b"<svg/>", content_type, 1)


def test_a_uuid_id_names_the_file() -> None:
    response = image_response(WEBP, "image/webp", "0b6c-41_e2")
    assert response.headers["content-disposition"] == 'inline; filename="0b6c-41_e2.webp"'


@pytest.mark.parametrize("file_id", ['1"; x="', "../1", "", "a b", "1\n"])
def test_an_id_that_isnt_letters_and_digits_is_refused(file_id: str) -> None:
    with pytest.raises(ValueError):
        image_response(PNG, "image/png", file_id)
