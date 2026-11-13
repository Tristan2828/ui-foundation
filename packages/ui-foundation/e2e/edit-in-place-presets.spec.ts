import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// The `inPlace` presets on a record's view (app/EditInPlacePresets): each
// kind opens its own control, checks before sending, saves, and reads as
// it should at rest; a pair saves as one, with the rule's message on the
// pair and a part's own refusal on that part; a link reads as its label
// or its host and edits as two boxes. Axe runs on every open state, in
// both themes.
const HARNESS = 'http://localhost:6180/story.html?id=app-editinplacepresets--'

async function open(page: Page, story: string, theme: 'light' | 'dark' = 'light') {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${HARNESS}${story}&theme=${theme}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

const axe = (page: Page) => new AxeBuilder({ page }).disableRules(['landmark-one-main', 'region']).analyze()

const row = (page: Page, label: string) => page.locator('dl > div').filter({ has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) })

test('text: Enter saves; a value past its limit is refused under the field, unsent', async ({ page }) => {
  await open(page, 'presets')
  await expect(row(page, 'Code')).toContainText('Not set')
  await page.getByRole('button', { name: 'Edit Code' }).click()
  const code = page.getByRole('textbox', { name: 'Code' })
  await expect(code).toBeFocused()
  await code.fill('ROOF-1234')
  await page.keyboard.press('Enter')
  await expect(row(page, 'Code')).toContainText('At most 8 characters')
  await expect(code).toHaveAttribute('aria-invalid', 'true')
  await code.fill('ROOF-1')
  await page.keyboard.press('Enter')
  await expect(row(page, 'Code')).toContainText('ROOF-1')
  await expect(code).toBeHidden()
})

test('number: reads with its unit, refuses a value out of range, saves the number', async ({ page }) => {
  await open(page, 'presets')
  await expect(row(page, 'Hours')).toContainText('12 h')
  await page.getByRole('button', { name: 'Edit Hours' }).click()
  const hours = page.getByRole('textbox', { name: 'Hours' })
  await hours.fill('250')
  await page.keyboard.press('Enter')
  await expect(row(page, 'Hours')).toContainText('At most 200')
  await hours.fill('20.5')
  await page.keyboard.press('Enter')
  await expect(row(page, 'Hours')).toContainText('20.5 h')
})

test('money: reads as dollars, takes what was typed with a $ and commas, and shows a server refusal', async ({ page }) => {
  await open(page, 'presets')
  await expect(row(page, 'Budget')).toContainText('$1,234.56')
  await page.getByRole('button', { name: 'Edit Budget' }).click()
  const budget = page.getByRole('textbox', { name: 'Budget' })
  await expect(budget).toHaveValue('1234.56')
  await budget.fill('$2,500.5')
  await page.keyboard.press('Enter')
  await expect(row(page, 'Budget')).toContainText('$2,500.50')

  await page.getByRole('button', { name: 'Edit Budget' }).click()
  await budget.fill('1.234')
  await page.keyboard.press('Enter')
  await expect(row(page, 'Budget')).toContainText('Enter an amount, like 12.50')
  await budget.fill('20000')
  await page.keyboard.press('Enter')
  await expect(row(page, 'Budget')).toContainText('Over the yearly cap of $10,000.00')
  await expect(budget).toHaveValue('20000')
})

test('date: typed (Enter saves), or picked from the calendar on its button (a pick saves)', async ({ page }) => {
  await open(page, 'presets')
  await expect(row(page, 'Due')).toContainText('Sep 2, 2026')
  await page.getByRole('button', { name: 'Edit Due' }).click()
  const box = page.getByRole('textbox', { name: 'Due' })
  await expect(box).toBeFocused()
  await box.fill('9/5/2026')
  await box.press('Enter')
  await expect(row(page, 'Due')).toContainText('Sep 5, 2026')
  await page.getByRole('button', { name: 'Edit Due' }).click()
  await row(page, 'Due').getByRole('button', { name: 'Open Calendar' }).click()
  const calendar = page.locator('[data-slot="date-field-calendar"]')
  await expect(calendar).toBeVisible()
  await calendar.getByRole('button', { name: /September 9th, 2026/ }).click()
  await expect(row(page, 'Due')).toContainText('Sep 9, 2026')
})

