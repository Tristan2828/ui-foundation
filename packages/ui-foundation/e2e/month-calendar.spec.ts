import { expect, test } from '@playwright/test'
import AxeBuilder from './axe'

// MonthCalendar (app/MonthCalendar): titles in the days on a laptop,
// two then a count; dots on a phone; the picked day's list under the
// month with its links and the app's action; months, Today, picking by
// mouse and keys; the four states; axe in both themes at both widths.
const story = (id: string, theme = 'light') => `http://localhost:6180/story.html?id=app-monthcalendar--${id}&theme=${theme}`

const LAPTOP = { width: 1280, height: 900 }
const PHONE = { width: 390, height: 844 }

const day = (page: import('@playwright/test').Page, iso: string) => page.locator(`[data-day="${iso}"]`)

test('a laptop shows titles in the days, two then a count, and the picked day under the month', async ({ page }) => {
  await page.setViewportSize(LAPTOP)
  await page.goto(story('default'))
  const grid = page.getByRole('grid', { name: 'Events, November 2026' })
  await expect(grid).toBeVisible()
  await expect(grid.getByRole('columnheader').locator('.sr-only')).toHaveText(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
  await expect(grid.getByRole('columnheader').locator('span.max-md\\:hidden')).toHaveText(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  // Nov 26 has three: two titles by time, then "+1 more".
  const busy = day(page, '2026-11-26')
  await expect(busy.locator('li')).toHaveText(['Holiday dinner', 'Parade', '+1 more'])
  await expect(busy.locator('.sr-only')).toHaveText('Thursday, November 26, 3 items: Holiday dinner, Parade, Call the family')
  await expect(day(page, '2026-11-20')).toHaveAttribute('aria-current', 'date')
  await expect(day(page, '2026-11-20')).toHaveAttribute('aria-selected', 'true')
  const list = page.getByRole('group', { name: 'Friday, November 20, today' })
  await expect(list.getByRole('link', { name: /Book club/ })).toHaveAttribute('href', '/events/1')
  await expect(list).toContainText('7:00 PM · Event')

  // A click picks a day; its list is by time, all day first.
  await busy.click()
  await expect(page.getByTestId('picked')).toHaveText('picked 2026-11-26')
  const items = page.getByRole('group', { name: 'Thursday, November 26' }).getByRole('listitem')
  await expect(items).toHaveText([/Holiday dinner.*All day · Event/, /Parade.*8:00 AM/, /Call the family.*5:30 PM/])
  // The app's action, for the picked day.
  await page.getByRole('button', { name: 'Add Event' }).click()
  await expect(page.getByTestId('picked')).toHaveText('picked 2026-11-26 · add on 2026-11-26')
})

test('months, Today and the keys', async ({ page }) => {
  await page.setViewportSize(LAPTOP)
  await page.goto(story('default'))
  await page.getByRole('button', { name: 'Next Month' }).click()
  await expect(page.getByRole('grid', { name: 'Events, December 2026' })).toBeVisible()
  await expect(day(page, '2026-12-09').locator('li')).toHaveText(['Dentist'])
  await page.getByRole('button', { name: 'Today' }).click()
  await expect(page.getByRole('grid', { name: 'Events, November 2026' })).toBeVisible()

  // One tab stop, on the picked day; arrows move it and the focus.
  await day(page, '2026-11-20').focus()
  await expect(page.locator('[data-day][tabindex="0"]')).toHaveCount(1)
  await page.keyboard.press('ArrowRight')
  await expect(day(page, '2026-11-21')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(day(page, '2026-11-28')).toBeFocused()
  await page.keyboard.press('Home')
  await expect(day(page, '2026-11-23')).toBeFocused()
  await page.keyboard.press('End')
  await expect(day(page, '2026-11-29')).toBeFocused()
  // Past the month's edge turns the page.
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('grid', { name: 'Events, December 2026' })).toBeVisible()
  await expect(day(page, '2026-12-06')).toBeFocused()
  await page.keyboard.press('PageUp')
  await expect(day(page, '2026-11-06')).toBeFocused()
  await expect(page.getByTestId('picked')).toHaveText('picked 2026-11-06')
})

test('weeks can start on Sunday', async ({ page }) => {
  await page.setViewportSize(LAPTOP)
  await page.goto(story('weeks-from-sunday'))
  await expect(page.getByRole('columnheader').locator('.sr-only')).toHaveText(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
  // Nov 1 2026 is a Sunday: the first cell.
  await expect(page.locator('tbody tr').first().locator('td').first()).toHaveAttribute('data-day', '2026-11-01')
})

test('a phone shows dots in the days, one per item in its tone, and the list under the month', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.goto(story('default'))
  const busy = day(page, '2026-11-26')
  await expect(busy.locator('ul')).toBeHidden()
  const dots = busy.locator('span.md\\:hidden span.rounded-full')
  await expect(dots).toHaveCount(3)
  await busy.click()
  await expect(page.getByRole('group', { name: 'Thursday, November 26' }).getByRole('listitem')).toHaveCount(3)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
})

// `opens="dialog"`: the calendar a list under RecordDialogRoute.
test('with opens="dialog" an item opens in a dialog over the month, and Open Full Page goes to its page', async ({ page }) => {
  await page.setViewportSize(LAPTOP)
  await page.goto(story('opens-dialog'))
  const address = page.getByTestId('address')
  await expect(address).toHaveText('/events')
  await page.getByRole('group', { name: 'Friday, November 20, today' }).getByRole('link', { name: /Book club/ }).click()

  const dialog = page.getByRole('dialog')
  await expect(address).toHaveText('/events/1')
  await expect(dialog.getByRole('heading', { level: 1, name: 'Book club' })).toBeVisible()
  // The month is still there, under the dialog (hidden from a screen reader while it's open).
  await expect(page.locator('[data-slot="month-calendar"]')).toBeAttached()

  // Close goes back to the month.
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(address).toHaveText('/events')

  // Open Full Page swaps the dialog for the event's own page.
  await page.getByRole('group', { name: 'Friday, November 20, today' }).getByRole('link', { name: /Book club/ }).click()
  await dialog.getByRole('link', { name: 'Open Full Page' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(address).toHaveText('/events/1')
  await expect(page.getByRole('heading', { level: 1, name: 'Book club' })).toBeVisible()
  await expect(page.getByRole('grid')).toHaveCount(0)
})

test('without opens an item links straight to its page, with no dialog state', async ({ page }) => {
  await page.setViewportSize(LAPTOP)
  await page.goto(story('default'))
  await page.getByRole('group', { name: 'Friday, November 20, today' }).getByRole('link', { name: /Book club/ }).click()
  await expect(page.getByText('Opened a record.')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('loading, empty and error', async ({ page }) => {
  await page.setViewportSize(LAPTOP)
  await page.goto(story('states'))
  await expect(page.getByRole('grid', { name: 'Loading, November 2026' })).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByText('Nothing this month')).toBeVisible()
  await expect(page.getByText('Nothing that day.')).toBeVisible()
  await expect(page.getByText('Connection problem')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible()
  await expect(page.getByRole('grid', { name: /^Error/ })).toHaveCount(0)
})

for (const theme of ['light', 'dark']) {
  for (const [name, size] of [['laptop', LAPTOP], ['phone', PHONE]] as const) {
    test(`axe, ${theme}, ${name}: no violations and no sideways scroll`, async ({ page }) => {
      await page.setViewportSize(size)
      for (const id of ['default', 'states', 'opens-dialog']) {
        await page.goto(story(id, theme))
        await expect(page.getByRole('grid').first()).toBeVisible()
        const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
        expect(results.violations).toEqual([])
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
      }
    })
  }
}
