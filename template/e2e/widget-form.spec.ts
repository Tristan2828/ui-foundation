import { expect, test, type Page } from '@playwright/test'

// Forces widget id 2's (Standing Desk) *first* GET via page.addInitScript —
// see e2e/widgets-table.spec.ts and src/mocks/e2e-hooks.ts for why this
// can't be a post-navigation worker.use() call for a first-load state.
async function forceWidgetGetOverride(
  page: Page,
  override: { status?: number; body?: unknown; delayMs?: number },
) {
  await page.addInitScript((o) => {
    window.__E2E_MSW_OVERRIDE__ = { method: 'get', path: '*/api/widgets/2', ...o }
  }, override)
}

// For an override registered *after* the page has already loaded: see
// e2e/widgets-table.spec.ts's waitForMswReady for why this wait is needed.
async function waitForMswReady(page: Page) {
  await page.waitForFunction(() => window.__msw !== undefined)
}

// A value on the widget's view, where every save lands: the <dd> beside
// its exact label.
function fieldValue(page: Page, label: string) {
  return page
    .locator('dl > div')
    .filter({ has: page.locator('dt').getByText(label, { exact: true }) })
    .locator('dd')
}

async function pickCategory(page: Page, name: string) {
  await page.locator('#widget-category').click()
  await page.getByRole('option', { name }).click()
}

async function pickAvailableFromDate(page: Page) {
  await page.locator('#widget-available-from').click()
  // "Today" is always present in the currently-open month, regardless of
  // what day the suite runs on — avoids a hardcoded date going stale.
  await page.getByRole('button', { name: /^Today,/ }).click()
}

// Multi choice: open the chips input and pick an option; Escape closes the
// list, which stays open between picks in multiple mode.
// Multi reference: type to search the server, pick the match, close the
// list. The search is the server's (GET /widget-categories?search=...).
async function pickExtraCategory(page: Page, search: string, name: string) {
  await page.locator('#widget-extra-categories').fill(search)
  await page.getByRole('option', { name, exact: true }).click()
  await page.keyboard.press('Escape')
}

// Multi choice: options and chips show each tag's label (WIDGET_TAG_LABELS),
// never its wire value.
async function pickTag(page: Page, name: string) {
  await page.locator('#widget-tags').click()
  await page.getByRole('option', { name, exact: true }).click()
  await page.keyboard.press('Escape')
}

