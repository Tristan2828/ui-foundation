import { expect, test, type Page } from '@playwright/test'

// Views that fill the filters (4.105), on the harness's ViewsFillFilters
// list: Current is the default view (the plain address) and its statuses
// show in the Status filter; Needs Water adds a rule no control shows;
// All ticks every status. A filter changed by hand keeps the rest and the
// pills follow. The address under the table is the list's URL query.
const URL = 'http://localhost:6180/story.html?id=app-datatable-tools--views-fill-filters&theme=light'

const views = (page: Page) => page.getByRole('group', { name: 'Views' })
const pill = (page: Page, name: string) => views(page).getByRole('button', { name, exact: true })
const statusFilter = (page: Page) => page.getByTestId('status-filter')
const statusBox = (page: Page) => page.getByRole('combobox', { name: 'Filter by status' })
// Ticks or unticks one status in the Status filter's list.
async function toggleStatus(page: Page, name: string) {
  await statusBox(page).click()
  await page.getByRole('option', { name }).click()
  await page.keyboard.press('Escape')
}
const address = (page: Page) => page.getByTestId('address')
const rows = (page: Page) => page.locator('tbody tr')

test('the plain address is the default view, its filters shown in the bar', async ({ page }) => {
  await page.goto(URL)
  await expect(pill(page, 'Current')).toHaveAttribute('aria-pressed', 'true')
  await expect(statusFilter(page)).toHaveText('Status filter: thriving, watch, resting')
  await expect(address(page)).toHaveText('Address: (plain)')
  // The control names them too.
  await expect(statusBox(page).locator('..')).toContainText('Status: Thriving +2')
  // Gone isn't shown: six living plants.
  await expect(rows(page)).toHaveCount(6)
})

test("a view's filters fill the bar, and the default view goes back to the plain address", async ({ page }) => {
  await page.goto(URL)
  await pill(page, 'All').click()
  await expect(pill(page, 'All')).toHaveAttribute('aria-pressed', 'true')
  await expect(statusFilter(page)).toHaveText('Status filter: thriving, watch, resting, gone')
  await expect(rows(page)).toHaveCount(7)
  await expect(address(page)).toContainText('status=gone')

  await pill(page, 'Current').click()
  await expect(pill(page, 'Current')).toHaveAttribute('aria-pressed', 'true')
  await expect(address(page)).toHaveText('Address: (plain)')
})

test("a view's rule applies while it's on; the bar shows the filters it can", async ({ page }) => {
  await page.goto(URL)
  await pill(page, 'Needs Water').click()
  await expect(pill(page, 'Needs Water')).toHaveAttribute('aria-pressed', 'true')
  await expect(statusFilter(page)).toHaveText('Status filter: thriving, watch, resting')
  await expect(address(page)).toContainText('dry=true')
  // Watered before Nov 5 and living: the snake plant and the jade.
  await expect(rows(page)).toHaveCount(2)
})

test('changing a filter by hand keeps the rest, drops the rule, and the pill lets go', async ({ page }) => {
  await page.goto(URL)
  await pill(page, 'Needs Water').click()
  await expect(rows(page)).toHaveCount(2)

  await page.getByRole('searchbox', { name: 'Search' }).fill('e')
  await expect(views(page).locator('[aria-pressed=true]')).toHaveCount(0)
  // The statuses the bar showed are kept; the rule no control showed is gone,
  // so the rows are what the bar says: living plants with an "e" (not the basil).
  await expect(statusFilter(page)).toHaveText('Status filter: thriving, watch, resting')
  await expect(address(page)).not.toContainText('dry=')
  await expect(rows(page)).toHaveCount(5)
})

test('changing a filter at the plain address keeps the default view’s, and matching a view presses it', async ({ page }) => {
  await page.goto(URL)
  await toggleStatus(page, 'Gone')
  // The default view's three statuses stayed, Gone joined them: that's All.
  await expect(statusFilter(page)).toHaveText('Status filter: thriving, watch, resting, gone')
  await expect(pill(page, 'All')).toHaveAttribute('aria-pressed', 'true')
})

test('clearing every filter by hand stays cleared', async ({ page }) => {
  await page.goto(URL)
  for (const name of ['Thriving', 'Watch', 'Resting']) await toggleStatus(page, name)
  await expect(statusFilter(page)).toHaveText('Status filter: none')
  await expect(views(page).locator('[aria-pressed=true]')).toHaveCount(0)
  await expect(address(page)).toHaveText('Address: ?view=none')
  await expect(rows(page)).toHaveCount(7)
})
