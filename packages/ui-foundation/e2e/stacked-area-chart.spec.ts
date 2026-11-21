import { expect, test } from '@playwright/test'

// StackedAreaChart (app/StackedAreaChart): the bands stacked across the
// plot, the legend, every state, a phone's width, and what a screen reader
// gets. Axe, the token check and the glyph check (every band, segment and
// swatch at 3:1) are e2e/fixtures-visual.spec.ts's, in both themes.
const story = (name: string) => `http://localhost:6180/story.html?id=app-stackedareachart--${name}`

test('the chart: four bands across the plot, each its own colour, the bottom one from zero', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(story('default'))
  const figure = page.getByRole('figure', { name: 'Holdings over time' })
  await expect(figure).toBeVisible()
  const bands = figure.locator('[data-slot="stacked-area-chart-band"]')
  await expect(bands).toHaveCount(4)
  const colours = await bands.evaluateAll((els) => els.map((el) => getComputedStyle(el).color))
  expect(new Set(colours).size).toBe(4)
  const plot = (await figure.locator('[aria-hidden="true"]').first().boundingBox())!
  const bottom = (await bands.first().locator('polygon').boundingBox())!
  expect(Math.abs(bottom.x - plot.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(bottom.x + bottom.width - (plot.x + plot.width))).toBeLessThanOrEqual(2)
  // The bottom band starts at zero: the plot's bottom edge (its 1px border aside).
  expect(Math.abs(bottom.y + bottom.height - (plot.y + plot.height))).toBeLessThanOrEqual(2)
  await expect(figure.locator('[data-slot="stacked-area-chart-legend"] li')).toHaveText([
    'Cash$6,800 · 7%',
    'Bonds$16,000 · 17%',
    'International$20,200 · 22%',
    'US stocks$49,500 · 54%',
    'Total$92,500',
  ])
  await expect(figure.locator('[aria-hidden="true"]').nth(1)).toHaveText('Apr 2026Sep 2026')
})

test('the states: a skeleton, one quiet line, one stacked column for one snapshot, a shorter plot', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1600 })
  await page.goto(story('all-states'))
  const loading = page.locator('[data-slot="stacked-area-chart"][data-state="loading"]')
  await expect(loading).toHaveAttribute('aria-busy', 'true')
  expect((await loading.locator('[data-slot="skeleton"]').boundingBox())!.height).toBeCloseTo(160, 0)
  await expect(page.getByRole('figure', { name: 'Holdings with no points' })).toHaveText('No points yet')

  const one = page.getByRole('figure', { name: 'Holdings, one snapshot' })
  await expect(one.locator('[data-slot="stacked-area-chart-segment"]')).toHaveCount(4)
  await expect(one.locator('polygon')).toHaveCount(0)
  const plot = (await one.locator('[aria-hidden="true"]').first().boundingBox())!
  const column = (await one.locator('[data-slot="stacked-area-chart-column"]').boundingBox())!
  expect(Math.abs(column.x + column.width / 2 - (plot.x + plot.width / 2))).toBeLessThanOrEqual(2)

  const short = page.getByRole('figure', { name: 'Two bands' })
  expect((await short.locator('[aria-hidden="true"]').first().boundingBox())!.height).toBeCloseTo(120, 0)
})

test('a screen reader gets a summary and a table with a column per band and a total', async ({ page }) => {
  await page.goto(story('default'))
  const figure = page.getByRole('figure', { name: 'Holdings over time' })
  await expect(figure.locator('figcaption')).toHaveText(
    'Total from $83,000 on Apr 2026 to $92,500 on Sep 2026; US stocks $49,500 (54%); International $20,200 (22%); Bonds $16,000 (17%); Cash $6,800 (7%)',
  )
  const table = figure.getByRole('table', { name: 'Holdings over time' })
  await expect(table.getByRole('columnheader')).toHaveText(['When', 'US stocks', 'International', 'Bonds', 'Cash', 'Total'])
  await expect(table.locator('tbody tr')).toHaveCount(6)
})

test("on a phone: the chart fills its card's width, and nothing on it spills out", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto(story('default'))
  const figure = page.getByRole('figure', { name: 'Holdings over time' })
  await expect(figure).toBeVisible()
  const content = (await page.locator('[data-slot="card-content"]').boundingBox())!
  const box = (await figure.boundingBox())!
  expect(Math.abs(box.width - (content.width - 2 * 16))).toBeLessThanOrEqual(2)
  const spill = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(spill).toBe(0)
})
