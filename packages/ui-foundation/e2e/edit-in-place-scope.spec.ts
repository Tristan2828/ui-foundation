import { expect, test, type Locator, type Page } from '@playwright/test'

// EditInPlaceScope (app/EditInPlaceScope stories), in a real browser: an
// always-editable note on a page of the app's own, with no EntityView or
// DataTable around it, saving the way cell pattern 18 promises. The second
// story is two notes in one scope, one hidden, as a notes app's tabs; the
// third, the same with each tab its own URL (`staysOnPage`). Axe in both
// themes is e2e/fixtures-visual.spec.ts's COMPOSITE_STORIES.
const story = (id: string) => `http://localhost:6180/story.html?id=app-editinplacescope--${id}`

async function open(page: Page, id: string) {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(story(id))
  await expect(page.getByRole('link', { name: 'All Notes' })).toBeVisible()
}

async function typeAtEnd(page: Page, editor: Locator, text: string) {
  await editor.locator('p').last().click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.type(text)
}

// The lost edit's title: what was typed has left the page unsaved.
const LOST_SHOPPING = "Shopping wasn't saved and is no longer on the page"

const saves = (page: Page, id: string) => page.getByTestId(`${id}-saves`)
const saved = (page: Page, id: string) => page.getByTestId(`${id}-saved`)
// From outside the editor without taking the caret from it: a click on
// the button would move focus, and leaving the note saves on its own.
const press = (page: Page, name: string) => page.getByRole('button', { name }).dispatchEvent('click')

