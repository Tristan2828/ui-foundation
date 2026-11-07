import { expect, test, type Page } from '@playwright/test'

// A record opened in a dialog over its list (app/RecordDialog stories), in
// a real browser: the address follows the dialog, Back, Esc and Close go
// back to the list as it was, "Open full page" and a deep link give the
// page, focus stays in the dialog and comes back to the row, and the
// required states show inside it. Axe in both themes is
// e2e/fixtures-visual.spec.ts's COMPOSITE_STORIES.
const story = (id: string) => `http://localhost:6180/story.html?id=app-recorddialog--${id}`

const address = (page: Page) => page.getByTestId('address')
const dialog = (page: Page) => page.getByRole('dialog')
// The browser's Back: the story's router is a memory one, so a POP on it.
const back = (page: Page) => page.evaluate(() => (window as unknown as { recordDialogBack: () => void }).recordDialogBack())

async function openFromRow(page: Page, name: string) {
  await page.getByRole('row').filter({ hasText: name }).getByRole('cell').first().click()
  await expect(dialog(page)).toBeVisible()
}

test('a row click opens the record over the list, at its own address', async ({ page }) => {
  await page.goto(story('default'))
  await page.getByRole('textbox', { name: 'Search projects' }).fill('fence')
  await expect(address(page)).toHaveText('/projects?q=fence')
  await openFromRow(page, 'Repaint the fence')

  await expect(address(page)).toHaveText('/projects/1')
  // Named by the record's heading once it loads, and modal.
  await expect(page.getByRole('dialog', { name: 'Repaint the fence' })).toBeVisible()
  await expect(dialog(page).getByRole('heading', { level: 1, name: 'Repaint the fence' })).toBeVisible()
  await expect(dialog(page).getByText('after a dry day')).toBeVisible()
  // No back link inside: the dialog's bar has Open full page and Close.
  await expect(dialog(page).getByRole('link', { name: 'Projects' })).toHaveCount(0)
  // The list is still there underneath, still filtered.
  await expect(page.getByRole('textbox', { name: 'Search projects', includeHidden: true })).toHaveValue('fence')
  await expect(page.getByRole('row', { includeHidden: true }).filter({ hasText: 'Fix the gate latch' })).toHaveCount(0)
})

for (const how of ['Back', 'Escape', 'Close'] as const) {
  test(`${how} closes the dialog, back to the list as it was`, async ({ page }) => {
    await page.goto(story('default'))
    await page.getByRole('textbox', { name: 'Search projects' }).fill('fence')
    await openFromRow(page, 'Repaint the fence')
    await expect(dialog(page).getByRole('heading', { level: 1 })).toBeVisible()

    if (how === 'Back') await back(page)
    else if (how === 'Escape') await page.keyboard.press('Escape')
    else await dialog(page).getByRole('button', { name: 'Close' }).click()

    await expect(dialog(page)).toHaveCount(0)
    await expect(address(page)).toHaveText('/projects?q=fence')
    await expect(page.getByRole('textbox', { name: 'Search projects' })).toHaveValue('fence')
  })
}

test('the keyboard: Enter on a row opens it, Tab stays inside, Esc gives focus back to the row', async ({ page }) => {
  await page.goto(story('default'))
  const row = page.getByRole('row').filter({ hasText: 'Fix the gate latch' })
  await row.focus()
  await page.keyboard.press('Enter')
  await expect(dialog(page).getByRole('heading', { level: 1, name: 'Fix the gate latch' })).toBeVisible()

  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    // Base UI's focus guard moves the caret back to the start just after the key.
    await expect.poll(() => dialog(page).evaluate((element) => element.contains(document.activeElement))).toBe(true)
  }

  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)
  // Back in the row: on its own link, the first thing in it that takes focus.
  await expect.poll(() => row.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  await expect(row.getByRole('link', { name: 'Fix the gate latch' })).toBeFocused()
})

