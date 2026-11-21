import AxeBuilder from './axe'
import { expect, test, type Locator, type Page } from '@playwright/test'

// The record extras: a `kind: 'switch'` fact toggled in place, badges edited in place keeping their
// pencil's room, strip values with an info tip and action, and a header button's hint line.
const HARNESS = 'http://localhost:6180/story.html?id=app-entityview--record-extras'

const rail = (page: Page) => page.getByRole('complementary', { name: 'Shift handover facts' })
const box = async (locator: Locator) => (await locator.boundingBox())!
const boxes = async (locator: Locator) => {
  const count = await locator.count()
  return Promise.all(Array.from({ length: count }, (_, at) => box(locator.nth(at))))
}
const same = (after: { x: number; y: number; width: number; height: number }[], before: typeof after) => {
  expect(after.length).toBe(before.length)
  after.forEach((was, at) => {
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(was[key] - before[at][key])).toBeLessThan(0.5)
  })
}

test('a switch fact is a switch named by its label, its word saying the state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HARNESS)
  const shared = rail(page).getByRole('switch', { name: 'Shared' })
  await expect(shared).toBeChecked()
  const word = rail(page).locator('[data-slot=entity-view-fact-switch-word]')
  await expect(word.locator('span:not(.invisible)')).toHaveText('With the team')
  // A slow save: the new state at once, busy until it lands.
  await shared.click()
  await expect(shared).not.toBeChecked()
  await expect(shared).toHaveAttribute('aria-busy', 'true')
  await expect(shared).not.toHaveAttribute('aria-busy', 'true')
  await expect(shared).not.toBeChecked()
  await expect(word.locator('span:not(.invisible)')).toHaveText('Only me')
  // The read-only one is disabled, its hint saying why.
  await expect(rail(page).getByRole('switch', { name: 'Archived' })).toBeDisabled()
  await expect(rail(page).getByRole('button', { name: 'About Archived' })).toHaveAccessibleDescription('A guide in review is never archived.')
})

test('Space and Enter toggle a switch from the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HARNESS)
  const reminders = rail(page).getByRole('switch', { name: 'Reminders' })
  await rail(page).getByRole('switch', { name: 'Shared' }).focus()
  await page.keyboard.press('Tab')
  await expect(reminders).toBeFocused()
  await page.keyboard.press('Space')
  await expect(reminders).toBeChecked()
  await page.keyboard.press('Enter')
  await expect(reminders).not.toBeChecked()
})

test('hovering and toggling a switch moves nothing in the rail', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HARNESS)
  await page.evaluate(() => document.fonts.ready)
  const values = rail(page).locator('dd')
  const before = await boxes(values)
  const shared = rail(page).getByRole('switch', { name: 'Shared' })
  await shared.hover()
  await page.waitForTimeout(250)
  same(await boxes(values), before)
  await shared.click()
  await expect(shared).not.toHaveAttribute('aria-busy', 'true')
  await page.mouse.move(5, 5)
  same(await boxes(values), before)
})

test('on a phone the switches are in Details and toggle there', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(`${HARNESS}&tab=details`)
  await expect(page.locator('[data-slot=entity-view-facts-rail]')).toHaveCount(0)
  const details = page.getByRole('tabpanel')
  const reminders = details.getByRole('switch', { name: 'Reminders' })
  await reminders.click()
  await expect(reminders).toBeChecked()
  await expect(details.getByRole('switch', { name: 'Shared' })).toBeVisible()
  // A finger-sized target: the switch's hit area runs past its track.
  const hit = await reminders.evaluate((node) => {
    const after = getComputedStyle(node, '::after')
    const rect = node.getBoundingClientRect()
    return rect.height - parseFloat(after.top) - parseFloat(after.bottom)
  })
  expect(hit).toBeGreaterThanOrEqual(30)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
})

