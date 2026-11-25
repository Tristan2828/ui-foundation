import { expect, test, type Page } from '@playwright/test'

// IconField (app/IconField stories): pick by click and by keyboard, the
// line naming the icon under the pointer or focus, and the sheet on a phone.
const story = (id: string) => `http://localhost:6180/story.html?id=app-iconfield--${id}`

const popup = (page: Page) => page.locator('[data-slot=icon-field-popup]')
const nameLine = (page: Page) => popup(page).locator('[data-slot=icon-field-name]')

test('picks an icon by click, and closes', async ({ page }) => {
  await page.goto(story('default'))
  const trigger = page.getByRole('button', { name: 'Place Icon' })
  await expect(trigger).toContainText('Computer')
  await trigger.click()
  const icons = popup(page).getByRole('group', { name: 'Icons' }).getByRole('button')
  await expect(icons).toHaveCount(11)
  // 6 across.
  const tops = await icons.evaluateAll((buttons) => buttons.slice(0, 7).map((button) => Math.round(button.getBoundingClientRect().top)))
  expect(new Set(tops.slice(0, 6)).size).toBe(1)
  expect(tops[6]).toBeGreaterThan(tops[0])
  await expect(popup(page).getByRole('button', { name: 'Computer' })).toHaveAttribute('aria-pressed', 'true')
  await expect(nameLine(page)).toHaveText('Computer')
  await popup(page).getByRole('button', { name: 'Car' }).hover()
  await expect(nameLine(page)).toHaveText('Car')
  await popup(page).getByRole('button', { name: 'Car' }).click()
  await expect(popup(page)).toHaveCount(0)
  await expect(page.getByTestId('place-value')).toHaveText('car')
  await expect(trigger).toContainText('Car')
  await expect(trigger).toBeFocused()
})

test('the keyboard picks, and the name line follows focus', async ({ page }) => {
  await page.goto(story('default'))
  const trigger = page.getByRole('button', { name: 'Place Icon' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(popup(page)).toBeVisible()
  const bed = popup(page).getByRole('button', { name: 'Bed' })
  // Tab along the grid to Bed (the seventh icon).
  await page.keyboard.press('Tab')
  for (let index = 0; index < 20 && !(await bed.evaluate((button) => button === document.activeElement)); index++) {
    await page.keyboard.press('Tab')
  }
  await expect(bed).toBeFocused()
  await expect(nameLine(page)).toHaveText('Bed')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('place-value')).toHaveText('bed')
})

test("renderIcon draws the trigger's icon", async ({ page }) => {
  await page.goto(story('default'))
  await expect(page.getByRole('button', { name: 'Category Icon' }).getByTestId('tinted-glyph')).toBeVisible()
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('opens as a sheet from the bottom with 48px buttons', async ({ page }) => {
    await page.goto(story('default'))
    await page.getByRole('button', { name: 'Place Icon' }).click()
    const sheet = page.getByRole('dialog', { name: 'Icon' })
    await expect(sheet).toBeVisible()
    // At the bottom of the screen, once it has slid in.
    await expect.poll(async () => {
      const box = await sheet.boundingBox()
      return box && Math.round(box.y + box.height)
    }).toBe(812)
    const button = await sheet.getByRole('button', { name: 'Sofa' }).boundingBox()
    expect(button?.width).toBe(48)
    expect(button?.height).toBe(48)
    await sheet.getByRole('button', { name: 'Sofa' }).click()
    await expect(sheet).toHaveCount(0)
    await expect(page.getByTestId('place-value')).toHaveText('sofa')
  })
})
