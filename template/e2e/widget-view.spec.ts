import { expect, test, type Page } from '@playwright/test'
import { forceMswOverride, waitForMswReady } from '@tristan2828/ui-foundation/testing'

// The widget view (/widgets/:id): one test per state (loading, not found,
// error, success, the sparse record's empty values), then the ways in and
// out of it (the table's title link, Edit, Cancel, Delete) and its layout
// at phone width.

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

    // Header: status-like values as badges, and the actions.
    const header = page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) })
    await expect(header.getByText('active', { exact: true })).toBeVisible()
    await expect(header.getByText('In progress', { exact: true })).toBeVisible()
    await expect(header.getByRole('button', { name: 'Edit' })).toBeVisible()
    await expect(header.getByRole('button', { name: 'Delete' })).toBeVisible()

    // Details: names, never ids, for references; labels, never wire values.
    await expect(fieldValue(page, 'Category')).toHaveText('Electronics')
    await expect(fieldValue(page, 'Extra Categories')).toHaveText('Stationery')
    await expect(fieldValue(page, 'Tags')).toHaveText('Fragile')
    await expect(fieldValue(page, 'Available From')).toHaveText('Jan 15, 2026')
    await expect(fieldValue(page, 'Price')).toHaveText('$24.99')
    await expect(fieldValue(page, 'Assignee Email')).toHaveText('alice@example.com')
    await expect(fieldValue(page, 'In Stock')).toHaveText('Yes')

    // Sub-records, read-only: the done-count, then the items in order,
    // each with its state in words, and nothing to tick.
    const checklist = page.getByRole('region', { name: 'Checklist' })
    await expect(checklist.getByText('1/2 done', { exact: true })).toBeVisible()
    const items = checklist.getByRole('listitem')
    await expect(items).toHaveText(['Charge the battery', 'Pair the receiver'])
    await expect(items.nth(0).getByRole('img', { name: 'Done', exact: true })).toBeVisible()
    await expect(items.nth(1).getByRole('img', { name: 'Not done' })).toBeVisible()
    await expect(page.getByRole('checkbox')).toHaveCount(0)

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
    await expect(fieldValue(page, 'In Stock')).toHaveText('No')
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
    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(page).toHaveURL('/widgets/1/edit')
    await page.locator('#widget-name').fill('Wireless Mouse Pro')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page).toHaveURL('/widgets/1')
    await expect(page.getByRole('heading', { level: 1, name: 'Wireless Mouse Pro' })).toBeVisible()
  })

  test('edit: Cancel returns to the view, unchanged', async ({ page }) => {
    await page.goto('/widgets/1')
    await page.getByRole('button', { name: 'Edit' }).click()
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

  test('wide screens put each label beside its value', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'the phone layout is the next test')
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/widgets/1')
    const label = await page.locator('dt').getByText('Category', { exact: true }).boundingBox()
    const value = await fieldValue(page, 'Category').boundingBox()
    expect(label).not.toBeNull()
    expect(value).not.toBeNull()
    expect(value!.x).toBeGreaterThan(label!.x + label!.width)
    expect(Math.abs(value!.y - label!.y)).toBeLessThan(4)
  })

  test('phone width: labels above values, sections stacked, nothing scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 })
    await page.goto('/widgets/1')
    await expect(page.getByRole('heading', { level: 1, name: 'Wireless Mouse' })).toBeVisible()

    const label = await page.locator('dt').getByText('Category', { exact: true }).boundingBox()
    const value = await fieldValue(page, 'Category').boundingBox()
    expect(value!.y).toBeGreaterThanOrEqual(label!.y + label!.height)

    const details = await page.getByRole('region', { name: 'Details' }).boundingBox()
    const description = await page.getByRole('region', { name: 'Description' }).boundingBox()
    expect(description!.y).toBeGreaterThanOrEqual(details!.y + details!.height)

    await expect(page.getByRole('button', { name: 'Edit' })).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Delete' })).toBeInViewport()
    const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(pageOverflows).toBe(false)
  })
})
