"""The database engine and the session dependency: the foundation's
(`foundation_backend.db`), re-exported so `from app.db import get_session`
works. No repository layer on purpose — routers call the session directly.
"""

from foundation_backend.db import (
    engine as engine,
    get_session as get_session,
)
