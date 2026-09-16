#!/usr/bin/env bash
# Exit criteria for Phase 2 — Contract and Boundary.
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "check-phase-2: $1" >&2; exit 1; }

# Cumulative: Phase 2 must not have broken Phase 1 (also runs `npm run
# verify`, which covers this phase's gateway/mock-conformance/e2e tests too).
scripts/check-phase-1.sh

[ -f openapi.yaml ] || fail "openapi.yaml missing"
[ -f openapi.yaml.sha256 ] || fail "openapi.yaml.sha256 missing — the spec must be frozen (Phase 2 step 9)"
node scripts/check-openapi-freeze.mjs || fail "openapi.yaml does not match its frozen hash"

[ -f src/api/contracts.ts ] || fail "src/api/contracts.ts missing"
grep -q "type Page<T>" src/api/contracts.ts || fail "contracts.ts has no Page<T>"
grep -q "type AppError" src/api/contracts.ts || fail "contracts.ts has no AppError"
grep -q "type QuerySpec" src/api/contracts.ts || fail "contracts.ts has no QuerySpec"

[ -d src/api/gateway ] && [ -n "$(find src/api/gateway -name '*.ts' -not -name '*.d.ts')" ] ||
  fail "src/api/gateway/ has no implementation"
[ -d src/api/transport ] && [ -n "$(find src/api/transport -name '*.ts')" ] ||
  fail "src/api/transport/ has no implementation"

GATEWAY_TESTS=$(find tests/gateway -name '*.test.ts' 2>/dev/null || true)
[ -n "$GATEWAY_TESTS" ] || fail "no gateway tests found under tests/gateway/"
for f in $GATEWAY_TESTS; do
  [ -s "$f" ] || fail "$f is empty"
  grep -q "AppError" "$f" || fail "$f does not reference AppError — is this really a gateway translation test?"
done

MOCK_TESTS=$(find tests/mocks -name '*.test.ts' 2>/dev/null || true)
[ -n "$MOCK_TESTS" ] || fail "no mock-conformance tests found under tests/mocks/"
for f in $MOCK_TESTS; do
  [ -s "$f" ] || fail "$f is empty"
done
grep -rq "openapi.yaml" tests/mocks || fail "mock-conformance tests don't appear to load openapi.yaml"

[ -d src/mocks ] && [ -f src/mocks/handlers.ts ] || fail "src/mocks/handlers.ts missing"
[ -f e2e/msw-contract.spec.ts ] || fail "e2e/msw-contract.spec.ts missing (proves MSW serves the contract with no backend)"

# The transport-import boundary rule must actually fail lint, not just exist.
FIXTURE="src/__check_phase_2_boundary_fixture.ts"
printf 'import { apiFetch } from "./api/transport";\nexport const x = apiFetch;\n' > "$FIXTURE"
if npx eslint "$FIXTURE" >/tmp/check-phase-2-lint.txt 2>&1; then
  rm -f "$FIXTURE" /tmp/check-phase-2-lint.txt
  fail "a fixture importing from api/transport/ did not fail lint"
fi
rm -f "$FIXTURE" /tmp/check-phase-2-lint.txt

# All six Phase 4 field types must be in the (now-frozen) Widget schema —
# this is the last point in the plan where they could still be added.
declare -a FORCES=(
  "forces a combobox with async search"
  "forces Select input . badge rendering"
  "forces a date picker"
  "forces empty-state display"
  "forces locale-aware formatting"
  "forces a textarea"
)
FLATTENED=$(tr '\n' ' ' < openapi.yaml | tr -s ' ')
for force in "${FORCES[@]}"; do
  echo "$FLATTENED" | grep -qi "$force" || fail "openapi.yaml's Widget schema is missing a field documented to: $force"
done

echo "check-phase-2: PASS"
