import { expect, test, type Page } from '@playwright/test'

// ListEditor's rows that open and its Duplicate (app/ListEditor, #222).
// RowsThatOpen: a leg day of eight exercises, each a summary line that
// opens to its fields, one at a time, held by the row's id so it stays open
// through a move; every item the save refuses opens (the form's focus on
// the first error makes that one the open item); Add
// and Duplicate open what they make, and Duplicate stops at the list's max
// (10), as Add does. Default: without `summary` or `onDuplicate`, every
// item shows its fields and there's no Duplicate, as before.
const stories = {
  default: 'http://localhost:6006/iframe.html?id=app-listeditor--default&viewMode=story',
  rows: 'http://localhost:6006/iframe.html?id=app-listeditor--rows-that-open&viewMode=story',
}

async function open(page: Page, story: keyof typeof stories, heading: string) {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(stories[story])
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
}

// An exercise's summary line, by position ("exercise 2: Back squat · …").
const line = (page: Page, n: number) => page.getByRole('button', { name: new RegExp(`^exercise ${n}: `) })
const nameBox = (page: Page, n: number) => page.getByRole('textbox', { name: `Exercise ${n} name` })

test('without summary or onDuplicate, every item shows its fields as before', async ({ page }) => {
  await open(page, 'default', 'Pack for the trip')
  const list = page.getByRole('list', { name: 'Checklist' })
  await expect(page.getByRole('textbox', { name: 'Item 1 text' })).toHaveValue('Spare cables')
  await expect(page.getByRole('textbox', { name: 'Item 2 text' })).toHaveValue('Rain jacket')
  await expect(list.locator('[aria-expanded]')).toHaveCount(0)
  await expect(list.getByRole('button', { name: /^Duplicate/ })).toHaveCount(0)
  await expect(list.getByRole('button', { name: 'Remove item 2', exact: true })).toBeEnabled()

  await page.getByRole('button', { name: 'Add item', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Item 3 text' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Item 1 text' })).toBeVisible()
})

test('one item is open at a time, and its line closes it again', async ({ page }) => {
  await open(page, 'rows', 'Leg day')
  await expect(line(page, 2)).toHaveAccessibleName('exercise 2: Back squat · 3 × 8 at 60 kg')
  await expect(page.getByRole('list', { name: 'Exercises' }).locator('[aria-expanded="true"]')).toHaveCount(0)
  await expect(nameBox(page, 2)).toHaveCount(0)

  await line(page, 2).click()
  await expect(line(page, 2)).toHaveAttribute('aria-expanded', 'true')
  await expect(nameBox(page, 2)).toHaveValue('Back squat')
  // The line names the fields it opens.
  const controls = await line(page, 2).getAttribute('aria-controls')
  await expect(page.locator(`[id="${controls}"]`).getByRole('textbox', { name: 'Exercise 2 name' })).toBeVisible()

  await line(page, 5).click()
  await expect(line(page, 5)).toHaveAttribute('aria-expanded', 'true')
  await expect(line(page, 2)).toHaveAttribute('aria-expanded', 'false')
  await expect(nameBox(page, 2)).toHaveCount(0)
  await expect(nameBox(page, 5)).toHaveValue('Leg press')

  await line(page, 5).click()
  await expect(line(page, 5)).toHaveAttribute('aria-expanded', 'false')
  await expect(nameBox(page, 5)).toHaveCount(0)
})

test('Enter on a line opens it, and the summary follows what is typed', async ({ page }) => {
  await open(page, 'rows', 'Leg day')
  await line(page, 1).focus()
  await page.keyboard.press('Enter')
  await expect(line(page, 1)).toHaveAttribute('aria-expanded', 'true')
  await nameBox(page, 1).fill('Goblet squat')
  await expect(line(page, 1)).toHaveAccessibleName('exercise 1: Goblet squat · 1 × 10 at 40 kg')
})

test('the open item stays open while it moves', async ({ page }) => {
  await open(page, 'rows', 'Leg day')
  await line(page, 4).click()
  await expect(nameBox(page, 4)).toHaveValue('Romanian deadlift')

  await page.getByRole('button', { name: 'Move exercise 4 up', exact: true }).click()
  await expect(line(page, 3)).toHaveAttribute('aria-expanded', 'true')
  await expect(nameBox(page, 3)).toHaveValue('Romanian deadlift')
  await expect(line(page, 4)).toHaveAttribute('aria-expanded', 'false')

  await page.getByRole('button', { name: 'Move exercise 3 down', exact: true }).click()
  await page.getByRole('button', { name: 'Move exercise 4 down', exact: true }).click()
  await expect(line(page, 5)).toHaveAttribute('aria-expanded', 'true')
  await expect(nameBox(page, 5)).toHaveValue('Romanian deadlift')
})

