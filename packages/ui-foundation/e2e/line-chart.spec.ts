import { expect, test } from '@playwright/test'

// LineChart (#238), on its stories: the chart's shape on a card, its four
// states, a phone's width, and what a screen reader gets. Axe, the token
// check and the line's and target's 3:1 (the glyph check) are
// e2e/storybook-visual.spec.ts's, in both themes.
const story = (name: string) => `http://localhost:6006/iframe.html?id=app-linechart--${name}&viewMode=story`

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
