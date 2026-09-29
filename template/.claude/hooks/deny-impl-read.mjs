#!/usr/bin/env node
// PreToolUse hook for the spec-tester subagent: refuses any Read of the
// gateway or transport implementation. This is what makes "tests written
// from openapi.yaml, not from the implementation" an enforced guarantee
// instead of a prompt instruction. Must be declared in spec-tester.md's own
// frontmatter — subagents do not inherit hooks from .claude/settings.json.
import { readFileSync } from 'node:fs';

const DENIED_PATTERNS = [/src[\\/]api[\\/]gateway[\\/]/, /src[\\/]api[\\/]transport[\\/]/];

let input = '';
try {
  input = readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}

let payload;
try {
  payload = JSON.parse(input);
} catch {
  process.exit(0);
}

const filePath = payload?.tool_input?.file_path ?? '';
if (DENIED_PATTERNS.some((re) => re.test(filePath))) {
  console.error(
    `spec-tester may not read implementation files. Denied: ${filePath}. Write tests from openapi.yaml and contracts.ts only.`,
  );
  process.exit(2);
}

process.exit(0);
