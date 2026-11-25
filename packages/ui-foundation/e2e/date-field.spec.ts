import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from './axe'

// DateField (app/DateField stories) in a real browser, in time zones on
// both sides of UTC: the day picked is the day saved and the day shown,
// never one off.
const story = (id: string) => `http://localhost:6180/story.html?id=app-datefield--${id}`

for (const timezoneId of ['Pacific/Honolulu', 'Pacific/Kiritimati']) {
  test.describe(`DateField in ${timezoneId}`, () => {
    test.use({ timezoneId, locale: 'en-US' })

    test('shows the saved day and saves the day picked, as YYYY-MM-DD', async ({ page }) => {
      await page.goto(story('default'))
      const finished = page.getByRole('button', { name: 'Finished' })
      await expect(finished).toHaveText('Sep 2, 2026')
      await finished.click()
      const calendar = page.locator('[data-slot="date-field-calendar"]')
      await expect(calendar).toBeVisible()
      // The selected day has focus, so the keyboard starts there.
      await expect(calendar.getByRole('button', { name: /September 2nd, 2026/ })).toBeFocused()
      await calendar.getByRole('button', { name: /September 15th, 2026/ }).click()
      await expect(calendar).toHaveCount(0)
      await expect(page.getByTestId('finished-value')).toHaveText('2026-09-15')
      await expect(finished).toHaveText('Sep 15, 2026')
      await expect(finished).toBeFocused()
    })

    test('the keyboard picks a day, and the chosen day picked again stays set', async ({ page }) => {
      await page.goto(story('default'))
      const finished = page.getByRole('button', { name: 'Finished' })
      await finished.focus()
      await page.keyboard.press('Enter')
      const calendar = page.locator('[data-slot="date-field-calendar"]')
      await expect(calendar.getByRole('button', { name: /September 2nd, 2026/ })).toBeFocused()
      await page.keyboard.press('ArrowRight')
      await expect(calendar.getByRole('button', { name: /September 3rd, 2026/ })).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('finished-value')).toHaveText('2026-09-03')
      await finished.click()
      await page
        .locator('[data-slot="date-field-calendar"]')
        .getByRole('button', { name: /September 3rd, 2026/ })
        .click()
      await expect(page.getByTestId('finished-value')).toHaveText('2026-09-03')
    })

    test('an optional field starts empty, and Clear empties it', async ({ page }) => {
      await page.goto(story('default'))
      const due = page.getByRole('button', { name: 'Due' })
      await expect(due).toHaveText('No due date')
      await due.click()
      const calendar = page.locator('[data-slot="date-field-calendar"]')
      await expect(calendar).toBeVisible()
      // Nothing to clear yet.
      await expect(calendar.getByRole('button', { name: 'Clear' })).toHaveCount(0)
      await calendar.getByRole('button', { name: /^Today/ }).click()
      await expect(page.getByTestId('due-value')).toHaveText(/^\d{4}-\d{2}-\d{2}$/)
      await due.click()
      await calendar.getByRole('button', { name: 'Clear' }).click()
      await expect(page.getByTestId('due-value')).toHaveText('empty')
      await expect(due).toHaveText('No due date')
    })

    test('typed: the day typed is the day saved, and the box reads it back', async ({ page }) => {
      await page.goto(story('typed'))
      const finished = page.getByRole('textbox', { name: 'Finished' })
      await expect(finished).toHaveValue('Sep 2, 2026')
      await finished.fill('9/15')
      await finished.press('Tab')
      await expect(page.getByTestId('finished-value')).toHaveText('2026-09-15')
      await expect(finished).toHaveValue('Sep 15, 2026')
      await finished.fill('2026-12-31')
      await finished.press('Enter')
      await expect(page.getByTestId('finished-value')).toHaveText('2026-12-31')
      await expect(finished).toHaveValue('Dec 31, 2026')
      const due = page.getByRole('textbox', { name: 'Due' })
      await expect(due).toHaveAttribute('placeholder', 'No due date')
      await due.fill('Jan 1')
      await expect(page.getByTestId('due-value')).toHaveText(/^\d{4}-01-01$/)
    })

    test('in place: the calendar opens with the field, a pick saves, Esc gives up, Clear unsets', async ({ page }) => {
      await page.goto(story('edit-in-place'))
      const details = page.getByRole('region', { name: 'Details' })
      await expect(details.getByText('Dec 31, 2026')).toBeVisible()
      await page.getByRole('button', { name: 'Edit Due' }).click()
      const calendar = page.locator('[data-slot="date-field-calendar"]')
      await expect(calendar).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(calendar).toHaveCount(0)
      await expect(details.getByText('Dec 31, 2026')).toBeVisible()

      await page.getByRole('button', { name: 'Edit Due' }).click()
      await calendar.getByRole('button', { name: /December 24th, 2026/ }).click()
      await expect(details.getByText('Dec 24, 2026')).toBeVisible({ timeout: 5000 })

      await page.getByRole('button', { name: 'Edit Due' }).click()
      await calendar.getByRole('button', { name: 'Clear' }).click()
      await expect(details.getByText('No due date')).toBeVisible({ timeout: 5000 })
    })
  })
}

