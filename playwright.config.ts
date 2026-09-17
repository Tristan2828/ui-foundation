import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Self-contained: build then preview, so `playwright test` doesn't
      // depend on a build step having already run in the calling shell/CI job.
      command: 'npm run build && npm run preview -- --port 4173',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // Same build-then-preview shape as above, targeting the Storybook
      // static build instead of the app — e2e/storybook-visual.spec.ts
      // navigates to this origin directly rather than via `baseURL`.
      // `storybook dev`'s on-demand Vite compilation was tried first and
      // is flaky under Playwright's parallel workers (concurrent
      // first-load requests race the dev-server's lazy transform); the
      // static build has no such race.
      command: 'npm run build-storybook && npm run preview-storybook',
      url: 'http://localhost:6006',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
