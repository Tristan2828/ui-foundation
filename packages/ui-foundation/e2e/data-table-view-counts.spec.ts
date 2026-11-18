import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from './axe'

// A view's count on its pill (4.127), on the harness's ViewCounts list:
// Needs a Look's count is the app's query (2 once it's back), Resting's
// is 0, Current and All have none. Counts Loading / Counts Loaded switches
// the query, so the pills can be measured before and after it lands.
const HARNESS = 'http://localhost:6180/story.html?id=app-datatable-tools--view-counts'

const views = (page: Page) => page.getByRole('group', { name: 'Views' })
const pills = (page: Page) => views(page).getByRole('button')
const boxes = (page: Page) => pills(page).evaluateAll((all) => all.map((pill) => pill.getBoundingClientRect().toJSON() as DOMRect))
const loadCounts = (page: Page) => page.getByRole('button', { name: 'Counts Loaded' }).click()

for (const width of [1280, 390]) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } })

    test('the count follows the label, is in its name, and 0 shows none', async ({ page }) => {
      await page.goto(`${HARNESS}&theme=light`)
      await expect(pills(page)).toHaveText(['Current', 'Needs a Look', 'Resting', 'All'])
      await loadCounts(page)
      await expect(pills(page)).toHaveText(['Current', 'Needs a Look · 2', 'Resting', 'All'])
      await expect(pills(page).nth(1)).toHaveAccessibleName('Needs a Look, 2')
      await expect(pills(page).nth(2)).toHaveAccessibleName('Resting')
      // A phone's pills scroll on their own line, never the page.
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
      await views(page).getByRole('button', { name: 'Needs a Look, 2' }).click()
      await expect(pills(page).nth(1)).toHaveAttribute('aria-pressed', 'true')
    })

    test('no pill moves or changes size when the counts arrive', async ({ page }) => {
      await page.goto(`${HARNESS}&theme=light`)
      await expect(pills(page)).toHaveCount(4)
      const before = await boxes(page)
      await loadCounts(page)
      await expect(pills(page).nth(1)).toHaveText('Needs a Look · 2')
      expect(await boxes(page)).toEqual(before)
    })
  })
}

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1280, 390]) {
    test(`counted pills, pressed and not, have no axe violations (${theme}, ${width})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto(`${HARNESS}&theme=${theme}`)
      await loadCounts(page)
      await views(page).getByRole('button', { name: 'Needs a Look, 2' }).click()
      await expect(pills(page).nth(1)).toHaveAttribute('aria-pressed', 'true')
      const results = await new AxeBuilder({ page })
        .include('[data-slot=data-table-views]')
        .analyze()
      expect(results.violations).toEqual([])
    })
  }
}
