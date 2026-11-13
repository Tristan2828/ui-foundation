import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// EntityView's facts rail (4.106, record standard A1): on a laptop the
// short facts sit in a 300px column beside the strip and the tabs, and
// aren't repeated in Details; with nothing else, there's no Details tab.
// On a phone they fold back into Details. Axe in both themes and every
// palette is fixtures-visual.spec.ts's (the stories named there); the
// rail itself is measured here at desktop width, where it's drawn.
const HARNESS = 'http://localhost:6180/story.html?id='

const rail = (page: Page) => page.getByRole('complementary', { name: 'Office move facts' })
const tabs = (page: Page) => page.getByRole('tablist', { name: 'Office move sections' }).getByRole('tab')

for (const width of [1440, 1920]) {
  test(`beside the strip and the tabs, 300px wide, top-aligned with the strip (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${HARNESS}app-entityview--facts-rail`)
    await expect(rail(page)).toBeVisible()
    const railBox = (await rail(page).boundingBox())!
    const stripBox = (await page.locator('[data-slot=entity-view-strip]').boundingBox())!
    const tabsBox = (await page.getByRole('tablist').boundingBox())!
    expect(railBox.width).toBe(300)
    expect(Math.abs(railBox.y - stripBox.y)).toBeLessThan(2)
    expect(railBox.x).toBeGreaterThan(tabsBox.x + tabsBox.width)
    // The labels sit beside their values.
    const status = rail(page).getByText('Status', { exact: true })
    const open = rail(page).getByText('Open', { exact: true })
    expect((await open.boundingBox())!.x).toBeGreaterThan((await status.boundingBox())!.x + 40)
    expect(Math.abs((await open.boundingBox())!.y - (await status.boundingBox())!.y)).toBeLessThan(6)
  })
}

test("what's in the rail isn't repeated in Details; Details keeps the rest", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${HARNESS}app-entityview--facts-rail`)
  await expect(tabs(page)).toHaveText(['Purpose', 'Linked2', 'Details'])
  await page.getByRole('tab', { name: 'Details' }).click()
  const details = page.getByRole('tabpanel')
  await expect(details.getByRole('heading', { name: 'Closing' })).toBeVisible()
  await expect(details.getByRole('heading', { name: 'Facts' })).toHaveCount(0)
  // The long-titled linked records are a tab, never the rail.
  await expect(rail(page).getByText(/loading bay/)).toHaveCount(0)
})

test('everything fits the rail: no Details tab', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${HARNESS}app-entityview--facts-rail-only`)
  await expect(rail(page)).toBeVisible()
  await expect(tabs(page)).toHaveText(['Purpose', 'Linked2'])
})

test('each kind draws one short line: status, text, record, badges, count, link, empty', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${HARNESS}app-entityview--facts-rail`)
  const facts = rail(page)
  await expect(facts.locator('[data-slot=status-mark][data-kind=active]')).toHaveText('Open')
  await expect(facts.getByRole('link', { name: 'Sam Example' })).toHaveAttribute('href', '/people/3')
  await expect(facts.getByRole('link', { name: '4' })).toHaveAttribute('href', '/tasks?project=1')
  const out = facts.getByRole('link', { name: /Plan \(PDF\)/ })
  await expect(out).toHaveAttribute('target', '_blank')
  await expect(out).toHaveAttribute('rel', 'noreferrer')
  await expect(facts.getByText('Finance')).toBeVisible()
  await expect(facts.getByText('Not booked')).toBeVisible()
})

test('on a phone the rail folds back into Details', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(`${HARNESS}app-entityview--facts-rail-only`)
  await expect(page.locator('[data-slot=entity-view-facts-rail]')).toHaveCount(0)
  await expect(tabs(page)).toHaveText(['Purpose', 'Linked2', 'Details'])
  await page.getByRole('tab', { name: 'Details' }).click()
  await expect(page.getByRole('tabpanel').getByRole('heading', { name: 'Facts' })).toBeVisible()
  await expect(page.getByRole('tabpanel').getByText('Sam Example')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
})

test('the rail follows the room it has: narrowing the window folds it, widening brings it back', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${HARNESS}app-entityview--facts-rail-only`)
  await expect(rail(page)).toBeVisible()
  await page.setViewportSize({ width: 800, height: 900 })
  await expect(page.locator('[data-slot=entity-view-facts-rail]')).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Details' })).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(rail(page)).toBeVisible()
})

for (const [theme, query] of [
  ['light', 'theme=light'],
  ['dark', 'theme=dark'],
  ['graphite-periwinkle', 'theme=dark&palette=graphite-periwinkle'],
] as const) {
  test(`the rail at desktop width has no axe violations (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${HARNESS}app-entityview--facts-rail&${query}`)
    await expect(rail(page)).toBeVisible()
    const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
    expect(results.violations).toEqual([])
  })
}
