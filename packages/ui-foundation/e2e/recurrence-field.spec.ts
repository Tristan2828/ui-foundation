import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// RecurrenceField (app/RecurrenceField stories, #326) in a real browser: a
// phrase read as it's typed, with its label and next five dates, and a
// clear refusal; the presets; on a form; edited in place (Enter saves, a
// phrase it can't read doesn't); the list cells; a phone's width; axe in
// both themes with a refusal showing; dates only, with weeks from Sunday
// (4.114), and its axe in both themes. Every story is on Thursday
// 2026-11-12, noon in Chicago.
const story = (id: string) => `http://localhost:6180/story.html?id=app-recurrencefield--${id}`
const field = (page: Page, name: string) => page.locator('[data-slot="recurrence-field"]').filter({ has: page.getByRole('textbox', { name, exact: true }) })
const row = (page: Page, label: string) =>
  page.locator('dl > div').filter({ has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) })

test.use({ locale: 'en-US', timezoneId: 'America/Chicago' })

test('reads a set value back as its phrase, label and next five dates', async ({ page }) => {
  await page.goto(story('default'))
  const box = page.getByRole('textbox', { name: 'Change the Filter', exact: true })
  await expect(box).toHaveValue('every 2nd tue at 9am')
  const preview = field(page, 'Change the Filter').locator('[data-slot="recurrence-preview"]')
  await expect(preview).toContainText('Every 2nd Tue at 9:00 AM')
  await expect(preview.getByRole('list', { name: 'Next' }).getByRole('listitem')).toHaveText([
    'Tue, Dec 8, 9:00 AM',
    'Tue, Jan 12, 2027, 9:00 AM',
    'Tue, Feb 9, 2027, 9:00 AM',
    'Tue, Mar 9, 2027, 9:00 AM',
    'Tue, Apr 13, 2027, 9:00 AM',
  ])
  // Its preset is pressed.
  await expect(field(page, 'Change the Filter').getByRole('button', { name: 'Monthly on the 2nd Thu' })).toHaveAttribute('aria-pressed', 'false')
  await expect(field(page, 'Change the Filter').getByRole('button', { name: 'Custom' })).toHaveAttribute('aria-pressed', 'true')
})

