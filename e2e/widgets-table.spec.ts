import { expect, test, type Page } from '@playwright/test'

// Forces the widgets list's *first* request via `page.addInitScript` —
// registering the override this way, before any of the page's own scripts
// run, means it applies before the app's first fetch, not a race against it.
// See src/mocks/e2e-hooks.ts.
async function forceWidgetsListOverride(
  page: Page,
  override: { status?: number; body?: unknown; delayMs?: number },
) {
  await page.addInitScript((o) => {
    window.__E2E_MSW_OVERRIDE__ = { method: 'get', path: '*/api/widgets', ...o }
  }, override)
}

// For an override registered *after* the page has already loaded (e.g. on a
// mutation triggered by a later click): window.__msw is only set once
// src/main.tsx's enableMocking() finishes, which page.goto's load event
// does not wait for.
async function waitForMswReady(page: Page) {
  await page.waitForFunction(() => window.__msw !== undefined)
}

test.describe('widgets table', () => {
  test('loading: a delayed response shows the skeleton first', async ({ page }) => {
    await forceWidgetsListOverride(page, { delayMs: 1000, body: { items: [], total: 0 } })
    await page.goto('/widgets')
    await expect(page.locator('[data-state="loading"]')).toBeVisible()
    await expect(page.getByText('No widgets yet')).toBeVisible()
  })

  test('empty: a page with no rows shows the empty state', async ({ page }) => {
    await forceWidgetsListOverride(page, { body: { items: [], total: 0 } })
    await page.goto('/widgets')
    await expect(page.getByText('No widgets yet')).toBeVisible()
    // Base UI's Button forces role="button" via ARIA even when it renders
    // as a react-router <Link> (nativeButton={false}) — it's not role=link.
    await expect(page.getByRole('button', { name: 'Create widget' })).toBeVisible()
  })

  test('error: a 500 response shows the error state', async ({ page }) => {
    await forceWidgetsListOverride(page, { status: 500, body: { detail: 'Internal error' } })
    await page.goto('/widgets')
    await expect(page.getByText('Something went wrong')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  test('validation: a 422 on delete surfaces the message without breaking the table', async ({
    page,
  }) => {
    await page.goto('/widgets')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
    await waitForMswReady(page)

    await page.evaluate(() => {
      const { worker, http, HttpResponse } = window.__msw
      worker.use(
        http.delete('*/api/widgets/:id', () =>
          HttpResponse.json(
            {
              detail: [
                {
                  loc: ['body', 'id'],
                  msg: 'cannot delete a widget with active assignments',
                  type: 'value_error',
                },
              ],
            },
            { status: 422 },
          ),
        ),
      )
    })

    await page.getByRole('button', { name: 'Delete Wireless Mouse' }).click()
    await page.getByRole('button', { name: 'Delete' }).click()

    // toAppError() deliberately gives every 422 the same generic message —
    // the specifics live in fieldErrors, for a form to bind per-field. This
    // screen has no field to bind to, so the toast shows that generic text,
    // not the server's specific "active assignments" reason.
    await expect(page.getByText('Validation failed')).toBeVisible()

    // The confirmation dialog deliberately stays open on error (only
    // onSuccess closes it) — Base UI correctly makes the page behind an
    // open modal inert, so the table row is unreachable until it's closed.
    await page.getByRole('button', { name: 'Cancel' }).click()
    // The AppError translation didn't crash the screen — the row is still there.
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
  })

  test('sort and filters live in the URL and survive the edit round trip', async ({ page }) => {
    await page.goto('/widgets')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Name' }).click()
    await expect(page.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'ascending')
    await page.getByLabel('Search widgets').fill('mouse')
    await expect(page).toHaveURL(/[?&]search=mouse/)
    await expect(page).toHaveURL(/[?&]sort=name%3Aasc|[?&]sort=name:asc/)
    await expect(page.getByRole('cell', { name: 'Standing Desk', exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: 'Edit Wireless Mouse' }).click()
    await expect(page).toHaveURL('/widgets/1/edit')
    await page.goBack()

    await expect(page.getByLabel('Search widgets')).toHaveValue('mouse')
    await expect(page.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'ascending')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Standing Desk', exact: true })).toHaveCount(0)
  })

  test('search sends one request once typing pauses, not one per keystroke', async ({ page }) => {
    await page.goto('/widgets')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
    await waitForMswReady(page)
    await page.evaluate(() => {
      const counter = window as unknown as { __searchRequests: number }
      counter.__searchRequests = 0
      window.__msw.worker.events.on('request:start', ({ request }) => {
        const url = new URL(request.url)
        if (url.pathname === '/api/widgets' && url.searchParams.has('search')) counter.__searchRequests++
      })
    })

    await page.getByLabel('Search widgets').pressSequentially('mouse', { delay: 50 })
    await expect(page.getByRole('cell', { name: 'Standing Desk', exact: true })).toHaveCount(0)

    const requests = await page.evaluate(() => (window as unknown as { __searchRequests: number }).__searchRequests)
    expect(requests).toBe(1)
  })

  test('a page past the end (stale link, or last row deleted) falls back to the last page', async ({ page }) => {
    await page.goto('/widgets?page=2')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
    await expect(page).toHaveURL('/widgets')
    await expect(page.getByText('No widgets yet')).toHaveCount(0)
  })

  test('multi choice filter: picking tags filters to widgets with any of them, via the URL', async ({
    page,
  }) => {
    await page.goto('/widgets')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()

    await page.getByLabel('Filter by tags').click()
    await page.getByRole('option', { name: 'bulky', exact: true }).click()
    await page.keyboard.press('Escape')

    await expect(page).toHaveURL(/[?&]tags=bulky/)
    await expect(page.getByRole('cell', { name: 'Standing Desk', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toHaveCount(0)

    // A shared or reloaded link restores the same filter.
    await page.reload()
    await expect(page.getByRole('button', { name: 'Remove bulky' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toHaveCount(0)
  })

  test('success: the default MSW data renders in the table', async ({ page }) => {
    await page.goto('/widgets')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Standing Desk', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Fountain Pen', exact: true })).toBeVisible()
    await expect(page.getByText('1–3 of 3')).toBeVisible()
  })
})
