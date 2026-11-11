import { defineConfig, devices } from '@playwright/test'

// This repo's own browser tests, run against the fixtures harness (e2e/harness/) (e2e/fixtures-visual.spec.ts, the
// rich-text round trip in e2e/rich-text-editor.spec.ts, rich text edited
// inline in e2e/rich-text-inline.spec.ts, EntityView's
// layouts in e2e/entity-view.spec.ts, DataTable's opt-ins in
// e2e/data-table.spec.ts, the scale glyphs' names in e2e/scales.spec.ts,
// DateField's time zones in e2e/date-field.spec.ts, SessionView's timed
// screen in e2e/session-view.spec.ts, MultiPick's picks saved one by one
// in e2e/multi-pick.spec.ts, ImageField and images in <Markdown>
// in e2e/images.spec.ts, ModuleStrip at desktop and phone widths in
// e2e/module-card.spec.ts, defineA11ySuite's view check on a
// `mobile="row"` page in e2e/a11y-suite.spec.ts, ListEditor's rows that open in
// e2e/list-editor.spec.ts, DataTable's card layouts in
// e2e/data-table-layouts.spec.ts, SpinWheel's spins in
// e2e/spin-wheel.spec.ts, FillInQueue's records in e2e/fill-in-queue.spec.ts, a hub's
// folded summaries, accordion and Customize sheet in e2e/widget-hub.spec.ts, DataTable's
// groupings and detail panel in e2e/data-table-grouping.spec.ts, folding
// by headings and NotesOutline in e2e/folding.spec.ts, a record opened in a dialog over its list in e2e/record-dialog.spec.ts, task items ticked in <Markdown> in e2e/markdown-tasks.spec.ts, one-line Markdown in rows in e2e/markdown-inline.spec.ts, EntityView's Print notes in e2e/entity-view-print.spec.ts, tables in written text in e2e/rich-text-tables.spec.ts, an app's palette and its picker in e2e/palettes.spec.ts, page links and PageTrail in e2e/page-links.spec.ts, EntityView's tabs, leading mark and rail fields beside in e2e/entity-view-tabs.spec.ts, MonthDayField's days in e2e/month-day-field.spec.ts, the page standards' small parts in e2e/new-parts.spec.ts, the page standards' small parts in e2e/new-parts.spec.ts, the navigation standard in AppShell in e2e/app-shell-standard.spec.ts) —
// kept out of the shipped playwright.config.ts so consuming apps don't
// need the harness. `npm run verify` runs both configs.
export default defineConfig({
  testDir: './e2e',
  testMatch: ['fixtures-visual.spec.ts', 'rich-text-editor.spec.ts', 'rich-text-tools.spec.ts', 'rich-text-inline.spec.ts', 'entity-view.spec.ts', 'data-table.spec.ts', 'app-shell.spec.ts', 'scales.spec.ts', 'date-field.spec.ts', 'emoji-field.spec.ts', 'session-view.spec.ts', 'editable-list.spec.ts', 'edit-in-place-presets.spec.ts', 'multi-pick.spec.ts', 'images.spec.ts', 'module-card.spec.ts', 'list-editor.spec.ts', 'widget-card.spec.ts', 'line-chart.spec.ts', 'app-shell-bottom-bar.spec.ts', 'app-shell-standard.spec.ts', 'board.spec.ts', 'data-table-layouts.spec.ts', 'spin-wheel.spec.ts', 'fill-in-queue.spec.ts', 'widget-hub.spec.ts', 'data-table-grouping.spec.ts', 'folding.spec.ts', 'record-dialog.spec.ts', 'markdown-tasks.spec.ts', 'markdown-inline.spec.ts', 'entity-view-print.spec.ts', 'rich-text-tables.spec.ts', 'rich-text-table-widths.spec.ts', 'palettes.spec.ts', 'a11y-suite.spec.ts', 'page-links.spec.ts', 'entity-view-tabs.spec.ts', 'month-day-field.spec.ts', 'entity-view-standard.spec.ts', 'new-parts.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: { trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // A static build, not the dev server: on-demand compilation races
    // Playwright's parallel first loads.
    command: 'npm run build-harness && npm run preview-harness',
    url: 'http://localhost:6180',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
