import { expect, test, type Page } from '@playwright/test'

// DialogContent's `size` and `dirty` (ui/Dialog stories), in a real
// browser: the three widths on a laptop, a confirm as a bottom sheet and a
// form as the whole screen on a phone, and a dirty dialog asking
// "Discard your changes?" before Esc, the close button, a click outside or
// Cancel closes it. Axe in both themes is e2e/fixtures-visual.spec.ts's
// COMPOSITE_STORIES.
const story = (id: string) => `http://localhost:6180/story.html?id=ui-dialog--${id}`

const LAPTOP = { width: 1280, height: 800 }
const PHONE = { width: 375, height: 812 }

async function box(page: Page, name: string | RegExp) {
  const dialog = page.getByRole('dialog', { name })
  await expect(dialog).toBeVisible()
  // Past the opening animation's zoom.
  await page.waitForTimeout(200)
  const rect = await dialog.boundingBox()
  if (!rect) throw new Error('no dialog box')
  return rect
}

for (const [size, width] of [
  ['confirm', 420],
  ['form', 640],
  ['record', 1120],
] as const) {
  test(`a ${size} dialog is ${width}px wide on a laptop`, async ({ page }) => {
    await page.setViewportSize(LAPTOP)
    await page.goto(story('sizes'))
    await page.getByRole('button', { name: { confirm: 'A confirm', form: 'A small form', record: 'A record' }[size] }).click()
    const rect = await box(page, `A ${size} dialog`)
    expect(Math.round(rect.width)).toBe(width)
    // Centred.
    expect(Math.abs(rect.x + rect.width / 2 - LAPTOP.width / 2)).toBeLessThan(2)
  })
}

test('on a phone a confirm is a sheet from the bottom, the action over Cancel, both full width', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.goto(story('confirm'))
  const rect = await box(page, 'Delete the Nov 1 balance?')
  expect(Math.round(rect.x)).toBe(0)
  expect(Math.round(rect.width)).toBe(PHONE.width)
  expect(Math.round(rect.y + rect.height)).toBe(PHONE.height)

  const dialog = page.getByRole('dialog', { name: 'Delete the Nov 1 balance?' })
  const del = await dialog.getByRole('button', { name: 'Delete' }).boundingBox()
  const cancel = await dialog.getByRole('button', { name: 'Cancel' }).boundingBox()
  if (!del || !cancel) throw new Error('no buttons')
  expect(del.y + del.height).toBeLessThanOrEqual(cancel.y)
  expect(Math.round(del.height)).toBe(40)
  expect(Math.round(del.width)).toBe(Math.round(cancel.width))
  expect(del.width).toBeGreaterThan(PHONE.width - 40)

  await dialog.getByRole('button', { name: 'Delete' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('The Nov 1 balance is gone.')).toBeVisible()
})

// 40rem to 48rem: the base dialog's `sm:` widths mustn't leak into a phone's.
test('between 640 and 768px a confirm is still the sheet and a form still the whole screen', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 })
  await page.goto(story('sizes'))
  await page.getByRole('button', { name: 'A confirm' }).click()
  let rect = await box(page, 'A confirm dialog')
  expect(Math.round(rect.width)).toBe(700)
  expect(Math.round(rect.y + rect.height)).toBe(900)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'A small form' }).click()
  rect = await box(page, 'A form dialog')
  expect([Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)]).toEqual([0, 0, 700, 900])
})

test('on a phone a form dialog is the whole screen', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.goto(story('sizes'))
  await page.getByRole('button', { name: 'A small form' }).click()
  const rect = await box(page, 'A form dialog')
  expect([Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)]).toEqual([
    0,
    0,
    PHONE.width,
    PHONE.height,
  ])
})

const shelf = (page: Page) => page.getByRole('dialog', { name: 'New shelf' })
const prompt = (page: Page) => page.getByRole('dialog', { name: 'Discard your changes?' })

test('with nothing typed, Esc, Cancel and a click outside close at once', async ({ page }) => {
  await page.setViewportSize(LAPTOP)
  await page.goto(story('dirty'))
  for (const how of ['Escape', 'Cancel', 'outside'] as const) {
    await page.getByRole('button', { name: 'New shelf' }).click()
    await expect(shelf(page)).toBeVisible()
    if (how === 'Escape') await page.keyboard.press('Escape')
    else if (how === 'Cancel') await shelf(page).getByRole('button', { name: 'Cancel' }).click()
    else await page.mouse.click(10, 10)
    await expect(shelf(page)).toHaveCount(0)
    await expect(prompt(page)).toHaveCount(0)
  }
})

for (const how of ['Escape', 'Close', 'Cancel', 'outside'] as const) {
  test(`with something typed, ${how} asks first; Keep editing keeps it, Discard closes`, async ({ page }) => {
    await page.setViewportSize(LAPTOP)
    await page.goto(story('dirty'))
    await page.getByRole('button', { name: 'New shelf' }).click()
    await shelf(page).getByRole('textbox', { name: 'Name' }).fill('Cookbooks')
    const leave = async () => {
      if (how === 'Escape') await page.keyboard.press('Escape')
      else if (how === 'Close') await shelf(page).getByRole('button', { name: 'Close' }).click()
      else if (how === 'Cancel') await shelf(page).getByRole('button', { name: 'Cancel' }).click()
      else await page.mouse.click(10, 10)
    }

    await leave()
    await expect(prompt(page)).toBeVisible()
    await expect(prompt(page).getByText('What you typed will be lost.')).toBeVisible()
    await prompt(page).getByRole('button', { name: 'Keep editing' }).click()
    await expect(prompt(page)).toHaveCount(0)
    await expect(shelf(page).getByRole('textbox', { name: 'Name' })).toHaveValue('Cookbooks')

    // Still dirty: it asks again, and Esc on the prompt is Keep editing.
    await leave()
    await expect(prompt(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(prompt(page)).toHaveCount(0)
    await expect(shelf(page)).toBeVisible()

    await leave()
    await prompt(page).getByRole('button', { name: 'Discard' }).click()
    await expect(prompt(page)).toHaveCount(0)
    await expect(shelf(page)).toHaveCount(0)
    await expect(page.getByTestId('shelf-result')).toHaveText('Nothing saved yet')

    // Opened again, it starts empty and clean.
    await page.getByRole('button', { name: 'New shelf' }).click()
    await expect(shelf(page).getByRole('textbox', { name: 'Name' })).toHaveValue('')
    await page.keyboard.press('Escape')
    await expect(shelf(page)).toHaveCount(0)
  })
}

test('a save that closes the dialog from code never asks', async ({ page }) => {
  await page.setViewportSize(LAPTOP)
  await page.goto(story('dirty'))
  await page.getByRole('button', { name: 'New shelf' }).click()
  await shelf(page).getByRole('textbox', { name: 'Name' }).fill('Cookbooks')
  await shelf(page).getByRole('button', { name: 'Add shelf' }).click()
  await expect(shelf(page)).toHaveCount(0)
  await expect(prompt(page)).toHaveCount(0)
  await expect(page.getByTestId('shelf-result')).toHaveText('Saved Cookbooks')
})
