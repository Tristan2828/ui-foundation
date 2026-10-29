"""The smallest app made of the package: what an app's `main.py` includes
from it, with nothing of an app's own. The tests run against this, so they
show the package works without the template around it."""

from fastapi import FastAPI

from foundation_backend.errors import register_error_handlers
from foundation_backend.routers import auth, client_errors, environment, jobs, mcp, oauth, push

app = FastAPI(title="foundation_backend tests")
register_error_handlers(app)
app.include_router(auth.router, prefix="/api")
app.include_router(auth.register_router, prefix="/api")
app.include_router(client_errors.router, prefix="/api")
app.include_router(environment.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(push.router, prefix="/api")
app.include_router(oauth.router)
app.include_router(mcp.router)
