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

  test('success: a valid submission creates the widget and returns to the table', async ({
    page,
  }) => {
    await page.goto('/widgets/new')

    await page.locator('#widget-name').fill('Playwright Success Widget')
    await pickCategory(page, 'Furniture')
    await pickAvailableFromDate(page)
    await page.locator('#widget-price').fill('9.99')
    await page.locator('#widget-description').fill('Created by the success e2e test.')
    await page.getByRole('button', { name: 'Create widget' }).click()

    await expect(page).toHaveURL(/\/widgets$/)
    await expect(
      page.getByRole('cell', { name: 'Playwright Success Widget', exact: true }),
    ).toBeVisible()
  })
})
