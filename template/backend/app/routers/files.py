"""/files — see openapi.yaml operationIds uploadFile, getFile and
getFileContent. Pictures for a record or for text (a widget's description
in the template): the picture itself as the request body, its type read
from its bytes, its bytes kept in Postgres beside its row, and served
behind the session with the headers foundation_backend.uploads sets. No
list and no delete: a file is reached through what points at it.
"""

import hashlib
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import Response
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db import get_session
from app.models import StoredFile, StoredFileContent, User
from app.openapi_responses import GET_RESPONSES, SERVER_ERROR, UNAUTHORIZED, VALIDATION, ResponsesDict
from app.schemas import FileOut, HTTPErrorBody
from foundation_backend.routers.auth import get_current_user
from foundation_backend.uploads import IMAGE_MAX_BYTES, IMAGE_TYPES, image_response, image_type, read_upload

router = APIRouter(tags=["files"], dependencies=[Depends(get_current_user)])

REFUSED = "Only a JPEG, PNG or WebP image can be uploaded."

UPLOAD_RESPONSES: ResponsesDict = {
    **UNAUTHORIZED,
    413: {"model": HTTPErrorBody, "description": "The file is over 10 MB."},
    **VALIDATION,
    **SERVER_ERROR,
}
# The request body is the picture's bytes, whatever type the browser says.
UPLOAD_BODY = {
    "requestBody": {
        "required": True,
        "content": {kind: {"schema": {"type": "string", "format": "binary"}} for kind in IMAGE_TYPES},
    }
}
CONTENT_RESPONSES: ResponsesDict = {
    200: {"content": {kind: {} for kind in IMAGE_TYPES}, "description": "The picture's bytes."},
    **GET_RESPONSES,
}


def _refuse(msg: str) -> RequestValidationError:
    return RequestValidationError([{"loc": ("body", "file"), "msg": msg, "type": "value_error"}])


async def _get_or_404(file_id: int, user: User, session: AsyncSession) -> StoredFile:
    stored = await session.get(StoredFile, file_id)
    # Someone else's file is indistinguishable from a missing one.
    if stored is None or stored.owner_id != user.id:
        raise HTTPException(status_code=404, detail="File not found")
    return stored


@router.post(
    "/files",
    response_model=FileOut,
    status_code=201,
    responses=UPLOAD_RESPONSES,
    openapi_extra=UPLOAD_BODY,
)
async def upload_file(
    request: Request,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> StoredFile:
    data = await read_upload(request, IMAGE_MAX_BYTES)
    if not data:
        raise _refuse("The file is empty.")
    # The bytes say what it is; the name and the Content-Type are not asked.
    content_type = image_type(data)
    if content_type is None:
        raise _refuse(REFUSED)
    stored = StoredFile(
        owner_id=user.id or 0,
        content_type=content_type,
        byte_size=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
        created_at=datetime.now(timezone.utc),
    )
    session.add(stored)
    await session.flush()
    session.add(StoredFileContent(file_id=stored.id or 0, data=data))
    await session.commit()
    await session.refresh(stored)
    return stored


@router.get("/files/{file_id}", response_model=FileOut, responses=GET_RESPONSES)
async def get_file(
    file_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> StoredFile:
    return await _get_or_404(file_id, user, session)


@router.get("/files/{file_id}/content", response_class=Response, responses=CONTENT_RESPONSES)
async def get_file_content(
    file_id: int,
    # Taken and ignored: there is one copy. The address matches an app that
    # keeps a thumbnail too, so stored text never changes if one comes.
    size: Literal["large", "thumb"] = Query(default="large"),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    stored = await _get_or_404(file_id, user, session)
    content = await session.get(StoredFileContent, stored.id)
    if content is None:
        # The row without its bytes: a restore gone wrong, not the caller's.
        raise HTTPException(status_code=404, detail="File not found")
    return image_response(content.data, stored.content_type, file_id)
