import { defineConfig, devices } from '@playwright/test'

// This repo's own Storybook tests (e2e/storybook-visual.spec.ts, the
// rich-text round trip in e2e/rich-text-editor.spec.ts, rich text edited
// inline in e2e/rich-text-inline.spec.ts, EntityView's
// layouts in e2e/entity-view.spec.ts, DataTable's opt-ins in
// e2e/data-table.spec.ts, the scale glyphs' names in e2e/scales.spec.ts,
// DateField's time zones in e2e/date-field.spec.ts, SessionView's timed
// screen in e2e/session-view.spec.ts, MultiPick's picks saved one by one
// in e2e/multi-pick.spec.ts, ImageField and images in <Markdown>
// in e2e/images.spec.ts, ModuleStrip at desktop and phone widths in
// e2e/module-card.spec.ts, ListEditor's rows that open in
// e2e/list-editor.spec.ts) —
// kept out of the shipped playwright.config.ts so consuming apps don't
// need Storybook. `npm run verify` runs both configs.
export default defineConfig({
  testDir: './e2e',
  testMatch: ['storybook-visual.spec.ts', 'rich-text-editor.spec.ts', 'rich-text-inline.spec.ts', 'entity-view.spec.ts', 'data-table.spec.ts', 'app-shell.spec.ts', 'scales.spec.ts', 'date-field.spec.ts', 'session-view.spec.ts', 'editable-list.spec.ts', 'multi-pick.spec.ts', 'images.spec.ts', 'module-card.spec.ts', 'list-editor.spec.ts'],
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