test('select: reads as its badge, the list opens with the field, a pick saves, "Not set" clears it', async ({ page }) => {
  await open(page, 'presets')
  await expect(row(page, 'Priority')).toContainText('Normal')
  await page.getByRole('button', { name: 'Edit Priority' }).click()
  await page.getByRole('option', { name: 'High' }).click()
  await expect(row(page, 'Priority')).toContainText('High')
  await page.getByRole('button', { name: 'Edit Priority' }).click()
  await page.getByRole('option', { name: 'Not set' }).click()
  await expect(row(page, 'Priority')).toContainText('Not set')
})

test('reference: typing searches through the app, a pick saves and reads as its name', async ({ page }) => {
  await open(page, 'presets')
  await expect(row(page, 'Category')).toContainText('Garden')
  await page.getByRole('button', { name: 'Edit Category' }).click()
  const box = page.getByRole('combobox', { name: 'Category' })
  await expect(box).toBeFocused()
  await box.fill('gar')
  await expect(page.getByRole('option', { name: 'Garage' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Kitchen' })).toBeHidden()
  await page.getByRole('option', { name: 'Garage' }).click()
  await expect(row(page, 'Category')).toContainText('Garage')
  await expect(box).toBeHidden()
})

test('fields as one: the rule across them shows on the pair, and nothing is sent until they agree', async ({ page }) => {
  await open(page, 'fields-as-one')
  const pair = row(page, 'Model and Effort')
  await expect(pair).toContainText('Small · Low')
  await page.getByRole('button', { name: 'Edit Model and Effort' }).click()
  await expect(page.getByRole('combobox', { name: 'Model' })).toBeFocused()
  await page.getByRole('combobox', { name: 'Effort' }).click()
  await page.getByRole('option', { name: 'Max' }).click()
  // Picking a part doesn't save: the pair is still open, both parts there.
  await expect(page.getByRole('combobox', { name: 'Model' })).toBeVisible()
  await page.keyboard.press('Control+Enter')
  await expect(pair).toContainText('Max effort needs the large model')
  await expect(page.getByRole('combobox', { name: 'Model' })).toHaveAttribute('aria-invalid', 'true')

  await page.getByRole('combobox', { name: 'Model' }).click()
  await page.getByRole('option', { name: 'Large' }).click()
  await page.keyboard.press('Control+Enter')
  await expect(pair).toContainText('Large · Max')
})

test('fields as one: a server refusal of one part shows on that part, not under the pair', async ({ page }) => {
  await open(page, 'fields-as-one')
  const pair = row(page, 'Model and Effort')
  await page.getByRole('button', { name: 'Edit Model and Effort' }).click()
  await page.getByRole('combobox', { name: 'Model' }).click()
  await page.getByRole('option', { name: 'Legacy' }).click()
  await page.keyboard.press('Control+Enter')
  const model = pair.locator('[data-part="model"]')
  await expect(model).toContainText('Legacy is not offered on this plan')
  await expect(pair.locator('[data-part="effort"]')).not.toContainText('Legacy is not offered')
  await expect(page.getByRole('combobox', { name: 'Model' })).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('combobox', { name: 'Effort' })).not.toHaveAttribute('aria-invalid', 'true')
})

test('fields as one, typed into: Enter saves both, a part’s own check shows on that part', async ({ page }) => {
  await open(page, 'fields-as-one')
  const pair = row(page, 'Hours and Budget')
  await expect(pair).toContainText('12 · $1,234.56')
  await page.getByRole('button', { name: 'Edit Hours and Budget' }).click()
  const hours = page.getByRole('textbox', { name: 'Hours' })
  const budget = page.getByRole('textbox', { name: 'Budget' })
  await budget.fill('abc')
  await page.keyboard.press('Enter')
  await expect(pair.locator('[data-part="budget"]')).toContainText('Budget: Enter an amount, like 12.50')
  await budget.fill('300')
  await hours.fill('')
  await page.keyboard.press('Enter')
  await expect(pair).toContainText('A budget needs its hours')
  await hours.fill('4')
  await page.keyboard.press('Enter')
  await expect(pair).toContainText('4 · $300.00')
})

test('link: reads as its label or its host, opening in a new tab; edits as URL and Label', async ({ page }) => {
  await open(page, 'links')
  const docs = row(page, 'Docs').getByRole('link')
  await expect(docs).toHaveText(/docs\.example\.com/)
  await expect(docs).toHaveAttribute('target', '_blank')
  await expect(docs).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(row(page, 'Supplier').getByRole('link')).toHaveText(/Supplier/)
  await expect(row(page, 'Ticket')).toContainText('No ticket')

  await page.getByRole('button', { name: 'Edit Ticket' }).click()
  const url = page.getByRole('textbox', { name: 'URL' })
  const label = page.getByRole('textbox', { name: 'Label' })
  await expect(url).toBeFocused()
  await url.fill('javascript:alert(1)')
  await page.keyboard.press('Enter')
  await expect(row(page, 'Ticket').locator('[data-part="url"]')).toContainText('Use a web or email address')
  await url.fill('tickets.example.com/42')
  await label.fill('Ticket 42')
  await label.press('Enter')
  const ticket = row(page, 'Ticket').getByRole('link')
  await expect(ticket).toHaveText(/Ticket 42/)
  await expect(ticket).toHaveAttribute('href', 'https://tickets.example.com/42')
})

test('link: a click on the link follows it; the pencil edits', async ({ page }) => {
  await open(page, 'links')
  const popup = page.waitForEvent('popup')
  await row(page, 'Docs').getByRole('link').click()
  await (await popup).close()
  await expect(page.getByRole('textbox', { name: 'URL' })).toBeHidden()
})

for (const theme of ['light', 'dark'] as const) {
  test(`every preset, open and refused, passes axe (${theme})`, async ({ page }) => {
    await open(page, 'presets', theme)
    expect((await axe(page)).violations).toEqual([])
    for (const field of ['Code', 'Hours', 'Budget']) {
      await page.getByRole('button', { name: `Edit ${field}` }).click()
      await page.getByRole('textbox', { name: field }).fill('9999999999')
      await page.keyboard.press('Enter')
      await expect(row(page, field).locator('[data-slot="field-error"]')).toBeVisible()
      expect((await axe(page)).violations).toEqual([])
      await page.keyboard.press('Escape')
    }
    await page.getByRole('button', { name: 'Edit Category' }).click()
    await expect(page.getByRole('option', { name: 'Garden' })).toBeVisible()
    // An open combobox hides the page from screen readers by design (the
    // ARIA combobox pattern), which axe reads as hidden focusable content
    // and a page with no level-one heading.
    expect((await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'region', 'aria-hidden-focus', 'page-has-heading-one']).analyze()).violations).toEqual([])
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')

    await open(page, 'fields-as-one', theme)
    await page.getByRole('button', { name: 'Edit Hours and Budget' }).click()
    await page.getByRole('textbox', { name: 'Budget' }).fill('abc')
    await page.keyboard.press('Enter')
    await expect(row(page, 'Hours and Budget').locator('[data-part="budget"] [data-slot="field-error"]')).toBeVisible()
    expect((await axe(page)).violations).toEqual([])

    await open(page, 'links', theme)
    await page.getByRole('button', { name: 'Edit Docs' }).click()
    await page.getByRole('textbox', { name: 'URL' }).fill('a b')
    await page.keyboard.press('Enter')
    await expect(row(page, 'Docs').locator('[data-slot="field-error"]')).toBeVisible()
    expect((await axe(page)).violations).toEqual([])
  })
}
