import { expect, test, type Page } from '@playwright/test'

// FillInQueue and FillInChoice (app/FillInQueue): picking by a click and by
// a number key, Save and next, Skip wrapping round, a refused save, and the
// empty queue. Axe and the token check are e2e/storybook-visual.spec.ts's.
const story = (name: string) => `http://localhost:6006/iframe.html?id=app-fillinqueue--${name}&viewMode=story`

const record = (page: Page) => page.locator('[data-slot=fill-in-queue-record]')
const save = (page: Page) => page.getByRole('button', { name: 'Save and next' })
const effort = (page: Page) => page.getByRole('group', { name: 'Effort' })

test('a click picks, Save and next saves and shows the next record, with the focus on it', async ({ page }) => {
  await page.goto(story('default'))
  await expect(record(page).getByRole('heading')).toHaveText('Repaint the fence')
  await expect(page.getByText('Record 1 of 4')).toBeVisible()
  await expect(page.getByText('1 of 5 filled')).toBeVisible()
  await expect(save(page)).toBeDisabled()

  const medium = effort(page).getByRole('button', { name: /Medium/ })
  await medium.click()
  await expect(medium).toHaveAttribute('aria-pressed', 'true')
  // Clicking the picked one again clears it.
  await medium.click()
  await expect(medium).toHaveAttribute('aria-pressed', 'false')
  await expect(save(page)).toBeDisabled()
  await medium.click()
  await save(page).click()

  await expect(record(page).getByRole('heading')).toHaveText('Learn Rust')
  await expect(page.getByText('2 of 5 filled')).toBeVisible()
  await expect(page.getByText('Record 1 of 3')).toBeVisible()
  await expect(page.getByRole('group', { name: 'Record 1 of 3' })).toBeFocused()
  // The new record starts with nothing picked.
  await expect(effort(page).getByRole('button', { pressed: true })).toHaveCount(0)
})

test('number keys pick in the shortcut row and Enter saves, but not inside the notes', async ({ page }) => {
  await page.goto(story('default'))
  await record(page).focus()
  await page.keyboard.press('3')
  await expect(effort(page).getByRole('button', { name: /Large/ })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('1')
  await expect(effort(page).getByRole('button', { name: /Small/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(effort(page).getByRole('button', { name: /Large/ })).toHaveAttribute('aria-pressed', 'false')

  // In the textarea a number is typed and Enter is a new line.
  const notes = page.getByRole('textbox', { name: 'Notes' })
  await notes.click()
  await page.keyboard.type('2 coats')
  await page.keyboard.press('Enter')
  await expect(notes).toHaveValue('2 coats\n')
  await expect(effort(page).getByRole('button', { name: /Small/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(record(page).getByRole('heading')).toHaveText('Repaint the fence')

  await record(page).focus()
  await page.keyboard.press('Enter')
  await expect(record(page).getByRole('heading')).toHaveText('Learn Rust')
  await expect(page.getByText('2 of 5 filled')).toBeVisible()
})

test('Skip moves on without saving and wraps from the last record to the first', async ({ page }) => {
  await page.goto(story('default'))
  const skip = page.getByRole('button', { name: 'Skip' })
  for (const name of ['Learn Rust', 'Fix the gate latch', 'Build a bookshelf']) {
    await skip.click()
    await expect(record(page).getByRole('heading')).toHaveText(name)
  }
  await expect(page.getByText('Record 4 of 4')).toBeVisible()
  await skip.click()
  await expect(record(page).getByRole('heading')).toHaveText('Repaint the fence')
  await expect(page.getByRole('group', { name: 'Record 1 of 4' })).toBeFocused()
  await expect(page.getByText('1 of 5 filled')).toBeVisible()
})

test('a suggestion is drawn dashed and said under the row', async ({ page }) => {
  await page.goto(story('default'))
  await expect(effort(page).getByRole('button', { name: /Medium/ })).toHaveAttribute('data-suggested', 'true')
  await expect(page.getByText('Suggested: Medium (from similar projects)')).toBeVisible()
})

test('a refused save keeps the record and says why under the buttons', async ({ page }) => {
  await page.goto(story('save-fails'))
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(record(page).getByRole('heading')).toHaveText('Learn Rust')
  await effort(page).getByRole('button', { name: /Small/ }).click()
  await save(page).click()
  await expect(page.getByRole('alert')).toHaveText('The server refused the change: try again.')
  await expect(record(page).getByRole('heading')).toHaveText('Learn Rust')
  await expect(save(page)).toBeEnabled()
})

test('filling every record leaves the empty state', async ({ page }) => {
  await page.goto(story('default'))
  for (let left = 4; left > 0; left--) {
    await expect(page.getByText(`Record 1 of ${left}`)).toBeVisible()
    await record(page).focus()
    await page.keyboard.press('2')
    await page.keyboard.press('Enter')
  }
  await expect(page.getByText('Every project has an effort')).toBeVisible()
  await expect(page.getByText('5 of 5 filled')).toBeVisible()
})

test('the States story has a loading, an empty and an error state', async ({ page }) => {
  await page.goto(story('states'))
  await expect(page.locator('[data-slot=fill-in-queue][data-state=loading]')).toBeVisible()
  await expect(page.getByText('Every project has an effort')).toBeVisible()
  await expect(page.getByText("Couldn't reach the server.")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})
