import { expect, test, type Page } from '@playwright/test'
import { forceMswOverride, waitForMswReady } from '@tristan2828/ui-foundation/testing'

// The widget view (/widgets/:id): one test per state (loading, not found,
// error, success, the sparse record's empty values), then the ways in and
// out of it (the table's title link, Edit, Cancel, Delete) and its layout
// (the rail) on wide screens and at phone width.

// Wireless Mouse (id 1) as the mocks seed it, for overrides that replace
// its first GET.
const WIRELESS_MOUSE = {
  id: 1,
  name: 'Wireless Mouse',
  categoryId: 1,
  status: 'active',
  availableFrom: '2026-01-15T00:00:00Z',
  assigneeEmail: 'alice@example.com',
  price: '24.99',
  description: 'A basic wireless mouse.',
  tags: ['fragile'],
  inStock: true,
  extraCategoryIds: [3],
  checklist: [
    { text: 'Charge the battery', done: true },
    { text: 'Pair the receiver', done: false },
  ],
  checklistState: 'open',
}

// The value cell (<dd>) of a label/value row, found by its exact label.
function fieldValue(page: Page, label: string) {
  return page
    .locator('dl > div')
    .filter({ has: page.locator('dt').getByText(label, { exact: true }) })
    .locator('dd')
}

// The body of every PATCH the page sends, in order.
function patchBodies(page: Page) {
  const bodies: unknown[] = []
  page.on('request', (request) => {
    if (request.method() === 'PATCH') bodies.push(request.postDataJSON())
  })
  return bodies
}

// Holds every PATCH for `ms`, then lets the normal mocks answer it.
async function delayPatches(page: Page, ms: number) {
  await waitForMswReady(page)
  await page.evaluate((ms) => {
    const { worker, http } = window.__msw
    worker.use(http.patch('*/api/widgets/:id', () => new Promise<undefined>((resolve) => setTimeout(resolve, ms))))
  }, ms)
}

// The widget as the mocks hold it now: what the server saved.
function serverWidget(page: Page, id: number) {
  return page.evaluate((id) => fetch(`/api/widgets/${id}`).then((response) => response.json()), id)
}

