import { expect, test, type Page } from '@playwright/test'

// DataTable's framed look and ListHeader's sibling switch (4.100), in a
// browser: the tools end at the table's own edge, the one settings button
// holds the Columns ticks and Group By and works from the keyboard, the
// views sit above the card, the switch goes to a sibling list, and on a
// phone nothing scrolls the page sideways. Axe and the token check, in
// both themes, are e2e/fixtures-visual.spec.ts's.
const story = (id: string) => `http://localhost:6180/story.html?id=${id}`
const FRAMED = story('app-datatable-tools--framed')

const box = async (page: Page, selector: string) => {
  const found = await page.locator(selector).first().boundingBox()
  if (!found) throw new Error(`${selector} has no box`)
  return found
}
const right = (b: { x: number; width: number }) => b.x + b.width

test.describe('on a laptop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("the tools, the rows and the pager end at the card's edge, the views above it", async ({ page }) => {
    await page.goto(FRAMED)
    const frame = await box(page, '[data-slot="data-table-frame"]')
    const top = await box(page, '[data-slot="data-table-top-bar"]')
    const rows = await box(page, '[data-slot="table-container"]')
    const pager = await box(page, '[data-slot="data-table-pagination"]')
    const settings = await box(page, '[data-tool="table-settings"]')
    for (const part of [top, rows, pager]) expect(Math.abs(right(part) - right(frame))).toBeLessThanOrEqual(2)
    expect(right(settings)).toBeLessThanOrEqual(right(frame))
    // Narrower than the page's area: nothing sits off at its far right.
    const area = await box(page, '[data-width="content"]')
    expect(frame.width).toBeLessThan(area.width)
    const views = await box(page, '[data-slot="data-table-views"]')
    expect(views.y + views.height).toBeLessThanOrEqual(frame.y)
    // Search and Filters keep their words; Columns and Group aren't buttons of their own.
    await expect(page.getByRole('button', { name: 'Filters' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Columns' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Group', exact: true })).toHaveCount(0)
  })

  test('the settings button hides a column and groups the rows', async ({ page }) => {
    await page.goto(FRAMED)
    await page.getByRole('button', { name: 'Table Settings' }).click()
    await expect(page.getByText('Show Columns')).toBeVisible()
    await expect(page.getByText('Group By')).toBeVisible()
    await page.getByRole('menuitemcheckbox', { name: 'Notes' }).click()
    await expect(page.getByRole('columnheader', { name: 'Notes', exact: true })).toHaveCount(0)
    await page.getByRole('menuitemradio', { name: 'Status' }).click()
    // The bar no longer says Group: Status, so the button's name does.
    const settings = page.getByRole('button', { name: 'Table Settings, Grouped by Status' })
    await expect(settings).toBeVisible()
    await expect(settings).toHaveAttribute('data-set', 'true')
    await expect(page.getByRole('button', { name: 'Fold All' })).toBeVisible()
    await expect(page.locator('[data-slot="table-group-heading"]').first()).toBeVisible()
  })

  test('it works from the keyboard', async ({ page }) => {
    await page.goto(FRAMED)
    const settings = page.getByRole('button', { name: 'Table Settings' })
    await settings.focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(settings).toBeFocused()
  })

  test("the sibling switch marks this list and goes to another", async ({ page }) => {
    await page.goto(FRAMED)
    const lists = page.getByRole('navigation', { name: 'Houseplants Lists' })
    await expect(lists.getByRole('link', { name: /Houseplants/ })).toHaveAttribute('aria-current', 'page')
    await expect(lists.getByRole('link', { name: /^Cuttings/ })).not.toHaveAttribute('aria-current', 'page')
    // ⋯ keeps only what's left.
    await page.getByRole('button', { name: 'More for Houseplants' }).click()
    await expect(page.getByRole('menuitemcheckbox', { name: 'Show Deleted' })).toBeVisible()
    await expect(page.getByRole('menuitem')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await lists.getByRole('link', { name: /^Cuttings/ }).click()
    await expect(page.getByText('All cuttings')).toBeVisible()
  })
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

  test('nothing scrolls sideways; the switch has its own line; the card holds the row list and the pager', async ({ page }) => {
    await page.goto(FRAMED)
    await expect(page.locator('[data-slot="data-table-phone-row"]').first()).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)

    const title = await box(page, 'h1')
    const lists = await box(page, '[data-slot="list-header-siblings"]')
    expect(lists.y).toBeGreaterThanOrEqual(title.y + title.height)
    const link = await box(page, '[data-slot="list-header-siblings"] a')
    expect(link.height).toBeGreaterThanOrEqual(40)

    const frame = await box(page, '[data-slot="data-table-frame"]')
    const pager = await box(page, '[data-slot="data-table-pagination"]')
    expect(pager.y + pager.height).toBeLessThanOrEqual(frame.y + frame.height + 1)

    // A phone's row list has no columns to pick: the settings hold Group By alone.
    await page.getByRole('button', { name: 'Table Settings' }).click()
    await expect(page.getByText('Group By')).toBeVisible()
    await expect(page.getByText('Show Columns')).toHaveCount(0)
  })
})
