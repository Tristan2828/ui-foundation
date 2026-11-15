import AxeBuilder from './axe'
import { expect, test, type Locator, type Page } from '@playwright/test'

// ListHeader's description and the secondary action's hint (4.120): one
// muted line under the title, wrapping in the header's width (and never
// widening a framed table's shared width); a short line under the second
// button ("12 searches left") that describes it, the buttons level; on a
// phone the description sits under the title's row and the hint goes
// with the button into ⋯, under its words.
const HARNESS = 'http://localhost:6180/story.html?id=app-listheader--description'
const FRAMED = 'http://localhost:6180/story.html?id=app-datatable-tools--header-at-table-edge'

const header = (page: Page, title: string) => page.locator('[data-slot=list-header]').filter({ has: page.getByRole('heading', { name: title }) })
const box = async (locator: Locator) => (await locator.boundingBox())!

test('the description is a muted line under the title', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HARNESS)
  const searches = header(page, 'Saved Searches')
  const line = searches.locator('[data-slot=list-header-description]')
  await expect(line).toHaveText('Each search runs against the catalog once a day.')
  const title = await box(searches.getByRole('heading', { level: 1 }))
  expect((await box(line)).y).toBeGreaterThanOrEqual(title.y + title.height - 1)
  // The long one wraps inside its header.
  const suppliers = header(page, 'Suppliers')
  const long = await box(suppliers.locator('[data-slot=list-header-description]'))
  expect(long.height).toBeGreaterThan(30)
  expect(long.x + long.width).toBeLessThanOrEqual((await box(suppliers)).x + (await box(suppliers)).width + 1)
})

test("a description doesn't widen a framed table's shared header", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(FRAMED)
  const card = await box(page.locator('[data-slot=data-table-frame]'))
  // A long description, set on the drawn header as an app would pass it.
  await page.locator('[data-slot=list-header]').evaluate((node) => {
    const line = document.createElement('p')
    line.dataset.slot = 'list-header-description'
    line.className = 'mt-1 max-w-prose type-body text-muted-foreground contain-inline-size'
    line.textContent = 'A sentence of context long enough to run past a three-column table if it were allowed to set the width of the header above it.'
    node.insertBefore(line, node.lastElementChild)
  })
  const after = await box(page.locator('[data-slot=data-table-frame]'))
  expect(Math.abs(after.width - card.width)).toBeLessThan(1)
  const line = await box(page.locator('[data-slot=list-header-description]'))
  expect(line.x + line.width).toBeLessThanOrEqual(after.x + after.width + 1)
})

test('the hint is a line under the second button, which it describes, the buttons level', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HARNESS)
  const searches = header(page, 'Saved Searches')
  const run = searches.getByRole('button', { name: 'Run Now' })
  await expect(run).toHaveAccessibleDescription('12 searches left')
  const hint = searches.locator('[data-slot=action-hint-text]')
  const button = await box(run)
  expect((await box(hint)).y).toBeGreaterThanOrEqual(button.y + button.height - 1)
  const neu = await box(searches.getByRole('button', { name: 'New search' }))
  const more = await box(searches.getByRole('button', { name: 'More for Saved Searches' }))
  expect(Math.abs(neu.y - button.y)).toBeLessThan(1)
  expect(Math.abs(more.y - button.y)).toBeLessThan(1)
  await run.click()
  await expect(hint).toHaveText('11 searches left')
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('the description is under the title and its buttons; the hint goes into ⋯ with the button', async ({ page }) => {
    await page.goto(HARNESS)
    const searches = header(page, 'Saved Searches')
    const title = await box(searches.getByRole('heading', { level: 1 }))
    const neu = await box(searches.getByRole('button', { name: 'New search' }))
    // Under the title and its buttons (which wrap under a long title), never between them.
    const line = await box(searches.locator('[data-slot=list-header-description]'))
    expect(line.y).toBeGreaterThanOrEqual(Math.max(title.y + title.height, neu.y + neu.height) - 1)
    await expect(searches.locator('[data-slot=action-hint]')).toBeHidden()
    await searches.getByRole('button', { name: 'More for Saved Searches' }).click()
    const item = page.getByRole('menuitem').first()
    await expect(item).toHaveAccessibleName(/^Run Now ?, 12 searches left$/)
    await expect(item.locator('[data-slot=list-header-secondary-item-hint]')).toHaveText('12 searches left')
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
  })
})

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 375]) {
    test(`a description and a hint have no axe violations (${theme}, ${width})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${HARNESS}&theme=${theme}`)
      await expect(page.locator('[data-slot=list-header-description]').first()).toBeVisible()
      const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
      expect(results.violations).toEqual([])
    })
  }
}