test("hovering an inline-edited header badge moves nothing; a click there opens it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HARNESS)
  await page.evaluate(() => document.fonts.ready)
  const badges = page.locator('[data-slot=entity-view-badges] [data-slot=badge]')
  await expect(badges).toHaveCount(3)
  const before = await boxes(badges)
  const stage = await box(badges.first())
  const x = stage.x + stage.width / 2
  const y = stage.y + stage.height / 2
  await page.mouse.move(x, y)
  await page.waitForTimeout(250)
  same(await boxes(badges), before)
  await page.mouse.click(x, y)
  await expect(page.getByRole('option', { name: 'Draft' })).toBeVisible()
  await page.keyboard.press('Escape')
})

test("a strip value's info shows on keyboard focus; its action runs", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HARNESS)
  const strip = page.locator('[data-slot=key-stats]')
  const info = strip.getByRole('button', { name: 'About Readers' })
  await expect(info).toHaveAccessibleDescription('People who opened it this month.')
  await info.focus()
  await expect(page.locator('[data-slot=tooltip-content]')).toHaveText('People who opened it this month.')
  await page.keyboard.press('Escape')
  const checks = strip.locator('dt', { hasText: 'Checks' }).locator('xpath=following-sibling::dd[1]')
  await expect(checks).toHaveText('0')
  await strip.getByRole('button', { name: 'Check Now' }).click()
  await expect(checks).toHaveText('1')
})

test('hovering a strip value with an info tip or action moves nothing', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HARNESS)
  await page.evaluate(() => document.fonts.ready)
  const values = page.locator('[data-slot=key-stats] dd')
  const before = await boxes(values)
  for (const name of ['About Readers', 'Check Now']) {
    await page.locator('[data-slot=key-stats]').getByRole('button', { name }).hover()
    await page.waitForTimeout(250)
    same(await boxes(values), before)
  }
})

test.describe('on a touch screen', () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true })

  test("a strip value's info is a line under it, and its action a finger-sized target", async ({ page }) => {
    await page.goto(HARNESS)
    const strip = page.locator('[data-slot=key-stats]')
    const line = strip.locator('[data-slot=entity-view-fact-hint-text]')
    await expect(line).toBeVisible()
    await expect(line).toHaveText('People who opened it this month.')
    await expect(strip.locator('[data-slot=entity-view-fact-hint]')).toBeHidden()
    expect((await box(strip.getByRole('button', { name: 'Check Now' }))).height).toBeGreaterThanOrEqual(44)
  })
})

for (const width of [1440, 375]) {
  test(`a header button's hint is a line under it, the buttons level (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(HARNESS)
    const search = page.getByRole('button', { name: 'Search', exact: true })
    const hint = page.locator('[data-slot=action-hint-text]')
    await expect(hint).toHaveText('12 searches left')
    await expect(search).toHaveAccessibleDescription('12 searches left')
    const button = await box(search)
    const print = await box(page.getByRole('button', { name: 'Print', exact: true }))
    expect(Math.abs(button.y - print.y)).toBeLessThan(1)
    const line = await box(hint)
    expect(line.y).toBeGreaterThanOrEqual(button.y + button.height - 1)
    await search.click()
    await expect(hint).toHaveText('11 searches left')
  })
}

for (const theme of ['light', 'dark'] as const) {
  for (const [name, width, query] of [
    ['the record', 1440, ''],
    ['Details on a phone', 375, '&tab=details'],
  ] as const) {
    test(`${name} with switches, strip extras and a hinted button has no axe violations (${theme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${HARNESS}${query}&theme=${theme}`)
      await expect(page.getByRole('switch', { name: 'Shared' })).toBeVisible()
      const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
      expect(results.violations).toEqual([])
    })
  }

  test(`a strip value's tooltip open has no axe violations (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${HARNESS}&theme=${theme}`)
    await page.locator('[data-slot=key-stats]').getByRole('button', { name: 'About Readers' }).hover()
    await expect(page.locator('[data-slot=tooltip-content]')).toBeVisible()
    const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
    expect(results.violations).toEqual([])
  })
}