// Quick picks (app/DateField's QuickPicks) on a fixed today, Tuesday Nov
// 24, 2026: each sets its day and closes, from the mouse and the keyboard.
test.describe('DateField quick picks', () => {
  test.use({ timezoneId: 'America/New_York', locale: 'en-US' })
  // Noon in New York on the day.
  const on = (day: string) => new Date(`${day}T17:00:00Z`)
  const popup = (page: Page) => page.locator('[data-slot="date-field-calendar"]')
  const picks = (page: Page) => popup(page).getByRole('group', { name: 'Quick Picks' })

  const TUESDAY = [
    { label: 'Today', name: 'Today, Tue, Nov 24', day: '2026-11-24', shown: 'Nov 24, 2026' },
    { label: 'Tomorrow', name: 'Tomorrow, Wed, Nov 25', day: '2026-11-25', shown: 'Nov 25, 2026' },
    { label: 'This Weekend', name: 'This Weekend, Sat, Nov 28', day: '2026-11-28', shown: 'Nov 28, 2026' },
    { label: 'Next Week', name: 'Next Week, Mon, Nov 30', day: '2026-11-30', shown: 'Nov 30, 2026' },
  ]

  for (const pick of TUESDAY) {
    test(`${pick.label} on a typed field sets ${pick.day} and closes`, async ({ page }) => {
      await page.clock.setFixedTime(on('2026-11-24'))
      await page.goto(story('quick-picks'))
      const due = page.getByRole('textbox', { name: 'Due' })
      await page.locator('[data-slot="date-field"]').filter({ has: due }).getByRole('button', { name: 'Open Calendar' }).click()
      await expect(picks(page).getByRole('button')).toHaveText(['TodayTue, Nov 24', 'TomorrowWed, Nov 25', 'This WeekendSat, Nov 28', 'Next WeekMon, Nov 30'])
      await picks(page).getByRole('button', { name: pick.name, exact: true }).click()
      await expect(popup(page)).toHaveCount(0)
      await expect(page.getByTestId('due-value')).toHaveText(pick.day)
      await expect(due).toHaveValue(pick.shown)
      await expect(due).toBeFocused()
    })

    test(`${pick.label} on a date button, by the keyboard, sets ${pick.day}`, async ({ page }) => {
      await page.clock.setFixedTime(on('2026-11-24'))
      await page.goto(story('quick-picks'))
      const start = page.getByRole('button', { name: 'Start', exact: true })
      await start.focus()
      await page.keyboard.press('Enter')
      // The keyboard starts on today's day; the picks are before it.
      await expect(popup(page).getByRole('button', { name: /November 24th, 2026/ })).toBeFocused()
      const target = picks(page).getByRole('button', { name: pick.name, exact: true })
      for (let presses = 0; presses < 8 && !(await target.evaluate((el) => el === document.activeElement)); presses++) {
        await page.keyboard.press('Shift+Tab')
      }
      await expect(target).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(popup(page)).toHaveCount(0)
      await expect(page.getByTestId('start-value')).toHaveText(pick.day)
      await expect(start).toHaveText(pick.shown)
    })
  }

  test('on a Saturday, This Weekend is today; Next Week is the coming week start', async ({ page }) => {
    await page.clock.setFixedTime(on('2026-11-28'))
    await page.goto(story('quick-picks'))
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await picks(page).getByRole('button', { name: 'This Weekend, Sat, Nov 28', exact: true }).click()
    await expect(page.getByTestId('start-value')).toHaveText('2026-11-28')
    // Weeks from Sunday: the next week starts tomorrow.
    await page.getByRole('button', { name: 'Weeks From Sunday', exact: true }).click()
    await picks(page).getByRole('button', { name: 'Next Week, Sun, Nov 29', exact: true }).click()
    await expect(page.getByTestId('sunday-value')).toHaveText('2026-11-29')
  })

  test('over a year end, the picks land in the new year', async ({ page }) => {
    await page.clock.setFixedTime(on('2026-12-31'))
    await page.goto(story('quick-picks'))
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await expect(picks(page).getByRole('button')).toHaveText(['TodayThu, Dec 31', 'TomorrowFri, Jan 1', 'This WeekendSat, Jan 2', 'Next WeekMon, Jan 4'])
    await picks(page).getByRole('button', { name: 'Next Week, Mon, Jan 4', exact: true }).click()
    await expect(page.getByTestId('start-value')).toHaveText('2027-01-04')
  })

  test("an app's own list shows only its picks", async ({ page }) => {
    await page.clock.setFixedTime(on('2026-11-24'))
    await page.goto(story('quick-picks'))
    await page.getByRole('button', { name: 'Review', exact: true }).click()
    await expect(picks(page).getByRole('button')).toHaveText(['TodayTue, Nov 24', 'In a MonthThu, Dec 24'])
    await picks(page).getByRole('button', { name: 'In a Month, Thu, Dec 24', exact: true }).click()
    await expect(page.getByTestId('review-value')).toHaveText('2026-12-24')
  })

  test('a field without quick picks has none', async ({ page }) => {
    await page.goto(story('default'))
    await page.getByRole('button', { name: 'Finished' }).click()
    await expect(popup(page)).toBeVisible()
    await expect(popup(page).locator('[data-slot="date-field-quick-picks"]')).toHaveCount(0)
  })

  for (const theme of ['light', 'dark']) {
    test(`open, with its picks, has zero axe violations (${theme})`, async ({ page }) => {
      await page.clock.setFixedTime(on('2026-11-24'))
      await page.goto(`${story('quick-picks')}&theme=${theme}`)
      await page.getByRole('button', { name: 'Start', exact: true }).click()
      await expect(picks(page)).toBeVisible()
      // A day's name is react-day-picker's "Monday, September 14th, 2026", and
      // axe doesn't find the "14" it shows as a word of that (docs/DEFERRED.md).
      const results = await new AxeBuilder({ page })
        .disableRules(['landmark-one-main', 'page-has-heading-one', 'region', 'label-content-name-mismatch'])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }
})
