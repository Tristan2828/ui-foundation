"""normalize_database_url: a connection string pasted as a provider gives
it (with libpq-only params asyncpg can't use), or a plain postgresql://
one, becomes one SQLAlchemy + asyncpg accept, and its sslmode becomes
DATABASE_SSL's default. The settings are read at import, so the last
tests reload the module under a patched environment."""

import importlib
from collections.abc import Callable, Iterator
from types import ModuleType

import dotenv
import pytest

from foundation_backend import config
from foundation_backend.config import normalize_database_url

PROVIDER = "postgresql://user:pw@db.example.com/appdb?sslmode=require&channel_binding=require"


def test_a_provider_string_as_copied_becomes_asyncpg_with_ssl_implied() -> None:
    url, ssl = normalize_database_url(PROVIDER)
    assert url == "postgresql+asyncpg://user:pw@db.example.com/appdb"
    assert ssl is True


def test_a_plain_postgresql_url_becomes_asyncpg_and_implies_nothing() -> None:
    url, ssl = normalize_database_url("postgresql://app:pw@postgres:5432/app")
    assert url == "postgresql+asyncpg://app:pw@postgres:5432/app"
    assert ssl is None


def test_an_already_normalized_url_passes_through_and_implies_nothing() -> None:
    local = "postgresql+asyncpg://ui_foundation:ui_foundation@localhost:5432/ui_foundation"
    assert normalize_database_url(local) == (local, None)


def test_sslmode_disable_implies_no_ssl_and_other_params_are_kept() -> None:
    url, ssl = normalize_database_url("postgres://u:p@host/db?sslmode=disable&application_name=app")
    assert url == "postgresql+asyncpg://u:p@host/db?application_name=app"
    assert ssl is False


def test_surrounding_whitespace_from_a_paste_is_dropped() -> None:
    url, ssl = normalize_database_url(f"  {PROVIDER}\n")
    assert url == "postgresql+asyncpg://user:pw@db.example.com/appdb"
    assert ssl is True


@pytest.fixture
def reload_config(monkeypatch: pytest.MonkeyPatch) -> Iterator[Callable[[dict[str, str]], ModuleType]]:
    """Reloads foundation_backend.config with exactly these database
    settings (no .env file read), then reloads it again as it was."""

    def reload(env: dict[str, str]) -> ModuleType:
        monkeypatch.setattr(dotenv, "load_dotenv", lambda *args, **kwargs: False)
        for name in ("DATABASE_URL", "DATABASE_SSL"):
            monkeypatch.delenv(name, raising=False)
        for name, value in env.items():
            monkeypatch.setenv(name, value)
        return importlib.reload(config)

    yield reload
    monkeypatch.undo()
    importlib.reload(config)


def test_the_settings_read_the_normalized_url_and_the_implied_ssl(
    reload_config: Callable[[dict[str, str]], ModuleType],
) -> None:
    settings = reload_config({"DATABASE_URL": PROVIDER})
    assert settings.DATABASE_URL == "postgresql+asyncpg://user:pw@db.example.com/appdb"
    assert settings.DATABASE_SSL is True
    plain = reload_config({"DATABASE_URL": "postgresql://app:pw@postgres:5432/app"})
    assert plain.DATABASE_URL == "postgresql+asyncpg://app:pw@postgres:5432/app"
    assert plain.DATABASE_SSL is False


def test_an_explicit_database_ssl_wins_over_the_urls_sslmode(
    reload_config: Callable[[dict[str, str]], ModuleType],
) -> None:
    off = reload_config({"DATABASE_URL": PROVIDER, "DATABASE_SSL": "false"})
    assert off.DATABASE_SSL is False
    on = reload_config({"DATABASE_URL": "postgresql://u:p@host/db?sslmode=disable", "DATABASE_SSL": "true"})
    assert on.DATABASE_SSL is True
