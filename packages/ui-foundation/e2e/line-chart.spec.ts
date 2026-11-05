import { expect, test } from '@playwright/test'

// LineChart (#238), on its stories: the chart's shape on a card, its four
// states, a phone's width, and what a screen reader gets. Axe, the token
// check and the line's and target's 3:1 (the glyph check) are
// e2e/fixtures-visual.spec.ts's, in both themes.
const story = (name: string) => `http://localhost:6180/story.html?id=app-linechart--${name}`

test('the chart: a line across the plot, the dashed target, the lowest point marked with its value', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(story('default'))
  const figure = page.getByRole('figure', { name: 'Price over time' })
  await expect(figure).toBeVisible()
  const plot = (await figure.locator('[aria-hidden="true"]').first().boundingBox())!
  const line = (await figure.locator('polyline').boundingBox())!
  // From the first day's edge to the last's.
  expect(Math.abs(line.x - plot.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(line.x + line.width - (plot.x + plot.width))).toBeLessThanOrEqual(2)
  await expect(figure.locator('line[stroke-dasharray]')).toHaveCount(1)
  await expect(figure.locator('[aria-hidden="true"]').first().getByText('Buy at $99.00')).toBeVisible()
  await expect(figure.locator('[aria-hidden="true"]').first().getByText('$99.99', { exact: true })).toBeVisible()
  // The mark is the lowest point: nothing on the line sits below it.
  const mark = (await figure.locator('[data-slot="line-chart-mark"]').boundingBox())!
  expect(mark.y + mark.height / 2).toBeGreaterThanOrEqual(line.y + line.height - 2)
  // The first and last days under the plot.
  await expect(figure.locator('[aria-hidden="true"]').nth(1)).toHaveText('Oct 1Oct 20')
})

test('a screen reader gets the summary and every point in a table', async ({ page }) => {
  await page.goto(story('default'))
  const figure = page.getByRole('figure', { name: 'Price over time' })
  await expect(figure.locator('figcaption')).toHaveText(
    'From $129.99 on Oct 1 to $105.00 on Oct 20; lowest $99.99 on Oct 14; highest $129.99 on Oct 1; Buy at $99.00',
  )
  const table = figure.getByRole('table', { name: 'Price over time' })
  await expect(table.getByRole('row')).toHaveCount(12)
  await expect(table.getByRole('row', { name: 'Oct 14 $99.99' })).toHaveCount(1)
  // The picture itself is hidden from it: the words on it are in the summary.
  expect(await figure.locator('[aria-hidden="true"] svg').count()).toBe(2)
})

test('every state: a skeleton at its height, the empty line, one point a dot with no line', async ({ page }) => {
  await page.goto(story('all-states'))
  const loading = page.locator('[data-slot="line-chart"][data-state="loading"]')
  await expect(loading).toHaveAttribute('aria-busy', 'true')
  expect((await loading.locator('[data-slot="skeleton"]').boundingBox())!.height).toBeCloseTo(160, 0)

  await expect(page.getByRole('figure', { name: 'Price with no points' })).toContainText('No points yet')

  const one = page.getByRole('figure', { name: 'Price with one point' })
  await expect(one.locator('polyline')).toHaveCount(0)
  await expect(one.locator('[data-slot="line-chart-mark"]')).toBeVisible()
  await expect(one.locator('[aria-hidden="true"]').first().getByText('$129.99', { exact: true })).toBeVisible()

  const latest = page.getByRole('figure', { name: 'Price, latest marked' })
  expect((await latest.locator('[aria-hidden="true"]').first().boundingBox())!.height).toBeCloseTo(120, 0)
  await expect(latest.locator('[aria-hidden="true"]').first().getByText('$105.00', { exact: true })).toBeVisible()
})

