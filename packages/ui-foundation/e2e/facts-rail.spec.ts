import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

// EntityView's facts rail (4.106, record standard A1): on a laptop the
// short facts sit in a 300px column beside the record's body, and aren't
// repeated in Details; with nothing else, there's no Details tab. The strip
// stays above at full width, and the rail starts level with the first
// content under it: the open tab's first section (never the tab bar), or
// the first card with no tabs (4.108). On a phone they fold back into
// Details. Axe in both themes and every palette is fixtures-visual.spec.ts's
// (the stories named there); the rail itself is measured here at desktop
// width, where it's drawn.
const HARNESS = 'http://localhost:6180/story.html?id='

const rail = (page: Page) => page.getByRole('complementary', { name: 'Office move facts' })
const tabs = (page: Page) => page.getByRole('tablist', { name: 'Office move sections' }).getByRole('tab')

const box = async (locator: Locator) => (await locator.boundingBox())!

for (const width of [1440, 1920]) {
  test(`beside the open tab's content, 300px wide, level with its first section (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${HARNESS}app-entityview--facts-rail`)
    await expect(rail(page)).toBeVisible()
    const railBox = await box(rail(page))
    const stripBox = await box(page.locator('[data-slot=entity-view-strip]'))
    const tabsBox = await box(page.getByRole('tablist'))
    const first = await box(page.getByRole('tabpanel').getByRole('region').first())
    expect(railBox.width).toBe(300)
    // Level with the open tab's first section, under the tab bar.
    expect(Math.abs(railBox.y - first.y)).toBeLessThan(2)
    expect(railBox.y).toBeGreaterThan(tabsBox.y + tabsBox.height)
    expect(railBox.x).toBeGreaterThan(first.x + first.width)
    // The strip above both, the record's full width; the tab bar keeps to the column.
    expect(railBox.y).toBeGreaterThan(stripBox.y + stripBox.height)
    expect(stripBox.x + stripBox.width).toBeGreaterThan(railBox.x + railBox.width - 2)
    expect(tabsBox.x + tabsBox.width).toBeLessThan(railBox.x)
    // The labels sit beside their values.
    const status = rail(page).getByText('Status', { exact: true })
    const open = rail(page).getByText('Open', { exact: true })
    expect((await open.boundingBox())!.x).toBeGreaterThan((await status.boundingBox())!.x + 40)
    expect(Math.abs((await open.boundingBox())!.y - (await status.boundingBox())!.y)).toBeLessThan(6)
  })
}

test("on another tab the rail is level with that tab's first section", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${HARNESS}app-entityview--facts-rail`)
  const linked = page.getByRole('tab', { name: /Linked/ })
  await linked.click()
  await expect(linked).toHaveAttribute('aria-selected', 'true')
  await expect(rail(page)).toBeVisible()
  // Linked's own panel, once it shows: right after the click a bare
  // tabpanel locator can still find Purpose's, which then hides (no box).
  const section = page.getByRole('tabpanel', { name: /Linked/ }).getByRole('region').first()
  await expect(section).toBeVisible()
  const first = await box(section)
  expect(Math.abs((await box(rail(page))).y - first.y)).toBeLessThan(2)
})

test('with no tabs, level with the first card, the strip above both', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${HARNESS}app-entityview--facts-rail-no-tabs`)
  await expect(rail(page)).toBeVisible()
  await expect(page.getByRole('tablist')).toHaveCount(0)
  const railBox = await box(rail(page))
  const stripBox = await box(page.locator('[data-slot=entity-view-strip]'))
  const first = await box(page.getByRole('region', { name: 'Purpose' }))
  expect(railBox.width).toBe(300)
  expect(Math.abs(railBox.y - first.y)).toBeLessThan(2)
  expect(railBox.x).toBeGreaterThan(first.x + first.width)
  expect(railBox.y).toBeGreaterThan(stripBox.y + stripBox.height)
  expect(stripBox.x + stripBox.width).toBeGreaterThan(railBox.x + railBox.width - 2)
})

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

// Beside the rail the record's column fills the room up to it (4.112): the
// Details cards as wide as the tab bar over them, not a 42rem reading width
// that left a blank band before the rail, and their labels a compact 10rem,
// so a value that wrapped at the old width (a 12rem label in a 42rem card)
// reads on one line.
for (const width of [1440, 1920]) {
  test(`Details fills the column up to the rail, its labels compact (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${HARNESS}app-entityview--facts-rail&tab=details`)
    await expect(rail(page)).toBeVisible()
    const closing = page.getByRole('tabpanel').getByRole('region', { name: 'Closing' })
    await expect(closing).toBeVisible()
    const tabsBox = await box(page.getByRole('tablist'))
    const card = await box(closing)
    expect(Math.abs(card.x + card.width - (tabsBox.x + tabsBox.width))).toBeLessThan(2)
    expect(Math.abs(card.x - tabsBox.x)).toBeLessThan(2)
    expect(card.x + card.width).toBeLessThan((await box(rail(page))).x)
    const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))
    const label = await box(closing.locator('dt').first())
    expect(label.width).toBeLessThanOrEqual(11 * rem + 0.5)
    // Beside its value, which takes the rest on one line.
    const value = closing.locator('dd').first()
    const valueBox = await box(value)
    expect(valueBox.x).toBeGreaterThan(label.x + label.width)
    const lineHeight = await value.evaluate((node) => parseFloat(getComputedStyle(node).lineHeight))
    expect(valueBox.height).toBeLessThan(lineHeight * 1.5)
  })
}

test('without the rail, Details keeps its reading width and its rows', async ({ page }) => {
  // A record with no facts rail: Details at its 42rem reading width.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${HARNESS}app-entityview--details-tab`)
  await page.getByRole('tab', { name: 'Details' }).click()
  const details = page.locator('[data-slot=entity-view-details]')
  await expect(details).toBeVisible()
  const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))
  expect((await box(details)).width).toBeLessThanOrEqual(42 * rem + 0.5)
  // The rail's record on a phone: the rail folds back and Details' rows are
  // as before, the narrow card's 6-7rem label beside its value (never the
  // rail's 10rem one).
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(`${HARNESS}app-entityview--facts-rail&tab=details`)
  await expect(page.locator('[data-slot=entity-view-facts-rail]')).toHaveCount(0)
  const closing = page.getByRole('tabpanel').getByRole('region', { name: 'Closing' })
  await expect(closing).toBeVisible()
  const label = await box(closing.locator('dt').first())
  expect(label.width).toBeLessThanOrEqual(7 * rem + 0.5)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
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
  for (const story of ['facts-rail', 'facts-rail&tab=details', 'facts-rail-no-tabs']) {
    test(`the rail at desktop width has no axe violations (${story}, ${theme})`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`${HARNESS}app-entityview--${story}&${query}`)
      await expect(rail(page)).toBeVisible()
      const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
      expect(results.violations).toEqual([])
    })
  }
}
