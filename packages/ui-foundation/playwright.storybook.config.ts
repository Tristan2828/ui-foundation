import { defineConfig, devices } from '@playwright/test'

// This repo's own Storybook tests (e2e/storybook-visual.spec.ts, the
// rich-text round trip in e2e/rich-text-editor.spec.ts, EntityView's
// layouts in e2e/entity-view.spec.ts, DataTable's opt-ins in
// e2e/data-table.spec.ts) —
// kept out of the shipped playwright.config.ts so consuming apps don't
// need Storybook. `npm run verify` runs both configs.
export default defineConfig({
  testDir: './e2e',
  testMatch: ['storybook-visual.spec.ts', 'rich-text-editor.spec.ts', 'entity-view.spec.ts', 'data-table.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: { trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // A static build, not `storybook dev`: the dev server's on-demand
    // compilation races Playwright's parallel first loads.
    command: 'npm run build-storybook && npm run preview-storybook',
    url: 'http://localhost:6006',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
