"""The backend's dependency allowlist (#236): foundation_backend.scripts.check_deps
against small pyproject.toml and deps-allowlist.json files."""

import json
from pathlib import Path

import pytest

from foundation_backend.scripts.check_deps import main

PYPROJECT = """
[project]
name = "app-backend"
version = "0.1.0"
dependencies = [
  "ui-foundation-backend",
  "fastapi==0.141.1",
  "uvicorn[standard]==0.53.0",
]

[project.optional-dependencies]
push = ["cryptography==50.0.2"]
dev = ["pytest==9.1.1"]
"""

ALLOWED = ["ui-foundation-backend", "fastapi", "uvicorn", "cryptography", "pytest"]


def run(tmp_path: Path, pyproject: str, allowed: list[str] | None = ALLOWED) -> int:
    (tmp_path / "pyproject.toml").write_text(pyproject, encoding="utf-8")
    allowlist: dict[str, object] = {"dependencies": []}
    if allowed is not None:
        allowlist["python"] = allowed
    (tmp_path / "deps-allowlist.json").write_text(json.dumps(allowlist), encoding="utf-8")
    return main(["--pyproject", str(tmp_path / "pyproject.toml"), "--allowlist", str(tmp_path / "deps-allowlist.json")])


def test_passes_when_every_requirement_is_listed_and_pinned(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert run(tmp_path, PYPROJECT) == 0
    assert "all 5 declared Python requirements" in capsys.readouterr().out


def test_names_a_dependency_that_is_not_listed(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert run(tmp_path, PYPROJECT.replace('"fastapi==0.141.1",', '"fastapi==0.141.1",\n  "requests==2.33.0",')) == 1
    assert 'dependencies: "requests" is not in' in capsys.readouterr().err


def test_checks_every_optional_group_and_dependency_group(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    extra = PYPROJECT + '\n[dependency-groups]\nlint = ["ruff==0.14.0", {include-group = "dev"}]\n'
    assert run(tmp_path, extra.replace('dev = ["pytest==9.1.1"]', 'dev = ["pytest==9.1.1", "rich==14.0.0"]')) == 1
    err = capsys.readouterr().err
    assert 'optional-dependencies.dev: "rich"' in err
    assert 'dependency-groups.lint: "ruff"' in err


def test_requires_an_exact_pin_except_for_the_foundation_package(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert run(tmp_path, PYPROJECT.replace("fastapi==0.141.1", "fastapi>=0.141")) == 1
    assert '"fastapi>=0.141" is not pinned' in capsys.readouterr().err


def test_reads_names_as_pep_503_does(tmp_path: Path) -> None:
    assert run(tmp_path, PYPROJECT.replace("fastapi==", "FastAPI=="), [*ALLOWED]) == 0
    assert run(tmp_path, PYPROJECT, ["UI_Foundation.Backend", "fastapi", "uvicorn", "cryptography", "pytest"]) == 0


def test_fails_without_a_python_list(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert run(tmp_path, PYPROJECT, None) == 1
    assert 'has no "python" list' in capsys.readouterr().err
