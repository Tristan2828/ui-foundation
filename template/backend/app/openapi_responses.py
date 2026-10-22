"""Shared `responses=` fragments: the foundation's
(`foundation_backend.openapi_responses`), re-exported for this app's
routers. Constants only — not a layer.
"""

from foundation_backend.openapi_responses import (
    ResponsesDict as ResponsesDict,
    UNAUTHORIZED as UNAUTHORIZED,
    NOT_FOUND as NOT_FOUND,
    VALIDATION as VALIDATION,
    RATE_LIMITED as RATE_LIMITED,
    SIGN_IN_EXPIRED as SIGN_IN_EXPIRED,
    CONFLICT as CONFLICT,
    SERVER_ERROR as SERVER_ERROR,
    LIST_RESPONSES as LIST_RESPONSES,
    CREATE_RESPONSES as CREATE_RESPONSES,
    GET_RESPONSES as GET_RESPONSES,
    UPDATE_RESPONSES as UPDATE_RESPONSES,
    DELETE_RESPONSES as DELETE_RESPONSES,
)
