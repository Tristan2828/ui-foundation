#!/usr/bin/env node
// openapi.yaml is frozen as of Phase 2 (docs/BUILD-PLAN.md Phase 2, step 9)
// until v1.1.0. Enforced here as a committed hash, rather than a git-tag
// diff, so the check works the same in a shallow CI checkout as it does
// locally, and the only way to change the spec is to deliberately update
// openapi.yaml.sha256 in the same commit — a visible, reviewable diff.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const specPath = new URL("../openapi.yaml", import.meta.url);
const lockPath = new URL("../openapi.yaml.sha256", import.meta.url);

const actual = createHash("sha256").update(readFileSync(specPath)).digest("hex");
const expected = readFileSync(lockPath, "utf8").trim();

if (actual !== expected) {
  console.error(
    `check-openapi-freeze: openapi.yaml has changed since it was frozen in Phase 2.\n` +
      `  expected sha256 ${expected}\n` +
      `  actual   sha256 ${actual}\n` +
      `Changes to openapi.yaml wait for v1.1.0 (see docs/BUILD-PLAN.md Phase 2, step 9).\n` +
      `If this change is deliberate and approved, update openapi.yaml.sha256 to match.`,
  );
  process.exit(1);
}

console.log("check-openapi-freeze: openapi.yaml matches its frozen hash.");
