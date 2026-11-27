import type { Locator, Page } from '@playwright/test'
import { expect, forceMswOverride, test, waitForMswReady } from '@tristan2828/ui-foundation/testing'

// Editing in place on the widget view (cell pattern 18): Name, Status,
// Price and Extra Categories turn into the form's own control where
// they're shown and save when you leave them; Description is edited where
// it's read (`inline`: the editor at rest, no click to open), saved a
// pause after typing stops. Nothing typed is ever lost: a refused save
// stays open with what was typed and the reason.

// The body of every PATCH the page sends, in order, without the version
// each one carries (baseUpdatedAt: the widget it was built on), which
// "two writers" below checks on its own.
function patchBodies(page: Page) {
  const bodies: unknown[] = []
  page.on('request', (request) => {
    if (request.method() !== 'PATCH') return
    const body = { ...(request.postDataJSON() as Record<string, unknown>) }
    delete body.baseUpdatedAt
    bodies.push(body)
  })
  return bodies
}

// Answers every widget PATCH with `status` and `body` from now on.
type ErrorBody = { detail: string | { loc: (string | number)[]; msg: string; type: string }[] }

async function refusePatches(page: Page, status: number, body: ErrorBody) {
  await waitForMswReady(page)
  await page.evaluate(
    ([status, body]) => {
      const { worker, http, HttpResponse } = window.__msw
      worker.use(http.patch('*/api/widgets/:id', () => HttpResponse.json(body, { status: status as number })))
    },
    [status, body] as const,
  )
}

// Holds every PATCH for `ms`, then lets the normal mocks answer it.
async function delayPatches(page: Page, ms: number) {
  await waitForMswReady(page)
  await page.evaluate((ms) => {
    const { worker, http } = window.__msw
    worker.use(http.patch('*/api/widgets/:id', () => new Promise<undefined>((resolve) => setTimeout(resolve, ms))))
  }, ms)
}

async function resetMswOverrides(page: Page) {
  await page.evaluate(() => window.__msw.worker.resetHandlers())
}

function fieldValue(page: Page, label: string) {
  return page
    .locator('dl > div')
    .filter({ has: page.locator('dt').getByText(label, { exact: true }) })
    .locator('dd')
}

const title = (page: Page) => page.getByRole('heading', { level: 1 })

async function openWidget(page: Page, id = 1) {
  await page.goto(`/widgets/${id}`)
  await expect(title(page)).toBeVisible()
  await expect(page.locator('[data-state="success"]')).toBeVisible()
  // The notes' editor builds itself a moment after the page: a click
  // before it's there lands on nothing.
  await expect(page.getByRole('textbox', { name: 'Description' })).toBeVisible()
}

// The caret at the end of a paragraph, by a click on its last line's end.
// A plain click hits the paragraph's middle, and on a phone, where it
// wraps to two lines, that's the edge between them: which line it lands
// on is the editor's call (prosemirror-view 1.43 picks the upper one, the
// browser picked the lower), and End then goes to that line's end, mid-sentence.
async function clickParagraphEnd(paragraph: Locator) {
  const box = await paragraph.boundingBox()
  if (!box) throw new Error('the paragraph is not on screen')
  await paragraph.click({ position: { x: box.width - 2, y: box.height - 2 } })
}

// The line under a field saying "Saving…", then "Saved", found by its
// name: the description's editor takes uploads, so it has a status of its
// own too ("Uploads").
function saveLine(field: Locator) {
  return field.getByRole('status', { name: 'Save Status' })
}

// Description saved what's on screen: its line says "Saved".
async function descriptionSaved(page: Page) {
  await expect(saveLine(page.getByRole('region', { name: 'Description' }))).toHaveText('Saved', { timeout: 5000 })
}

