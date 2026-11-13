import { expect, test } from '@playwright/test'

// DataTable's table tools (app/DataTable tools): what markup tests can't
// say. A view's pill sets the filters, the Columns menu's pick is kept on
// the device and gives way to a view's own columns, a row's ⋯ menu never
// opens the row, and under 48rem the list is a row list with search and
// Filters on one line and every filter in a bottom sheet. A capped related
// list's View all goes to the whole list. Axe and the token check are
// e2e/fixtures-visual.spec.ts's.
const story = (id: string) => `http://localhost:6180/story.html?id=${id}`
const columnHeader = (page: import('@playwright/test').Page, name: string) => page.getByRole('columnheader', { name, exact: true })

test.describe('on a laptop', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('a view pill sets its filters, and the filter names itself', async ({ page }) => {
    await page.goto(story('app-datatable-tools--list-tools'))
    const views = page.getByRole('group', { name: 'Views' })
    await expect(views.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    await views.getByRole('button', { name: 'Growing' }).click()
    await expect(views.getByRole('button', { name: 'Growing' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('combobox', { name: 'Status: Thriving' })).toBeVisible()
    await expect(page.getByRole('row')).toHaveCount(4)
  })

  test('the Columns menu hides a column, remembers it, and a view with columns wins', async ({ page }) => {
    await page.goto(story('app-datatable-tools--list-tools'))
    await expect(columnHeader(page, 'Notes')).toBeVisible()
    await page.getByRole('button', { name: 'Columns' }).click()
    // The name and the actions are never in the menu.
    await expect(page.getByRole('menuitemcheckbox', { name: 'Name' })).toHaveCount(0)
    await page.getByRole('menuitemcheckbox', { name: 'Notes' }).click()
    await page.keyboard.press('Escape')
    await expect(columnHeader(page, 'Notes')).toHaveCount(0)

    await page.reload()
    await expect(columnHeader(page, 'Notes')).toHaveCount(0)
    const stored = await page.evaluate(() => localStorage.getItem('fixtures:plants:columns'))
    expect(JSON.parse(stored ?? 'null')).toEqual({
      order: ['name', 'status', 'rooms', 'light', 'kind', 'watered', 'notes'],
      hidden: ['notes'],
    })

    // "Needs a look" shows its own columns, Notes among them, and the ticks can't change.
    await page.getByRole('group', { name: 'Views' }).getByRole('button', { name: 'Needs a look' }).click()
    await expect(columnHeader(page, 'Notes')).toBeVisible()
    await expect(columnHeader(page, 'Light')).toHaveCount(0)
    await page.getByRole('button', { name: 'Columns' }).click()
    await expect(page.getByText('Set by This View')).toBeVisible()
    await expect(page.getByRole('menuitemcheckbox', { name: 'Light' })).toHaveAttribute('aria-disabled', 'true')
  })

  test("a row's ⋯ menu opens its actions, not the row; the actions stay pinned", async ({ page }) => {
    await page.goto(story('app-datatable-tools--list-tools'))
    const row = page.getByRole('row', { name: /Basil/ })
    await row.getByRole('button', { name: 'Actions' }).click()
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'Move' }).click()
    await expect(page.getByText('Opened plant')).toHaveCount(0)
    // Pinned to the right edge of the scrolling table.
    const cell = row.locator('td').last()
    await expect(cell).toHaveCSS('position', 'sticky')
    await row.getByRole('cell', { name: 'Basil' }).click()
    await expect(page.getByText('Opened plant 2')).toBeVisible()
  })

  test('one action is drawn as its icon', async ({ page }) => {
    await page.goto(story('app-datatable-tools--one-row-action'))
    await expect(page.getByRole('button', { name: 'Water Basil' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Actions' })).toHaveCount(0)
  })

  test('a related list shows ten, then View all goes to the whole list', async ({ page }) => {
    await page.goto(story('app-datatable-tools--related'))
    const careLog = page.locator('section').filter({ hasText: 'Care log' })
    await expect(careLog.getByRole('row')).toHaveCount(11)
    await expect(page.getByRole('link', { name: /View All/ })).toHaveCount(1)
    await page.getByRole('link', { name: 'View All 19' }).click()
    await expect(page.getByText('All visits')).toBeVisible()
  })
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true })

  test('rows are a list, each 44px at least, and a tap opens the record', async ({ page }) => {
    await page.goto(story('app-datatable-tools--list-tools'))
    await expect(page.getByRole('table')).toHaveCount(0)
    const rows = page.locator('[data-slot="data-table-phone-row"]')
    await expect(rows).toHaveCount(7)
    const heights = await rows.locator('a').evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height))
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(44)
    await expect(rows.first()).toContainText(/Bright light\s*·\s*,?\s*Watered Nov 9/)
    // No sideways scroll on the page, and no Columns menu for a row list.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await expect(page.getByRole('button', { name: 'Columns' })).toHaveCount(0)
    await rows.filter({ hasText: 'Snake plant' }).getByRole('link').tap()
    await expect(page.getByText('Opened plant 3')).toBeVisible()
  })

  test('search and Filters share a line, and every filter is in the sheet', async ({ page }) => {
    await page.goto(story('app-datatable-tools--list-tools-filtered'))
    const search = await page.getByRole('searchbox', { name: 'Search' }).boundingBox()
    const filters = page.getByRole('button', { name: 'Filters, 3 active' })
    const button = await filters.boundingBox()
    expect(Math.abs(search!.y - button!.y)).toBeLessThan(4)
    // The primary filters' chips show, since their controls are in the sheet.
    await expect(page.getByText('Status: Thriving')).toBeVisible()
    await filters.click()
    const sheet = page.getByRole('dialog', { name: 'Filters' })
    await expect(sheet.getByRole('combobox', { name: 'Status: Thriving' })).toBeVisible()
    await expect(sheet.getByRole('combobox', { name: 'Light: Medium' })).toBeVisible()
    await sheet.getByRole('button', { name: 'Clear Filters' }).click()
    await expect(sheet.getByRole('combobox', { name: 'Any status' })).toBeVisible()
    await sheet.getByRole('button', { name: 'Done' }).click()
    await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeVisible()
  })

  test('the views stay on one line that scrolls sideways', async ({ page }) => {
    await page.goto(story('app-datatable-tools--list-tools'))
    const pills = page.getByRole('group', { name: 'Views' }).getByRole('button')
    const tops = await pills.evaluateAll((buttons) => buttons.map((button) => Math.round(button.getBoundingClientRect().top)))
    expect(new Set(tops).size).toBe(1)
  })
})
