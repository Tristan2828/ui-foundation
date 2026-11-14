import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

// The record's status in the facts rail (4.115): a fact marked
// `recordStatus` is the first fact at the top of the rail, whatever its
// place in `facts` and its section's among the rail's, and in Details
// where the rail folds on a phone. Read-only here, it has a small action
// button under it (the app's own dialog, opened from the fact's button)
// and a hint saying why: a tooltip on an info button, by hover or keyboard
// focus, and a line under the value on a touch screen. Badges carry
// icons. The strip's values are edited in place, inline: hovering one
// moves nothing, so a click where the mouse rests opens that value, at a
// laptop's width and a phone's (where the strip wraps).
const HARNESS = 'http://localhost:6180/story.html?id=app-entityview--facts-rail-status'

const rail = (page: Page) => page.getByRole('complementary', { name: 'Office move facts' })
const box = async (locator: Locator) => (await locator.boundingBox())!

test('the status is the first fact at the top of the rail, its section first', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HARNESS)
  await expect(rail(page)).toBeVisible()
  // Facts is listed after Schedule and Status last in it: both moved up.
  await expect(rail(page).getByRole('heading')).toHaveText(['Facts', 'Schedule'])
  await expect(rail(page).locator('dt').first()).toHaveText('Status')
  await expect(rail(page).locator('dd').first()).toHaveAttribute('data-record-status', '')
  await expect(rail(page).locator('dt')).toHaveText(['Status', 'Owner', 'Teams', 'Starts', 'Ends'])
  // The action under the value, not beside it.
  const value = await box(rail(page).locator('[data-slot=status-mark]'))
  const action = await box(rail(page).getByRole('button', { name: 'Close…' }))
  expect(action.y).toBeGreaterThanOrEqual(value.y + value.height - 1)
  expect(Math.abs(action.x - value.x)).toBeLessThan(4)
})

test('on a phone the status tops Details, its action and hint there too', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(`${HARNESS}&tab=details`)
  await expect(page.locator('[data-slot=entity-view-facts-rail]')).toHaveCount(0)
  const details = page.getByRole('tabpanel')
  await expect(details.getByRole('heading')).toHaveText(['Facts', 'Schedule'])
  await expect(details.locator('dt').first()).toHaveText('Status')
  await expect(details.getByRole('button', { name: 'Close…' })).toBeVisible()
  await expect(details.getByRole('button', { name: 'About Status' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
})

test('the hint shows on keyboard focus and on hover, and describes its button', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HARNESS)
  const info = rail(page).getByRole('button', { name: 'About Status' })
  await expect(info).toHaveAccessibleDescription('Changes when the project is closed, which records a date and a reason.')
  // Keyboard: Tab from the record link before it (Owner is after it in
  // the DOM, so walk back from the action).
  await rail(page).getByRole('button', { name: 'Close…' }).focus()
  await page.keyboard.press('Shift+Tab')
  await expect(info).toBeFocused()
  const tooltip = page.locator('[data-slot=tooltip-content]')
  await expect(tooltip).toHaveText('Changes when the project is closed, which records a date and a reason.')
  await page.keyboard.press('Escape')
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await expect(tooltip).toHaveCount(0)
  await info.hover()
  await expect(tooltip).toBeVisible()
})

test("the action opens the app's own dialog from the fact's button", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HARNESS)
  const close = rail(page).getByRole('button', { name: 'Close…' })
  await expect(close).toHaveAttribute('data-slot', 'entity-view-fact-action')
  await close.click()
  const dialog = page.getByRole('dialog', { name: 'Close this project?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Close Project' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(rail(page).locator('[data-slot=status-mark]')).toHaveText('Closed')
  await expect(rail(page).getByRole('button', { name: 'Close…' })).toHaveCount(0)
})

