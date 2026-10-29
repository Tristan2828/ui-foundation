"""Hold the backend's Python dependencies to the app's allowlist, as
`ui-foundation check-deps` holds package.json's (#236):

    cd backend && .venv/Scripts/python -m foundation_backend.scripts.check_deps

Every requirement in pyproject.toml's `[project] dependencies`, each
`[project.optional-dependencies]` group and each `[dependency-groups]`
group must name a distribution in the `python` list of the app's
`deps-allowlist.json` (one folder up), and be pinned with `==`. The one
exception to the pin is `ui-foundation-backend` itself, which the
ui-foundation repo installs editable, unpinned. An addition to the list
is a person's decision: if one is needed, the case goes in
docs/BLOCKERS.md. The template's backend/scripts/verify.sh runs it.
"""

import argparse
import json
import re
import sys
import tomllib
from pathlib import Path

# PEP 508: the name, then extras, a version or a marker.
NAME = re.compile(r"^\s*([A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)")
UNPINNED_ALLOWED = {"ui-foundation-backend"}


def normalize(name: str) -> str:
    """PEP 503's name: case and runs of `-`, `_` and `.` don't matter."""
    return re.sub(r"[-_.]+", "-", name).lower()


def requirements(pyproject: dict[str, object]) -> list[tuple[str, str]]:
    """Every requirement as (where it's declared, the requirement)."""
    found: list[tuple[str, str]] = []
    project = pyproject.get("project")
    if isinstance(project, dict):
        for requirement in project.get("dependencies", []):
            found.append(("dependencies", requirement))
        for group, listed in project.get("optional-dependencies", {}).items():
            for requirement in listed:
                found.append((f"optional-dependencies.{group}", requirement))
    groups = pyproject.get("dependency-groups")
    if isinstance(groups, dict):
        for group, listed in groups.items():
            for requirement in listed:
                # A group can include another ({include-group = "..."}), which isn't a requirement.
                if isinstance(requirement, str):
                    found.append((f"dependency-groups.{group}", requirement))
    return found


def problems(pyproject: dict[str, object], allowed: list[str]) -> list[str]:
    """What breaks the rules, one line each; empty when nothing does."""
    allowed_names = {normalize(name) for name in allowed}
    found: list[str] = []
    for where, requirement in requirements(pyproject):
        match = NAME.match(requirement)
        if match is None:
            found.append(f'{where}: "{requirement}" names no distribution')
            continue
        name = normalize(match.group(1))
        if name not in allowed_names:
            found.append(
                f'{where}: "{match.group(1)}" is not in deps-allowlist.json\'s "python" list. '
                "If it is needed, write the case in docs/BLOCKERS.md and stop."
            )
        elif "==" not in requirement and name not in UNPINNED_ALLOWED:
            found.append(f'{where}: "{requirement}" is not pinned: give it an exact version (==)')
    return found


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else None)
    parser.add_argument("--pyproject", default="pyproject.toml", type=Path)
    parser.add_argument("--allowlist", default="../deps-allowlist.json", type=Path)
    args = parser.parse_args(argv)

    if not args.allowlist.exists():
        print(f"check_deps: no {args.allowlist} here", file=sys.stderr)
        return 1
    allowlist = json.loads(args.allowlist.read_text(encoding="utf-8"))
    allowed = allowlist.get("python")
    if not isinstance(allowed, list):
        print(f'check_deps: {args.allowlist} has no "python" list', file=sys.stderr)
        return 1
    pyproject = tomllib.loads(args.pyproject.read_text(encoding="utf-8"))

    found = problems(pyproject, allowed)
    for line in found:
        print(f"check_deps: {line}", file=sys.stderr)
    if found:
        return 1
    print(f"check_deps: all {len(requirements(pyproject))} declared Python requirements are allowlisted and pinned")
    return 0


if __name__ == "__main__":
    sys.exit(main())
