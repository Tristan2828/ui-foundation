import { expect, test, type Page } from '@playwright/test'

// FormDialog (app/FormDialog stories) in a real browser: 640px on a
// laptop and the whole screen on a phone, the title and buttons pinned
// while the fields scroll, a required field refused, a failed save as a
// Notice with Try again, and "Discard your changes?" once something is
// typed. Opened over a list by its route is e2e/record-dialog.spec.ts.
// Axe in both themes is e2e/fixtures-visual.spec.ts's COMPOSITE_STORIES.
const story = (id: string) => `http://localhost:6180/story.html?id=app-formdialog--${id}`

const LAPTOP = { width: 1280, height: 800 }
const PHONE = { width: 375, height: 812 }

const book = (page: Page) => page.getByRole('dialog', { name: 'New Book' })

async function rectOf(page: Page, selector: string) {
  const rect = await page.locator(selector).boundingBox()
  if (!rect) throw new Error(`no ${selector}`)
  return rect
}

test('640px on a laptop; Add with a title adds it and closes', async ({ page }) => {
  await page.setViewportSize(LAPTOP)
  await page.goto(story('default'))
  await expect(book(page)).toBeVisible()
  await page.waitForTimeout(200)
  expect(Math.round((await book(page).boundingBox())!.width)).toBe(640)

  await book(page).getByRole('button', { name: 'Add Book' }).click()
  await expect(book(page).getByText('Give it a title')).toBeVisible()
  await expect(book(page).getByRole('textbox', { name: 'Title' })).toHaveAttribute('aria-invalid', 'true')

  await book(page).getByRole('textbox', { name: 'Title' }).fill('The Long Walk')
  await book(page).getByRole('button', { name: 'Add Book' }).click()
  await expect(book(page)).toHaveCount(0)
  await expect(page.getByTestId('book-result')).toHaveText('Added The Long Walk')
})

for (const viewport of [LAPTOP, PHONE]) {
  test(`a long form scrolls between its pinned title and buttons (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto(story('long'))
    await expect(book(page)).toBeVisible()
    await page.waitForTimeout(200)
    const body = page.locator('[data-slot=form-dialog-body]')
    const scrolls = await body.evaluate((element) => element.scrollHeight > element.clientHeight)
    expect(scrolls).toBe(true)

    const bar = await rectOf(page, '[data-slot=form-dialog-bar]')
    const header = await rectOf(page, '[data-slot=form-dialog-header]')
    await body.evaluate((element) => element.scrollTo(0, element.scrollHeight))
    // Neither moved, and the bar is on screen.
    expect(await rectOf(page, '[data-slot=form-dialog-bar]')).toEqual(bar)
    expect(await rectOf(page, '[data-slot=form-dialog-header]')).toEqual(header)
    expect(bar.y + bar.height).toBeLessThanOrEqual(viewport.height)
    await expect(book(page).getByRole('textbox', { name: 'Notes' })).toBeInViewport()
  })
}

test('on a phone: the whole screen, Cancel and Add two wide buttons', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.goto(story('default'))
  await expect(book(page)).toBeVisible()
  await page.waitForTimeout(200)
  const rect = (await book(page).boundingBox())!
  expect([Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)]).toEqual([
    0,
    0,
    PHONE.width,
    PHONE.height,
  ])
  const cancel = (await book(page).getByRole('button', { name: 'Cancel' }).boundingBox())!
  const add = (await book(page).getByRole('button', { name: 'Add Book' }).boundingBox())!
  expect(Math.round(cancel.width)).toBe(Math.round(add.width))
  expect(cancel.width).toBeGreaterThan(PHONE.width / 2 - 40)
  expect(Math.round(add.height)).toBe(40)
  expect(Math.round(add.y)).toBe(Math.round(cancel.y))
})

test('a failed save: a Notice above the buttons, what was typed kept, Try again submits again', async ({ page }) => {
  await page.setViewportSize(LAPTOP)
  await page.goto(story('failed-save'))
  const notice = book(page).locator('[data-slot=notice]')
  await expect(notice).toContainText("Couldn't add the book")
  await expect(notice).toHaveAttribute('data-tone', 'destructive')
  await expect(book(page).getByRole('textbox', { name: 'Title' })).toHaveValue('fail')

  // Try again submits again: refused again, still open.
  await notice.getByRole('button', { name: 'Try Again' }).click()
  await expect(book(page).getByRole('button', { name: 'Add Book' })).toBeDisabled()
  await expect(notice).toContainText("Couldn't add the book")

  await book(page).getByRole('textbox', { name: 'Title' }).fill('Harbor Light')
  await notice.getByRole('button', { name: 'Try Again' }).click()
  await expect(book(page)).toHaveCount(0)
  await expect(page.getByTestId('book-result')).toHaveText('Added Harbor Light')
})

test('something typed: closing asks "Discard your changes?"', async ({ page }) => {
  await page.setViewportSize(LAPTOP)
  await page.goto(story('closed'))
  await page.getByRole('button', { name: 'New Book' }).click()
  await book(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(book(page)).toHaveCount(0)

  await page.getByRole('button', { name: 'New Book' }).click()
  await book(page).getByRole('textbox', { name: 'Author' }).fill('Jane Doe')
  await page.keyboard.press('Escape')
  const prompt = page.getByRole('dialog', { name: 'Discard your changes?' })
  await expect(prompt).toBeVisible()
  await prompt.getByRole('button', { name: 'Keep Editing' }).click()
  await expect(book(page).getByRole('textbox', { name: 'Author' })).toHaveValue('Jane Doe')
  await book(page).getByRole('button', { name: 'Cancel' }).click()
  await prompt.getByRole('button', { name: 'Discard' }).click()
  await expect(book(page)).toHaveCount(0)
  await expect(page.getByTestId('book-result')).toHaveText('No book added yet')
})
