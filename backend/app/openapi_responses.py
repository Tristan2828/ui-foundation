"""Shared `responses=` fragments so every router documents the exact error
shapes openapi.yaml declares, instead of FastAPI's default auto-docs (which
don't know about dynamically raised HTTPExceptions at all, and name the
422 model differently). Constants only — not a layer.
"""

from typing import Any

from app.schemas import HTTPErrorBody, ValidationErrorBody

ResponsesDict = dict[int | str, dict[str, Any]]

UNAUTHORIZED: ResponsesDict = {401: {"model": HTTPErrorBody, "description": "Missing or invalid credentials."}}
NOT_FOUND: ResponsesDict = {404: {"model": HTTPErrorBody, "description": "Resource not found."}}
VALIDATION: ResponsesDict = {422: {"model": ValidationErrorBody, "description": "Validation failed."}}
SERVER_ERROR: ResponsesDict = {500: {"model": HTTPErrorBody, "description": "Unhandled server error."}}

LIST_RESPONSES = {**UNAUTHORIZED, **SERVER_ERROR}
CREATE_RESPONSES = {**UNAUTHORIZED, **VALIDATION, **SERVER_ERROR}
GET_RESPONSES = {**UNAUTHORIZED, **NOT_FOUND, **SERVER_ERROR}
UPDATE_RESPONSES = {**UNAUTHORIZED, **NOT_FOUND, **VALIDATION, **SERVER_ERROR}
DELETE_RESPONSES = {**UNAUTHORIZED, **NOT_FOUND, **SERVER_ERROR}
