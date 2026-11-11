import { expect, test } from '@playwright/test'

// The overview standard (app/OverviewPage): what markup tests can't say.
// From 48rem the parts are tiles, at least 170px, as many as fit, and a
// click opens one detail below the grid at a time (Escape closes it and
// returns to the tile); under 48rem they are an accordion, one line each
// with its value. Axe and the glyph check are e2e/fixtures-visual.spec.ts's.
const story = (id: string) => `http://localhost:6180/story.html?id=${id}`

test.describe('OverviewPage', () => {
  test('tiles fill the row at 170px or more, and open one detail below the grid', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 })
    await page.goto(story('app-overviewpage--default'))
    const tiles = page.locator('[data-slot="overview-tile"]')
    await expect(tiles).toHaveCount(6)
    const widths = await tiles.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width))
    for (const width of widths) expect(width).toBeGreaterThanOrEqual(170)
    const tops = await tiles.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)))
    expect(new Set(tops).size).toBe(1)

    const savings = tiles.filter({ hasText: 'Savings' })
    const deals = tiles.filter({ hasText: 'Deals' })
    await expect(savings).toHaveAttribute('aria-expanded', 'true')
    const detail = page.locator('[data-slot="overview-detail"]')
    await expect(detail.getByRole('link', { name: 'Savings' })).toHaveAttribute('href', '/accounts')
    const gridBottom = (await page.locator('[data-slot="overview-tiles"]').boundingBox())!
    expect((await detail.boundingBox())!.y).toBeGreaterThanOrEqual(gridBottom.y + gridBottom.height)

    await deals.click()
    await expect(deals).toHaveAttribute('aria-expanded', 'true')
    await expect(savings).toHaveAttribute('aria-expanded', 'false')
    await expect(detail.getByRole('link', { name: 'Deals' })).toBeVisible()
    await expect(detail).not.toContainText('Everyday account')

    await detail.getByRole('link', { name: 'Reading lamp' }).focus()
    await page.keyboard.press('Escape')
    await expect(deals).toHaveAttribute('aria-expanded', 'false')
    await expect(deals).toBeFocused()
    await expect(detail).toBeEmpty()
  })

  test('the empty part opens to its one way to start', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 })
    await page.goto(story('app-overviewpage--default'))
    await page.locator('[data-slot="overview-tile"]', { hasText: 'Budget' }).click()
    await expect(page.locator('[data-slot="overview-detail"]').getByText('Add the first line')).toBeVisible()
  })

  test('under 48rem the parts are an accordion, one line each with its value', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(story('app-overviewpage--default'))
    await expect(page.locator('[data-slot="overview-tile"]')).toHaveCount(0)
    const cards = page.locator('[data-slot="widget-card"]')
    await expect(cards).toHaveCount(6)
    // defaultOpen holds Savings open; the rest show their value folded.
    const deals = cards.filter({ hasText: 'Deals' })
    await expect(deals).toHaveAttribute('data-collapsed', 'true')
    await expect(deals.locator('[data-slot="widget-card-summary"]')).toHaveText('2 now')
    await deals.getByRole('button', { name: 'Deals' }).click()
    await expect(deals).not.toHaveAttribute('data-collapsed', 'true')
    await expect(cards.filter({ hasText: 'Savings' })).toHaveAttribute('data-collapsed', 'true')
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
  })

  test("a hub's WidgetCard in the same anatomy: the title links with a chevron", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 })
    await page.goto(story('app-overviewpage--card-anatomy'))
    const deals = page.locator('[data-slot="widget-card"]').filter({ hasText: 'Deals' })
    await expect(deals.getByRole('heading', { name: 'Deals' }).getByRole('link')).toHaveAttribute('href', '/purchases')
    await expect(deals.locator('[data-slot="widget-card-value"]')).toHaveText('2 now')
    await expect(page.locator('[data-slot="freshness"][data-state="stale"]')).toBeVisible()
  })
})