test('reads a phrase as it is typed, and says clearly what it cannot read', async ({ page }) => {
  await page.goto(story('default'))
  const box = page.getByRole('textbox', { name: 'Water the Plants', exact: true })
  const preview = field(page, 'Water the Plants').locator('[data-slot="recurrence-preview"]')
  await expect(preview).toContainText("Doesn’t repeat")
  await box.pressSequentially('every 3 days at 9am, 5pm')
  await expect(preview).toContainText('Every 3 days at 9:00 AM and 5:00 PM')
  await expect(preview.getByRole('listitem').first()).toHaveText('Thu, Nov 12, 5:00 PM')
  await expect(page.getByTestId('water-value')).toHaveText('FREQ=DAILY;INTERVAL=3 · 2026-11-12 · 09:00,17:00 · schedule')
  await expect(box).not.toHaveAttribute('aria-invalid', 'true')

  await box.fill('every blue moon')
  await expect(preview).toContainText("Couldn't read “blue moon”")
  await expect(box).toHaveAttribute('aria-invalid', 'true')
  await expect(box).toHaveAccessibleDescription(/Couldn't read “blue moon”/)
  // Nothing it can't read is kept: the value is none.
  await expect(page.getByTestId('water-value')).toHaveText('none')

  await box.fill('every! 3 days starting dec 1 until mar 1')
  await expect(preview).toContainText('Every 3 days after done, at 9:00 AM, until Mar 1, 2027')
  await expect(page.getByTestId('water-value')).toHaveText('FREQ=DAILY;INTERVAL=3;UNTIL=20270301 · 2026-12-01 · 09:00 · from done')
  await box.fill('')
  await expect(page.getByTestId('water-value')).toHaveText('none')
})

test('a preset sets the rule from the start day, and keeps the times', async ({ page }) => {
  await page.goto(story('default'))
  const presets = field(page, 'Change the Filter').getByRole('group', { name: 'Presets' })
  await expect(presets.getByRole('button')).toHaveText([
    'Daily',
    'Weekdays',
    'Weekly on Thu',
    'Monthly on the 12th',
    'Monthly on the 2nd Thu',
    'Yearly on Nov 12',
    'Custom',
  ])
  await presets.getByRole('button', { name: 'Weekdays' }).click()
  await expect(page.getByTestId('filter-value')).toHaveText('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR · 2026-11-12 · 09:00 · schedule')
  await expect(page.getByRole('textbox', { name: 'Change the Filter', exact: true })).toHaveValue('every weekday at 9am')
  await expect(presets.getByRole('button', { name: 'Weekdays' })).toHaveAttribute('aria-pressed', 'true')
  await presets.getByRole('button', { name: 'Monthly on the 2nd Thu' }).click()
  await expect(page.getByTestId('filter-value')).toHaveText('FREQ=MONTHLY;BYDAY=2TH · 2026-11-12 · 09:00 · schedule')
  await presets.getByRole('button', { name: 'Custom' }).click()
  await expect(page.getByRole('textbox', { name: 'Change the Filter', exact: true })).toBeFocused()
})

test('a stored rule that can never fall is refused and shown as such', async ({ page }) => {
  await page.goto(story('default'))
  const box = page.getByRole('textbox', { name: 'Imported', exact: true })
  await expect(box).toHaveAttribute('aria-invalid', 'true')
  await expect(field(page, 'Imported')).toContainText('never falls on a day')
  await box.fill('every feb 28')
  await expect(field(page, 'Imported')).toContainText('Every Feb 28 at 9:00 AM')
  await expect(box).not.toHaveAttribute('aria-invalid', 'true')
})

test('on a form: the value saves, and a phrase it cannot read stops the save', async ({ page }) => {
  await page.goto(story('in-form'))
  const box = page.getByRole('textbox', { name: 'Repeats', exact: true })
  await box.fill('every last fri at 6pm')
  await page.getByRole('button', { name: 'Save Chore' }).click()
  await expect(page.getByTestId('saved-value')).toHaveText('FREQ=MONTHLY;BYDAY=-1FR · 2026-11-12 · 18:00 · schedule')

  await box.fill('every so often')
  await page.getByRole('button', { name: 'Save Chore' }).click()
  await expect(page.getByText('Say how it repeats')).toBeVisible()
})

test('in place: Enter saves what was typed, an unreadable phrase is not saved, Esc gives up', async ({ page }) => {
  await page.goto(story('edit-in-place'))
  await expect(row(page, 'Repeats')).toContainText('Every 2nd Tue at 9:00 AM')
  await expect(row(page, 'Reminder')).toContainText('Not set')

  await page.getByRole('button', { name: 'Edit Repeats', exact: true }).click()
  const box = page.getByRole('textbox', { name: 'Repeats', exact: true })
  await expect(box).toBeFocused()
  await box.fill('every weekday at 8am')
  await box.press('Enter')
  await expect(row(page, 'Repeats')).toContainText('Every weekday at 8:00 AM', { timeout: 5000 })

  await page.getByRole('button', { name: 'Edit Repeats', exact: true }).click()
  await box.fill('every now and then')
  await box.press('Enter')
  await expect(row(page, 'Repeats')).toContainText("Couldn't read")
  await box.press('Escape')
  await expect(row(page, 'Repeats')).toContainText('Every weekday at 8:00 AM')

  // A preset pressed with Enter is picked, not saved from before it.
  await page.getByRole('button', { name: 'Edit Reminder', exact: true }).click()
  await row(page, 'Reminder').getByRole('button', { name: 'Daily' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: 'Reminder', exact: true })).toHaveValue('every day at 9am')
  await page.getByRole('textbox', { name: 'Reminder', exact: true }).press('Enter')
  await expect(row(page, 'Reminder')).toContainText('Every day at 9:00 AM', { timeout: 5000 })
})

test('list cells: the Repeats label and the Next one, in the rule’s zone', async ({ page }) => {
  await page.goto(story('list-cells'))
  const cells = (name: string) => page.getByRole('row').filter({ hasText: name }).getByRole('cell')
  await expect(cells('Change the filter')).toHaveText(['Change the filter', 'Every 2nd Tue at 9:00 AM', 'Tue, Dec 8, 9:00 AM'])
  await expect(cells('Take out the bins')).toHaveText([
    'Take out the bins',
    'Every Mon and Thu at 7:00 AM and 7:30 PM',
    'Thu, Nov 12, 7:30 PM',
  ])
  await expect(cells('Pay the rent').nth(2)).toHaveText('Mon, Nov 30, 9:00 AM')
  await expect(cells('Descale the kettle').nth(1)).toHaveText('Every 30 days after done, at 9:00 AM')
  await expect(cells('Spring clean').nth(2)).toHaveText('Ended')
})

