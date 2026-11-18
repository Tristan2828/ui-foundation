import { expect, test, type Locator } from '@playwright/test'

// Several items in one fact (4.111), on the harness's FactList "Links box":
// a Related row of long linked titles with kind icons, a For row with a
// bullet, and a Tasks box drawn with FactList. Each item is marked, the
// marks sit on the item's first line, a wrapped line starts where the
// first line's words do (a hanging indent), and the items have room
// between them.
const URL = 'http://localhost:6180/story.html?id=app-factlist--links-box&theme=light'

const rect = (locator: Locator) => locator.evaluate((node) => node.getBoundingClientRect().toJSON() as DOMRect)

test('each linked record is its own item, led by its kind icon', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 })
  await page.goto(URL)
  const related = page.locator('[data-slot=fact-list]').first()
  const items = related.locator('[data-slot=fact-list-item]')
  await expect(items).toHaveCount(3)
  await expect(related.getByRole('link', { name: /Ask the landlord/ })).toHaveAttribute('href', '/discussions/3')
  await expect(related.getByRole('link', { name: /floor plan.*opens in a new tab/ })).toHaveAttribute('target', '_blank')
  // Every item has an icon, hidden from screen readers.
  for (const item of await items.all()) {
    await expect(item.locator('[data-slot=fact-list-mark] svg')).toHaveCount(1)
    await expect(item.locator('[data-slot=fact-list-mark]')).toHaveAttribute('aria-hidden', 'true')
  }
  // The long title wraps, and its second line starts where its first does, after the mark.
  const first = items.first()
  const link = first.getByRole('link')
  const lines = await link.evaluate((node) => [...node.getClientRects()].map((r) => ({ left: r.left, top: r.top })))
  expect(lines.length).toBeGreaterThan(1)
  expect(new Set(lines.map((line) => Math.round(line.left))).size).toBe(1)
  const mark = await rect(first.locator('[data-slot=fact-list-mark]'))
  expect(lines[0].left).toBeGreaterThan(mark.right)
  // The mark sits on the first line, not the middle of the item.
  expect(Math.abs(mark.top - (await rect(first)).top)).toBeLessThan(2)
  // Room between items.
  const second = await rect(items.nth(1))
  expect(second.top - (await rect(first)).bottom).toBeGreaterThanOrEqual(4)
})

test('an item with no icon gets a bullet; no items is the empty label', async ({ page }) => {
  await page.goto(URL)
  const forItem = page.locator('[data-slot=fact-list-item]', { hasText: 'Facilities' })
  await expect(forItem.locator('[data-slot=fact-list-mark] svg')).toHaveCount(0)
  await expect(forItem.locator('[data-slot=fact-list-mark] > span')).toHaveCount(1)
  await expect(page.getByText('Nothing yet')).toBeVisible()
})

test("an app's own box uses the same list, named by its aria-label", async ({ page }) => {
  await page.goto(URL)
  const tasks = page.getByRole('list', { name: 'Tasks' })
  await expect(tasks.getByRole('listitem')).toHaveCount(3)
  await expect(tasks.locator('[data-slot=fact-list-mark] > span')).toHaveCount(3)
})
