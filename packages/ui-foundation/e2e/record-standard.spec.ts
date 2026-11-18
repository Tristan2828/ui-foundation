import { expect, test, type Locator, type Page } from '@playwright/test'

// The record standard's looks (4.98), in the browser: the facts as a
// Details tab with no rail (1A), the strip as wide as its numbers (2A), a
// box of facts beside a tab and under it on a phone, a tiny record as a
// small card dialog (8A), and choice fields two to a row (9C). The status
// marks (5B) are measured by fixtures-visual.spec.ts (axe and glyphs).
const HARNESS = 'http://localhost:6180/story.html?id='

const box = async (locator: Locator) => {
  const found = await locator.boundingBox()
  expect(found).not.toBeNull()
  return found!
}

const scrollsSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)

test.describe('the Details tab (1A)', () => {
  test('the facts are the last tab, no rail, and open there', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`${HARNESS}app-entityview--details-tab`)
    const tabs = page.getByRole('tablist', { name: 'Office move sections' })
    // Changes carries its count (4.101's tab bar).
    await expect(tabs.getByRole('tab')).toHaveText(['Notes', /^Changes/, 'Details'])
    await expect(page.getByRole('complementary', { name: 'Office move details' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Summary' })).toBeHidden()

    await tabs.getByRole('tab', { name: 'Details' }).click()
    await expect(page.getByTestId('address')).toHaveText('Page at /?tab=details')
    const summary = page.getByRole('region', { name: 'Summary' })
    await expect(summary).toBeVisible()
    // A reading width, never the page's.
    expect((await box(summary)).width).toBeLessThanOrEqual(672 + 1)
    // Labels beside their values.
    const label = await box(summary.locator('dt').getByText('Floor', { exact: true }))
    const value = await box(summary.locator('dd').getByText('Third', { exact: true }))
    expect(value.x).toBeGreaterThan(label.x + label.width)
    expect(Math.abs(value.y - label.y)).toBeLessThan(4)
  })

  test('a box of facts sits beside its tab, and under it on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`${HARNESS}app-entityview--details-tab`)
    const side = page.getByRole('complementary', { name: 'Notes Facts' })
    const notes = await box(page.getByRole('region', { name: 'Notes' }))
    const packing = await box(side.getByRole('region', { name: 'Packing' }))
    expect(packing.x).toBeGreaterThan(notes.x + notes.width)
    expect(Math.abs(packing.y - notes.y)).toBeLessThan(2)

    await page.setViewportSize({ width: 375, height: 812 })
    const notesPhone = await box(page.getByRole('region', { name: 'Notes' }))
    const packingPhone = await box(side.getByRole('region', { name: 'Packing' }))
    expect(packingPhone.y).toBeGreaterThanOrEqual(notesPhone.y + notesPhone.height)
    expect(await scrollsSideways(page)).toBe(false)
  })

  test('with no other tab, the facts stay in the column, in their place', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`${HARNESS}app-entityview--details-in-the-column`)
    await expect(page.getByRole('heading', { level: 1, name: 'Office move' })).toBeVisible()
    await expect(page.getByRole('tablist')).toHaveCount(0)
    await expect(page.getByRole('complementary')).toHaveCount(0)
    const summary = await box(page.getByRole('region', { name: 'Summary' }))
    const notes = await box(page.getByRole('region', { name: 'Notes' }))
    expect(notes.y).toBeGreaterThan(summary.y)
    expect(Math.abs(notes.x - summary.x)).toBeLessThan(2)
  })
})

test.describe('the strip (2A)', () => {
  test('is as wide as its numbers, not the page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`${HARNESS}app-entityview--details-tab`)
    const strip = await box(page.locator('[data-slot=key-stats]'))
    const header = await box(page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) }))
    expect(strip.width).toBeLessThan(header.width / 2)
    // It hugs its numbers: the last one ends a padding's width from its edge.
    const last = await box(page.locator('[data-slot=key-stats] > div').last())
    expect(strip.x + strip.width - (last.x + last.width)).toBeLessThan(20)
  })

  test('wraps inside the page on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await page.goto(`${HARNESS}app-entityview--details-tab`)
    await expect(page.locator('[data-slot=key-stats]')).toBeVisible()
    expect(await scrollsSideways(page)).toBe(false)
  })
})

test.describe('a tiny record as a small card (8A)', () => {
  test('a 420px dialog, its title, Delete, Open full page and Close on one line, facts as rows', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`${HARNESS}app-recorddialog--card`)
    const dialog = page.getByRole('dialog', { name: 'Repaint the fence' })
    await expect(dialog).toBeVisible()
    expect(Math.round((await box(dialog)).width)).toBe(420)
    const title = await box(dialog.getByRole('heading', { level: 1 }))
    for (const name of ['Delete', 'Open Full Page', 'Close']) {
      const control = await box(dialog.getByRole(name === 'Open Full Page' ? 'link' : 'button', { name }))
      expect(Math.abs(control.y + control.height / 2 - (title.y + title.height / 2))).toBeLessThan(8)
    }
    // No card round the facts, and no bar above the record.
    await expect(dialog.locator('[data-slot=card]')).toHaveCount(0)
    await expect(dialog.locator('dt').getByText('Display Order', { exact: true })).toBeVisible()

    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByTestId('address')).toHaveText('/projects')
  })

  test('dialog only: no Open full page', async ({ page }) => {
    await page.goto(`${HARNESS}app-recorddialog--card-dialog-only`)
    const dialog = page.getByRole('dialog', { name: 'Repaint the fence' })
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Open Full Page' })).toHaveCount(0)
  })

  test('a sheet from the bottom on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${HARNESS}app-recorddialog--card`)
    const dialog = page.getByRole('dialog', { name: 'Repaint the fence' })
    await expect(dialog).toBeVisible()
    await expect
      .poll(async () => {
        const at = await box(dialog)
        return Math.round(at.y + at.height)
      })
      .toBe(812)
    expect(Math.round((await box(dialog)).width)).toBe(375)
  })
})

test.describe('choice fields two to a row (9C)', () => {
  const group = (page: Page, name: string) => page.getByRole('group', { name, exact: true })

  test('two to a row in a form, the fifth on its own', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`${HARNESS}app-formcontrols--choice-pairs`)
    const [room, effort, side, coats, finish] = await Promise.all(
      ['Room', 'Effort', 'Side', 'Coats', 'Finish'].map((name) => box(group(page, name))),
    )
    expect(Math.abs(room.y - effort.y)).toBeLessThan(2)
    expect(Math.abs(side.y - coats.y)).toBeLessThan(2)
    expect(side.y).toBeGreaterThan(room.y + room.height)
    expect(finish.y).toBeGreaterThan(side.y + side.height)
    // Each group stays on one line, joined.
    for (const name of ['Room', 'Effort', 'Side', 'Coats']) {
      const buttons = group(page, name).getByRole('button')
      const first = await box(buttons.first())
      const last = await box(buttons.last())
      expect(Math.abs(first.y - last.y)).toBeLessThan(2)
    }
  })

  test('on a phone two stay side by side while they fit, and go one per row when they do not', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${HARNESS}app-formcontrols--choice-pairs`)
    const [room, effort, side, coats] = await Promise.all(
      ['Room', 'Effort', 'Side', 'Coats'].map((name) => box(group(page, name))),
    )
    expect(effort.y).toBeGreaterThan(room.y + room.height)
    expect(Math.abs(side.y - coats.y)).toBeLessThan(2)
    expect(coats.x).toBeGreaterThan(side.x + side.width)
    expect(await scrollsSideways(page)).toBe(false)
  })
})
