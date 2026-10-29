"""The app's own start-up (app/main.py's lifespan): what it refuses. The
package's push, jobs and MCP code is tested in the package
(packages/backend-foundation/tests)."""

import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from foundation_backend import config, push
from app.main import app, lifespan


async def test_the_app_refuses_to_start_with_push_on_and_no_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "PUSH_ENABLED", True)
    monkeypatch.setattr(config, "VAPID_SUBJECT", "mailto:ops@example.com")
    monkeypatch.setattr(config, "VAPID_PRIVATE_KEY", None)
    with pytest.raises(RuntimeError, match="VAPID_PRIVATE_KEY"):
        async with lifespan(app):
            pass
    # With the key it gets past the check (and stops at nothing else here).
    monkeypatch.setattr(config, "VAPID_PRIVATE_KEY", push.private_key_b64(ec.generate_private_key(ec.SECP256R1())))
    assert push.config_problem() is None