test.describe('widget form', () => {
  test('loading: editing shows a skeleton before the widget loads', async ({ page }) => {
    await forceWidgetGetOverride(page, {
      delayMs: 1000,
      body: {
        id: 2,
        name: 'Standing Desk',
        categoryId: 2,
        status: 'draft',
        availableFrom: '2026-03-01T00:00:00Z',
        assigneeEmail: null,
        price: '349.00',
        description: 'Electric height-adjustable desk, 120x60cm top.',
      },
    })
    await page.goto('/widgets/2/edit')
    await expect(page.locator('[data-state="loading"]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Edit Widget' })).toBeVisible()
  })

  test('empty: a null assignee renders as an empty field, not a placeholder value', async ({
    page,
  }) => {
    // Standing Desk (id 2) has assigneeEmail: null in the default mock data
    // — openapi.yaml's own comment names this the nullable field's
    // "empty-state display" forcing case (see src/routes/widgets/widget-schema.ts).
    await page.goto('/widgets/2/edit')
    await expect(page.getByRole('heading', { name: 'Edit Widget' })).toBeVisible()
    await expect(page.locator('#widget-assignee')).toHaveValue('')
  })

  test('error: a 404 shows the error state instead of a broken form', async ({ page }) => {
    await forceWidgetGetOverride(page, { status: 404, body: { detail: 'Widget 2 not found' } })
    await page.goto('/widgets/2/edit')
    await expect(page.getByText('Not found', { exact: true })).toBeVisible()
    await expect(page.getByText('Widget 2 not found')).toBeVisible()
  })

  test('validation: a 422 on submit binds the message to the right field', async ({ page }) => {
    await page.goto('/widgets/new')
    await waitForMswReady(page)

    await page.evaluate(() => {
      const { worker, http, HttpResponse } = window.__msw
      worker.use(
        http.post('*/api/widgets', () =>
          HttpResponse.json(
            {
              detail: [{ loc: ['body', 'price'], msg: 'must be greater than zero', type: 'value_error' }],
            },
            { status: 422 },
          ),
        ),
      )
    })

    await page.locator('#widget-name').fill('Validation Test Widget')
    await pickCategory(page, 'Electronics')
    await pickAvailableFromDate(page)
    await page.locator('#widget-price').fill('19.99')
    await page.locator('#widget-description').fill('Exercises the 422 -> fieldErrors path.')
    await page.getByRole('button', { name: 'Create widget' }).click()

    await expect(page.getByText('must be greater than zero')).toBeVisible()
    // Still on the form — a validation error must not navigate away.
    await expect(page.getByRole('heading', { name: 'New Widget' })).toBeVisible()
  })

  test('success: a valid submission creates the widget and opens its view', async ({
    page,
  }) => {
    await page.goto('/widgets/new')

    await page.locator('#widget-name').fill('Playwright Success Widget')
    await pickCategory(page, 'Furniture')
    await pickAvailableFromDate(page)
    await page.locator('#widget-price').fill('9.99')
    await page.locator('#widget-description').fill('Created by the success e2e test.')
    await pickTag(page, 'Bulky')
    await pickTag(page, 'Seasonal')
    await page.getByRole('button', { name: 'Create widget' }).click()

    // The new widget's own view (the four seeded widgets are ids 1–4).
    await expect(page).toHaveURL('/widgets/5')
    await expect(page.getByRole('heading', { level: 1, name: 'Playwright Success Widget' })).toBeVisible()
    await expect(fieldValue(page, 'Tags')).toHaveText('BulkySeasonal')

    // And it's in the table.
    await page.getByRole('main').getByRole('link', { name: 'Widgets', exact: true }).click()
    await expect(page.getByRole('cell', { name: 'Playwright Success Widget', exact: true })).toBeVisible()
  })

  test('cancel: leaving a new widget unsaved goes back to the list', async ({ page }) => {
    await page.goto('/widgets/new')
    await page.locator('#widget-name').fill('Never Saved')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page).toHaveURL('/widgets')
    await expect(page.getByRole('cell', { name: 'Never Saved', exact: true })).toHaveCount(0)
  })

  test('multi choice: existing tags are removable chips, and the edited set is what saves', async ({
    page,
  }) => {
    await page.goto('/widgets/1/edit')
    await expect(page.getByRole('button', { name: 'Remove Fragile' })).toBeVisible()

    await page.getByRole('button', { name: 'Remove Fragile' }).click()
    await pickTag(page, 'Featured')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page).toHaveURL('/widgets/1')
    await expect(fieldValue(page, 'Tags')).toHaveText('Featured')
  })

  test('multi reference: picks found by searching save, and show by name in the table', async ({ page }) => {
    await page.goto('/widgets/new')
    await page.locator('#widget-name').fill('Linked Widget')
    await pickCategory(page, 'Electronics')
    await pickAvailableFromDate(page)
    await page.locator('#widget-price').fill('3.00')
    await page.locator('#widget-description').fill('Has two extra categories.')
    await pickExtraCategory(page, 'furn', 'Furniture')
    await pickExtraCategory(page, 'stat', 'Stationery')
    await expect(page.getByRole('button', { name: 'Remove Furniture' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove Stationery' })).toBeVisible()
    await page.getByRole('button', { name: 'Create widget' }).click()

    await expect(page).toHaveURL(/\/widgets\/\d+$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Linked Widget' })).toBeVisible()
    await expect(fieldValue(page, 'Extra Categories')).toHaveText('FurnitureStationery')
  })

  test('multi reference: saved picks keep their names while a search shows other records', async ({ page }) => {
    // Standing Desk (id 2) links Electronics and Stationery. Searching
    // "furn" returns only Furniture, so the two chips' names must come from
    // the lookup by id, not from the search results.
    await page.goto('/widgets/2/edit')
    await expect(page.getByRole('button', { name: 'Remove Electronics' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove Stationery' })).toBeVisible()

    await page.locator('#widget-extra-categories').fill('furn')
    await expect(page.getByRole('option', { name: 'Furniture', exact: true })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Electronics', exact: true })).toHaveCount(0)
    // The open list makes the rest of the form inert, so the chips are
    // matched by their visible text rather than by role.
    const chips = page.locator('[data-slot="combobox-chip"]')
    await expect(chips.filter({ hasText: /^Electronics$/ })).toBeVisible()
    await expect(chips.filter({ hasText: /^Stationery$/ })).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Remove Electronics' }).click()
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page).toHaveURL('/widgets/2')
    await expect(fieldValue(page, 'Extra Categories')).toHaveText('Stationery')
  })

  test('multi reference: Enter before the search answers waits, and never removes a pick', async ({ page }) => {
    // Standing Desk (id 2) has Electronics and Stationery. The list opens
    // on every category, Electronics (already picked) highlighted. Typing
    // "furn" starts a slow search: until it answers, the list still shows
    // that old list, and Enter there used to unpick Electronics.
    await page.goto('/widgets/2/edit')
    await expect(page.getByRole('button', { name: 'Remove Electronics' })).toBeVisible()
    await waitForMswReady(page)
    await page.evaluate(() => {
      const { worker, http, delay } = window.__msw
      worker.use(
        http.get('*/api/widget-categories', async ({ request }) => {
          if (new URL(request.url).searchParams.get('search')) await delay(800)
        }),
      )
    })
    await page.locator('#widget-extra-categories').click()
    await expect(page.getByRole('option')).toHaveCount(3)
    await page.keyboard.type('furn')
    await expect(page.getByRole('listbox')).toHaveAttribute('aria-busy', 'true')
    await page.keyboard.press('Enter')
    // Nothing picked or unpicked while it searched (chips by text: the open
    // list makes the rest of the form inert).
    const chips = page.locator('[data-slot="combobox-chip"]')
    await expect(chips.filter({ hasText: /^Electronics$/ })).toBeVisible()
    await expect(chips.filter({ hasText: /^Furniture$/ })).toHaveCount(0)

    // Once it answers, its first match is highlighted and Enter picks it.
    const furniture = page.getByRole('option', { name: 'Furniture', exact: true })
    await expect(page.getByRole('option')).toHaveCount(1)
    await expect(furniture).toHaveAttribute('data-highlighted', '')
    await expect(page.getByRole('listbox')).not.toHaveAttribute('aria-busy', 'true')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Remove Furniture' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove Electronics' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove Stationery' })).toBeVisible()
  })

  test('multi reference: a 422 on the field binds to it', async ({ page }) => {
    await page.goto('/widgets/1/edit')
    await expect(page.getByRole('button', { name: 'Remove Stationery' })).toBeVisible()
    await waitForMswReady(page)
    await page.evaluate(() => {
      const { worker, http, HttpResponse } = window.__msw
      worker.use(
        http.patch('*/api/widgets/1', () =>
          HttpResponse.json(
            { detail: [{ loc: ['body', 'extraCategoryIds'], msg: 'unknown category ids: [99]', type: 'value_error.foreign_key' }] },
            { status: 422 },
          ),
        ),
      )
    })
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('unknown category ids: [99]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Edit Widget' })).toBeVisible()
  })

  test('sub-records: a saved checklist loads in order, and add, tick, reorder and remove all save', async ({
    page,
  }) => {
    // Wireless Mouse (id 1): "Charge the battery" (done), "Pair the receiver".
    await page.goto('/widgets/1/edit')
    await expect(page.getByLabel('Item 1 text')).toHaveValue('Charge the battery')
    await expect(page.getByLabel('Item 1 done')).toBeChecked()
    await expect(page.getByLabel('Item 2 text')).toHaveValue('Pair the receiver')
    await expect(page.getByLabel('Item 2 done')).not.toBeChecked()
    // The first row can't move up, the last can't move down.
    await expect(page.getByRole('button', { name: 'Move item 1 up' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Move item 2 down' })).toBeDisabled()

    await page.getByRole('button', { name: 'Add item' }).click()
    // The new row's text box takes focus, ready to type.
    await expect(page.getByLabel('Item 3 text')).toBeFocused()
    await page.keyboard.type('Test the scroll wheel')
    await page.getByLabel('Item 3 done').click()
    await page.getByRole('button', { name: 'Move item 3 up' }).click()
    await expect(page.getByLabel('Item 2 text')).toHaveValue('Test the scroll wheel')
    await page.getByRole('button', { name: 'Remove item 1' }).click()
    await expect(page.getByLabel('Item 1 text')).toHaveValue('Test the scroll wheel')
    await page.getByRole('button', { name: 'Save changes' }).click()

    // The view shows the saved list in its new order.
    await expect(page).toHaveURL('/widgets/1')
    const checklist = page.getByRole('region', { name: 'Checklist' })
    await expect(checklist.getByText('1/2 done', { exact: true })).toBeVisible()
    await expect(checklist.getByRole('listitem')).toHaveText(['Test the scroll wheel', 'Pair the receiver'])
    await expect(checklist.getByRole('checkbox', { name: 'Done: Test the scroll wheel' })).toBeChecked()

    // Reopening shows the saved order. Through the view's Edit button, not
    // page.goto: a full load restarts the mocks with their seed data.
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page.getByLabel('Item 1 text')).toHaveValue('Test the scroll wheel')
    await expect(page.getByLabel('Item 1 done')).toBeChecked()
    await expect(page.getByLabel('Item 2 text')).toHaveValue('Pair the receiver')
    await expect(page.getByLabel('Item 3 text')).toHaveCount(0)
  })

  test('computed field: never on the form, and recomputed by the server after a save', async ({ page }) => {
    await page.goto('/widgets/1/edit')
    await expect(page.getByText('In progress')).toHaveCount(0)
    // Ticking the last open item makes the whole checklist complete.
    await page.getByLabel('Item 2 done').click()
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page).toHaveURL('/widgets/1')
    const header = page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) })
    await expect(header.getByText('Complete', { exact: true })).toBeVisible()
  })

  test('sub-records: an empty list says so, and a blank item is caught on its own row', async ({ page }) => {
    await page.goto('/widgets/2/edit')
    await expect(page.getByText('No items yet.')).toBeVisible()
    await page.getByRole('button', { name: 'Add item' }).click()
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('Write something or remove the item')).toBeVisible()
    await expect(page.getByLabel('Item 1 text')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('heading', { name: 'Edit Widget' })).toBeVisible()
  })

  test('sub-records: a server 422 inside one item binds to that row', async ({ page }) => {
    await page.goto('/widgets/1/edit')
    await expect(page.getByLabel('Item 2 text')).toHaveValue('Pair the receiver')
    await waitForMswReady(page)
    await page.evaluate(() => {
      const { worker, http, HttpResponse } = window.__msw
      worker.use(
        http.patch('*/api/widgets/1', () =>
          HttpResponse.json(
            { detail: [{ loc: ['body', 'checklist', 1, 'text'], msg: 'That step is not allowed', type: 'value_error' }] },
            { status: 422 },
          ),
        ),
      )
    })
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('That step is not allowed')).toBeVisible()
    await expect(page.getByLabel('Item 2 text')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Item 1 text')).not.toHaveAttribute('aria-invalid', 'true')
  })

  test('yes/no: a new widget starts in stock, and the switch state is what saves', async ({ page }) => {
    await page.goto('/widgets/new')
    const inStock = page.getByRole('switch', { name: 'In Stock' })
    // The default the API also applies: on.
    await expect(inStock).toBeChecked()

    // Clicking the label toggles it too: the label is wired to the switch.
    await page.getByText('In Stock', { exact: true }).click()
    await expect(inStock).not.toBeChecked()

    await page.locator('#widget-name').fill('Out Of Stock Widget')
    await pickCategory(page, 'Furniture')
    await pickAvailableFromDate(page)
    await page.locator('#widget-price').fill('5.00')
    await page.locator('#widget-description').fill('Saved with the switch off.')
    await page.getByRole('button', { name: 'Create widget' }).click()

    await expect(page).toHaveURL(/\/widgets\/\d+$/)
    await expect(page.getByRole('switch', { name: 'In stock' })).not.toBeChecked()
    await page.getByRole('main').getByRole('link', { name: 'Widgets', exact: true }).click()
    await expect(page.getByRole('switch', { name: 'In stock: Out Of Stock Widget' })).not.toBeChecked()
  })

  test('yes/no: editing shows the stored value, and turning it on saves', async ({ page }) => {
    // Fountain Pen (id 3) is out of stock in the mocks.
    await page.goto('/widgets/3/edit')
    const inStock = page.getByRole('switch', { name: 'In Stock' })
    await expect(inStock).not.toBeChecked()

    await inStock.click()
    await expect(inStock).toBeChecked()
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page).toHaveURL('/widgets/3')
    await expect(page.getByRole('switch', { name: 'In stock' })).toBeChecked()
  })
})
