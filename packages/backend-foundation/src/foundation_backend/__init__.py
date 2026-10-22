"""The auth and security layer every app built on ui-foundation shares
(the PyPI package `ui-foundation-backend`). README.md says what is in it
and how an app uses it.
"""

# The release version, the same as @tristan2828/ui-foundation's. The release
# workflow writes it into pyproject.toml; this reads it back.
from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("ui-foundation-backend")
except PackageNotFoundError:  # imported from a source tree, not installed
    __version__ = "0.0.0"
