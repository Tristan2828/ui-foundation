import { expect, test, type Page } from '@playwright/test'

// EntityView's page width (4.133): data-width="wide" on an ancestor lifts
// the record's reading cap, so on a TV the column fills the page and the
// facts rail stays 300px; a dialog keeps its cap; a phone is unchanged.
// Axe and the token check in both themes are e2e/fixtures-visual.spec.ts's.
const story = (name: string) => `http://localhost:6180/story.html?id=app-entityview--${name}`
const view = (page: Page) => page.locator('[data-state="success"][data-layout]').first()

async function widths(page: Page) {
  const root = view(page)
  await expect(root).toBeVisible()
  return root.evaluate((el) => {
    const rail = el.querySelector('[data-slot="entity-view-facts-rail"]')
    return { view: el.getBoundingClientRect().width, rail: rail ? rail.getBoundingClientRect().width : 0 }
  })
}
const noSpill = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

test('at 1920, wide fills the page with the record, the rail still 300px', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(story('facts-rail'))
  const regular = await widths(page)
  await page.goto(story('page-wide'))
  const wide = await widths(page)
  expect(wide.view).toBeGreaterThan(regular.view + 400)
  expect(wide.rail).toBeCloseTo(300, 0)
  expect(regular.rail).toBeCloseTo(300, 0)
  expect(await noSpill(page)).toBe(0)
})

test('a record without the rail fills the page too', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(story('tabs-column'))
  const regular = await widths(page)
  await page.goto(story('page-wide-column'))
  const wide = await widths(page)
  expect(regular.view).toBeLessThanOrEqual(896 + 1)
  expect(wide.view).toBeGreaterThan(1500)
  expect(await noSpill(page)).toBe(0)
})

test('in a dialog the record keeps its cap', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(story('facts-rail'))
  const regular = await widths(page)
  await page.goto(story('page-wide-in-dialog'))
  const inDialog = await widths(page)
  expect(Math.abs(inDialog.view - regular.view)).toBeLessThanOrEqual(1)
})

test('on a phone, wide changes nothing', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto(story('facts-rail'))
  const regular = await widths(page)
  await page.goto(story('page-wide'))
  const wide = await widths(page)
  expect(Math.abs(wide.view - regular.view)).toBeLessThanOrEqual(1)
  expect(await noSpill(page)).toBe(0)
})
