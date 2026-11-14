import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// A date filter a view fills (4.110), on the harness's DateViews list
// (today fixed at Nov 13, 2026): Overdue is "due before today", Upcoming
// "due from today", both in the Due filter behind Filters with a chip
// beside it; Between dates takes a range. The address under the table is
// the list's URL query.
const HARNESS = 'http://localhost:6180/story.html?id='
const URL = `${HARNESS}app-datatable-tools--date-views&theme=light`

const pill = (page: Page, name: string) => page.getByRole('group', { name: 'Views' }).getByRole('button', { name, exact: true })
const rows = (page: Page) => page.locator('tbody tr')
const address = (page: Page) => page.getByTestId('address')
const chip = (page: Page) => page.locator('[data-slot=secondary-filter-chip]')
const filtersButton = (page: Page) => page.getByRole('button', { name: /^Filters/ })

test("a view's date preset fills the Due filter, with a chip to take it off", async ({ page }) => {
  await page.goto(URL)
  await expect(rows(page)).toHaveCount(6)
  await pill(page, 'Overdue').click()
  await expect(pill(page, 'Overdue')).toHaveAttribute('aria-pressed', 'true')
  await expect(address(page)).toHaveText('Address: ?due=before-today')
  // Nov 2 and Nov 12; today's isn't overdue.
  await expect(rows(page)).toHaveCount(2)
  await expect(chip(page)).toHaveText('Due: Before today')
  await expect(filtersButton(page)).toHaveAccessibleName('Filters, 1 active')
  await filtersButton(page).click()
  await expect(page.getByRole('combobox', { name: 'Due: Before today' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Remove filter: Due: Before today' }).click()
  await expect(rows(page)).toHaveCount(6)
  await expect(chip(page)).toHaveCount(0)
  await expect(address(page)).toHaveText('Address: (plain)')
  await expect(pill(page, 'Overdue')).toHaveAttribute('aria-pressed', 'false')
})

test('Upcoming keeps today and every day after', async ({ page }) => {
  await page.goto(URL)
  await pill(page, 'Upcoming').click()
  await expect(address(page)).toHaveText('Address: ?due=from-today')
  await expect(rows(page)).toHaveCount(4)
  await expect(chip(page)).toHaveText('Due: From today')
})

test("a shared link's preset is the view it names", async ({ page }) => {
  await page.goto(`${HARNESS}app-datatable-tools--date-views-overdue&theme=light`)
  await expect(pill(page, 'Overdue')).toHaveAttribute('aria-pressed', 'true')
  await expect(rows(page)).toHaveCount(2)
})

test('picking a preset by hand is the view it equals; Between dates takes a range', async ({ page }) => {
  await page.goto(URL)
  await filtersButton(page).click()
  await page.getByRole('combobox', { name: 'Any due date' }).click()
  await page.getByRole('option', { name: 'From today' }).click()
  await expect(address(page)).toHaveText('Address: ?due=from-today')
  await expect(pill(page, 'Upcoming')).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('combobox', { name: 'Due: From today' }).click()
  await page.getByRole('option', { name: 'Between dates' }).click()
  // Picked before either day is: no filter yet, the days show.
  await expect(address(page)).toHaveText('Address: (plain)')
  const from = page.getByRole('textbox', { name: 'Due From' })
  const to = page.getByRole('textbox', { name: 'Due To' })
  await from.fill('2026-11-14')
  await from.press('Tab')
  await expect(address(page)).toHaveText('Address: ?due=2026-11-14..')
  await to.fill('2026-11-30')
  await to.press('Tab')
  await expect(address(page)).toHaveText('Address: ?due=2026-11-14..2026-11-30')
  await expect(page.getByRole('combobox', { name: 'Due: Nov 14, 2026 – Nov 30, 2026' })).toBeVisible()
  await page.keyboard.press('Escape')
  // Nov 14 and Nov 20, and no view is this range.
  await expect(rows(page)).toHaveCount(2)
  await expect(chip(page)).toHaveText('Due: Nov 14, 2026 – Nov 30, 2026')
  for (const name of ['Upcoming', 'Overdue', 'All']) await expect(pill(page, name)).toHaveAttribute('aria-pressed', 'false')
})

test.describe('the open Filters panel with a range has zero axe violations', () => {
  for (const query of ['theme=light', 'theme=dark', 'theme=dark&palette=graphite-periwinkle', 'theme=light&palette=palm-lcd']) {
    test(query, async ({ page }) => {
      await page.goto(`${HARNESS}app-datatable-tools--date-views&${query}`)
      await filtersButton(page).click()
      await page.getByRole('combobox', { name: 'Any due date' }).click()
      await page.getByRole('option', { name: 'Between dates' }).click()
      await expect(page.getByRole('textbox', { name: 'Due From' })).toBeVisible()
      const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
      expect(results.violations).toEqual([])
    })
  }
})
