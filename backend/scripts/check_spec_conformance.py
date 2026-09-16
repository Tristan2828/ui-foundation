#!/usr/bin/env python
"""Phase 8 item 6: diff FastAPI's generated OpenAPI document against the
hand-written openapi.yaml. Treats the generated spec as a conformance
test of the contract (docs/BUILD-PLAN.md "Contract Direction"), not a
byte-for-byte comparison — component names and extra FastAPI-only
responses (e.g. its automatic 422 on routes with typed query/path params,
which openapi.yaml does not document) are expected to differ. What must
match: every path/method/status the contract declares exists here, with a
response schema exposing the same property names.

Needs no database — app.openapi() only introspects route signatures.
"""

import re
import sys
from pathlib import Path
from typing import Any

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.main import app  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]


def resolve(spec: dict[str, Any], node: dict[str, Any]) -> dict[str, Any]:
    while "$ref" in node:
        ref = node["$ref"].removeprefix("#/")
        target: Any = spec
        for part in ref.split("/"):
            target = target[part]
        node = target
    if "allOf" in node:
        merged: dict[str, Any] = {}
        for part in node["allOf"]:
            merged.update(resolve(spec, part))
        return {**node, **merged}
    return node


def response_properties(spec: dict[str, Any], response: dict[str, Any]) -> set[str] | None:
    schema = response.get("content", {}).get("application/json", {}).get("schema")
    if schema is None:
        return None
    resolved = resolve(spec, schema)
    if resolved.get("type") == "array":
        resolved = resolve(spec, resolved["items"])
    return set(resolved.get("properties", {}).keys()) or None


def normalize(path: str) -> str:
    # Path-parameter names are FastAPI-internal (openapi.yaml uses {id};
    # routers may use a more descriptive {widget_id}) — only position and
    # count matter for wire conformance, not the name.
    return re.sub(r"\{[^}]+\}", "{}", path)


def main() -> int:
    contract = yaml.safe_load((REPO_ROOT / "openapi.yaml").read_text())
    generated = app.openapi()
    generated_by_normalized_path = {normalize(p): p for p in generated.get("paths", {})}
    errors: list[str] = []

    for path, methods in contract["paths"].items():
        for method, operation in methods.items():
            if method not in ("get", "post", "patch", "put", "delete"):
                continue
            contract_path = f"/api{path}"
            full_path = generated_by_normalized_path.get(normalize(contract_path))
            gen_op = generated.get("paths", {}).get(full_path, {}).get(method) if full_path else None
            if gen_op is None:
                errors.append(f"{method.upper()} {contract_path}: missing from generated spec")
                continue
            for status_code, response in operation.get("responses", {}).items():
                gen_response = gen_op.get("responses", {}).get(str(status_code))
                if gen_response is None:
                    errors.append(f"{method.upper()} {contract_path} {status_code}: missing from generated spec")
                    continue
                want = response_properties(contract, response)
                got = response_properties(generated, gen_response)
                if want is not None and want != got:
                    errors.append(
                        f"{method.upper()} {contract_path} {status_code}: property mismatch — "
                        f"contract {sorted(want)} vs generated {sorted(got or set())}"
                    )

    if errors:
        for error in errors:
            print(f"check-spec-conformance: {error}", file=sys.stderr)
        return 1

    print("check-spec-conformance: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