test.describe('widget view', () => {
  test('loading: a skeleton shows until the widget arrives', async ({ page }) => {
    await forceMswOverride(page, { method: 'get', path: '*/api/widgets/1', delayMs: 1000, body: WIRELESS_MOUSE })
    await page.goto('/widgets/1')
    await expect(page.locator('[data-state="loading"]')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Wireless Mouse' })).toBeVisible()
    await expect(page.locator('[data-state="loading"]')).toHaveCount(0)
  })

  test('not found: a 404 says so and offers the list, never a retry', async ({ page }) => {
    // Another user's widget is the same plain 404 from the server, so this
    // is also what opening someone else's widget looks like.
    await page.goto('/widgets/99')
    await expect(page.getByText('Not found', { exact: true })).toBeVisible()
    await expect(page.getByText('Widget 99 not found')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Back to Widgets' }).click()
    await expect(page).toHaveURL('/widgets')
    await expect(page.getByRole('heading', { level: 1, name: 'Widgets' })).toBeVisible()
  })

  test('error: a failed load shows the error, and Try again recovers', async ({ page }) => {
    // Opened from the table, so the failure can be a one-off: the retry
    // then reaches the normal mocks.
    await page.goto('/widgets')
    await waitForMswReady(page)
    await page.evaluate(() => {
      const { worker, http, HttpResponse } = window.__msw
      worker.use(
        http.get('*/api/widgets/1', () => HttpResponse.json({ detail: 'Database is down' }, { status: 500 }), {
          once: true,
        }),
      )
    })
    await page.getByRole('link', { name: 'Wireless Mouse' }).click()

    await expect(page.getByText('Something went wrong')).toBeVisible()
    await expect(page.getByText('Database is down')).toBeVisible()
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Wireless Mouse' })).toBeVisible()
  })

  test('success: the whole widget, each value rendered the way its table cell is', async ({ page }) => {
    await page.goto('/widgets/1')
    await expect(page.getByRole('heading', { level: 1, name: 'Wireless Mouse' })).toBeVisible()

    // Header: status-like values (Status edits in place, In Stock is a
    // quick action that flips), and the actions.
    const header = page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) })
    await expect(header.getByText('Active', { exact: true })).toBeVisible()
    await expect(header.getByRole('button', { name: 'Edit Status' })).toBeAttached()
    await expect(header.getByText('In progress', { exact: true })).toBeVisible()
    await expect(header.getByRole('switch', { name: 'In stock' })).toBeChecked()
    await expect(header.getByText('In stock', { exact: true })).toBeVisible()
    await expect(header.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
    await expect(header.getByRole('button', { name: 'Delete' })).toBeVisible()

    // Details: names, never ids, for references; labels, never wire values.
    await expect(fieldValue(page, 'Category')).toHaveText('Electronics')
    await expect(fieldValue(page, 'Extra Categories')).toHaveText('Stationery')
    await expect(fieldValue(page, 'Tags')).toHaveText('Fragile')
    await expect(fieldValue(page, 'Available From')).toHaveText('Jan 15, 2026')
    await expect(fieldValue(page, 'Price')).toHaveText('$24.99')
    await expect(fieldValue(page, 'Assignee Email')).toHaveText('alice@example.com')
    // No control in a field row, only the edit-in-place buttons of the
    // fields the plan makes editable (e2e/widget-edit-in-place.spec.ts).
    await expect(
      page.locator('dd').locator('input, button:not([data-edit]), [role="switch"], [role="checkbox"]'),
    ).toHaveCount(0)

    // Sub-records, a quick action: the done-count, then the items in order
    // as one group of checkboxes, each named for what it changes.
    const checklist = page.getByRole('region', { name: 'Checklist' })
    await expect(checklist.getByText('1/2 done', { exact: true })).toBeVisible()
    const group = checklist.getByRole('group', { name: 'Checklist items' })
    await expect(group).toHaveAccessibleDescription('1/2 done')
    await expect(group.getByRole('listitem')).toHaveText(['Done: Charge the battery', 'Done: Pair the receiver'])
    await expect(group.getByRole('checkbox', { name: 'Done: Charge the battery' })).toBeChecked()
    await expect(group.getByRole('checkbox', { name: 'Done: Pair the receiver' })).not.toBeChecked()

    // Long text, as Markdown: emphasis, a list, a link that opens a new tab.
    const description = page.getByRole('region', { name: 'Description' })
    await expect(description.locator('strong')).toHaveText('2.4GHz')
    await expect(description.getByRole('listitem')).toHaveCount(2)
    const link = description.getByRole('link', { name: /setup guide/ })
    await expect(link).toHaveAttribute('href', 'https://example.com/mouse-setup')
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noreferrer')
  })

  test('empty values read as the plan\'s "not set" labels, never a blank', async ({ page }) => {
    // Blank Slate (id 4): every optional field empty (src/mocks/data.ts).
    await page.goto('/widgets/4')
    await expect(page.getByRole('heading', { level: 1, name: 'Blank Slate' })).toBeVisible()
    await expect(fieldValue(page, 'Assignee Email')).toHaveText('Unassigned')
    await expect(fieldValue(page, 'Tags')).toHaveText('Untagged')
    await expect(fieldValue(page, 'Extra Categories')).toHaveText('No extra categories')
    await expect(page.getByRole('switch', { name: 'In stock' })).not.toBeChecked()
    await expect(page.getByText('Out of stock', { exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Checklist' })).toContainText('No items')

    // No value anywhere on the page is blank.
    const values = await page.locator('dd').allTextContents()
    expect(values.length).toBeGreaterThan(0)
    for (const value of values) expect(value.trim()).not.toBe('')
  })

  test('long text: Markdown renders headings, lists, tables and links; raw HTML does not', async ({ page }) => {
    await forceMswOverride(page, {
      method: 'get',
      path: '*/api/widgets/1',
      body: {
        ...WIRELESS_MOUSE,
        description: [
          '# Setup',
          '',
          '1. Insert the battery',
          '2. Plug in the receiver',
          '',
          '| Part | Count |',
          '| --- | --- |',
          '| Receiver | 1 |',
          '',
          '[Manual](https://example.com/manual)',
          '',
          '<b>not bold</b> <script>window.__markdownScriptRan = true</script>',
        ].join('\n'),
      },
    })
    await page.goto('/widgets/1')
    const description = page.getByRole('region', { name: 'Description' })

    // A `#` heading sits under the page's <h1> and the section's <h2>.
    await expect(description.getByRole('heading', { level: 3, name: 'Setup' })).toBeVisible()
    await expect(description.getByRole('listitem')).toHaveText(['Insert the battery', 'Plug in the receiver'])
    await expect(description.getByRole('cell', { name: 'Receiver' })).toBeVisible()
    await expect(description.getByRole('link', { name: /Manual/ })).toHaveAttribute('target', '_blank')

    // Raw HTML shows as the characters typed, never as markup.
    await expect(description.getByText('<b>not bold</b>')).toBeVisible()
    await expect(description.locator('b, script')).toHaveCount(0)
    expect(await page.evaluate(() => (window as { __markdownScriptRan?: boolean }).__markdownScriptRan)).toBeUndefined()
  })

  test('the table opens a widget from its name, and has no row actions', async ({ page }) => {
    await page.goto('/widgets')
    const table = page.getByRole('table')
    await expect(table.getByRole('link', { name: 'Wireless Mouse' })).toBeVisible()
    await expect(table.getByRole('button', { name: /^(Edit|Delete)/ })).toHaveCount(0)

    await table.getByRole('link', { name: 'Wireless Mouse' }).click()
    await expect(page).toHaveURL('/widgets/1')
    await expect(page.getByRole('heading', { level: 1, name: 'Wireless Mouse' })).toBeVisible()

    // And the link above the title goes back.
    await page.getByRole('main').getByRole('link', { name: 'Widgets', exact: true }).click()
    await expect(page).toHaveURL('/widgets')
  })

  test('edit: saving returns to the view, showing the change', async ({ page }) => {
    await page.goto('/widgets/1')
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page).toHaveURL('/widgets/1/edit')
    await page.locator('#widget-name').fill('Wireless Mouse Pro')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page).toHaveURL('/widgets/1')
    await expect(page.getByRole('heading', { level: 1, name: 'Wireless Mouse Pro' })).toBeVisible()
  })

  test('edit: Cancel returns to the view, unchanged', async ({ page }) => {
    await page.goto('/widgets/1')
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.locator('#widget-name').fill('Not Saved')
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page).toHaveURL('/widgets/1')
    await expect(page.getByRole('heading', { level: 1, name: 'Wireless Mouse' })).toBeVisible()
  })

  test('delete: confirming removes the widget and returns to the list', async ({ page }) => {
    await page.goto('/widgets/3')
    await page.getByRole('button', { name: 'Delete' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Delete Fountain Pen?')).toBeVisible()
    await dialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page).toHaveURL('/widgets')
    await expect(page.getByText('Fountain Pen deleted')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Fountain Pen', exact: true })).toHaveCount(0)
  })

  test('validation: a failed delete keeps the view and says why', async ({ page }) => {
    await page.goto('/widgets/1')
    await expect(page.getByRole('heading', { level: 1, name: 'Wireless Mouse' })).toBeVisible()
    await waitForMswReady(page)
    await page.evaluate(() => {
      const { worker, http, HttpResponse } = window.__msw
      worker.use(
        http.delete('*/api/widgets/:id', () =>
          HttpResponse.json(
            { detail: [{ loc: ['body', 'id'], msg: 'cannot delete a widget with active assignments', type: 'value_error' }] },
            { status: 422 },
          ),
        ),
      )
    })
    await page.getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()

    // toAppError() gives every 422 the same generic message; the specifics
    // are fieldErrors, and a delete has no field to bind them to.
    await expect(page.getByText('Validation failed')).toBeVisible()
    // The dialog stays open on error (only success closes it).
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
    await expect(page).toHaveURL('/widgets/1')
    await expect(page.getByRole('heading', { level: 1, name: 'Wireless Mouse' })).toBeVisible()
  })

  test('quick action: ticking an item saves the list at once, and the server\'s progress follows', async ({ page }) => {
    const bodies = patchBodies(page)
    await page.goto('/widgets/1')
    const checklist = page.getByRole('region', { name: 'Checklist' })
    const pair = checklist.getByRole('checkbox', { name: 'Done: Pair the receiver' })
    await pair.click()

    await expect(pair).toBeChecked()
    await expect(checklist.getByText('2/2 done', { exact: true })).toBeVisible()
    // Progress is computed by the server: it changes once the save answers,
    // because the view shows the widget the server returns.
    await expect(page.locator('header').getByText('Complete', { exact: true })).toBeVisible()
    // A plain PATCH, and a list is sent whole.
    expect(bodies).toEqual([
      {
        checklist: [
          { text: 'Charge the battery', done: true },
          { text: 'Pair the receiver', done: true },
        ],
      },
    ])
    await expect(page).toHaveURL('/widgets/1')

    // The item's text ticks it too, and so does the keyboard.
    await checklist.getByText('Pair the receiver', { exact: true }).click()
    await expect(pair).not.toBeChecked()
    await pair.focus()
    await page.keyboard.press('Space')
    await expect(pair).toBeChecked()
    await expect(page.locator('header').getByText('Complete', { exact: true })).toBeVisible()

    // Saved, not just shown: the table agrees.
    await page.getByRole('main').getByRole('link', { name: 'Widgets', exact: true }).click()
    await expect(page.getByRole('row').filter({ hasText: 'Wireless Mouse' })).toContainText('2/2 done')
  })

  test('quick action: In stock flips on the page and saves', async ({ page }) => {
    const bodies = patchBodies(page)
    await page.goto('/widgets/1')
    const inStock = page.getByRole('switch', { name: 'In stock' })
    await inStock.click()

    await expect(inStock).not.toBeChecked()
    await expect(page.getByText('Out of stock', { exact: true })).toBeVisible()
    await expect.poll(() => bodies).toEqual([{ inStock: false }])
    expect((await serverWidget(page, 1)).inStock).toBe(false)

    await page.getByRole('main').getByRole('link', { name: 'Widgets', exact: true }).click()
    await expect(page.getByRole('switch', { name: 'In stock: Wireless Mouse' })).not.toBeChecked()
  })

  test('quick action: a refused change goes back and the server\'s reason shows', async ({ page }) => {
    // A rule only the server knows (a cap on how many can be in stock):
    // it answers 422 with the reason on the field.
    await page.goto('/widgets/3')
    const inStock = page.getByRole('switch', { name: 'In stock' })
    await expect(inStock).not.toBeChecked()
    await waitForMswReady(page)
    await page.evaluate(() => {
      const { worker, http, HttpResponse } = window.__msw
      worker.use(
        http.patch('*/api/widgets/3', () =>
          HttpResponse.json(
            { detail: [{ loc: ['body', 'inStock'], msg: 'Only 3 widgets can be in stock at once', type: 'value_error' }] },
            { status: 422 },
          ),
        ),
      )
    })
    await inStock.click()

    await expect(page.getByText("Couldn't update Fountain Pen: Only 3 widgets can be in stock at once")).toBeVisible()
    await expect(inStock).not.toBeChecked()
    await expect(page.getByText('Out of stock', { exact: true })).toBeVisible()
    expect((await serverWidget(page, 3)).inStock).toBe(false)
  })

  test('quick action: saving shows beside the control and blocks nothing else', async ({ page }) => {
    await page.goto('/widgets/1')
    await delayPatches(page, 1500)
    const checklist = page.getByRole('region', { name: 'Checklist' })
    await checklist.getByRole('checkbox', { name: 'Done: Pair the receiver' }).click()

    await expect(checklist.getByRole('status', { name: 'Saving' })).toBeVisible()
    await expect(page.locator('header').getByRole('status', { name: 'Saving' })).toHaveCount(0)
    // Nothing is disabled: not the other controls, not this one, not Edit.
    await expect(checklist.getByRole('checkbox', { name: 'Done: Charge the battery' })).toBeEnabled()
    await expect(checklist.getByRole('checkbox', { name: 'Done: Pair the receiver' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Edit Status' })).toBeEnabled()
    await expect(page.getByRole('switch', { name: 'In stock' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeEnabled()

    await expect(checklist.getByRole('status', { name: 'Saving' })).toHaveCount(0)
    await expect(checklist.getByText('2/2 done', { exact: true })).toBeVisible()
  })

  test('quick action: two quick ticks both land, the second built on the first', async ({ page }) => {
    const bodies = patchBodies(page)
    await page.goto('/widgets/1')
    // Slow saves, so the second tick happens while the first is in flight.
    await delayPatches(page, 800)
    const checklist = page.getByRole('region', { name: 'Checklist' })
    await checklist.getByRole('checkbox', { name: 'Done: Charge the battery' }).click()
    await checklist.getByRole('checkbox', { name: 'Done: Pair the receiver' }).click()

    await expect(checklist.getByRole('checkbox', { name: 'Done: Charge the battery' })).not.toBeChecked()
    await expect(checklist.getByRole('checkbox', { name: 'Done: Pair the receiver' })).toBeChecked()
    await expect.poll(() => bodies.length).toBe(2)
    await expect(checklist.getByRole('status', { name: 'Saving' })).toHaveCount(0)

    const both = [
      { text: 'Charge the battery', done: false },
      { text: 'Pair the receiver', done: true },
    ]
    expect(bodies[1]).toEqual({ checklist: both })
    expect((await serverWidget(page, 1)).checklist).toEqual(both)
    await expect(checklist.getByRole('checkbox', { name: 'Done: Charge the battery' })).not.toBeChecked()
    await expect(checklist.getByRole('checkbox', { name: 'Done: Pair the receiver' })).toBeChecked()
  })

  // The plan's layout is `rail`: Details in a column on the right,
  // Description and Checklist in the main column beside it.
  for (const width of [1280, 2289]) {
    test(`wide screens (${width}px): Details in the rail, the main column beside it from the top`, async ({ page, isMobile }) => {
      test.skip(!!isMobile, 'the phone layout is the next test')
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/widgets/1')
      const rail = page.getByRole('complementary', { name: 'Wireless Mouse details' })
      await expect(rail.getByRole('region', { name: 'Details' })).toBeVisible()

      const header = await page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) }).boundingBox()
      const details = await page.getByRole('region', { name: 'Details' }).boundingBox()
      const description = await page.getByRole('region', { name: 'Description' }).boundingBox()
      expect(description!.y).toBeGreaterThan(header!.y + header!.height)
      expect(Math.abs(description!.y - details!.y)).toBeLessThan(2)
      expect(description!.x + description!.width).toBeLessThan(details!.x)
      // The whole content area: the header reaches the rail's right edge.
      expect(Math.abs(header!.x + header!.width - (details!.x + details!.width))).toBeLessThan(2)

      // The rail is narrow, so each label sits above its value.
      const label = await page.locator('dt').getByText('Category', { exact: true }).boundingBox()
      const value = await fieldValue(page, 'Category').boundingBox()
      expect(value!.y).toBeGreaterThanOrEqual(label!.y + label!.height)
      const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
      expect(pageOverflows).toBe(false)
    })
  }

  test('phone width: labels above values, the rail first, nothing scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 })
    await page.goto('/widgets/1')
    await expect(page.getByRole('heading', { level: 1, name: 'Wireless Mouse' })).toBeVisible()

    const label = await page.locator('dt').getByText('Category', { exact: true }).boundingBox()
    const value = await fieldValue(page, 'Category').boundingBox()
    expect(value!.y).toBeGreaterThanOrEqual(label!.y + label!.height)

    const details = await page.getByRole('region', { name: 'Details' }).boundingBox()
    const description = await page.getByRole('region', { name: 'Description' }).boundingBox()
    expect(description!.y).toBeGreaterThanOrEqual(details!.y + details!.height)

    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Delete' })).toBeInViewport()
    const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(pageOverflows).toBe(false)
  })
})
