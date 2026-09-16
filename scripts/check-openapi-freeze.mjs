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

// Hash the content, not the raw bytes: git's CRLF/LF normalization (there's
// no .gitattributes pinning this file's line endings) means the same commit
// can check out as LF or CRLF depending on the machine's core.autocrlf, and
// a byte-for-byte hash would flake on that alone.
function normalize(text) {
  return text.replace(/\r\n/g, "\n");
}

const actual = createHash("sha256").update(normalize(readFileSync(specPath, "utf8"))).digest("hex");
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
