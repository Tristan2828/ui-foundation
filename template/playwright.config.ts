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
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // The off-canvas sheet only exists below the mobile breakpoint.
      testIgnore: ['mobile-sidebar.spec.ts'],
    },
    // A phone-width run of the screen-state specs only, not a second full
    // suite. Nothing in src/routes or src/components/app carries a
    // breakpoint: what responsiveness exists is inherited from shadcn (the
    // sidebar becomes an off-canvas sheet, the toolbar wraps, DataTable
    // scrolls horizontally behind its pinned column). That works, but
    // until this project existed nothing asserted it, so a regression at
    // phone width was invisible.
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      // Not shell.spec.ts: it asserts the *persistent* sidebar and its
      // expand/collapse cookie, which below the mobile breakpoint is an
      // off-canvas sheet instead — a different component, not a narrower
      // one. mobile-sidebar.spec.ts covers that sheet.
      testMatch: ['widgets-table.spec.ts', 'widget-view.spec.ts', 'a11y.spec.ts', 'mobile-sidebar.spec.ts'],
    },
  ],
  webServer: {
    // Self-contained: build then preview, so `playwright test` doesn't
    // depend on a build step having already run in the calling shell/CI job.
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
