import { expect, test, type Locator, type Page } from '@playwright/test'

// EntityForm in the form standard (4.85; app/EntityForm stories) in a
// real browser: short fields sharing rows by size, 32px controls 14px
// apart (40px on a phone, one field a row but two dates), the required
// marks, a refused Add moving to the problem and counting it, a failed
// save's Notice with Try again, the bar stuck to the window's bottom, the
// status drawn as its badge, and "Discard your changes?" before leaving
// with something typed. The last test is FormDialog's route guard, on
// RecordDialog's New record story. Axe in both themes and every palette
// is e2e/fixtures-visual.spec.ts's COMPOSITE_STORIES; the row rule itself
// is tests/form-standard.test.tsx.
const story = (id: string) => `http://localhost:6180/story.html?id=app-entityform--${id}`

const LAPTOP = { width: 1280, height: 900 }
const PHONE = { width: 375, height: 812 }

const box = async (locator: Locator) => {
  const rect = await locator.boundingBox()
  if (!rect) throw new Error('not drawn')
  return rect
}
const fieldOf = (page: Page, id: string) => page.locator(`[data-slot=field]:has(#${id})`)
const bar = (page: Page) => page.locator('[data-slot=entity-form-bar]')
const toFix = (page: Page) => page.locator('[data-slot=entity-form-to-fix]')
const prompt = (page: Page) => page.getByRole('dialog', { name: 'Discard your changes?' })

async function open(page: Page, id: string, viewport = LAPTOP) {
  await page.setViewportSize(viewport)
  await page.goto(story(id))
  await expect(page.getByRole('heading', { level: 1, name: 'New book' })).toBeVisible()
}

test('on a laptop: short fields share rows by size, 32px controls 14px apart', async ({ page }) => {
  await open(page, 'default')
  const top = async (id: string) => Math.round((await box(fieldOf(page, id))).y)
  const width = async (id: string) => (await box(fieldOf(page, id))).width

  // Status and Format; Series and Number; Started, Finished and Rating; Pages and Published.
  expect(await top('book-format')).toBe(await top('book-status'))
  expect(await top('book-number')).toBe(await top('book-series'))
  expect(await top('book-finished')).toBe(await top('book-started'))
  expect(await top('book-rating')).toBe(await top('book-started'))
  expect(await top('book-published')).toBe(await top('book-pages'))
  // Each row is its own: Started doesn't join Series and Number.
  expect(await top('book-started')).toBeGreaterThan(await top('book-series'))
  // Full and solo-sized fields take the row.
  expect(await top('book-author')).toBeGreaterThan(await top('book-status'))
  expect(await top('book-series')).toBeGreaterThan(await top('book-author'))

  // As wide as their sizes: a series (l, 2.6) beside a number (s, 1).
  const ratio = (await width('book-series')) / (await width('book-number'))
  expect(ratio).toBeGreaterThan(2.4)
  expect(ratio).toBeLessThan(2.8)
  // The row fills the form, gap included.
  const title = await box(fieldOf(page, 'book-title'))
  const number = await box(fieldOf(page, 'book-number'))
  expect(Math.abs(number.x + number.width - (title.x + title.width))).toBeLessThan(1)

  for (const id of ['book-title', 'book-status', 'book-started', 'book-pages']) {
    expect(Math.round((await box(page.locator(`#${id}`))).height)).toBe(32)
  }
  expect(Math.round((await box(bar(page).getByRole('button', { name: 'Add book' }))).height)).toBe(32)
  const titleBottom = (await box(fieldOf(page, 'book-title'))).y + title.height
  expect(Math.round((await top('book-status')) - titleBottom)).toBe(14)
})

test('on a phone: a field a row but two dates, 40px controls, two wide buttons', async ({ page }) => {
  await open(page, 'default', PHONE)
  const rect = (id: string) => box(fieldOf(page, id))
  expect((await rect('book-format')).y).toBeGreaterThan((await rect('book-status')).y)
  expect((await rect('book-number')).y).toBeGreaterThan((await rect('book-series')).y)
  // Two dates stay side by side; the rating after them takes its own row.
  expect(Math.round((await rect('book-finished')).y)).toBe(Math.round((await rect('book-started')).y))
  expect((await rect('book-rating')).y).toBeGreaterThan((await rect('book-started')).y)
  // Two numbers too.
  expect(Math.round((await rect('book-published')).y)).toBe(Math.round((await rect('book-pages')).y))

  expect(Math.round((await box(page.locator('#book-title'))).height)).toBe(40)
  const cancel = await box(bar(page).getByRole('button', { name: 'Cancel' }))
  const add = await box(bar(page).getByRole('button', { name: 'Add book' }))
  expect(Math.round(add.height)).toBe(40)
  expect(Math.abs(cancel.width - add.width)).toBeLessThan(2)
  expect(cancel.width).toBeGreaterThan(120)
})