test('items the save refuses open to show why, and stay open while they are fixed', async ({ page }) => {
  await open(page, 'rows', 'Leg day')
  await line(page, 2).click()
  await nameBox(page, 2).fill('')
  await line(page, 4).click()
  await nameBox(page, 4).fill('')
  await line(page, 6).click()
  await expect(line(page, 2)).toHaveAttribute('aria-expanded', 'false')
  await expect(line(page, 4)).toHaveAttribute('aria-expanded', 'false')

  // Both refused items open together. The form's focus on the first error
  // goes into exercise 2, which makes it the open one, so exercise 6 closes.
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(line(page, 2)).toHaveAttribute('aria-expanded', 'true')
  await expect(line(page, 4)).toHaveAttribute('aria-expanded', 'true')
  await expect(nameBox(page, 2)).toBeFocused()
  await expect(line(page, 6)).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByText('Name the exercise.')).toHaveCount(2)
  await expect(page.getByTestId('workout-saved')).toHaveText('nothing yet')

  // Fixing one: its error clears, and the item being typed in stays open
  // (it's the open one); the other still shows its error.
  await nameBox(page, 2).fill('Front squat')
  await expect(page.getByText('Name the exercise.')).toHaveCount(1)
  await expect(line(page, 2)).toHaveAttribute('aria-expanded', 'true')
  await expect(nameBox(page, 2)).toBeFocused()
  await expect(line(page, 4)).toHaveAttribute('aria-expanded', 'true')

  // Fixing the other moves the open item to it; exercise 2 closes.
  await nameBox(page, 4).fill('Deadlift')
  await expect(page.getByText('Name the exercise.')).toHaveCount(0)
  await expect(line(page, 4)).toHaveAttribute('aria-expanded', 'true')
  await expect(line(page, 2)).toHaveAttribute('aria-expanded', 'false')
})

test('Add opens the new item and closes the open one', async ({ page }) => {
  await open(page, 'rows', 'Leg day')
  await line(page, 3).click()
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click()
  await expect(line(page, 9)).toHaveAttribute('aria-expanded', 'true')
  await expect(line(page, 9)).toHaveAccessibleName('exercise 9: New exercise · 3 × 10')
  await expect(nameBox(page, 9)).toBeVisible()
  await expect(line(page, 3)).toHaveAttribute('aria-expanded', 'false')
})

test('Duplicate inserts the copy after its original and opens it, until the max', async ({ page }) => {
  await open(page, 'rows', 'Leg day')
  await line(page, 2).click()
  await page.getByRole('button', { name: 'Duplicate exercise 4', exact: true }).click()

  await expect(page.getByRole('list', { name: 'Exercises' }).getByRole('listitem')).toHaveCount(9)
  await expect(line(page, 4)).toHaveAccessibleName('exercise 4: Romanian deadlift · 3 × 10 at 50 kg')
  await expect(line(page, 5)).toHaveAccessibleName('exercise 5: Romanian deadlift · 3 × 10 at 50 kg')
  await expect(line(page, 6)).toHaveAccessibleName('exercise 6: Leg press · 4 × 12 at 100 kg')
  await expect(line(page, 5)).toHaveAttribute('aria-expanded', 'true')
  await expect(line(page, 4)).toHaveAttribute('aria-expanded', 'false')
  await expect(line(page, 2)).toHaveAttribute('aria-expanded', 'false')

  // The copy is its own item: changing it leaves the original as it was.
  await page.getByRole('spinbutton', { name: 'Exercise 5 weight (kg)' }).fill('55')
  await expect(line(page, 5)).toHaveAccessibleName('exercise 5: Romanian deadlift · 3 × 10 at 55 kg')
  await expect(line(page, 4)).toHaveAccessibleName('exercise 4: Romanian deadlift · 3 × 10 at 50 kg')

  // The tenth item reaches the max: Duplicate and Add both stop.
  await page.getByRole('button', { name: 'Duplicate exercise 9', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Exercises' }).getByRole('listitem')).toHaveCount(10)
  await expect(line(page, 10)).toHaveAttribute('aria-expanded', 'true')
  for (const n of [1, 5, 10]) {
    await expect(page.getByRole('button', { name: `Duplicate exercise ${n}`, exact: true })).toBeDisabled()
  }
  await expect(page.getByRole('button', { name: 'Add exercise', exact: true })).toBeDisabled()

  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByTestId('workout-saved')).toContainText('"weight":55')
})
