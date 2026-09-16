#!/usr/bin/env node
// Fails if package.json names a dependency that is not in deps-allowlist.json.
// Run as part of `verify:fast` so an agent cannot quietly install an unapproved package.
import { readFileSync, existsSync } from 'node:fs';

const allowlistPath = new URL('../deps-allowlist.json', import.meta.url);
const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
const allowed = new Set([...allowlist.dependencies, ...allowlist.devDependencies]);

const pkgPath = new URL('../package.json', import.meta.url);
if (!existsSync(pkgPath)) {
  console.log('check-deps: no package.json yet (Phase 1 not started) — nothing to check.');
  process.exit(0);
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const declared = { ...pkg.dependencies, ...pkg.devDependencies };
const violations = Object.keys(declared).filter((name) => !allowed.has(name));

if (violations.length > 0) {
  for (const name of violations) {
    console.error(
      `check-deps: "${name}" is not in deps-allowlist.json. If it is needed, write the case in docs/BLOCKERS.md and stop.`,
    );
  }
  process.exit(1);
}

console.log(`check-deps: all ${Object.keys(declared).length} declared dependencies are allowlisted.`);