test('a required field: an asterisk screen readers skip, and aria-required on its control', async ({ page }) => {
  await open(page, 'default')
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveAttribute('aria-required', 'true')
  await expect(page.getByRole('textbox', { name: 'Author' })).not.toHaveAttribute('aria-required')
  const mark = fieldOf(page, 'book-title').locator('[data-slot=field-required]')
  await expect(mark).toHaveText('*')
  await expect(mark).toHaveAttribute('aria-hidden', 'true')
  // The control's name is the word alone.
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveCount(1)
})

test('Add finds the problem: it moves to the first and counts what is left', async ({ page }) => {
  await open(page, 'default')
  await page.getByRole('textbox', { name: 'Link' }).fill('nope')
  await bar(page).getByRole('button', { name: 'Add book' }).click()
  await expect(toFix(page)).toHaveText('2 to fix')
  await expect(page.getByRole('textbox', { name: 'Title' })).toBeFocused()
  await expect(page.getByText('Give it a title')).toBeVisible()

  await page.getByRole('textbox', { name: 'Title' }).fill('The Long Walk')
  await bar(page).getByRole('button', { name: 'Add book' }).click()
  await expect(toFix(page)).toHaveText('1 to fix')
  await expect(page.getByRole('textbox', { name: 'Link' })).toBeFocused()
  await expect(page.getByText('Enter a full address, starting https://')).toBeVisible()

  await page.getByRole('textbox', { name: 'Link' }).fill('https://example.com/book')
  await bar(page).getByRole('button', { name: 'Add book' }).click()
  await expect(page.getByText('Added The Long Walk')).toBeVisible()
})

test('a failed save: a Notice in the bar above the buttons, what was typed kept, Try again submits again', async ({ page }) => {
  await open(page, 'failed-save')
  const notice = page.locator('[data-slot=notice]')
  await expect(notice).toContainText("Couldn't add the book")
  await expect(notice).toHaveAttribute('data-tone', 'destructive')
  // In the bar, so on screen with the buttons though the form is taller than the window.
  await expect(bar(page).locator('[data-slot=notice]')).toBeInViewport()
  expect((await box(notice)).y).toBeLessThan((await box(bar(page).getByRole('button', { name: 'Add book' }))).y)
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('fail')

  // Still refused: the Notice stays.
  await notice.getByRole('button', { name: 'Try again' }).click()
  await expect(notice).toContainText("Couldn't add the book")
  await page.getByRole('textbox', { name: 'Title' }).fill('The Long Walk')
  await notice.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('Added The Long Walk')).toBeVisible()
})

for (const viewport of [LAPTOP, PHONE]) {
  test(`the bar sticks to the bottom of the window while the form is taller (${viewport.width}px)`, async ({ page }) => {
    await open(page, 'sections', { width: viewport.width, height: 700 })
    const form = await box(page.locator('[data-slot=entity-form]'))
    expect(form.height).toBeGreaterThan(700)
    const stuck = await box(bar(page))
    expect(Math.abs(stuck.y + stuck.height - 700)).toBeLessThan(1)
    // The room it takes, for whatever sits at the window's bottom.
    const offset = await page.evaluate(() => document.documentElement.style.getPropertyValue('--toast-bottom-offset'))
    expect(offset).toBe(`${Math.round(stuck.height)}px`)

    // At the form's end it's in its place, after the last field.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const end = await box(bar(page))
    const notes = await box(page.getByRole('textbox', { name: 'Notes' }))
    expect(end.y).toBeGreaterThan(notes.y + notes.height)
  })
}

