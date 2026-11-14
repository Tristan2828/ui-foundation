import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

// ListHeader's secondary action (4.117): one outline button beside New,
// before it, New still the primary (filled). On a phone it folds into ⋯
// as the menu's first item; a list with nothing else in ⋯ shows ⋯ on a
// phone only. Disabled (a refresh in flight) it's disabled in both
// places. As a framed DataTable's `pageHeader` it's the same component.
const HARNESS = 'http://localhost:6180/story.html?id=app-listheader--secondary-action'

const header = (page: Page, title: string) =>
  page.locator('[data-slot=list-header]').filter({ has: page.getByRole('heading', { name: new RegExp(`^${title}`) }) })
const box = async (locator: Locator) => (await locator.boundingBox())!

test('the secondary action is a button beside New, before it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HARNESS)
  const feeds = header(page, 'Feeds')
  const refresh = feeds.getByRole('button', { name: 'Refresh Now' })
  const create = feeds.getByRole('button', { name: 'New feed' })
  await expect(refresh).toBeVisible()
  await expect(refresh).toHaveAttribute('data-slot', 'list-header-secondary')
  const [r, n] = [await box(refresh), await box(create)]
  expect(r.x + r.width).toBeLessThanOrEqual(n.x)
  expect(n.x - (r.x + r.width)).toBeLessThan(12)
  expect(Math.abs(r.y - n.y)).toBeLessThan(2)
  // New is the primary: filled; the secondary is outlined, unfilled.
  const fill = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(await fill(refresh)).not.toEqual(await fill(create))
  // ⋯ holds the rest, not the secondary action, at this width.
  await feeds.getByRole('button', { name: 'More for Feeds' }).click()
  await expect(page.getByRole('menuitem', { name: 'Export' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Refresh Now' })).toBeHidden()
  await page.keyboard.press('Escape')
  // A list with nothing else in ⋯ has no ⋯ here.
  const books = header(page, 'Books')
  await expect(books.getByRole('button', { name: 'Add from Catalog' })).toBeVisible()
  await expect(books.getByRole('button', { name: 'More for Books' })).toBeHidden()
})

test('a click runs it; disabled while it runs', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HARNESS)
  const refresh = header(page, 'Feeds').getByRole('button', { name: 'Refresh Now' })
  await refresh.click()
  await expect(refresh).toBeDisabled()
  await expect(refresh).toBeEnabled()
  await expect(page.getByTestId('secondary-log')).toHaveText('Refreshed 1, added 0')
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('it folds into ⋯ as the first item', async ({ page }) => {
    await page.goto(HARNESS)
    const feeds = header(page, 'Feeds')
    await expect(feeds.getByRole('button', { name: 'Refresh Now' })).toBeHidden()
    await expect(feeds.getByRole('button', { name: 'New feed' })).toBeVisible()
    await feeds.getByRole('button', { name: 'More for Feeds' }).click()
    const items = page.getByRole('menuitem')
    await expect(items.first()).toHaveText('Refresh Now')
    await expect(page.getByRole('menuitem', { name: 'Export' })).toBeVisible()
    await items.first().click()
    await expect(page.getByTestId('secondary-log')).toHaveText('Refreshed 1, added 0')
  })

  test("a list with nothing else in ⋯ gets ⋯ for it", async ({ page }) => {
    await page.goto(HARNESS)
    const books = header(page, 'Books')
    await expect(books.getByRole('button', { name: 'Add from Catalog' })).toBeHidden()
    await books.getByRole('button', { name: 'More for Books' }).click()
    await expect(page.getByRole('menuitem')).toHaveText(['Add from Catalog'])
    await expect(page.getByRole('separator')).toHaveCount(0)
    await page.getByRole('menuitem', { name: 'Add from Catalog' }).click()
    await expect(page.getByTestId('secondary-log')).toHaveText('Refreshed 0, added 1')
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
  })
})

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 375]) {
    test(`the headers have no axe violations (${theme}, ${width})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${HARNESS}&theme=${theme}`)
      await expect(page.getByRole('heading', { name: /^Feeds/ })).toBeVisible()
      const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
      expect(results.violations).toEqual([])
    })
  }

  test(`the phone's menu open has no axe violations (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${HARNESS}&theme=${theme}`)
    await header(page, 'Feeds').getByRole('button', { name: 'More for Feeds' }).click()
    await expect(page.getByRole('menuitem', { name: 'Refresh Now' })).toBeVisible()
    await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'))
    const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
    expect(results.violations).toEqual([])
  })
}