test.describe('EditInPlaceScope, one note that autosaves', () => {
  test('typing saves with no click away, and the note stays editable while saving', async ({ page }) => {
    await open(page, 'note')
    const editor = page.getByRole('textbox', { name: 'Shopping' })
    await expect(editor).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit Shopping' })).toHaveCount(0)

    await typeAtEnd(page, editor, ' And tea.')
    // Watched every frame: the 500ms "Saving…" is easy to step over.
    await page.waitForFunction(() => [...document.querySelectorAll('[role=status]')].some((s) => s.textContent === 'Saving…'), undefined, {
      polling: 'raf',
      timeout: 5000,
    })
    await expect(editor).toBeFocused()
    await expect(editor).toHaveAttribute('aria-readonly', 'false')
    await page.keyboard.type(' And jam.')
    await expect(saved(page, 'shopping')).toHaveText('Milk, eggs and bread. And tea. And jam.', { timeout: 5000 })
    await expect(saves(page, 'shopping')).toHaveText('2')
    await expect(editor).toBeFocused()
  })

  test('a refusal keeps exactly what was typed, with the reason', async ({ page }) => {
    await open(page, 'note')
    const editor = page.getByRole('textbox', { name: 'Shopping' })
    await typeAtEnd(page, editor, ' refuse')
    await expect(page.getByText('The server refused it, as a server would.').first()).toBeVisible({ timeout: 5000 })
    await expect(editor).toContainText('Milk, eggs and bread. refuse')
    await expect(editor).toHaveAttribute('aria-invalid', 'true')
    await expect(saved(page, 'shopping')).toHaveText('Milk, eggs and bread.')
  })

  test('leaving the page saves first and goes on, asking only when the save fails', async ({ page }) => {
    await open(page, 'note')
    const editor = page.getByRole('textbox', { name: 'Shopping' })
    await typeAtEnd(page, editor, ' refuse')
    await page.getByRole('link', { name: 'All Notes' }).click()
    const prompt = page.getByRole('dialog', { name: 'Discard your changes?' })
    await expect(prompt).toBeVisible({ timeout: 5000 })
    await prompt.getByRole('button', { name: 'Keep Editing' }).click()
    await expect(prompt).toHaveCount(0)

    await editor.locator('p').last().click()
    await page.keyboard.press('ControlOrMeta+End')
    for (let i = 0; i < ' refuse'.length; i++) await page.keyboard.press('Backspace')
    await page.keyboard.type(' And tea.')
    await page.getByRole('link', { name: 'All Notes' }).click()
    await expect(page.getByText('All notes', { exact: true })).toBeVisible({ timeout: 5000 })
    await expect(prompt).toHaveCount(0)
  })

  test('a value saved elsewhere under unsaved typing says so, and nothing saves over it until a pick', async ({ page }) => {
    await open(page, 'note')
    const editor = page.getByRole('textbox', { name: 'Shopping' })
    await typeAtEnd(page, editor, ' Mine.')
    await press(page, 'Change Shopping Elsewhere')
    // Said under the note, and in a toast.
    await expect(page.getByRole('alert').filter({ hasText: /changed elsewhere/ })).toBeVisible()
    await page.waitForTimeout(2000)
    await expect(saves(page, 'shopping')).toHaveText('0')
    await expect(saved(page, 'shopping')).toContainText('Added in another tab.')

    await page.getByRole('button', { name: 'Show Saved' }).click()
    await expect(editor).toContainText('Added in another tab.')
    await expect(editor).not.toContainText('Mine.')
    await expect(saves(page, 'shopping')).toHaveText('0')
  })

  test('"Keep Mine" keeps both: what was typed, laid onto the value saved elsewhere', async ({ page }) => {
    await open(page, 'note')
    const editor = page.getByRole('textbox', { name: 'Shopping' })
    await typeAtEnd(page, editor, ' Mine.')
    await press(page, 'Change Shopping Elsewhere')
    await page.getByRole('button', { name: 'Keep Mine' }).click()
    await expect(editor).toContainText('Mine.')
    await expect(editor).toContainText('Added in another tab.')
    await expect(saves(page, 'shopping')).toHaveText('1', { timeout: 5000 })
    await expect(saved(page, 'shopping')).toContainText('Milk, eggs and bread. Mine.')
    await expect(saved(page, 'shopping')).toContainText('Added in another tab.')
  })

  test('a note taken off the page mid-typing still saves what was typed', async ({ page }) => {
    await open(page, 'note')
    const editor = page.getByRole('textbox', { name: 'Shopping' })
    await typeAtEnd(page, editor, ' And tea.')
    // At once, inside the pause: nothing has been sent yet.
    await press(page, 'Close Shopping')
    await expect(editor).toHaveCount(0)
    await expect(saved(page, 'shopping')).toHaveText('Milk, eggs and bread. And tea.', { timeout: 5000 })
    await expect(saves(page, 'shopping')).toHaveText('1')
  })

  test('a note taken off the page whose save is then refused says so, and offers what was typed', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await open(page, 'note')
    const editor = page.getByRole('textbox', { name: 'Shopping' })
    await typeAtEnd(page, editor, ' refuse this')
    await press(page, 'Close Shopping')
    await expect(editor).toHaveCount(0)
    const lost = page.locator('[data-sonner-toast]').filter({ hasText: LOST_SHOPPING })
    await expect(lost).toBeVisible({ timeout: 5000 })
    // Not the title of a refusal on the page, which can still be retried.
    await expect(lost).not.toContainText("Couldn't save")
    await expect(lost).toContainText('The server refused it, as a server would. Copy what you typed to keep it.')
    await expect(saves(page, 'shopping')).toHaveText('1')
    await expect(saved(page, 'shopping')).toHaveText('Milk, eggs and bread.')
    // It stays until it's dealt with: nothing else holds the text now.
    await page.waitForTimeout(5000)
    await expect(lost).toBeVisible()
    await lost.getByRole('button', { name: 'Copy Text' }).click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Milk, eggs and bread. refuse this')
    await expect(lost).toHaveCount(0)
  })

  test('a note taken off the page after its save was refused tries once more, then says so', async ({ page }) => {
    await open(page, 'note')
    const editor = page.getByRole('textbox', { name: 'Shopping' })
    await typeAtEnd(page, editor, ' refuse')
    await expect(saves(page, 'shopping')).toHaveText('1', { timeout: 5000 })
    await press(page, 'Close Shopping')
    await expect(saves(page, 'shopping')).toHaveText('2', { timeout: 5000 })
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Copy Text' })).toBeVisible()
  })
})

