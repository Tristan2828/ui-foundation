import { defineConfig, devices } from '@playwright/test'

// This repo's own browser tests, run against the fixtures harness (e2e/harness/): e2e/fixtures-visual.spec.ts and the
// per-component specs beside it. Kept out of the shipped playwright.config.ts so consuming apps don't need the harness;
// `npm run verify` runs both configs.
// The editor's specs, run on the phone project too.
const RICH_TEXT_SPECS = ['rich-text-editor.spec.ts', 'rich-text-tools.spec.ts', 'rich-text-inline.spec.ts', 'rich-text-tables.spec.ts', 'rich-text-table-widths.spec.ts', 'rich-text-phone.spec.ts']

export default defineConfig({
  testDir: './e2e',
  testMatch: ['fixtures-visual.spec.ts', 'rich-text-editor.spec.ts', 'rich-text-perf.spec.ts', 'rich-text-tools.spec.ts', 'rich-text-inline.spec.ts', 'entity-view.spec.ts', 'entity-view-width.spec.ts', 'data-table.spec.ts', 'app-shell.spec.ts', 'scales.spec.ts', 'date-field.spec.ts', 'date-choices.spec.ts', 'emoji-field.spec.ts', 'emoji.spec.ts', 'icon-field.spec.ts', 'pill-filter.spec.ts', 'session-view.spec.ts', 'editable-list.spec.ts', 'edit-in-place-presets.spec.ts', 'multi-pick.spec.ts', 'images.spec.ts', 'image-shrink.spec.ts', 'module-card.spec.ts', 'list-editor.spec.ts', 'widget-card.spec.ts', 'line-chart.spec.ts', 'stacked-area-chart.spec.ts', 'app-shell-bottom-bar.spec.ts', 'app-shell-bar-search.spec.ts', 'app-shell-standard.spec.ts', 'board.spec.ts', 'data-table-layouts.spec.ts', 'spin-wheel.spec.ts', 'fill-in-queue.spec.ts', 'widget-hub.spec.ts', 'data-table-grouping.spec.ts', 'folding.spec.ts', 'record-dialog.spec.ts', 'markdown-tasks.spec.ts', 'markdown-inline.spec.ts', 'entity-view-print.spec.ts', 'rich-text-tables.spec.ts', 'rich-text-table-widths.spec.ts', 'palettes.spec.ts', 'a11y-suite.spec.ts', 'page-links.spec.ts', 'entity-view-tabs.spec.ts', 'month-day-field.spec.ts', 'entity-view-standard.spec.ts', 'dialog.spec.ts', 'form-dialog.spec.ts', 'new-parts.spec.ts', 'overview-page.spec.ts', 'entity-form.spec.ts', 'data-table-tools.spec.ts', 'app-shell-trail-search.spec.ts', 'form-controls.spec.ts', 'feedback.spec.ts', 'equal-items.spec.ts', 'recurrence-field.spec.ts', 'record-standard.spec.ts', 'app-shell-tiles.spec.ts', 'app-shell-phone-counts.spec.ts', 'data-table-framed.spec.ts', 'record-tabs.spec.ts', 'editable-value.spec.ts', 'review-looks.spec.ts', 'data-table-views.spec.ts', 'data-table-view-counts.spec.ts', 'facts-rail.spec.ts', 'list-header-width.spec.ts', 'error-state.spec.ts', 'date-filter.spec.ts', 'page-tabs-status.spec.ts', 'fact-list.spec.ts', 'facts-rail-status.spec.ts', 'facts-rail-rating.spec.ts', 'rating-input.spec.ts', 'list-header-secondary.spec.ts', 'record-extras.spec.ts', 'list-header-description.spec.ts', 'overview-links.spec.ts', 'page-gaps.spec.ts', 'color-field.spec.ts', 'rich-text-phone.spec.ts', 'fact-badge-tones.spec.ts', 'form-conflict.spec.ts', 'step-track.spec.ts', 'notify-open.spec.ts', 'image-viewer.spec.ts', 'quick-add-input.spec.ts', 'month-calendar.spec.ts', 'density.spec.ts', 'settings-page.spec.ts', 'week-start.spec.ts', 'facts-rail-long.spec.ts'],
  fullyParallel: true,
  // PW_WORKERS=1 (or 50%) runs the suite with fewer workers on a machine
  // short of memory; unset, Playwright picks its default.
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) || process.env.PW_WORKERS : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: { trace: 'on-first-retry' },
  projects: [
    { name: 'chromium', testIgnore: 'rich-text-perf.spec.ts', use: { ...devices['Desktop Chrome'] } },
    // The rich-text editor on a phone (review F11): a touch screen, where
    // its toolbar is the bar pinned to the keyboard and its small controls
    // take a 40px tap. A laptop-only test skips itself here (`isMobile`).
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: RICH_TEXT_SPECS },
    // The typing budget (CPU throttled) runs alone, once the rest are done:
    // other specs on the machine's CPU would be measured with it.
    { name: 'perf', testMatch: 'rich-text-perf.spec.ts', dependencies: ['chromium', 'phone'], fullyParallel: false, use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // A static build, not the dev server: on-demand compilation races
    // Playwright's parallel first loads.
    command: 'npm run build-harness && npm run preview-harness',
    url: 'http://localhost:6180',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
