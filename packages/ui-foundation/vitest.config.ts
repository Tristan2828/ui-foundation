import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    environment: 'node',
    // e2e/ holds Playwright specs. .claude/worktrees: a nested worktree is a
    // normal occurrence in an agent-built repo, and its specs must not run here.
    exclude: ['**/node_modules/**', 'e2e/**', '**/.claude/worktrees/**'],
  },
})