test('Open full page swaps the dialog for the page, and Back goes to the list', async ({ page }) => {
  await page.goto(story('open'))
  await expect(dialog(page).getByRole('heading', { level: 1, name: 'Repaint the fence' })).toBeVisible()
  await dialog(page).getByRole('link', { name: 'Open full page' }).click()

  await expect(dialog(page)).toHaveCount(0)
  await expect(address(page)).toHaveText('/projects/1')
  await expect(page.getByRole('heading', { level: 1, name: 'Repaint the fence' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Projects' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toHaveCount(0)

  await back(page)
  await expect(address(page)).toHaveText('/projects?q=re')
  await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible()
})

test('a deep link is the full page, not a dialog', async ({ page }) => {
  await page.goto(story('full-page'))
  await expect(page.getByRole('heading', { level: 1, name: 'Repaint the fence' })).toBeVisible()
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Projects' })).toBeVisible()
})

test('a record opened from another page is its full page', async ({ page }) => {
  await page.goto(story('from-another-page'))
  await page.getByRole('link', { name: 'Repaint the fence' }).click()
  await expect(address(page)).toHaveText('/projects/1')
  await expect(page.getByRole('heading', { level: 1, name: 'Repaint the fence' })).toBeVisible()
  await expect(dialog(page)).toHaveCount(0)
})

test('a linked record opens in the same dialog, and Close goes all the way back to the list', async ({ page }) => {
  await page.goto(story('default'))
  await openFromRow(page, 'Repaint the fence')
  await dialog(page).getByRole('link', { name: 'Fix the gate latch' }).click()
  await expect(address(page)).toHaveText('/projects/2')
  await expect(page.getByRole('dialog', { name: 'Fix the gate latch' })).toBeVisible()

  await dialog(page).getByRole('button', { name: 'Close' }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(address(page)).toHaveText('/projects')
})

test('loading, an error with Retry, and not found show inside the dialog', async ({ page }) => {
  await page.goto(story('loading'))
  // Named by the label while there's no record title.
  await expect(page.getByRole('dialog', { name: 'Project' })).toBeVisible()
  await expect(dialog(page).locator('[data-slot="skeleton"]').first()).toBeVisible()

  await page.goto(story('default'))
  await page.getByRole('link', { name: 'A project that fails' }).click()
  await expect(page.getByRole('dialog', { name: 'Project' })).toBeVisible()
  await expect(dialog(page).getByRole('button', { name: 'Try again' })).toBeVisible()

  await page.goto(story('not-found'))
  await expect(dialog(page).getByText('Not found', { exact: true })).toBeVisible()
  await expect(dialog(page).getByRole('button', { name: 'Try again' })).toHaveCount(0)
  // Its way out closes the dialog rather than pushing the list again.
  await dialog(page).getByRole('button', { name: 'Back to Projects' }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(address(page)).toHaveText('/projects')
})

test("Esc while editing in place gives up the edit, and only the next one closes the dialog", async ({ page }) => {
  await page.goto(story('open'))
  await dialog(page).getByRole('button', { name: 'Edit Owner' }).click()
  const input = dialog(page).getByRole('textbox', { name: 'Owner' })
  await input.fill('Grace Hopper')
  await page.keyboard.press('Escape')
  await expect(input).toHaveCount(0)
  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page).getByText('Ada Lovelace')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)
  await expect(address(page)).toHaveText('/projects?q=re')
})

// DataTable's `opens`: the row's own link (its name) opens the record the
// same way the row does; a modified click still gets the full page.
test("a click on the row's own link opens the dialog, not the page", async ({ page }) => {
  await page.goto(story('default'))
  await page.getByRole('link', { name: 'Fix the gate latch' }).click()
  await expect(page.getByRole('dialog', { name: 'Fix the gate latch' })).toBeVisible()
  await expect(address(page)).toHaveText('/projects/2')
})

test('rows that open their page go to it, with no dialog', async ({ page }) => {
  await page.goto(story('opens-page'))
  await page.getByRole('row').filter({ hasText: 'Repaint the fence' }).getByRole('cell').nth(1).click()
  await expect(address(page)).toHaveText('/projects/1')
  await expect(page.getByRole('heading', { level: 1, name: 'Repaint the fence' })).toBeVisible()
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Projects' })).toBeVisible()
})

// `fullPage={false}`: a record with no page of its own, only the dialog.
test('a dialog only record has no Open full page', async ({ page }) => {
  await page.goto(story('dialog-only'))
  await openFromRow(page, 'Repaint the fence')
  await expect(dialog(page).getByRole('heading', { level: 1, name: 'Repaint the fence' })).toBeVisible()
  await expect(dialog(page).getByRole('link', { name: 'Open full page' })).toHaveCount(0)
  await dialog(page).getByRole('button', { name: 'Close' }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(address(page)).toHaveText('/projects')
})

test('a deep link to a dialog only record opens the dialog over its list', async ({ page }) => {
  await page.goto(story('dialog-only-deep-link'))
  await expect(page.getByRole('dialog', { name: 'Repaint the fence' })).toBeVisible()
  await expect(address(page)).toHaveText('/projects/1')
  await expect(page.getByRole('heading', { level: 1, name: 'Projects', includeHidden: true })).toHaveCount(1)
  await dialog(page).getByRole('button', { name: 'Close' }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(address(page)).toHaveText('/projects')
  await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible()
})

test('a dialog only record opened from another page opens over its list', async ({ page }) => {
  await page.goto(story('dialog-only-from-another-page'))
  await page.getByRole('link', { name: 'Repaint the fence' }).click()
  await expect(page.getByRole('dialog', { name: 'Repaint the fence' })).toBeVisible()
  await dialog(page).getByRole('button', { name: 'Close' }).click()
  await expect(address(page)).toHaveText('/projects')
  await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible()
})

// `listPath`: the list at /projects/list, the record a sibling at /projects/:id.
test('a list at its own path opens the record over it, and closing goes back to the list', async ({ page }) => {
  await page.goto(story('list-at-its-own-path'))
  await expect(address(page)).toHaveText('/projects/list')
  await page.getByRole('textbox', { name: 'Search projects' }).fill('fence')
  await openFromRow(page, 'Repaint the fence')
  await expect(address(page)).toHaveText('/projects/1')
  await expect(page.getByRole('dialog', { name: 'Repaint the fence' })).toBeVisible()
  // The list is still drawn behind it, at its own address and filter.
  await expect(page.getByTestId('list-at')).toHaveText('/projects/list')
  await expect(page.getByRole('textbox', { name: 'Search projects', includeHidden: true })).toHaveValue('fence')

  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)
  await expect(address(page)).toHaveText('/projects/list?q=fence')
  await expect(page.getByRole('textbox', { name: 'Search projects' })).toHaveValue('fence')

  await openFromRow(page, 'Repaint the fence')
  await dialog(page).getByRole('button', { name: 'Close' }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(address(page)).toHaveText('/projects/list?q=fence')
})

test('a list at its own path: Back closes the dialog, Open full page gives the page', async ({ page }) => {
  await page.goto(story('list-at-its-own-path-open'))
  await expect(page.getByRole('dialog', { name: 'Repaint the fence' })).toBeVisible()
  await back(page)
  await expect(dialog(page)).toHaveCount(0)
  await expect(address(page)).toHaveText('/projects/list?q=re')

  await page.goto(story('list-at-its-own-path-open'))
  await dialog(page).getByRole('link', { name: 'Open full page' }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(address(page)).toHaveText('/projects/1')
  await expect(page.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects/list')
})

test('a list at its own path: a deep link to the record is its full page', async ({ page }) => {
  await page.goto(story('list-at-its-own-path-deep-link'))
  await expect(page.getByRole('heading', { level: 1, name: 'Repaint the fence' })).toBeVisible()
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toHaveCount(0)
})

// A sub-record over its parent's page: /projects/1/tasks/12 over /projects/1.
test("a sub-record opens over its parent's page, at its own address, and Esc goes back to the parent", async ({ page }) => {
  await page.goto(story('sub-records'))
  await expect(page.getByRole('heading', { level: 1, name: 'Repaint the fence' })).toBeVisible()
  await openFromRow(page, 'Buy the paint')
  await expect(address(page)).toHaveText('/projects/1/tasks/12')
  await expect(page.getByRole('dialog', { name: 'Buy the paint' })).toBeVisible()
  // No page of its own, so no Open full page; the parent stays behind it.
  await expect(dialog(page).getByRole('link', { name: 'Open full page' })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'Repaint the fence', includeHidden: true })).toHaveCount(1)

  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)
  await expect(address(page)).toHaveText('/projects/1')
  await expect(page.getByRole('heading', { level: 1, name: 'Repaint the fence' })).toBeVisible()
})

test("a reload of a sub-record's address is the dialog over its parent again", async ({ page }) => {
  await page.goto(story('sub-record-deep-link'))
  await expect(page.getByRole('dialog', { name: 'Buy the paint' })).toBeVisible()
  await expect(address(page)).toHaveText('/projects/1/tasks/12')
  await expect(page.getByRole('heading', { level: 1, name: 'Repaint the fence', includeHidden: true })).toHaveCount(1)
  await dialog(page).getByRole('button', { name: 'Close' }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(address(page)).toHaveText('/projects/1')
  await expect(page.getByRole('heading', { level: 1, name: 'Repaint the fence' })).toBeVisible()
})