test("badges draw each item's icon before its label, in the muted tone", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HARNESS)
  const badges = rail(page).locator('[data-slot=badge]')
  await expect(badges).toHaveText(['Finance', 'Support', 'Facilities'])
  const icons = rail(page).locator('[data-slot=entity-view-fact-badge-icon]')
  await expect(icons).toHaveCount(2)
  for (const index of [0, 1]) {
    const badge = badges.nth(index)
    const icon = await box(badge.locator('[data-slot=entity-view-fact-badge-icon] svg'))
    const label = await box(badge.getByText(['Finance', 'Support'][index]))
    expect(icon.x + icon.width).toBeLessThanOrEqual(label.x + 0.5)
  }
  const muted = await page.evaluate(() => {
    const probe = document.createElement('span')
    probe.className = 'text-muted-foreground'
    document.body.append(probe)
    const colour = getComputedStyle(probe).color
    probe.remove()
    return colour
  })
  await expect(icons.first()).toHaveCSS('color', muted)
})

test.describe('on a touch screen', () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true })

  test('the hint is a line under the value, and the action a finger-sized target', async ({ page }) => {
    await page.goto(`${HARNESS}&tab=details`)
    const details = page.getByRole('tabpanel')
    const line = details.locator('[data-slot=entity-view-fact-hint-text]')
    await expect(line).toBeVisible()
    await expect(line).toHaveText('Changes when the project is closed, which records a date and a reason.')
    await expect(details.locator('[data-slot=entity-view-fact-hint]')).toBeHidden()
    const value = await box(details.locator('[data-slot=status-mark]'))
    expect((await box(line)).y).toBeGreaterThanOrEqual(value.y + value.height - 1)
    expect((await box(details.getByRole('button', { name: 'Close…' }))).height).toBeGreaterThanOrEqual(44)
  })
})

// The strip (KeyStats) with values edited in place: hovering a value
// keeps every value where it was, and a click where the mouse rests opens
// that value, never the next one. Before 4.115 an inline value's pencil
// took its room only on hover, moving the values after it along and
// wrapping a nearly full row.
for (const width of [1440, 375]) {
  test(`hovering a strip value moves nothing; a click there opens it (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(HARNESS)
    const values = page.locator('[data-slot=key-stats] [data-slot=editable-value]')
    await expect(values).toHaveCount(6)
    const labels = await page.locator('[data-slot=key-stats] dt').allTextContents()
    for (let index = 0; index < labels.length; index++) {
      const before = await Promise.all(labels.map((_, at) => box(values.nth(at))))
      const target = before[index]
      // Just inside the value's start: where a person aims at a short value.
      const x = target.x + Math.min(12, target.width / 2)
      const y = target.y + target.height / 2
      await page.mouse.move(x, y)
      await page.waitForTimeout(250)
      const after = await Promise.all(labels.map((_, at) => box(values.nth(at))))
      expect(after).toEqual(before)
      await page.mouse.click(x, y)
      await expect(page.getByRole('textbox', { name: labels[index] })).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('textbox', { name: labels[index] })).toHaveCount(0)
      await page.mouse.move(0, 0)
    }
  })

  test(`focusing a strip value's pencil moves nothing (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(HARNESS)
    const values = page.locator('[data-slot=key-stats] [data-slot=editable-value]')
    const pencils = page.locator('[data-slot=key-stats] [data-edit]')
    const count = await values.count()
    const before = await Promise.all(Array.from({ length: count }, (_, at) => box(values.nth(at))))
    for (let index = 0; index < count; index++) {
      await pencils.nth(index).focus()
      await page.waitForTimeout(200)
      const after = await Promise.all(Array.from({ length: count }, (_, at) => box(values.nth(at))))
      expect(after).toEqual(before)
    }
  })
}

for (const theme of ['light', 'dark'] as const) {
  for (const [name, width, query] of [
    ['the rail', 1440, ''],
    ['Details on a phone', 375, '&tab=details'],
  ] as const) {
    test(`${name} has no axe violations (${theme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${HARNESS}${query}&theme=${theme}`)
      await expect(page.getByRole('button', { name: 'Close…' })).toBeVisible()
      const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
      expect(results.violations).toEqual([])
    })
  }

  test(`the hint's tooltip open has no axe violations (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${HARNESS}&theme=${theme}`)
    await rail(page).getByRole('button', { name: 'About Status' }).hover()
    await expect(page.locator('[data-slot=tooltip-content]')).toBeVisible()
    // Measured once its fade-in is over, never mid-fade (DEFERRED's axe-wait row).
    await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'))
    const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
    expect(results.violations).toEqual([])
  })
}
