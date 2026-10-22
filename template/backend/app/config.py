"""This app's settings, read once, from the environment. The foundation's
(the database, sessions, sign-in limits, TOTP, error reporting, AI chats'
OAuth, the seeded account) come from `foundation_backend.config` and are
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

# Scheduled jobs (app/jobs.py, docs/deploy.md "Scheduled jobs"): whether
# this process runs the registered jobs on their schedules. On by default
# with APP_ENV=production, off otherwise, so a dev server or a test runs a
# job only when asked (POST /api/jobs/{name}/run, or JOBS_ENABLED=true).
JOBS_ENABLED: bool = os.environ.get("JOBS_ENABLED", "true" if APP_ENV == "production" else "false").lower() == "true"
# How long a job's runs are kept in job_runs.
JOB_RUNS_KEEP_DAYS: int = int(os.environ.get("JOB_RUNS_KEEP_DAYS", "30"))

# Reminders through Web Push (app/push.py, app/reminders.py, docs/deploy.md
# "Reminders (Web Push)"). Off by default: /api/push/* answer 404 and the
# send-reminders job isn't registered. On needs the push extra
# (`pip install -e ".[push]"`), and the app refuses to start without it or
# the two VAPID settings.
PUSH_ENABLED: bool = os.environ.get("PUSH_ENABLED", "false").lower() == "true"
# The app's VAPID private key, base64url (scripts/generate_vapid_keys.py).
# A secret: never in the repo. Every subscription is made with its public
# half, so changing it stops every device's reminders until each allows
# them again.
VAPID_PRIVATE_KEY: str | None = os.environ.get("VAPID_PRIVATE_KEY", "").strip() or None
# How the push services reach whoever runs the app: mailto:ops@example.com
# or an https:// page.
VAPID_SUBJECT: str | None = os.environ.get("VAPID_SUBJECT", "").strip() or None
# The only hosts (and their subdomains) the backend sends a push to: the
# browsers' push services. The endpoint comes from the browser, so without
# this a signed-in user could make the backend POST anywhere.
DEFAULT_PUSH_ALLOWED_HOSTS = "fcm.googleapis.com,updates.push.services.mozilla.com,push.apple.com,notify.windows.com"
PUSH_ALLOWED_HOSTS: tuple[str, ...] = tuple(
    host.strip().lower()
    for host in os.environ.get("PUSH_ALLOWED_HOSTS", DEFAULT_PUSH_ALLOWED_HOSTS).split(",")
    if host.strip()
)
