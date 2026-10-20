import { expect, test } from '@playwright/test'

// DateField (app/DateField stories) in a real browser, in time zones on
// both sides of UTC: the day picked is the day saved and the day shown,
// never one off.
const story = (id: string) => `http://localhost:6006/iframe.html?id=app-datefield--${id}&viewMode=story`

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
