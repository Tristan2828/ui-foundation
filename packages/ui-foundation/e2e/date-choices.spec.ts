import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from './axe'

// DateChoices (app/DateChoices stories): a row's ⋯ "move to" picker, the
// app's choices and then the month, as a dialog in DateField's look and
// keyboard. The row sits on Wed Nov 25, 2026, which is also the story's
// today.
const story = (id: string) => `http://localhost:6180/story.html?id=app-datechoices--${id}`

const popup = (page: Page) => page.getByRole('dialog', { name: 'Move Water the plants' })
const trigger = (page: Page) => page.getByRole('button', { name: 'Move Water the plants' })
const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement
    return el?.getAttribute('aria-label') ?? el?.textContent ?? ''
  })

test.use({ locale: 'en-US', timezoneId: 'America/Chicago' })

test.describe('DateChoices', () => {
  test('a dialog with its choices (label, muted value), then the month on the day it is on', async ({ page }) => {
    await page.goto(story('move-to'))
    await trigger(page).click()
    await expect(popup(page)).toBeVisible()
    await expect(page.getByRole('menu')).toHaveCount(0)
    const rows = popup(page).getByRole('group', { name: 'Move to' })
    await expect(rows.getByRole('button')).toHaveText(['Morning7:00 AM', 'Work1:00 PM', 'Evening5:00 PM', 'Night8:00 PM', 'TomorrowThu, Nov 26'])
    await expect(rows.getByRole('button', { name: 'Morning, 7:00 AM' })).toBeDisabled()
    await expect(rows.getByRole('button', { name: 'Tomorrow, Thu, Nov 26' }).locator('span').last()).toHaveClass(/text-muted-foreground/)
    await expect(popup(page).getByRole('grid')).toBeVisible()
    await expect(popup(page).getByRole('grid')).toHaveAccessibleName(/November 2026/)
    // The day it is on is chosen; the story's today is ringed (react-day-picker's today modifier).
    await expect(popup(page).locator('[data-selected="true"] button')).toHaveText('25')
    await expect(popup(page).locator('[data-today="true"] button')).toHaveText('25')
  })

  test('a choice runs its own work and closes, focus back on the trigger', async ({ page }) => {
    await page.goto(story('move-to'))
    await trigger(page).click()
    await popup(page).getByRole('button', { name: 'Work, 1:00 PM' }).click()
    await expect(popup(page)).toHaveCount(0)
    await expect(page.getByTestId('did')).toHaveText('Work')
    await expect(trigger(page)).toBeFocused()
  })

  test('a day picked in the month runs onPick and closes', async ({ page }) => {
    await page.goto(story('move-to'))
    await trigger(page).click()
    // The month moves on with its next button, and stays open.
    await popup(page).getByRole('button', { name: /Next Month/ }).click()
    await expect(popup(page).getByRole('grid')).toHaveAccessibleName(/December 2026/)
    await popup(page).getByRole('button', { name: /December 3rd, 2026/ }).click()
    await expect(popup(page)).toHaveCount(0)
    await expect(page.getByTestId('did')).toHaveText('picked 2026-12-03')
    await expect(page.getByTestId('row-day')).toHaveText('Thu, Dec 3')
  })

  test('keyboard: opens on the first choice that can be pressed, Tab through the choices to the month, arrows move the day, Enter picks', async ({ page }) => {
    await page.goto(story('move-to'))
    await trigger(page).focus()
    await page.keyboard.press('Enter')
    await expect(popup(page)).toBeVisible()
    // Morning has ended (disabled), so Work is first.
    expect(await focused(page)).toBe('Work, 1:00 PM')
    for (const name of ['Evening, 5:00 PM', 'Night, 8:00 PM', 'Tomorrow, Thu, Nov 26']) {
      await page.keyboard.press('Tab')
      expect(await focused(page)).toBe(name)
    }
    await page.keyboard.press('Tab')
    expect(await focused(page)).toMatch(/Previous Month/)
    await page.keyboard.press('Tab')
    expect(await focused(page)).toMatch(/Next Month/)
    await page.keyboard.press('Tab')
    expect(await focused(page)).toMatch(/November 25th, 2026/)
    await page.keyboard.press('ArrowRight')
    expect(await focused(page)).toMatch(/November 26th, 2026/)
    await page.keyboard.press('ArrowDown')
    expect(await focused(page)).toMatch(/December 3rd, 2026/)
    await page.keyboard.press('Enter')
    await expect(popup(page)).toHaveCount(0)
    await expect(page.getByTestId('did')).toHaveText('picked 2026-12-03')
    await expect(trigger(page)).toBeFocused()
  })

  test('keyboard: Escape closes with nothing done, focus back on the trigger', async ({ page }) => {
    await page.goto(story('move-to'))
    await trigger(page).click()
    await expect(popup(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(popup(page)).toHaveCount(0)
    await expect(page.getByTestId('did')).toHaveText('nothing yet')
    await expect(trigger(page)).toBeFocused()
  })

  test('with no choices it is the month alone, opening on the day', async ({ page }) => {
    await page.goto(story('calendar-only'))
    await trigger(page).click()
    await expect(popup(page).locator('[data-slot="date-choices-rows"]')).toHaveCount(0)
    expect(await focused(page)).toMatch(/November 25th, 2026/)
  })

  test('weeks start on the app’s day', async ({ page }) => {
    await page.goto(story('weeks-from-sunday'))
    await trigger(page).click()
    await expect(popup(page).locator('thead th').first()).toHaveAttribute('aria-label', 'Sunday')
  })

  for (const theme of ['light', 'dark']) {
    test(`open, with its choices, has zero axe violations (${theme})`, async ({ page }) => {
      await page.goto(`${story('move-to')}&theme=${theme}`)
      await trigger(page).click()
      await expect(popup(page).getByRole('grid')).toBeVisible()
      // A day's name is react-day-picker's "Monday, September 14th, 2026", and
      // axe doesn't find the "14" it shows as a word of that (docs/DEFERRED.md).
      const results = await new AxeBuilder({ page })
        .disableRules(['landmark-one-main', 'page-has-heading-one', 'region', 'label-content-name-mismatch'])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }
})
