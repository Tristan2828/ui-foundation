"""This app's settings, read once, from the environment. The foundation's
(the database, sessions, sign-in limits, TOTP, error reporting, AI chats'
OAuth, scheduled jobs, Web Push, the seeded account) come from `foundation_backend.config` and are
re-exported here, so `from app.config import DATA_LABEL` works for both.
Code that changes one at runtime (a test's monkeypatch) patches it on
`foundation_backend.config`, where the package reads it.
"""

import os

from dotenv import load_dotenv

# Before the foundation's settings are read: this finds backend/.env from
# this file, wherever the process was started.
load_dotenv()

from foundation_backend.config import *  # noqa: E402,F403
from foundation_backend.config import APP_ENV  # noqa: E402

# dist/ is the frontend build (`npm run build:real` for a deployment; its
# build-info.json says so, foundation_backend.deploy_checks); resolved relative to this
# file so it works regardless of the process's working directory.
STATIC_DIR: str = os.environ.get(
    "STATIC_DIR",
    os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "dist")),
)
