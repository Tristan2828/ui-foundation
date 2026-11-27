"""/files: a picture as the request body, its type from its bytes, read
back behind the session with foundation_backend.uploads' headers. See
tests/conftest.py for scope (SQLite; the bytea column against Postgres is
scripts/check-backend-postgres.sh's)."""

import hashlib

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import StoredFile, StoredFileContent, User
from foundation_backend import uploads

JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01" + b"\x00" * 40 + b"\xff\xd9"
PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 40
WEBP = b"RIFF" + (40).to_bytes(4, "little") + b"WEBPVP8 " + b"\x00" * 40


async def _upload(client: AsyncClient, data: bytes, content_type: str = "image/png") -> dict:  # type: ignore[type-arg]
    response = await client.post("/api/files", content=data, headers={"content-type": content_type})
    assert response.status_code == 201, response.text
    body: dict = response.json()  # type: ignore[type-arg]
    return body


@pytest.mark.parametrize(("data", "expected"), [(JPEG, "image/jpeg"), (PNG, "image/png"), (WEBP, "image/webp")])
async def test_the_type_comes_from_the_bytes(client: AsyncClient, data: bytes, expected: str) -> None:
    # Sent as something else entirely: the bytes decide.
    body = await _upload(client, data, "application/octet-stream")
    assert body["contentType"] == expected
    assert body["byteSize"] == len(data)
    assert body["sha256"] == hashlib.sha256(data).hexdigest()
    assert set(body) == {"id", "contentType", "byteSize", "sha256", "createdAt"}


async def test_a_lying_type_is_not_believed(client: AsyncClient) -> None:
    # An HTML page sent as a JPEG named photo.jpg is refused, never stored.
    response = await client.post(
        "/api/files",
        content=b"<!doctype html><script>alert(document.cookie)</script>",
        headers={"content-type": "image/jpeg", "x-file-name": "photo.jpg"},
    )
    assert response.status_code == 422
    assert response.json()["detail"] == [
        {"loc": ["body", "file"], "msg": "Only a JPEG, PNG or WebP image can be uploaded.", "type": "value_error"}
    ]


@pytest.mark.parametrize(
    "data",
    [
        b"GIF89a" + b"\x00" * 40,
        b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        b"%PDF-1.7\n%%EOF\n",
    ],
)
async def test_a_gif_an_svg_or_a_pdf_is_refused(client: AsyncClient, session: AsyncSession, data: bytes) -> None:
    response = await client.post("/api/files", content=data, headers={"content-type": "image/png"})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "file"]
    assert await session.get(StoredFile, 1) is None


async def test_an_empty_body_is_refused(client: AsyncClient) -> None:
    response = await client.post("/api/files", content=b"", headers={"content-type": "image/png"})
    assert response.status_code == 422
    assert response.json()["detail"][0]["msg"] == "The file is empty."


async def test_over_the_limit_is_a_413(client: AsyncClient, session: AsyncSession) -> None:
    big = PNG + b"\x00" * (uploads.IMAGE_MAX_BYTES - len(PNG) + 1)
    response = await client.post("/api/files", content=big, headers={"content-type": "image/png"})
    assert response.status_code == 413
    assert response.json() == {"detail": "The file is over 10 MB."}
    assert await session.get(StoredFile, 1) is None


async def test_exactly_the_limit_is_stored(client: AsyncClient) -> None:
    exact = PNG + b"\x00" * (uploads.IMAGE_MAX_BYTES - len(PNG))
    body = await _upload(client, exact)
    assert body["byteSize"] == uploads.IMAGE_MAX_BYTES


async def test_the_bytes_are_kept_apart_from_the_row(client: AsyncClient, session: AsyncSession) -> None:
    body = await _upload(client, WEBP)
    content = await session.get(StoredFileContent, body["id"])
    assert content is not None and content.data == WEBP


async def test_get_reads_the_record(client: AsyncClient) -> None:
    body = await _upload(client, JPEG, "image/jpeg")
    got = await client.get(f"/api/files/{body['id']}")
    assert got.status_code == 200
    assert got.json() == body


async def test_content_is_the_bytes_with_every_header(client: AsyncClient) -> None:
    body = await _upload(client, JPEG, "image/jpeg")
    content = await client.get(f"/api/files/{body['id']}/content")
    assert content.status_code == 200
    assert content.content == JPEG
    assert content.headers["content-type"] == "image/jpeg"
    assert content.headers["x-content-type-options"] == "nosniff"
    assert content.headers["content-disposition"] == f'inline; filename="{body["id"]}.jpg"'
    assert content.headers["content-security-policy"] == "default-src 'none'; sandbox"
    assert content.headers["cross-origin-resource-policy"] == "same-origin"
    assert content.headers["cache-control"] == "private, max-age=31536000, immutable"


async def test_size_is_taken_and_ignored(client: AsyncClient) -> None:
    body = await _upload(client, PNG)
    for size in ("large", "thumb"):
        content = await client.get(f"/api/files/{body['id']}/content", params={"size": size})
        assert content.status_code == 200
        assert content.content == PNG
    assert (await client.get(f"/api/files/{body['id']}/content", params={"size": "huge"})).status_code == 422


async def test_another_owners_file_is_a_404(client: AsyncClient, session: AsyncSession) -> None:
    body = await _upload(client, PNG)
    session.add(User(id=2, email="other@example.com", name="Other", password_hash="unused"))
    await session.commit()
    stored = await session.get(StoredFile, body["id"])
    assert stored is not None
    stored.owner_id = 2
    await session.commit()
    for path in (f"/api/files/{body['id']}", f"/api/files/{body['id']}/content"):
        response = await client.get(path)
        assert response.status_code == 404
        assert response.json() == {"detail": "File not found"}
    assert (await client.get("/api/files/999")).status_code == 404
    assert (await client.get("/api/files/999/content")).status_code == 404


async def test_signed_out_is_a_401(client: AsyncClient) -> None:
    client.cookies.clear()
    assert (await client.post("/api/files", content=PNG)).status_code == 401
    assert (await client.get("/api/files/1/content")).status_code == 401
