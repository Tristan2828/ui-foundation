"""Exception handlers pinned to openapi.yaml's error shapes: the
foundation's (`foundation_backend.errors`), re-exported.
"""

from foundation_backend.errors import (
    register_error_handlers as register_error_handlers,
)
