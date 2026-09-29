import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // e2e/ holds Playwright specs, not vitest unit tests — excluded so the
    // two runners don't fight over the same files.
    // .claude/worktrees: a nested worktree under the project root is a
    // normal occurrence in an agent-built repo — without this, one
    // session's in-progress specs run in another session's verify.
    exclude: ['**/node_modules/**', 'e2e/**', '**/.claude/worktrees/**'],
    // No test files exist before Phase 2 (gateway/mock-conformance tests).
    // Without this, an empty suite is a hard failure instead of a no-op.
    passWithNoTests: true,
  },
})
