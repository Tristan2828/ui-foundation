import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// A list's header as wide as its framed table (4.106, the list standard's
// C3): with the ListHeader passed as DataTable's `pageHeader`, the header,
// the views and the card share the table's width, so New ends on the
// card's right edge above a short table, and further out on a wider one
// (up to the page's edge). A phone is unchanged.
const HARNESS = 'http://localhost:6180/story.html?id='

const right = async (page: Page, selector: string) => {
  const box = await page.locator(selector).first().boundingBox()
  expect(box).not.toBeNull()
  return box!.x + box!.width
}
const newRight = async (page: Page) => {
  const box = await page.getByRole('button', { name: 'New Plant' }).boundingBox()
  return box!.x + box!.width
}

for (const width of [1440, 1920]) {
  test(`a short table: New ends on the card's right edge (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${HARNESS}app-datatable-tools--header-at-table-edge`)
    const card = await right(page, '[data-slot=data-table-frame]')
    expect(Math.abs((await newRight(page)) - card)).toBeLessThanOrEqual(1)
    // Well short of the page's edge: the table is three columns.
    expect(card).toBeLessThan(width - 200)
  })

  test(`a wide table: New follows the card's wider edge (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${HARNESS}app-datatable-tools--header-at-table-edge-wide`)
    const card = await right(page, '[data-slot=data-table-frame]')
    expect(Math.abs((await newRight(page)) - card)).toBeLessThanOrEqual(1)
    // Every column: well past the short table's three.
    expect(card).toBeGreaterThan(1000)
  })
}

test('on a phone the header spans the screen, as before', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(`${HARNESS}app-datatable-tools--header-at-table-edge`)
  await expect(page.locator('[data-shared-width]')).toHaveCount(0)
  // New ends where the list does: the page's own padding, not a table's edge.
  expect(Math.abs((await newRight(page)) - (await right(page, '[data-look=framed]')))).toBeLessThanOrEqual(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
})

for (const [theme, query] of [
  ['light', 'theme=light'],
  ['dark', 'theme=dark'],
] as const) {
  test(`no axe violations at 1440 (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${HARNESS}app-datatable-tools--header-at-table-edge&${query}`)
    await expect(page.getByRole('button', { name: 'New Plant' })).toBeVisible()
    const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
    expect(results.violations).toEqual([])
  })
}