test("on a phone: the chart fills its card's width, and nothing on it spills out", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto(story('default'))
  const figure = page.getByRole('figure', { name: 'Price over time' })
  await expect(figure).toBeVisible()
  const content = (await page.locator('[data-slot="card-content"]').boundingBox())!
  const box = (await figure.boundingBox())!
  expect(Math.abs(box.width - (content.width - 2 * 16))).toBeLessThanOrEqual(2)
  const spill = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(spill).toBe(0)
})

test('a projection: the line carries on dashed from its last point to the right edge, in the same colour', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(story('projection'))
  const figure = page.getByRole('figure', { name: 'Balance and projection' })
  const plot = (await figure.locator('[aria-hidden="true"]').first().boundingBox())!
  const measured = (await figure.locator('polyline').first().boundingBox())!
  const ahead = figure.locator('[data-slot="line-chart-projection"] polyline')
  await expect(ahead).toHaveAttribute('stroke-dasharray', '6 4')
  const dashed = (await ahead.boundingBox())!
  // Where the measured line ends, the dashed one starts, and it runs to the edge.
  expect(Math.abs(dashed.x - (measured.x + measured.width))).toBeLessThanOrEqual(2)
  expect(Math.abs(dashed.x + dashed.width - (plot.x + plot.width))).toBeLessThanOrEqual(2)
  const colour = (line: typeof ahead) => line.evaluate((el) => getComputedStyle(el).color)
  expect(await colour(ahead)).toBe(await colour(figure.locator('polyline').first()))
  await expect(figure.locator('[aria-hidden="true"]').nth(1)).toHaveText('20242030')
  await expect(figure.locator('figcaption')).toContainText('Projected $128,000.00 on 2030')
})

const multi = (name: string) => `http://localhost:6180/story.html?id=app-multilinechart--${name}`

test('several series: a line each across the plot, a legend naming each with its latest value', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(multi('default'))
  const figure = page.getByRole('figure', { name: 'Net worth over time' })
  await expect(figure.locator('[data-slot="multi-line-chart-series"]')).toHaveCount(3)
  const legend = figure.locator('[data-slot="multi-line-chart-legend"] li')
  await expect(legend).toHaveText(['Assets$197,500', 'Owed$59,500', 'Net worth$138,000'])
  // Each series in its own colour.
  const colours = await figure
    .locator('[data-slot="multi-line-chart-series"]')
    .evaluateAll((all) => all.map((el) => getComputedStyle(el).color))
  expect(new Set(colours).size).toBe(3)
  const table = figure.getByRole('table', { name: 'Net worth over time' })
  await expect(table.getByRole('columnheader')).toHaveText(['When', 'Assets', 'Owed', 'Net worth'])
  await expect(table.getByRole('row')).toHaveCount(7)
})

test('projections: dashed series start where the measured one ends, under a target', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(multi('projections'))
  const figure = page.getByRole('figure', { name: 'Invested and projected' })
  const lines = figure.locator('[data-slot="multi-line-chart-series"] polyline')
  await expect(lines).toHaveCount(4)
  await expect(figure.locator('[data-slot="multi-line-chart-series"] polyline[stroke-dasharray]')).toHaveCount(3)
  const measured = (await lines.nth(0).boundingBox())!
  const middle = (await lines.nth(2).boundingBox())!
  expect(Math.abs(middle.x - (measured.x + measured.width))).toBeLessThanOrEqual(2)
  await expect(figure.locator('[aria-hidden="true"]').first().getByText('Target $300,000')).toBeVisible()
})

test('several series, every state; on a phone nothing spills out', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto(multi('all-states'))
  await expect(page.locator('[data-slot="multi-line-chart"][data-state="loading"]')).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('figure', { name: 'Net worth with no points' })).toContainText('No points yet')
  await expect(page.getByRole('figure', { name: 'Net worth with one point' }).locator('[data-slot="multi-line-chart-dot"]')).toHaveCount(3)
  await page.goto(multi('projections'))
  await expect(page.getByRole('figure', { name: 'Invested and projected' })).toBeVisible()
  const spill = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(spill).toBe(0)
})
