import { expect, test } from '@playwright/test'

// The page standards' small parts (app/Timeline, app/ValueList,
// app/ListHeader): what markup tests can't say. The timeline's date moves
// above its entry under 24rem of its own width, Show all adds the rest,
// +N opens its tooltip on focus, and Show deleted comes on and off from
// the ⋯ menu. Axe and the glyph check are e2e/fixtures-visual.spec.ts's.
const story = (id: string) => `http://localhost:6180/story.html?id=${id}`

test.describe('Timeline', () => {
  test('dates sit left of their entry, in one column, and Show all adds the rest', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 900 })
    await page.goto(story('app-timeline--default'))
    const items = page.locator('[data-slot="timeline-item"]')
    await expect(items).toHaveCount(5)
    const first = items.first()
    const date = await first.locator('time').boundingBox()
    const body = await first.getByText('Raised at the visit').boundingBox()
    expect(date!.x + date!.width).toBeLessThan(body!.x)
    expect(Math.abs(date!.y - body!.y)).toBeLessThan(8)
    // The dates' right edges line up down the column.
    const edges = await items.locator('time').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().right)))
    expect(new Set(edges).size).toBe(1)
    await page.getByRole('button', { name: 'Show all 7' }).click()
    await expect(items).toHaveCount(7)
    await expect(page.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true')
  })

  test('under 24rem the date moves above its entry', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 })
    await page.goto(story('app-timeline--in-a-narrow-card'))
    const first = page.locator('[data-slot="timeline-item"]').first()
    const date = await first.locator('time').boundingBox()
    const body = await first.getByText('Raised at the visit').boundingBox()
    expect(date!.y + date!.height).toBeLessThanOrEqual(body!.y + 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
  })
})

test.describe('ValueList', () => {
  test('two values and +N, the folded ones in a tooltip on focus', async ({ page }) => {
    await page.goto(story('app-valuelist--default'))
    const row = page.getByRole('row', { name: /Example capsule B/ })
    await expect(row.locator('[data-slot="value-list-item"]')).toHaveCount(2)
    const more = row.getByRole('button', { name: '3 more: General, Sleep, Stomach' })
    await expect(more).toHaveText('+3')
    await more.focus()
    await expect(page.locator('[data-slot=tooltip-content][data-open]')).toHaveText('General, Sleep, Stomach')
    // Every row's chips start in one column, however many values the row has.
    const lefts = await page.locator('[data-slot="value-list"]').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)))
    expect(new Set(lefts).size).toBe(1)
  })
})

test.describe('ListHeader', () => {
  test('Show deleted in the ⋯ menu brings the notice, and Back to the list takes it away', async ({ page }) => {
    await page.goto(story('app-listheader--default'))
    const header = page.locator('[data-slot="list-header"]').nth(1)
    await expect(header.getByRole('status')).toBeEmpty()
    await header.getByRole('button', { name: 'More for Medications' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Show deleted' }).click()
    await expect(header.getByRole('status')).toContainText('Showing deleted medications.')
    await header.getByRole('button', { name: 'Back to the list' }).click()
    await expect(header.getByRole('status')).toBeEmpty()
  })

  test('two or more links fold into the menu, with the page\'s extras', async ({ page }) => {
    await page.goto(story('app-listheader--default'))
    const header = page.locator('[data-slot="list-header"]').nth(2)
    await expect(header.getByRole('link', { name: 'Board' })).toHaveCount(0)
    await header.getByRole('button', { name: 'More for Tasks' }).click()
    for (const name of ['Board', 'Spin', 'Fill in 54']) await expect(page.getByRole('menuitem', { name })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Export' })).toBeVisible()
    await expect(page.getByRole('menuitemcheckbox', { name: 'Show deleted' })).toBeVisible()
  })
})