test.describe('widget view: editing in place', () => {
  test('only the plan\'s fields offer it; the rest stay read-only', async ({ page }) => {
    await openWidget(page)
    for (const label of ['Name', 'Status', 'Price', 'Extra Categories']) {
      await expect(page.getByRole('button', { name: `Edit ${label}`, exact: true })).toHaveCount(1)
    }
    // Description is the editor at rest: no click to open, no pencil.
    await expect(page.getByRole('textbox', { name: 'Description' })).toBeVisible()
    for (const label of ['Description', 'Category', 'Tags', 'Available From', 'Assignee Email', 'Checklist']) {
      await expect(page.getByRole('button', { name: `Edit ${label}`, exact: true })).toHaveCount(0)
    }
    // The view's own Edit button and form stay.
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  })

  test('text: click the title, type, Enter saves; shown as saved only once it is', async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await delayPatches(page, 800)
    await title(page).getByText('Wireless Mouse').click()
    const name = page.getByRole('textbox', { name: 'Name' })
    await expect(name).toBeFocused()
    await expect(name).toHaveValue('Wireless Mouse')
    await name.fill('Wireless Mouse Pro')
    await page.keyboard.press('Enter')

    // Saving: still open, read-only, says so; the rest of the page works.
    await expect(page.getByRole('status').filter({ hasText: 'Saving…' })).toBeVisible()
    await expect(name).toHaveAttribute('readonly', '')
    await expect(name).toHaveValue('Wireless Mouse Pro')
    await expect(page.getByRole('button', { name: 'Edit Price' })).toBeEnabled()

    await expect(title(page)).toHaveText('Wireless Mouse Pro')
    await expect(name).toHaveCount(0)
    expect(bodies).toEqual([{ name: 'Wireless Mouse Pro' }])
    // A keyboard save hands the caret back to the value's edit button.
    await expect(page.getByRole('button', { name: 'Edit Name' })).toBeFocused()
  })

  test('an unchanged value closes with no request', async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await title(page).getByText('Wireless Mouse').click()
    await page.getByRole('textbox', { name: 'Name' }).press('Enter')
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveCount(0)
    await expect(title(page)).toHaveText('Wireless Mouse')
    expect(bodies).toEqual([])
  })

  test('Esc gives up: the saved value comes back, nothing is sent', async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await title(page).getByText('Wireless Mouse').click()
    await page.getByRole('textbox', { name: 'Name' }).fill('Not kept')
    await page.keyboard.press('Escape')
    await expect(title(page)).toHaveText('Wireless Mouse')
    await expect(page.getByRole('button', { name: 'Edit Name' })).toBeFocused()
    expect(bodies).toEqual([])
  })

  test('from the keyboard: tab to the value, Enter edits, tabbing away saves', async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await page.getByRole('button', { name: 'Edit Price' }).focus()
    await page.keyboard.press('Enter')
    const price = page.getByRole('textbox', { name: 'Price' })
    await expect(price).toBeFocused()
    await price.fill('30.00')
    await page.keyboard.press('Tab')
    await expect(fieldValue(page, 'Price')).toHaveText('$30.00')
    expect(bodies).toEqual([{ price: '30.00' }])
  })

  test("a value the form's rules refuse is never sent, and says why", async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await fieldValue(page, 'Price').click()
    await page.getByRole('textbox', { name: 'Price' }).fill('cheap')
    await page.keyboard.press('Enter')
    const price = page.getByRole('textbox', { name: 'Price' })
    await expect(price).toHaveValue('cheap')
    await expect(price).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('alert')).toHaveText('Enter a price with exactly two decimal places, e.g. 19.99')
    expect(bodies).toEqual([])
  })

  test('choice: the Status badge opens its list, and a pick saves', async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await page.locator('header').last().getByText('Active', { exact: true }).click()
    await page.getByRole('option', { name: 'Archived' }).click()
    await expect(page.locator('header').last().getByText('Archived', { exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Status' })).toHaveCount(0)
    expect(bodies).toEqual([{ status: 'archived' }])
    // The keyboard keeps its place: back on the value's edit button.
    await expect(page.getByRole('button', { name: 'Edit Status' })).toBeFocused()
  })

  test('choice: closing the list with nothing picked gives up', async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await page.getByRole('button', { name: 'Edit Status' }).click()
    await expect(page.getByRole('option', { name: 'Draft' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('combobox', { name: 'Status' })).toHaveCount(0)
    await expect(page.locator('header').last().getByText('Active', { exact: true })).toBeVisible()
    expect(bodies).toEqual([])
  })

  test('long text: edited as rich text, Ctrl/Cmd+Enter saves, untouched parts saved as written', async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    const description = page.getByRole('region', { name: 'Description' })
    await description.getByText('Runs on one AA battery').click()
    const editor = page.getByRole('textbox', { name: 'Description' })
    await expect(editor).toBeFocused()
    // Formatted, not Markdown syntax: the bold is bold, the list a list.
    await expect(editor.locator('strong')).toHaveText('2.4GHz')
    await expect(editor.locator('li')).toHaveCount(2)
    await clickParagraphEnd(editor.locator('p').first())
    await page.waitForTimeout(100)
    await page.keyboard.press('End')
    await page.keyboard.type(' Quiet clicks.')
    // Enter is a new line in long text, not a save.
    await page.keyboard.press('Enter')
    await page.keyboard.press('Backspace')
    await expect(editor).toBeVisible()
    await page.keyboard.press('ControlOrMeta+Enter')

    // Saved now, and it stays the editor, the caret where it was.
    await descriptionSaved(page)
    await expect(editor).toBeFocused()
    await expect(description.getByText('Quiet clicks.')).toBeVisible()
    expect(bodies).toEqual([
      {
        description:
          'A basic wireless mouse with a **2.4GHz** USB receiver. Quiet clicks.\n\n' +
          '- Two buttons and a scroll wheel\n' +
          '- Runs on one AA battery\n\n' +
          'See the [setup guide](https://example.com/mouse-setup).',
      },
    ])
  })

  test('long text autosaves: typing saves with no click away, and stays editable while it saves', async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await delayPatches(page, 800)
    const description = page.getByRole('region', { name: 'Description' })
    await description.getByText('Runs on one AA battery').click()
    const editor = page.getByRole('textbox', { name: 'Description' })
    await expect(editor).toBeFocused()
    await editor.locator('p').last().click()
    await page.waitForTimeout(100)
    await page.keyboard.press('ControlOrMeta+End')
    await page.keyboard.type(' Two pages.')

    // Saved a pause after typing stops: no click away, the caret stays.
    const status = saveLine(description)
    // Beside it, the editor's own, empty while nothing uploads.
    await expect(description.getByRole('status', { name: 'Uploads' })).toBeEmpty()
    await expect(status).toHaveText('Saving…')
    await expect(editor).toBeFocused()
    await expect(editor).toHaveAttribute('aria-readonly', 'false')
    // Typing mid-save is kept, and goes in the next save.
    await page.keyboard.type(' Quick start.')
    await expect(status).toHaveText('Saved', { timeout: 5000 })
    await expect(editor).toBeFocused()
    const saved =
      'A basic wireless mouse with a **2.4GHz** USB receiver.\n\n' +
      '- Two buttons and a scroll wheel\n' +
      '- Runs on one AA battery\n\n' +
      'See the [setup guide](https://example.com/mouse-setup). Two pages.'
    expect(bodies).toEqual([{ description: saved }, { description: `${saved} Quick start.` }])

    // Esc saves now (nothing is left): nothing reverts, nothing more is sent.
    await page.keyboard.press('Escape')
    await expect(editor).toBeFocused()
    await expect(description.getByText('Two pages. Quick start.')).toBeVisible()
    expect(bodies).toHaveLength(2)
  })

  test('long text autosaves: leaving the page with a save still to come saves it and goes, with no prompt', async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await page.getByRole('region', { name: 'Description' }).getByText('Runs on one AA battery').click()
    const editor = page.getByRole('textbox', { name: 'Description' })
    await editor.locator('p').last().click()
    await page.waitForTimeout(100)
    await page.keyboard.press('ControlOrMeta+End')
    await page.keyboard.type(' Left at once.')
    await page.getByRole('main').getByRole('link', { name: 'Widgets', exact: true }).click()
    await expect(page).toHaveURL('/widgets')
    await expect(page.getByRole('dialog', { name: 'Discard your changes?' })).toHaveCount(0)
    expect(bodies).toHaveLength(1)
    expect((bodies[0] as { description: string }).description).toMatch(/Left at once\.$/)
  })

  test('long text autosaves: if the save on the way out is refused, leaving asks', async ({ page }) => {
    await openWidget(page)
    await refusePatches(page, 500, { detail: 'Database is down' })
    await page.getByRole('region', { name: 'Description' }).getByText('Runs on one AA battery').click()
    const editor = page.getByRole('textbox', { name: 'Description' })
    await editor.locator('p').last().click()
    await page.waitForTimeout(100)
    await page.keyboard.press('ControlOrMeta+End')
    await page.keyboard.type(' Not saved.')
    await page.getByRole('main').getByRole('link', { name: 'Widgets', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Discard your changes?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Keep Editing' }).click()
    await expect(page).toHaveURL('/widgets/1')
    await expect(editor).toContainText('Not saved.')
    await expect(page.getByRole('alert')).toHaveText('Database is down')
  })

  test('long text: an edit to the last block saves no newline that was not typed', async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    const description = page.getByRole('region', { name: 'Description' })
    await description.getByText('Runs on one AA battery').click()
    const editor = page.getByRole('textbox', { name: 'Description' })
    await expect(editor).toBeFocused()
    await editor.locator('p').last().click()
    await page.waitForTimeout(100)
    await page.keyboard.press('ControlOrMeta+End')
    await page.keyboard.type(' Two pages.')
    await page.keyboard.press('ControlOrMeta+Enter')

    await descriptionSaved(page)
    await expect(description.getByText('Two pages.')).toBeVisible()
    // The stored text ends without a newline, and so does the save.
    expect(bodies).toEqual([
      {
        description:
          'A basic wireless mouse with a **2.4GHz** USB receiver.\n\n' +
          '- Two buttons and a scroll wheel\n' +
          '- Runs on one AA battery\n\n' +
          'See the [setup guide](https://example.com/mouse-setup). Two pages.',
      },
    ])
  })

  test('long text: Ctrl/Cmd+Enter inside a table saves, and adds nothing', async ({ page }) => {
    const description = 'Sizes:\n\n| Part | Size |\n| --- | --- |\n| Top | 120x60cm |'
    await forceMswOverride(page, {
      method: 'get',
      path: '*/api/widgets/2',
      body: {
        id: 2,
        name: 'Standing Desk',
        categoryId: 2,
        status: 'draft',
        availableFrom: '2026-03-01T00:00:00Z',
        assigneeEmail: null,
        price: '349.00',
        description,
        tags: ['bulky', 'featured'],
        inStock: true,
        extraCategoryIds: [1, 3],
        checklist: [],
        pairings: [],
        checklistState: 'none',
      },
    })
    const bodies = patchBodies(page)
    await openWidget(page, 2)
    const region = page.getByRole('region', { name: 'Description' })
    await region.getByText('Sizes:').click()
    const editor = page.getByRole('textbox', { name: 'Description' })
    await expect(editor).toBeFocused()
    await editor.getByRole('cell', { name: '120x60cm' }).click()
    await page.waitForTimeout(100)
    await page.keyboard.press('End')
    await page.keyboard.type(' top')
    await page.keyboard.press('ControlOrMeta+Enter')

    await descriptionSaved(page)
    // Inside a table, Ctrl/Cmd+Enter is also the table's "leave the table"
    // key; it saves all the same, with no paragraph added after the table.
    // The edited table is written in the editor's own style (padded cells,
    // docs/DEFERRED.md); the paragraph before it is kept as written.
    expect(bodies).toEqual([
      { description: 'Sizes:\n\n| Part | Size         |\n| ---- | ------------ |\n| Top  | 120x60cm top |' },
    ])
  })

  test('long text: a table the editor pads (a short row) is kept as written when another block is edited', async ({ page }) => {
    // GFM allows a row with fewer cells than the header; the editor shows
    // it padded with empty cells. The table still saves as written.
    const table = '| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| only one cell |'
    await forceMswOverride(page, {
      method: 'get',
      path: '*/api/widgets/2',
      body: {
        id: 2,
        name: 'Standing Desk',
        categoryId: 2,
        status: 'draft',
        availableFrom: '2026-03-01T00:00:00Z',
        assigneeEmail: null,
        price: '349.00',
        description: `Intro line.\n\n${table}\n\nOutro.`,
        tags: ['bulky', 'featured'],
        inStock: true,
        extraCategoryIds: [1, 3],
        checklist: [],
        pairings: [],
        checklistState: 'none',
      },
    })
    const bodies = patchBodies(page)
    await openWidget(page, 2)
    await page.getByRole('region', { name: 'Description' }).getByText('Intro line.').click()
    const editor = page.getByRole('textbox', { name: 'Description' })
    await expect(editor).toBeFocused()
    await editor.getByText('Intro line.').click()
    await page.waitForTimeout(100)
    await page.keyboard.press('End')
    await page.keyboard.type(' Edited.')
    await page.keyboard.press('ControlOrMeta+Enter')

    await descriptionSaved(page)
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(bodies).toEqual([{ description: `Intro line. Edited.\n\n${table}\n\nOutro.` }])
  })

  test('long text: Ctrl/Cmd+K links words in place; Enter in the link box applies it, Esc closes it', async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    const description = page.getByRole('region', { name: 'Description' })
    await description.getByText('Runs on one AA battery').click()
    const editor = page.getByRole('textbox', { name: 'Description' })
    await expect(editor).toBeFocused()
    // "Two buttons": the first two words of the first list item.
    await editor.locator('li').first().click()
    await page.waitForTimeout(100)
    await page.keyboard.press('Home')
    for (let i = 0; i < 'Two buttons'.length; i++) await page.keyboard.press('Shift+ArrowRight')
    await page.waitForTimeout(100)

    // Esc closes the box only: the field stays open, nothing saved.
    await page.keyboard.press('ControlOrMeta+k')
    const box = page.getByRole('dialog', { name: 'Add Link' })
    await expect(box.getByRole('textbox', { name: 'Link Address' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(box).toHaveCount(0)
    await expect(editor).toBeFocused()

    // Enter, and Ctrl/Cmd+Enter too, applies the link only: the field
    // stays open until it's saved.
    await page.keyboard.press('ControlOrMeta+k')
    await box.getByRole('textbox', { name: 'Link Address' }).fill('example.com/buttons')
    await page.keyboard.press('ControlOrMeta+Enter')
    await expect(box).toHaveCount(0)
    await expect(editor).toBeFocused()
    await expect(editor.getByRole('link', { name: 'Two buttons', exact: true })).toBeVisible()
    expect(bodies).toEqual([])
    await page.keyboard.press('ControlOrMeta+Enter')

    await descriptionSaved(page)
    await expect(description.getByRole('link', { name: /Two buttons/ })).toHaveAttribute('href', 'https://example.com/buttons')
    expect(bodies).toEqual([
      {
        description:
          'A basic wireless mouse with a **2.4GHz** USB receiver.\n\n' +
          '- [Two buttons](https://example.com/buttons) and a scroll wheel\n' +
          '- Runs on one AA battery\n\n' +
          'See the [setup guide](https://example.com/mouse-setup).',
      },
    ])
  })

  test('long text: the floating toolbar is part of the field; Esc hides it before saving', async ({ page, isMobile }) => {
    // A touch screen has no floating toolbar: the row pinned to its
    // keyboard has the words' formats.
    test.skip(isMobile, 'a laptop: no floating toolbar on a touch screen')
    const bodies = patchBodies(page)
    await openWidget(page)
    const description = page.getByRole('region', { name: 'Description' })
    await description.getByText('Runs on one AA battery').click()
    const editor = page.getByRole('textbox', { name: 'Description' })
    await expect(editor).toBeFocused()
    // "basic", in the first paragraph. The wait is past ProseMirror's
    // focus window: a caret that lands on the document's start within
    // 200ms of the editor taking focus is read as the browser resetting
    // the selection, and put back where it was, so a quicker Ctrl+Home
    // is undone.
    await editor.locator('p').first().click()
    await page.waitForTimeout(300)
    await page.keyboard.press('ControlOrMeta+Home')
    for (let i = 0; i < 'A '.length; i++) await page.keyboard.press('ArrowRight')
    for (let i = 0; i < 'basic'.length; i++) await page.keyboard.press('Shift+ArrowRight')
    await page.waitForTimeout(100)

    // Alt+F10 into it: still open, nothing sent.
    const floating = description.getByRole('toolbar', { name: 'Format Selection' })
    await expect(floating).toBeVisible()
    await page.keyboard.press('Alt+F10')
    await expect(floating.getByRole('button', { name: 'Bold', exact: true })).toBeFocused()
    await page.waitForTimeout(100)
    await expect(editor).toBeVisible()
    expect(bodies).toEqual([])

    // Enter formats, and focus goes back to the text; a click formats too.
    await page.keyboard.press('Enter')
    await expect(editor).toBeFocused()
    await floating.getByRole('button', { name: 'Italic', exact: true }).click()
    await expect(editor).toBeFocused()

    // Esc hides the floating toolbar only: nothing saved yet.
    await page.keyboard.press('Escape')
    await expect(floating).toHaveCount(0)
    await expect(editor).toBeFocused()
    expect(bodies).toEqual([])
    await page.keyboard.press('ControlOrMeta+Enter')

    await descriptionSaved(page)
    expect(bodies).toEqual([
      {
        description:
          'A ***basic*** wireless mouse with a **2.4GHz** USB receiver.\n\n' +
          '- Two buttons and a scroll wheel\n' +
          '- Runs on one AA battery\n\n' +
          'See the [setup guide](https://example.com/mouse-setup).',
      },
    ])
  })

  test('long text: the slash menu in place: Enter picks and Esc closes it, neither saves nor gives up', async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    const description = page.getByRole('region', { name: 'Description' })
    await description.getByText('Runs on one AA battery').click()
    const editor = page.getByRole('textbox', { name: 'Description' })
    await expect(editor).toBeFocused()
    // A new line at the end, after "See the setup guide."
    await editor.locator('p').last().click()
    await page.waitForTimeout(100)
    await page.keyboard.press('ControlOrMeta+End')
    await page.keyboard.press('Enter')

    const menu = description.getByRole('listbox', { name: 'Blocks' })
    // Esc closes the menu only: the field stays open, nothing sent.
    await page.keyboard.type('/qu')
    await expect(menu).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(editor).toBeFocused()
    for (let i = 0; i < '/qu'.length; i++) await page.keyboard.press('Backspace')

    // Enter picks: still open, nothing sent until it's saved.
    await page.keyboard.type('/sub')
    await page.keyboard.press('Enter')
    await expect(menu).toHaveCount(0)
    await expect(editor).toBeFocused()
    await page.keyboard.type('Care')
    await page.waitForTimeout(100)
    expect(bodies).toEqual([])
    await page.keyboard.press('ControlOrMeta+Enter')

    await descriptionSaved(page)
    expect(bodies).toEqual([
      {
        description:
          'A basic wireless mouse with a **2.4GHz** USB receiver.\n\n' +
          '- Two buttons and a scroll wheel\n' +
          '- Runs on one AA battery\n\n' +
          'See the [setup guide](https://example.com/mouse-setup).\n\n' +
          '## Care',
      },
    ])
  })

  test('a link in the notes still opens, in a new tab, and changes nothing', async ({ page, context }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    const description = page.getByRole('region', { name: 'Description' })
    const opened = context.waitForEvent('page')
    await description.getByRole('link', { name: /setup guide/ }).click()
    await (await opened).close()
    await expect(page).toHaveURL('/widgets/1')
    await expect(page.getByRole('textbox', { name: 'Description' })).toBeVisible()
    expect(bodies).toEqual([])
  })

  test('a click on paragraph 45 of a long note puts the caret there, and the page stays put (F8)', async ({ page }) => {
    const description = Array.from({ length: 60 }, (_, index) => `Paragraph ${index + 1} of the notes.`).join('\n\n')
    await forceMswOverride(page, {
      method: 'get',
      path: '*/api/widgets/2',
      body: {
        id: 2,
        name: 'Standing Desk',
        categoryId: 2,
        status: 'draft',
        availableFrom: '2026-03-01T00:00:00Z',
        assigneeEmail: null,
        price: '349.00',
        description,
        tags: ['bulky', 'featured'],
        inStock: true,
        extraCategoryIds: [1, 3],
        checklist: [],
        pairings: [],
        checklistState: 'none',
      },
    })
    const bodies = patchBodies(page)
    await openWidget(page, 2)
    const editor = page.getByRole('textbox', { name: 'Description' })
    const target = editor.getByText('Paragraph 45 of the notes.', { exact: true })
    await target.scrollIntoViewIfNeeded()
    const before = await page.evaluate(() => window.scrollY)
    expect(before).toBeGreaterThan(0)
    await target.click()
    await expect(editor).toBeFocused()
    await page.waitForTimeout(100)
    await page.keyboard.press('End')
    await page.keyboard.type(' Here.')
    await expect(editor.getByText('Paragraph 45 of the notes. Here.', { exact: true })).toBeVisible()
    // Negative control: the first paragraph didn't get it.
    await expect(editor.getByText('Paragraph 1 of the notes.', { exact: true })).toBeVisible()
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThan(40)
    await descriptionSaved(page)
    expect((bodies[0] as { description: string }).description).toContain('Paragraph 45 of the notes. Here.')
  })

  test('multi reference: Enter picks, Esc closes the list only, leaving saves', async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await fieldValue(page, 'Extra Categories').click()
    const picker = page.getByRole('combobox', { name: 'Extra Categories' })
    await expect(picker).toBeFocused()
    await picker.fill('Furn')
    const furniture = page.getByRole('option', { name: 'Furniture' })
    await expect(furniture).toBeVisible()
    // Enter picks the highlighted option (it doesn't save): the field
    // stays open with both picks.
    await furniture.hover()
    await expect(furniture).toHaveAttribute('data-highlighted', '')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Remove Furniture' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove Stationery' })).toBeVisible()

    // Esc with the list open closes the list, not the field.
    await picker.press('ArrowDown')
    await expect(picker).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Escape')
    await expect(picker).toHaveAttribute('aria-expanded', 'false')
    await expect(picker).toBeVisible()
    expect(bodies).toEqual([])

    await page.getByRole('heading', { level: 2, name: 'Details' }).click()
    await expect(picker).toHaveCount(0)
    await expect(fieldValue(page, 'Extra Categories')).toHaveText('FurnitureStationery')
    expect(bodies).toEqual([{ extraCategoryIds: [3, 2] }])
  })

  test('multi reference: a second Esc gives up with the saved picks, never an empty list (issue #123)', async ({
    page,
  }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await fieldValue(page, 'Extra Categories').click()
    const picker = page.getByRole('combobox', { name: 'Extra Categories' })
    await picker.fill('Furn')
    const furniture = page.getByRole('option', { name: 'Furniture' })
    await furniture.hover()
    await expect(furniture).toHaveAttribute('data-highlighted', '')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Remove Furniture' })).toBeVisible()

    // The first Esc closes the list, the second gives up: the field shows
    // what was saved, and nothing was sent.
    await picker.press('ArrowDown')
    await expect(picker).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Escape')
    await expect(picker).toHaveAttribute('aria-expanded', 'false')
    // Gone, not fading out: only a closed list's Escape cleared the value.
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(picker).toHaveCount(0)
    await expect(fieldValue(page, 'Extra Categories')).toHaveText('Stationery')
    expect(bodies).toEqual([])
  })

  test('a 422 stays open with exactly what was typed and the field error word for word', async ({ page }) => {
    await openWidget(page)
    await refusePatches(page, 422, {
      detail: [{ loc: ['body', 'name'], msg: 'A widget with this name already exists', type: 'value_error' }],
    })
    await title(page).getByText('Wireless Mouse').click()
    const name = page.getByRole('textbox', { name: 'Name' })
    await name.fill('Standing Desk')
    await page.keyboard.press('Enter')

    await expect(page.getByRole('alert')).toHaveText('A widget with this name already exists')
    await expect(name).toHaveValue('Standing Desk')
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await expect(name).toHaveAccessibleDescription('A widget with this name already exists')
    // No toast, nothing reverted.
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0)

    // Esc gives up.
    await page.keyboard.press('Escape')
    await expect(title(page)).toHaveText('Wireless Mouse')
  })

  test('a 500 stays open the same way, and leaving again retries', async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await refusePatches(page, 500, { detail: 'Database is down' })
    await fieldValue(page, 'Price').click()
    const price = page.getByRole('textbox', { name: 'Price' })
    await price.fill('31.00')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('alert')).toHaveText('Database is down')
    await expect(price).toHaveValue('31.00')

    await resetMswOverrides(page)
    await price.focus()
    await page.getByRole('heading', { level: 2, name: 'Details' }).click()
    await expect(fieldValue(page, 'Price')).toHaveText('$31.00')
    expect(bodies).toEqual([{ price: '31.00' }, { price: '31.00' }])
  })

  test('no answer at all (offline) stays open with the reason', async ({ page }) => {
    await openWidget(page)
    await waitForMswReady(page)
    await page.evaluate(() => {
      const { worker, http, HttpResponse } = window.__msw
      worker.use(http.patch('*/api/widgets/:id', () => HttpResponse.error()))
    })
    await fieldValue(page, 'Price').click()
    await page.getByRole('textbox', { name: 'Price' }).fill('32.00')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('alert')).toContainText('Network error')
    await expect(page.getByRole('textbox', { name: 'Price' })).toHaveValue('32.00')
  })

  test('one field at a time: opening another saves the open one first', async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await title(page).getByText('Wireless Mouse').click()
    await page.getByRole('textbox', { name: 'Name' }).fill('Wireless Mouse Pro')
    await fieldValue(page, 'Price').click()
    await expect(page.getByRole('textbox', { name: 'Price' })).toBeFocused()
    await expect(title(page)).toHaveText('Wireless Mouse Pro')
    expect(bodies).toEqual([{ name: 'Wireless Mouse Pro' }])
  })

  test('one field at a time: if the open one can\'t save, it stays and the other doesn\'t open', async ({ page }) => {
    await openWidget(page)
    await refusePatches(page, 422, {
      detail: [{ loc: ['body', 'name'], msg: 'A widget with this name already exists', type: 'value_error' }],
    })
    await title(page).getByText('Wireless Mouse').click()
    await page.getByRole('textbox', { name: 'Name' }).fill('Standing Desk')
    await fieldValue(page, 'Price').click()
    await expect(page.getByRole('alert')).toHaveText('A widget with this name already exists')
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Standing Desk')
    await expect(page.getByRole('textbox', { name: 'Price' })).toHaveCount(0)
  })

  test('leaving the page with unsaved text asks first', async ({ page }) => {
    await openWidget(page)
    await title(page).getByText('Wireless Mouse').click()
    await page.getByRole('textbox', { name: 'Name' }).fill('Half typed')
    const back = page.getByRole('main').getByRole('link', { name: 'Widgets', exact: true })

    await back.click()
    const dialog = page.getByRole('dialog', { name: 'Discard your changes?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Keep Editing' }).click()
    await expect(page).toHaveURL('/widgets/1')
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Half typed')

    await back.click()
    await page.getByRole('dialog', { name: 'Discard your changes?' }).getByRole('button', { name: 'Discard' }).click()
    await expect(page).toHaveURL('/widgets')
  })

  test('Back with unsaved text asks too; with nothing typed it just goes', async ({ page }) => {
    await page.goto('/widgets')
    await page.getByRole('link', { name: 'Wireless Mouse' }).click()
    await expect(title(page)).toHaveText('Wireless Mouse')
    await fieldValue(page, 'Price').click()
    await page.goBack()
    await expect(page).toHaveURL('/widgets')

    await page.getByRole('link', { name: 'Wireless Mouse' }).click()
    await fieldValue(page, 'Price').click()
    await page.getByRole('textbox', { name: 'Price' }).fill('99.00')
    await page.goBack()
    await expect(page.getByRole('dialog', { name: 'Discard your changes?' })).toBeVisible()
    await expect(page).toHaveURL('/widgets/1')
  })

  test('closing the tab with unsaved text asks the browser to confirm', async ({ page }) => {
    await openWidget(page)
    await title(page).getByText('Wireless Mouse').click()
    await page.getByRole('textbox', { name: 'Name' }).fill('Half typed')
    const asked = new Promise<string>((resolve) => page.once('dialog', (dialog) => {
      resolve(dialog.type())
      void dialog.dismiss()
    }))
    await page.close({ runBeforeUnload: true })
    expect(await asked).toBe('beforeunload')
  })
})