test('on a phone: the presets wrap and nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.goto(story('default'))
  const presets = field(page, 'Change the Filter').getByRole('group', { name: 'Presets' })
  const box = await presets.boundingBox()
  expect(box!.x + box!.width).toBeLessThanOrEqual(320)
  const scrolls = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(scrolls).toBe(false)
})

test('dates only, weeks from Sunday: the preview has no times, and weekly rules carry WKST=SU', async ({ page }) => {
  await page.goto(story('dates-only'))
  const club = field(page, 'Book Club')
  const box = page.getByRole('textbox', { name: 'Book Club', exact: true })
  await expect(box).toHaveValue('every other week on sun and wed')
  const preview = club.locator('[data-slot="recurrence-preview"]')
  await expect(preview.locator('p').first()).toHaveText('Every other week on Sun and Wed')
  // From Thursday the 12th: weeks from Sunday, so Sun the 15th (not the 8th's fortnight), and no times.
  await expect(preview.getByRole('list', { name: 'Next' }).getByRole('listitem')).toHaveText([
    'Sun, Nov 15',
    'Wed, Nov 18',
    'Sun, Nov 29',
    'Wed, Dec 2',
    'Sun, Dec 13',
  ])
  await expect(club).not.toContainText('AM')
  await expect(club).not.toContainText('12:00')

  // Typed: a weekly rule gets WKST=SU; a time is refused; today counts when it falls today.
  const market = page.getByRole('textbox', { name: 'Farmers Market', exact: true })
  await expect(market).toHaveAttribute('placeholder', 'every 2nd tue')
  await market.fill('every other week on sun and thu')
  await expect(page.getByTestId('market-value')).toHaveText('FREQ=WEEKLY;INTERVAL=2;BYDAY=TH,SU;WKST=SU · 2026-11-12 · 00:00 · schedule')
  const marketPreview = field(page, 'Farmers Market').locator('[data-slot="recurrence-preview"]')
  await expect(marketPreview.getByRole('listitem').first()).toHaveText('Thu, Nov 12')
  // Its week is Sun 8 to Sat 14, so the next is two weeks on: Sun the 22nd (Monday weeks would give the 15th).
  await expect(marketPreview.getByRole('listitem').nth(1)).toHaveText('Sun, Nov 22')
  await market.fill('every thu at 9am')
  await expect(marketPreview).toContainText('leave out “at …”')
  await expect(market).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByTestId('market-value')).toHaveText('none')

  // A weekly preset carries WKST=SU, and stays pressed.
  const presets = field(page, 'Farmers Market').getByRole('group', { name: 'Presets' })
  await presets.getByRole('button', { name: 'Weekdays' }).click()
  await expect(page.getByTestId('market-value')).toHaveText('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;WKST=SU · 2026-11-12 · 00:00 · schedule')
  await expect(market).toHaveValue('every weekday')
  await expect(presets.getByRole('button', { name: 'Weekdays' })).toHaveAttribute('aria-pressed', 'true')

  // In place: the value at rest has no times either, and what's typed saves.
  await expect(row(page, 'Repeats')).toHaveText(/Every other week on Sun and Wed$/)
  await page.getByRole('button', { name: 'Edit Repeats', exact: true }).click()
  const inPlaceBox = page.getByRole('textbox', { name: 'Repeats', exact: true })
  await inPlaceBox.fill('every 3 weeks on sun')
  await inPlaceBox.press('Enter')
  await expect(row(page, 'Repeats')).toHaveText(/Every 3 weeks on Sun$/, { timeout: 5000 })
})

for (const theme of ['light', 'dark'] as const) {
  test(`dates only has no axe violations (${theme})`, async ({ page }) => {
    await page.goto(`${story('dates-only')}&theme=${theme}`)
    await page.getByRole('textbox', { name: 'Farmers Market', exact: true }).fill('every thu at 9am')
    await expect(field(page, 'Farmers Market')).toContainText('leave out')
    const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'region', 'page-has-heading-one']).analyze()
    expect(results.violations).toEqual([])
  })
}

for (const theme of ['light', 'dark'] as const) {
  test(`a refusal and a preview have no axe violations (${theme})`, async ({ page }) => {
    await page.goto(`${story('default')}&theme=${theme}`)
    await page.getByRole('textbox', { name: 'Water the Plants', exact: true }).fill('every blue moon')
    await expect(field(page, 'Water the Plants')).toContainText("Couldn't read")
    const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'region', 'page-has-heading-one']).analyze()
    expect(results.violations).toEqual([])
  })
}
