import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // PW_WORKERS=1 (or 50%) runs the suite with fewer workers on a machine
  // short of memory; unset, Playwright picks its default.
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) || process.env.PW_WORKERS : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    // vite.config.ts's preview port.
    baseURL: 'http://localhost:4180',
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
      testMatch: ['widgets-table.spec.ts', 'widget-view.spec.ts', 'widget-edit-in-place.spec.ts', 'a11y.spec.ts', 'mobile-sidebar.spec.ts'],
    },
  ],
  webServer: {
    // Self-contained: build then preview, so `playwright test` doesn't
    // depend on a build step having already run in the calling shell/CI job.
    command: 'npm run build && npm run preview',
    // On the mocks, the preview's /api proxy (vite.config.ts) goes to port 9,
    // where nothing listens: a request that bypasses MSW fails (and the
    // package's test fixture names it) rather than reaching a backend
    // running on :8000. Against the real API it's left alone.
    env: process.env.VITE_API === 'real' ? {} : { BACKEND_URL: 'http://127.0.0.1:9' },
    url: 'http://localhost:4180',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