// The checklist, a list edited in place (editInPlace's `list` kind): items
// added at the end, edited where they're shown, moved and removed with the
// form's own buttons. Every change is one PATCH of the whole list.
test.describe('widget view: the checklist edited in place', () => {
  const checklist = (page: Page) => page.getByRole('region', { name: 'Checklist' })
  const items = (page: Page) => checklist(page).getByRole('list', { name: 'Checklist' }).getByRole('listitem')
  const item = (text: string, done = false) => ({ text, done })

  test('three items added in a row from the keyboard alone; each saves, and they stay', async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await checklist(page).getByRole('button', { name: 'Add Item' }).focus()
    await page.keyboard.press('Enter')

    // Enter saves the item and opens the next, the caret already in it.
    for (const [index, text] of ['Test the scroll wheel', 'Clean the sensor', 'Box it up'].entries()) {
      const box = page.getByRole('textbox', { name: `Item ${index + 3} text` })
      await expect(box).toBeFocused()
      await page.keyboard.type(text)
      await page.keyboard.press('Enter')
    }
    await expect(page.getByRole('textbox', { name: 'Item 6 text' })).toBeFocused()
    // An empty box closes on Esc, with nothing sent.
    await page.keyboard.press('Escape')
    await expect(checklist(page).getByRole('button', { name: 'Add Item' })).toBeFocused()

    const saved = [
      item('Charge the battery', true),
      item('Pair the receiver'),
      item('Test the scroll wheel'),
      item('Clean the sensor'),
      item('Box it up'),
    ]
    expect(bodies).toEqual([
      { checklist: saved.slice(0, 3) },
      { checklist: saved.slice(0, 4) },
      { checklist: saved },
    ])
    await expect(items(page)).toHaveText(saved.map(({ text }) => text))
    await expect(checklist(page).getByText('1/5 done', { exact: true })).toBeVisible()

    // Saved, not just shown: away to the list and back reads it again.
    await page.getByRole('main').getByRole('link', { name: 'Widgets', exact: true }).click()
    await page.getByRole('link', { name: 'Wireless Mouse' }).click()
    await expect(items(page)).toHaveText(saved.map(({ text }) => text))
  })

  test("an item's text edits where it's shown: Enter saves, Esc gives up", async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await checklist(page).getByText('Pair the receiver', { exact: true }).click()
    const text = page.getByRole('textbox', { name: 'Item 2 text' })
    await expect(text).toBeFocused()
    await expect(text).toHaveValue('Pair the receiver')
    await text.fill('Pair the USB receiver')
    await page.keyboard.press('Enter')

    await expect(items(page)).toHaveText(['Charge the battery', 'Pair the USB receiver'])
    await expect(checklist(page).getByRole('button', { name: 'Edit item 2' })).toBeFocused()
    expect(bodies).toEqual([{ checklist: [item('Charge the battery', true), item('Pair the USB receiver')] }])

    // From the keyboard: Enter on its pencil, then Esc puts it back.
    await page.keyboard.press('Enter')
    await expect(text).toBeFocused()
    await text.fill('Something else')
    await page.keyboard.press('Escape')
    await expect(items(page)).toHaveText(['Charge the battery', 'Pair the USB receiver'])
    expect(bodies).toHaveLength(1)
  })

  test("move and remove: the form's buttons, each one save, the caret following the item", async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await checklist(page).getByRole('button', { name: 'Move item 2 up' }).click()
    await expect(items(page)).toHaveText(['Pair the receiver', 'Charge the battery'])
    // The moved item is first now, so its Move up is off: the caret is on its Move down.
    await expect(checklist(page).getByRole('button', { name: 'Move item 1 down' })).toBeFocused()

    await checklist(page).getByRole('button', { name: 'Remove item 1' }).click()
    await expect(items(page)).toHaveText(['Charge the battery'])
    await expect(checklist(page).getByRole('button', { name: 'Remove item 1' })).toBeFocused()

    expect(bodies).toEqual([
      { checklist: [item('Pair the receiver'), item('Charge the battery', true)] },
      { checklist: [item('Charge the battery', true)] },
    ])
  })

  test("a blank item is never sent: the form's rule shows under it", async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await checklist(page).getByRole('button', { name: 'Add Item' }).click()
    await page.getByRole('textbox', { name: 'Item 3 text' }).fill('   ')
    await page.keyboard.press('Enter')
    await expect(checklist(page).getByRole('alert')).toHaveText('Write something or remove the item')
    expect(bodies).toEqual([])
  })

  test("a refused change leaves the list as it was, with the server's reason", async ({ page }) => {
    await openWidget(page)
    await refusePatches(page, 422, {
      detail: [{ loc: ['body', 'checklist', 1, 'text'], msg: 'That item is already on the list', type: 'value_error' }],
    })

    // A move: the order stays, the reason under the list.
    await checklist(page).getByRole('button', { name: 'Move item 2 up' }).click()
    await expect(checklist(page).getByRole('alert')).toHaveText('That item is already on the list')
    await expect(items(page)).toHaveText(['Charge the battery', 'Pair the receiver'])
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0)

    // An item's text: it stays open with what was typed and the reason.
    await checklist(page).getByText('Pair the receiver', { exact: true }).click()
    const text = page.getByRole('textbox', { name: 'Item 2 text' })
    await text.fill('Charge the battery')
    await page.keyboard.press('Enter')
    await expect(text).toHaveValue('Charge the battery')
    await expect(text).toHaveAttribute('aria-invalid', 'true')
    await expect(text).toHaveAccessibleDescription('That item is already on the list')
  })

  test('ticking keeps working beside it: a tick and an item added just after both land', async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await delayPatches(page, 400)
    await checklist(page).getByRole('checkbox', { name: 'Done: Pair the receiver' }).click()
    await checklist(page).getByRole('button', { name: 'Add Item' }).click()
    await page.getByRole('textbox', { name: 'Item 3 text' }).fill('Test the scroll wheel')
    await page.keyboard.press('Enter')

    await expect(items(page)).toHaveText(['Charge the battery', 'Pair the receiver', 'Test the scroll wheel'])
    await expect(checklist(page).getByRole('checkbox', { name: 'Done: Pair the receiver' })).toBeChecked()
    // The add was sent after the tick answered, built on the ticked list.
    expect(bodies).toEqual([
      { checklist: [item('Charge the battery', true), item('Pair the receiver', true)] },
      { checklist: [item('Charge the battery', true), item('Pair the receiver', true), item('Test the scroll wheel')] },
    ])
  })

  test('an empty list says so, and takes its first item', async ({ page }) => {
    // Blank Slate (id 4) has no checklist.
    const bodies = patchBodies(page)
    await openWidget(page, 4)
    await expect(checklist(page)).toContainText('No items')
    await checklist(page).getByRole('button', { name: 'Add Item' }).click()
    await page.getByRole('textbox', { name: 'Item 1 text' }).fill('Unbox it')
    await page.keyboard.press('Enter')
    await expect(items(page)).toHaveText(['Unbox it'])
    expect(bodies).toEqual([{ checklist: [item('Unbox it')] }])
  })

  test('a half-typed item asks before leaving the page', async ({ page }) => {
    await openWidget(page)
    await checklist(page).getByRole('button', { name: 'Add Item' }).click()
    await page.getByRole('textbox', { name: 'Item 3 text' }).fill('Half typed')
    await page.getByRole('main').getByRole('link', { name: 'Widgets', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Discard your changes?' })).toBeVisible()
  })
})

