import { expect, test, type Page } from '@playwright/test'
import { forceMswOverride, waitForMswReady } from '@tristan2828/ui-foundation/testing'

// Editing in place on the widget view (cell pattern 18): Name, Status,
// Price, Description and Extra Categories turn into the form's own control
// where they're shown and save when you leave them. Nothing typed is ever
// lost: a refused save stays open with what was typed and the reason.

// The body of every PATCH the page sends, in order.
function patchBodies(page: Page) {
  const bodies: unknown[] = []
  page.on('request', (request) => {
    if (request.method() === 'PATCH') bodies.push(request.postDataJSON())
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
}

test.describe('widget view: editing in place', () => {
  test('only the plan\'s fields offer it; the rest stay read-only', async ({ page }) => {
    await openWidget(page)
    for (const label of ['Name', 'Status', 'Price', 'Description', 'Extra Categories']) {
      await expect(page.getByRole('button', { name: `Edit ${label}`, exact: true })).toHaveCount(1)
    }
    for (const label of ['Category', 'Tags', 'Available From', 'Assignee Email', 'Checklist']) {
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
    await editor.locator('p').first().click()
    await page.waitForTimeout(100)
    await page.keyboard.press('End')
    await page.keyboard.type(' Quiet clicks.')
    // Enter is a new line in long text, not a save.
    await page.keyboard.press('Enter')
    await page.keyboard.press('Backspace')
    await expect(editor).toBeVisible()
    await page.keyboard.press('ControlOrMeta+Enter')

    await expect(description.getByText('Quiet clicks.')).toBeVisible()
    await expect(editor).toHaveCount(0)
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

    await expect(editor).toHaveCount(0)
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

    await expect(editor).toHaveCount(0)
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
    const box = page.getByRole('dialog', { name: 'Add link' })
    await expect(box.getByRole('textbox', { name: 'Link address' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(box).toHaveCount(0)
    await expect(editor).toBeFocused()

    // Enter, and Ctrl/Cmd+Enter too, applies the link only: the field
    // stays open until it's saved.
    await page.keyboard.press('ControlOrMeta+k')
    await box.getByRole('textbox', { name: 'Link address' }).fill('example.com/buttons')
    await page.keyboard.press('ControlOrMeta+Enter')
    await expect(box).toHaveCount(0)
    await expect(editor).toBeFocused()
    await expect(editor.getByRole('link', { name: 'Two buttons', exact: true })).toBeVisible()
    expect(bodies).toEqual([])
    await page.keyboard.press('ControlOrMeta+Enter')

    await expect(editor).toHaveCount(0)
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

  test('long text: the toolbar is part of the field; moving to it saves nothing', async ({ page }) => {
    const bodies = patchBodies(page)
    await openWidget(page)
    const description = page.getByRole('region', { name: 'Description' })
    await description.getByText('Runs on one AA battery').click()
    const editor = page.getByRole('textbox', { name: 'Description' })
    await expect(editor).toBeFocused()
    // "basic", in the first paragraph (in a list item, Shift+Tab would
    // outdent the item instead of leaving the text).
    await editor.locator('p').first().click()
    await page.waitForTimeout(100)
    // The document's start: at phone width the line wraps, and Home goes
    // to the start of the line on screen.
    await page.keyboard.press('ControlOrMeta+Home')
    for (let i = 0; i < 'A '.length; i++) await page.keyboard.press('ArrowRight')
    for (let i = 0; i < 'basic'.length; i++) await page.keyboard.press('Shift+ArrowRight')
    await page.waitForTimeout(100)

    // Shift+Tab into the toolbar: still open, nothing sent.
    await page.keyboard.press('Shift+Tab')
    const toolbar = description.getByRole('toolbar', { name: 'Formatting' })
    await expect(toolbar.getByRole('button', { name: 'Bold', exact: true })).toBeFocused()
    await page.waitForTimeout(100)
    await expect(editor).toBeVisible()
    expect(bodies).toEqual([])

    // Enter formats, and focus goes back to the text; a click formats too.
    await page.keyboard.press('Enter')
    await expect(editor).toBeFocused()
    await toolbar.getByRole('button', { name: 'Italic', exact: true }).click()
    await expect(editor).toBeFocused()
    expect(bodies).toEqual([])
    await page.keyboard.press('ControlOrMeta+Enter')

    await expect(editor).toHaveCount(0)
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

  test('a link inside a value still navigates; a click anywhere else edits', async ({ page, context }) => {
    await openWidget(page)
    const description = page.getByRole('region', { name: 'Description' })
    const opened = context.waitForEvent('page')
    await description.getByRole('link', { name: /setup guide/ }).click()
    await (await opened).close()
    await expect(page.getByRole('textbox', { name: 'Description' })).toHaveCount(0)
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
    await dialog.getByRole('button', { name: 'Keep editing' }).click()
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
