"""GET /environment — see openapi.yaml operationId getDataEnvironment.

Which data this backend serves, for the app's DataEnvironmentBanner: the
DATA_LABEL setting (app/config.py), null for production data. No session
needed: the banner shows on /login too, and the label names a database,
not anything about a user.
"""

from fastapi import APIRouter

from app.config import DATA_LABEL
from app.openapi_responses import SERVER_ERROR
from app.schemas import DataEnvironmentOut

router = APIRouter(tags=["environment"])


@router.get("/environment", response_model=DataEnvironmentOut, responses=SERVER_ERROR)
async def get_data_environment() -> DataEnvironmentOut:
    return DataEnvironmentOut(data_label=DATA_LABEL)