// Sub-records whose items hold a reference: each row is the form's (a
// category combobox and a note), the item reads as the category's name.
test.describe('widget view: the pairings edited in place (a reference in each item)', () => {
  const pairings = (page: Page) => page.getByRole('region', { name: 'Pairings' })
  const items = (page: Page) => pairings(page).getByRole('list', { name: 'Pairings' }).getByRole('listitem')
  const SAVED = [
    { categoryId: 3, note: 'Desk sets' },
    { categoryId: 2, note: '' },
  ]

  test('a pairing added from the keyboard: search, Enter picks without saving, a note, Enter saves', async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await pairings(page).getByRole('button', { name: 'Add Pairing' }).click()
    const picker = page.getByRole('combobox', { name: 'Pairing 3 category' })
    await expect(picker).toBeFocused()
    await picker.fill('Elec')
    const electronics = page.getByRole('option', { name: 'Electronics' })
    await expect(electronics).toBeVisible()
    await picker.press('ArrowDown')
    await expect(electronics).toHaveAttribute('data-highlighted', '')
    // Enter in the open list picks; the row stays open for its note.
    await page.keyboard.press('Enter')
    await expect(picker).toHaveValue('Electronics')
    await expect(electronics).toBeHidden()
    expect(bodies).toEqual([])

    const note = page.getByRole('textbox', { name: 'Pairing 3 note' })
    await note.fill('Gift sets')
    await page.keyboard.press('Enter')

    // The item carries the id; the view shows the name.
    expect(bodies).toEqual([{ pairings: [...SAVED, { categoryId: 1, note: 'Gift sets' }] }])
    await expect(items(page)).toHaveText(['Stationery · Desk sets', 'Furniture', 'Electronics · Gift sets'])
    // Enter opened the next one; an empty one closes on Esc with nothing sent.
    await expect(page.getByRole('combobox', { name: 'Pairing 4 category' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('combobox', { name: 'Pairing 4 category' })).toHaveCount(0)
    expect(bodies).toHaveLength(1)

    // Saved, not just shown: away to the list and back reads it again.
    await page.getByRole('main').getByRole('link', { name: 'Widgets', exact: true }).click()
    await page.getByRole('link', { name: 'Wireless Mouse' }).click()
    await expect(items(page)).toHaveText(['Stationery · Desk sets', 'Furniture', 'Electronics · Gift sets'])
  })

  test("an item's reference changes where it's shown: a click picks, leaving saves", async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await items(page).nth(1).getByText('Furniture', { exact: true }).click()
    const picker = page.getByRole('combobox', { name: 'Pairing 2 category' })
    await expect(picker).toBeFocused()
    // The saved pick shows by name, from the lookup by id.
    await expect(picker).toHaveValue('Furniture')
    await page.getByRole('button', { name: 'Show Options' }).click()
    await page.getByRole('option', { name: 'Electronics' }).click()
    await expect(picker).toHaveValue('Electronics')
    expect(bodies).toEqual([])

    await page.getByRole('heading', { level: 2, name: 'Pairings' }).click()
    await expect(picker).toHaveCount(0)
    expect(bodies).toEqual([{ pairings: [SAVED[0], { categoryId: 1, note: '' }] }])
    await expect(items(page)).toHaveText(['Stationery · Desk sets', 'Electronics'])
  })

  test("move and remove: the form's buttons, each one save of the whole list", async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await pairings(page).getByRole('button', { name: 'Move pairing 2 up' }).click()
    await expect(items(page)).toHaveText(['Furniture', 'Stationery · Desk sets'])
    await pairings(page).getByRole('button', { name: 'Remove pairing 1' }).click()
    await expect(items(page)).toHaveText(['Stationery · Desk sets'])
    expect(bodies).toEqual([{ pairings: [SAVED[1], SAVED[0]] }, { pairings: [SAVED[0]] }])
  })

  test("a pairing with no category is never sent: the form's rule shows under it", async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    await pairings(page).getByRole('button', { name: 'Add Pairing' }).click()
    await page.getByRole('textbox', { name: 'Pairing 3 note' }).fill('No category yet')
    await page.keyboard.press('Enter')
    await expect(pairings(page).getByRole('alert')).toHaveText('Pick a category or remove the pairing')
    expect(bodies).toEqual([])
  })

  test("a refused reference stays open with the pick and the server's reason", async ({ page }) => {
    await openWidget(page)
    await refusePatches(page, 422, {
      detail: [{ loc: ['body', 'pairings', 2, 'categoryId'], msg: 'Category not found', type: 'value_error.foreign_key' }],
    })
    await pairings(page).getByRole('button', { name: 'Add Pairing' }).click()
    const picker = page.getByRole('combobox', { name: 'Pairing 3 category' })
    await page.getByRole('button', { name: 'Show Options' }).click()
    await page.getByRole('option', { name: 'Stationery' }).click()
    await page.getByRole('textbox', { name: 'Pairing 3 note' }).fill('Again')
    await page.keyboard.press('Enter')

    await expect(picker).toHaveValue('Stationery')
    await expect(picker).toHaveAttribute('aria-invalid', 'true')
    await expect(picker).toHaveAccessibleDescription('Category not found')
    await expect(items(page)).toHaveText(['Stationery · Desk sets', 'Furniture'])
  })

  test('an empty list says so, and takes its first pairing', async ({ page }) => {
    // Blank Slate (id 4) has no pairings.
    const bodies = patchBodies(page)
    await openWidget(page, 4)
    await expect(pairings(page)).toContainText('No pairings')
    await pairings(page).getByRole('button', { name: 'Add Pairing' }).click()
    await page.getByRole('button', { name: 'Show Options' }).click()
    await page.getByRole('option', { name: 'Furniture' }).click()
    await page.getByRole('textbox', { name: 'Pairing 1 note' }).press('Enter')
    await expect(items(page)).toHaveText(['Furniture'])
    expect(bodies).toEqual([{ pairings: [{ categoryId: 2, note: '' }] }])
  })
})

