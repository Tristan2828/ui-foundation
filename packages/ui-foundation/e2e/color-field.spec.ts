import { expect, test, type Page } from '@playwright/test'

// ColorField (app/ColorField stories): pick by pointer and by keyboard as
// one radio group, Custom opening the browser's own picker, a value that's
// none of the named colours, and a required one refused. Axe, the tokens
// and the swatches' contrast are e2e/fixtures-visual.spec.ts.
const story = (id: string) => `http://localhost:6180/story.html?id=app-colorfield--${id}`

// Counts showPicker() calls: headless Chromium opens no picker to see.
async function countPickerOpens(page: Page) {
  await page.addInitScript(() => {
    const opens = { count: 0 }
    Object.assign(window, { pickerOpens: opens })
    HTMLInputElement.prototype.showPicker = function showPicker() {
      opens.count += 1
    }
  })
}
const pickerOpens = (page: Page) => page.evaluate(() => (window as unknown as { pickerOpens: { count: number } }).pickerOpens.count)

const values = (page: Page) => page.getByTestId('values')

test('each swatch is a radio named by its colour, the value checked, and a click picks one', async ({ page }) => {
  await page.goto(story('default'))
  const label = page.getByRole('radiogroup', { name: 'Label Colour' })
  await expect(label.getByRole('radio')).toHaveCount(13)
  await expect(label.getByRole('radio', { name: 'Blue' })).toBeChecked()
  await expect(label.getByRole('radio', { name: 'Custom' })).not.toBeChecked()
  await expect(label.getByText('Blue', { exact: true })).toBeVisible()

  await label.getByText('Teal', { exact: true }).click()
  await expect(label.getByRole('radio', { name: 'Teal' })).toBeChecked()
  await expect(label.getByRole('radio', { name: 'Blue' })).not.toBeChecked()
  await expect(values(page)).toHaveText('#0d8a80 · C0FFEE · empty')
})

test('a colour that is none of them shows Custom with its hex, and the value goes out unchanged until picked', async ({ page }) => {
  await page.goto(story('default'))
  const calendar = page.getByRole('radiogroup', { name: 'Calendar Colour' })
  await expect(calendar.getByRole('radio', { name: 'Custom' })).toBeChecked()
  await expect(calendar.locator('[data-slot=color-field-hex]')).toHaveText('#c0ffee')
  await expect(calendar.getByLabel('Custom colour')).toHaveValue('#c0ffee')
  await expect(values(page)).toHaveText('#2563eb · C0FFEE · empty')

  // An app's own list: a value stored uppercase is still its name, and
  // a pick goes out in storedColor's form.
  await page.goto(story('own-colors'))
  const paint = page.getByRole('radiogroup', { name: 'Wall Paint' })
  await expect(paint.getByRole('radio', { name: 'Sage' })).toBeChecked()
  await paint.getByText('Terracotta').click()
  await expect(page.getByTestId('paint-value')).toHaveText('#c66b3d')
})

test('the keyboard: one tab stop, arrows move and pick with a visible ring, Tab goes on to the picker', async ({ page }) => {
  await countPickerOpens(page)
  await page.goto(story('default'))
  const label = page.getByRole('radiogroup', { name: 'Label Colour' })
  // From the field's label, the next tab stop is the group's checked radio.
  await page.getByText('Label Colour', { exact: true }).click()
  await page.keyboard.press('Tab')
  const blue = label.getByRole('radio', { name: 'Blue' })
  await expect(blue).toBeFocused()

  await page.keyboard.press('ArrowRight')
  const indigo = label.getByRole('radio', { name: 'Indigo' })
  await expect(indigo).toBeFocused()
  await expect(indigo).toBeChecked()
  await expect(values(page)).toHaveText('#5b5ee8 · C0FFEE · empty')
  // The focus ring is on the choice the keyboard is on.
  const ring = await indigo.locator('xpath=ancestor::label[1]').evaluate((element) => getComputedStyle(element).boxShadow)
  expect(ring).not.toBe('none')

  await page.keyboard.press('ArrowLeft')
  await expect(blue).toBeChecked()

  // Reaching Custom by the keyboard picks it and keeps the value; it
  // doesn't open the picker. Tab goes to the picker, not another swatch.
  await label.getByText('Grey', { exact: true }).click()
  await expect(label.getByRole('radio', { name: 'Grey' })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(label.getByRole('radio', { name: 'Custom' })).toBeChecked()
  await expect(label.locator('[data-slot=color-field-hex]')).toHaveText('#737373')
  // Space on it (a keyboard click) doesn't either.
  await page.keyboard.press('Space')
  expect(await pickerOpens(page)).toBe(0)
  await page.keyboard.press('Tab')
  await expect(label.getByLabel('Custom colour')).toBeFocused()
  // Arrows on the picker don't move the group.
  await page.keyboard.press('ArrowLeft')
  await expect(label.getByLabel('Custom colour')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('radiogroup', { name: 'Calendar Colour' }).getByRole('radio', { name: 'Custom' })).toBeFocused()
})

test('Custom by pointer opens the browser’s picker, and its colour goes out in storedColor’s form', async ({ page }) => {
  await countPickerOpens(page)
  await page.goto(story('default'))
  const label = page.getByRole('radiogroup', { name: 'Label Colour' })
  await label.getByText('Custom', { exact: true }).click()
  await expect(label.getByRole('radio', { name: 'Custom' })).toBeChecked()
  expect(await pickerOpens(page)).toBe(1)

  await label.getByLabel('Custom colour').fill('#123abc')
  await expect(label.locator('[data-slot=color-field-hex]')).toHaveText('#123abc')
  await expect(values(page)).toHaveText('#123abc · C0FFEE · empty')
  await expect(label.getByRole('radio', { name: 'Custom' })).toBeChecked()

  // Back to a named colour.
  await label.getByText('Red', { exact: true }).click()
  await expect(label.getByRole('radio', { name: 'Red' })).toBeChecked()
  await expect(label.locator('[data-slot=color-field-hex]')).toHaveCount(0)
  await expect(values(page)).toHaveText('#dc2626 · C0FFEE · empty')
})

test('a required colour left empty is refused on Save, and a pick clears it', async ({ page }) => {
  await page.goto(story('default'))
  const tag = page.getByRole('radiogroup', { name: 'Tag Colour' })
  await expect(tag).toHaveAttribute('aria-required', 'true')
  await expect(tag.getByRole('radio', { checked: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Save Colours' }).click()
  await expect(page.getByText('Pick a colour for the tag')).toBeVisible()
  await expect(tag).toHaveAttribute('aria-invalid', 'true')
  await tag.getByText('Green', { exact: true }).click()
  await expect(page.getByText('Pick a colour for the tag')).toHaveCount(0)
  await expect(values(page)).toHaveText('#2563eb · C0FFEE · #16883f')
})