test.describe('EditInPlaceScope, two notes in one scope (tabs)', () => {
  test('both editors stay mounted; each saves its own text, the hidden one included', async ({ page }) => {
    await open(page, 'two-notes')
    const shopping = page.getByTestId('shopping-pane')
    const packing = page.getByTestId('packing-pane')
    await expect(shopping.getByRole('textbox', { name: 'Shopping' })).toBeVisible()
    // The tab behind is mounted, editor and all, and hidden.
    await expect(packing.getByRole('textbox', { name: 'Packing', includeHidden: true })).toHaveCount(1)
    await expect(packing).toBeHidden()

    await typeAtEnd(page, shopping.getByRole('textbox', { name: 'Shopping' }), ' And tea.')
    await page.getByRole('button', { name: 'Packing', exact: true }).click()
    await expect(packing).toBeVisible()
    await expect(shopping).toBeHidden()
    await expect(saved(page, 'shopping')).toHaveText('Milk, eggs and bread. And tea.', { timeout: 5000 })

    const packingEditor = packing.getByRole('textbox', { name: 'Packing' })
    await typeAtEnd(page, packingEditor, ' Then desks.')
    await expect(saved(page, 'packing')).toHaveText('Pack the shared shelves first. Then desks.', { timeout: 5000 })
    await expect(saves(page, 'packing')).toHaveText('1')
    await expect(saves(page, 'shopping')).toHaveText('1')

    // Back to the first: its text was never rebuilt from the server's.
    await page.getByRole('button', { name: 'Shopping', exact: true }).click()
    await expect(shopping.getByRole('textbox', { name: 'Shopping' })).toContainText('Milk, eggs and bread. And tea.')
  })

  test('one leave guard for both: a refused save in the hidden tab asks once', async ({ page }) => {
    await open(page, 'two-notes')
    await typeAtEnd(page, page.getByTestId('shopping-pane').getByRole('textbox', { name: 'Shopping' }), ' refuse')
    await page.getByRole('button', { name: 'Packing', exact: true }).click()
    await page.getByRole('link', { name: 'All Notes' }).click()
    await expect(page.getByRole('dialog', { name: 'Discard your changes?' })).toHaveCount(1, { timeout: 5000 })
    await page.getByRole('button', { name: 'Keep Editing' }).click()
    await expect(page.getByRole('dialog', { name: 'Discard your changes?' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'All Notes' })).toBeVisible()
  })

  test('closing the tab in front mid-typing saves it, and the other comes to the front', async ({ page }) => {
    await open(page, 'two-notes')
    await typeAtEnd(page, page.getByTestId('shopping-pane').getByRole('textbox', { name: 'Shopping' }), ' And tea.')
    await press(page, 'Close Shopping')
    await expect(page.getByTestId('shopping-pane')).toHaveCount(0)
    await expect(page.getByTestId('packing-pane').getByRole('textbox', { name: 'Packing' })).toBeVisible()
    await expect(saved(page, 'shopping')).toHaveText('Milk, eggs and bread. And tea.', { timeout: 5000 })
    await expect(saves(page, 'shopping')).toHaveText('1')
    await expect(saves(page, 'packing')).toHaveText('0')
  })
})

test.describe('EditInPlaceScope, each tab its own URL (staysOnPage)', () => {
  const tab = (page: Page, name: string) => page.getByRole('navigation').getByRole('link', { name, exact: true })
  const dialog = (page: Page) => page.getByRole('dialog', { name: 'Discard your changes?' })

  test('moving to another tab mid-typing goes at once; the text behind saves itself', async ({ page }) => {
    await open(page, 'note-tabs')
    const shopping = page.getByTestId('shopping-pane')
    await typeAtEnd(page, shopping.getByRole('textbox', { name: 'Shopping' }), ' And tea.')
    await tab(page, 'Packing').click()
    await expect(page.getByTestId('packing-pane')).toBeVisible()
    // Not held for the save: it hasn't landed yet (each takes 500ms).
    await expect(saves(page, 'shopping')).toHaveText('0')
    await expect(shopping).toBeHidden()
    await expect(saved(page, 'shopping')).toHaveText('Milk, eggs and bread. And tea.', { timeout: 5000 })
  })

  test('a refused save never asks on a move between tabs, and keeps its text; leaving still asks', async ({ page }) => {
    await open(page, 'note-tabs')
    const shopping = page.getByTestId('shopping-pane')
    const editor = shopping.getByRole('textbox', { name: 'Shopping' })
    await typeAtEnd(page, editor, ' refuse')
    await expect(page.getByText('The server refused it, as a server would.').first()).toBeVisible({ timeout: 5000 })
    await tab(page, 'Packing').click()
    await expect(page.getByTestId('packing-pane')).toBeVisible()
    await expect(dialog(page)).toHaveCount(0)
    await tab(page, 'Shopping').click()
    await expect(shopping).toBeVisible()
    await expect(dialog(page)).toHaveCount(0)
    await expect(editor).toContainText('Milk, eggs and bread. refuse')

    await page.getByRole('link', { name: 'All Notes' }).click()
    await expect(dialog(page)).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'Keep Editing' }).click()
    await expect(editor).toContainText('Milk, eggs and bread. refuse')
  })

  test('closing a tab whose save is refused says so and tells the app (onLostEdit)', async ({ page }) => {
    await open(page, 'note-tabs')
    await typeAtEnd(page, page.getByTestId('shopping-pane').getByRole('textbox', { name: 'Shopping' }), ' refuse')
    await press(page, 'Close Shopping')
    await expect(page.getByTestId('packing-pane')).toBeVisible()
    await expect(dialog(page)).toHaveCount(0)
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: LOST_SHOPPING })).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('lost-edits')).toHaveText(
      'Shopping: Milk, eggs and bread. refuse (The server refused it, as a server would.)',
    )
  })
})