// Two writers: another tab, a
// phone or an AI chat saves the widget while this tab has it open and
// doesn't know. Each save carries the version it was built on
// (baseUpdatedAt), so this tab's stale save is refused (a 409), nothing is
// written, and the field asks.
test.describe('widget view: two writers', () => {
  const THEIRS = 'Added on the phone.'

  // Another writer saves, straight to the API: this tab's cache doesn't hear of it.
  async function saveElsewhere(page: Page) {
    await page.evaluate(async (added) => {
      const widget = await (await fetch('/api/widgets/1')).json()
      await fetch('/api/widgets/1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ description: `${widget.description}\n\n${added}`, baseUpdatedAt: widget.updatedAt }),
      })
    }, THEIRS)
  }

  // What's stored now, as the server has it.
  const stored = (page: Page) =>
    page.evaluate(async () => ((await (await fetch('/api/widgets/1')).json()) as { description: string }).description)

  // Types at the end of the first paragraph: a different block from theirs.
  async function typeMine(page: Page, text: string) {
    const editor = page.getByRole('textbox', { name: 'Description' })
    await clickParagraphEnd(editor.locator('p').first())
    await page.keyboard.press('End')
    await page.keyboard.type(text)
  }

  test('a stale save is refused, nothing is written, and the field says it changed elsewhere', async ({ page }) => {
    const sent: Record<string, unknown>[] = []
    const answers: number[] = []
    // This tab's own saves (the app's requests say X-Requested-With; the
    // other writer's fetch doesn't).
    page.on('request', (request) => {
      if (request.method() === 'PATCH' && request.headers()['x-requested-with']) sent.push(request.postDataJSON())
    })
    page.on('response', (response) => {
      if (response.request().method() === 'PATCH' && response.request().headers()['x-requested-with']) answers.push(response.status())
    })
    await openWidget(page)
    await saveElsewhere(page)
    await typeMine(page, ' Mine.')

    const description = page.getByRole('region', { name: 'Description' })
    await expect(description.getByText(/changed elsewhere/)).toBeVisible({ timeout: 5000 })
    await expect(description.getByRole('button', { name: 'Keep Mine' })).toBeVisible()
    // Its toast says what happened, not that the save failed.
    await expect(page.getByText('Description changed elsewhere')).toBeVisible()
    await expect(page.getByText("Couldn't save Description")).toHaveCount(0)
    expect(answers).toEqual([409])
    expect(sent[0]).toHaveProperty('baseUpdatedAt', '2026-11-01T09:00:01.000Z')
    // Nothing of this tab's was written over theirs, and it stays that way past the pause.
    await page.waitForTimeout(2000)
    expect(answers).toEqual([409])
    expect(await stored(page)).toContain(THEIRS)
    expect(await stored(page)).not.toContain('Mine.')
    // What was typed is still there.
    await expect(page.getByRole('textbox', { name: 'Description' })).toContainText('Mine.')
  })

  test('"Keep Mine" keeps both: typed text laid onto the other writer\'s, block by block', async ({ page }) => {
    await openWidget(page)
    await saveElsewhere(page)
    await typeMine(page, ' Mine.')
    const description = page.getByRole('region', { name: 'Description' })
    await description.getByRole('button', { name: 'Keep Mine' }).click()

    const editor = page.getByRole('textbox', { name: 'Description' })
    await expect(editor).toContainText('Mine.')
    await expect(editor).toContainText(THEIRS)
    await descriptionSaved(page)
    const saved = await stored(page)
    expect(saved).toContain('USB receiver. Mine.')
    expect(saved).toContain(THEIRS)
    await expect(description.getByText(/changed elsewhere/)).toHaveCount(0)
  })

  test('"Show Saved" drops what was typed and shows the other writer\'s text; nothing is sent', async ({ page }) => {
    await openWidget(page)
    await saveElsewhere(page)
    await typeMine(page, ' Mine.')
    const description = page.getByRole('region', { name: 'Description' })
    await description.getByRole('button', { name: 'Show Saved' }).click()
    const editor = page.getByRole('textbox', { name: 'Description' })
    await expect(editor).toContainText(THEIRS)
    await expect(editor).not.toContainText('Mine.')
    await page.waitForTimeout(1500)
    expect(await stored(page)).not.toContain('Mine.')
  })

  test('with nobody else saving, the same typing just saves (negative control)', async ({ page }) => {
    await openWidget(page)
    await typeMine(page, ' Mine.')
    await descriptionSaved(page)
    expect(await stored(page)).toContain('USB receiver. Mine.')
    await expect(page.getByRole('region', { name: 'Description' }).getByText(/changed elsewhere/)).toHaveCount(0)
  })
})
