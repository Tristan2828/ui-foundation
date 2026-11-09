import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// MonthDayField (app/MonthDayField stories) in a real browser: a month and
// day with no year, picked with the mouse, the keyboard and a finger; only
// real days are offered (February to the 29th); a stored value that isn't
// a day shows as written; edited in place, a pick saves and Esc gives up.
const story = (id: string) => `http://localhost:6180/story.html?id=app-monthdayfield--${id}`
const picker = (page: Page) => page.locator('[data-slot="month-day-field-picker"]')
const row = (page: Page, label: string) =>
  page.locator('dl > div').filter({ has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) })

test.use({ locale: 'en-US' })

test('shows the saved day and saves the day picked, as MM-DD', async ({ page }) => {
  await page.goto(story('default'))
  const from = page.getByRole('button', { name: 'Blooms from', exact: true })
  await expect(from).toHaveText('Mar 14')
  await from.click()
  // It opens on the chosen day's month, the chosen day focused and pressed.
  await expect(picker(page).getByRole('button', { name: 'March 14', exact: true })).toBeFocused()
  await expect(picker(page).getByRole('button', { name: 'March 14', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await picker(page).getByRole('button', { name: 'March 20', exact: true }).click()
  await expect(picker(page)).toHaveCount(0)
  await expect(page.getByTestId('from-value')).toHaveText('03-20')
  await expect(from).toHaveText('Mar 20')
  await expect(from).toBeFocused()
})

test('February offers its 29th and nothing past it; April stops at 30', async ({ page }) => {
  await page.goto(story('default'))
  await page.getByRole('button', { name: 'Blooms from', exact: true }).click()
  await picker(page).getByRole('button', { name: 'March, pick another month', exact: true }).click()
  await picker(page).getByRole('button', { name: 'February', exact: true }).click()
  const days = picker(page).getByRole('group', { name: 'February', exact: true }).getByRole('button')
  await expect(days).toHaveCount(29)
  await expect(picker(page).getByRole('button', { name: 'February 30', exact: true })).toHaveCount(0)
  await picker(page).getByRole('button', { name: 'Next month', exact: true }).click()
  await picker(page).getByRole('button', { name: 'Next month', exact: true }).click()
  await expect(picker(page).getByRole('group', { name: 'April', exact: true }).getByRole('button')).toHaveCount(30)
  await picker(page).getByRole('button', { name: 'Previous month', exact: true }).click()
  await picker(page).getByRole('button', { name: 'Previous month', exact: true }).click()
  await picker(page).getByRole('button', { name: 'February 29', exact: true }).click()
  await expect(page.getByTestId('from-value')).toHaveText('02-29')
  await expect(page.getByRole('button', { name: 'Blooms from', exact: true })).toHaveText('Feb 29')
})

test('the keyboard: arrows move, Page Down changes month and keeps the day in it, Enter picks', async ({ page }) => {
  await page.goto(story('default'))
  await page.getByRole('button', { name: 'Blooms from', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(picker(page).getByRole('button', { name: 'March 14', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(picker(page).getByRole('button', { name: 'March 21', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(picker(page).getByRole('button', { name: 'March 22', exact: true })).toBeFocused()
  await page.keyboard.press('End')
  await expect(picker(page).getByRole('button', { name: 'March 31', exact: true })).toBeFocused()
  // April has no 31st: the focus lands on its last day.
  await page.keyboard.press('PageDown')
  await expect(picker(page).getByRole('button', { name: 'April 30', exact: true })).toBeFocused()
  await page.keyboard.press('Home')
  await expect(picker(page).getByRole('button', { name: 'April 1', exact: true })).toBeFocused()
  await page.keyboard.press('PageUp')
  await page.keyboard.press('PageUp')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('from-value')).toHaveText('02-01')
  // Opening again starts on the day picked.
  await expect(page.getByRole('button', { name: 'Blooms from', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(picker(page).getByRole('button', { name: 'February 1', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(picker(page)).toHaveCount(0)
  await expect(page.getByTestId('from-value')).toHaveText('02-01')
})

test('an empty field opens on the months, which the keyboard moves through too', async ({ page }) => {
  await page.goto(story('default'))
  const by = page.getByRole('button', { name: 'Blooms by', exact: true })
  await expect(by).toHaveText('No end day')
  await by.click()
  const months = picker(page).getByRole('group', { name: 'Month', exact: true })
  await expect(months.getByRole('button')).toHaveCount(12)
  await expect(picker(page).getByRole('button', { name: 'Clear', exact: true })).toHaveCount(0)
  await page.keyboard.press('Home')
  await expect(months.getByRole('button', { name: 'January', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowRight')
  await expect(months.getByRole('button', { name: 'May', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(picker(page).getByRole('button', { name: 'May 1', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('by-value')).toHaveText('05-02')
  await by.click()
  await picker(page).getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(page.getByTestId('by-value')).toHaveText('empty')
  await expect(by).toHaveText('No end day')
})

test('a stored value that is not a day shows as written, refused, and a pick replaces it', async ({ page }) => {
  await page.goto(story('default'))
  const pruned = page.getByRole('button', { name: 'Pruned', exact: true })
  await expect(pruned).toHaveText('02-30')
  await expect(pruned).toHaveAttribute('aria-invalid', 'true')
  await expect(pruned).toHaveAccessibleDescription('February has 29 days')
  await pruned.click()
  await picker(page).getByRole('button', { name: 'September', exact: true }).click()
  await picker(page).getByRole('button', { name: 'September 1', exact: true }).click()
  await expect(page.getByTestId('pruned-value')).toHaveText('09-01')
  await expect(pruned).not.toHaveAttribute('aria-invalid', 'true')
})

test('on a phone: the picker fits the screen and every day is a finger-sized target', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto(story('default'))
  await page.getByRole('button', { name: 'Blooms from', exact: true }).click()
  // Measured once the popup's opening animation has run (it grows in from smaller).
  await expect(picker(page)).toBeVisible()
  await picker(page).evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)))
  const box = await picker(page).boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(320)
  for (const name of ['March 1', 'March 31', 'Next month']) {
    const target = await picker(page).getByRole('button', { name, exact: true }).boundingBox()
    expect(target!.width, name).toBeGreaterThanOrEqual(36)
    expect(target!.height, name).toBeGreaterThanOrEqual(36)
  }
  const scrolls = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(scrolls).toBe(false)
})

test('in place: the picker opens with the field, a pick saves, Esc gives up, Clear unsets', async ({ page }) => {
  await page.goto(story('edit-in-place'))
  await expect(row(page, 'Blooms from')).toContainText('Apr 1')
  await expect(row(page, 'Blooms by')).toContainText('May 15')
  await expect(row(page, 'Checked on')).toContainText('Feb 29')

  await page.getByRole('button', { name: 'Edit Blooms from', exact: true }).click()
  await expect(picker(page).getByRole('button', { name: 'April 1', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(picker(page)).toHaveCount(0)
  await expect(row(page, 'Blooms from')).toContainText('Apr 1')

  await page.getByRole('button', { name: 'Edit Blooms from', exact: true }).click()
  await picker(page).getByRole('button', { name: 'April 10', exact: true }).click()
  await expect(row(page, 'Blooms from')).toContainText('Apr 10', { timeout: 5000 })

  // Choosing another month doesn't save: only a day does.
  await page.getByRole('button', { name: 'Edit Blooms from', exact: true }).click()
  await picker(page).getByRole('button', { name: 'April, pick another month', exact: true }).click()
  await picker(page).getByRole('button', { name: 'June', exact: true }).click()
  await expect(picker(page).getByRole('group', { name: 'June', exact: true })).toBeVisible()
  await picker(page).getByRole('button', { name: 'June 5', exact: true }).click()
  await expect(row(page, 'Blooms from')).toContainText('Jun 5', { timeout: 5000 })

  await page.getByRole('button', { name: 'Edit Blooms from', exact: true }).click()
  await picker(page).getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(row(page, 'Blooms from')).toContainText('Not set', { timeout: 5000 })

  // A required one offers no Clear, and reads in its own format.
  await expect(row(page, 'Blooms by')).toContainText('May 15')
  await page.getByRole('button', { name: 'Edit Blooms by', exact: true }).click()
  await expect(picker(page).getByRole('button', { name: 'May 15', exact: true })).toBeFocused()
  await expect(picker(page).getByRole('button', { name: 'Clear', exact: true })).toHaveCount(0)
})

test('in place as a pair: each part picks its own day, saved together', async ({ page }) => {
  await page.goto(story('edit-in-place'))
  await expect(row(page, 'Resting season')).toContainText('Nov 1 · Feb 28')
  await page.getByRole('button', { name: 'Edit Resting season', exact: true }).click()
  await page.getByRole('button', { name: 'By', exact: true }).click()
  await picker(page).getByRole('button', { name: 'February 29', exact: true }).click()
  await expect(page.getByRole('button', { name: 'By', exact: true })).toHaveText('Feb 29')
  await page.getByRole('button', { name: 'By', exact: true }).focus()
  await page.keyboard.press('Control+Enter')
  await expect(row(page, 'Resting season')).toContainText('Nov 1 · Feb 29', { timeout: 5000 })
})

for (const theme of ['light', 'dark'] as const) {
  test(`the open picker has no axe violations (${theme})`, async ({ page }) => {
    for (const id of ['open-on-days', 'open-on-months']) {
      await page.goto(`${story(id)}&theme=${theme}`)
      await expect(picker(page)).toBeVisible()
      const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'region']).analyze()
      expect(results.violations, id).toEqual([])
    }
  })
}