test('sections are cards with their titles, and Add opens to the problem in one', async ({ page }) => {
  await open(page, 'sections', { width: 1280, height: 700 })
  for (const name of ['What it is', 'Reading', 'Details', 'Notes']) {
    const section = page.getByRole('region', { name })
    await expect(section).toBeVisible()
    await expect(section.locator('[data-slot=card]')).toHaveCount(1)
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.getByRole('textbox', { name: 'Link' }).fill('nope')
  await page.getByRole('textbox', { name: 'Title' }).fill('The Long Walk')
  await bar(page).getByRole('button', { name: 'Add book' }).click()
  await expect(toFix(page)).toHaveText('1 to fix')
  await expect(page.getByRole('textbox', { name: 'Link' })).toBeFocused()
  await expect(page.getByRole('textbox', { name: 'Link' })).toBeInViewport()
})

test('a status reads as its badge in the box and in its list', async ({ page }) => {
  await open(page, 'default')
  const trigger = page.locator('#book-status')
  await expect(trigger.locator('[data-slot=badge]')).toHaveText('To read')
  await trigger.click()
  const listbox = page.getByRole('listbox')
  await expect(listbox.locator('[data-slot=badge]')).toHaveText(['To read', 'Queue', 'Reading', 'Done', 'Gave up'])
  await listbox.getByRole('option', { name: 'Reading' }).click()
  await expect(trigger.locator('[data-slot=badge]')).toHaveText('Reading')
  // An optional one starts at "Not set".
  await expect(page.locator('#book-format')).toContainText('Not set')
})

test('nothing typed: Cancel and a link leave without asking', async ({ page }) => {
  await open(page, 'default')
  await bar(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Books' })).toBeVisible()
  await page.getByRole('link', { name: 'New book' }).click()
  await page.getByRole('navigation', { name: 'Books nav' }).getByRole('link', { name: 'Books' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Books' })).toBeVisible()
  await expect(prompt(page)).toHaveCount(0)
})

test('something typed: a link asks first, Keep editing stays, Discard leaves', async ({ page }) => {
  await open(page, 'default')
  await page.getByRole('textbox', { name: 'Title' }).fill('The Long Walk')
  const books = page.getByRole('navigation', { name: 'Books nav' }).getByRole('link', { name: 'Books' })
  await books.click()
  await expect(prompt(page)).toBeVisible()
  await prompt(page).getByRole('button', { name: 'Keep editing' }).click()
  await expect(prompt(page)).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('The Long Walk')

  await books.click()
  await prompt(page).getByRole('button', { name: 'Discard' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Books' })).toBeVisible()
})

test('something typed: Cancel asks once, and Discard goes where Cancel goes', async ({ page }) => {
  await open(page, 'default')
  await page.getByRole('textbox', { name: 'Author' }).fill('Jane Doe')
  await bar(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(prompt(page)).toBeVisible()
  await prompt(page).getByRole('button', { name: 'Discard' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Books' })).toBeVisible()
  await expect(prompt(page)).toHaveCount(0)
})

test("a save leaves for the new record without asking, though what's typed is unsaved until then", async ({ page }) => {
  await open(page, 'default')
  await page.getByRole('textbox', { name: 'Title' }).fill('The Long Walk')
  await bar(page).getByRole('button', { name: 'Add book' }).click()
  await expect(page.getByText('Added The Long Walk')).toBeVisible()
  await expect(prompt(page)).toHaveCount(0)
})

test('something typed: a reload asks the browser to confirm', async ({ page }) => {
  await open(page, 'default')
  const unguarded = await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(unguarded).toBe(false)
  await page.getByRole('textbox', { name: 'Title' }).fill('The Long Walk')
  const guarded = await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(guarded).toBe(true)
})

// FormDialog as a list's `new` route (RecordDialogRoute newPath): Back
// with a name typed asks first, as its Esc does.
test("FormDialog's new route: Back with something typed asks first", async ({ page }) => {
  await page.goto('http://localhost:6180/story.html?id=app-recorddialog--new-record-open')
  const form = page.getByRole('dialog', { name: 'New project' })
  await form.getByRole('textbox', { name: 'Name' }).fill('Paint the shed')
  const back = () => page.evaluate(() => (window as unknown as { recordDialogBack: () => void }).recordDialogBack())
  await back()
  await expect(prompt(page)).toBeVisible()
  await prompt(page).getByRole('button', { name: 'Keep editing' }).click()
  await expect(page.getByTestId('address')).toHaveText('/projects/new')
  await expect(form.getByRole('textbox', { name: 'Name' })).toHaveValue('Paint the shed')
  await back()
  await prompt(page).getByRole('button', { name: 'Discard' }).click()
  await expect(form).toHaveCount(0)
  await expect(page.getByTestId('address')).toHaveText('/projects')

  // Its own close asks once, not again on the way out; a save asks nothing.
  await page.goto('http://localhost:6180/story.html?id=app-recorddialog--new-record-open')
  await form.getByRole('textbox', { name: 'Name' }).fill('Paint the shed')
  await page.keyboard.press('Escape')
  await prompt(page).getByRole('button', { name: 'Discard' }).click()
  await expect(page.getByTestId('address')).toHaveText('/projects')
  await expect(prompt(page)).toHaveCount(0)
})
