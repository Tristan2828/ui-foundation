import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Every primitive gets one CSF story titled `ui/<Name>` with a single
// `AllVariants` export (see src/components/ui/*.stories.tsx) — kept in
// sync by hand with the primitives listed here. Story ids are Storybook's
// own deterministic `title`+export slug, e.g. `ui-button--all-variants`.
const STORYBOOK_URL = 'http://localhost:6006'
const PRIMITIVES = [
  'button',
  'badge',
  'card',
  'input',
  'sidebar',
  'sheet',
  'tooltip',
  'separator',
  'skeleton',
  'spinner',
  'empty',
  'toast',
]

function storyUrl(name: string, theme: 'light' | 'dark') {
  return `${STORYBOOK_URL}/iframe.html?id=ui-${name}--all-variants&viewMode=story&globals=theme:${theme}`
}

// Storybook's iframe.html is an isolated component preview, not a full
// page — it has no <main>, no <h1>, and content isn't wrapped in a
// landmark by design. axe's page-structure rules exist to catch real
// pages missing this; on a story preview they're false positives, not a
// component defect (the old kitchen-sink test never hit this because it
// ran against the full /kitchen-sink page, which had both).
function analyzeStory(page: import('@playwright/test').Page) {
  return new AxeBuilder({ page })
    .disableRules(['landmark-one-main', 'page-has-heading-one', 'region'])
    .analyze()
}

test.describe('storybook dark mode screenshots', () => {
  for (const name of PRIMITIVES) {
    test(`${name} story matches its dark-mode baseline`, async ({ page }) => {
      await page.goto(storyUrl(name, 'dark'))
      await expect(page.locator('html')).toHaveClass(/dark/)
      await expect(page).toHaveScreenshot(`storybook-${name}-dark.png`, {
        animations: 'disabled',
      })
    })
  }
})

test.describe('storybook stories have zero axe violations', () => {
  for (const name of PRIMITIVES) {
    test(`${name} story is accessible`, async ({ page }) => {
      await page.goto(storyUrl(name, 'light'))
      const results = await analyzeStory(page)
      expect(results.violations).toEqual([])
    })
  }
})

// Phase 3 and 4 both flagged dark-mode contrast for --destructive /
// --destructive-foreground as verified only by hand-computed ratios, never
// by a check. axe's color-contrast rule running against the rendered dark
// DOM is that check, for this token and every other one. Kept per-story
// (not one page-wide pass like the retired kitchen-sink test) so a
// contrast regression in any single primitive still fails independently.
test.describe('storybook stories have zero axe violations in dark mode', () => {
  for (const name of PRIMITIVES) {
    test(`${name} story is accessible in dark mode`, async ({ page }) => {
      await page.goto(storyUrl(name, 'dark'))
      await expect(page.locator('html')).toHaveClass(/dark/)
      const results = await analyzeStory(page)
      expect(results.violations).toEqual([])
    })
  }
})
