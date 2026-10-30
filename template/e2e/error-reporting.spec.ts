import type { Page, Request } from '@playwright/test'
import { expect, forceLoggedOut, forceMswOverride, test } from '@tristan2828/ui-foundation/testing'

// Error reporting (FoundationProviders' errorReporting, on in src/main.tsx):
// a server failure or a crashed screen is posted to POST /api/client-errors,
// with the route's pattern and never a query string; expected failures
// and signed-out pages send nothing.
function reportsOf(page: Page): Request[] {
  const reports: Request[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/client-errors') reports.push(request)
  })
  return reports
}

test.describe('error reporting', () => {
  test('a server failure of the widgets list is reported once, with the route pattern and no query string', async ({
    page,
  }) => {
    const reports = reportsOf(page)
    await forceMswOverride(page, { method: 'get', path: '*/api/widgets', status: 500, body: { detail: 'Database is down' } })
    await page.goto('/widgets?search=alice&page=1')
    await expect(page.getByText('Database is down')).toBeVisible()
    await expect.poll(() => reports.length).toBe(1)
    const body = reports[0].postDataJSON()
    expect(body).toMatchObject({
      source: 'query',
      type: 'ServerError',
      message: 'Database is down',
      method: 'GET',
      status: 500,
      route: '/widgets',
    })
    expect(JSON.stringify(body)).not.toContain('alice')
    // And once only.
    await page.waitForTimeout(500)
    expect(reports).toHaveLength(1)
  })

  test("a record's server failure names the pattern, not the id", async ({ page }) => {
    const reports = reportsOf(page)
    await forceMswOverride(page, { method: 'get', path: '*/api/widgets/2', status: 500, body: { detail: 'Internal server error' } })
    await page.goto('/widgets/2')
    await expect.poll(() => reports.length).toBe(1)
    expect(reports[0].postDataJSON()).toMatchObject({ source: 'query', status: 500, route: '/widgets/:id' })
  })

  test('an expected failure (a record that isn’t there) sends nothing', async ({ page }) => {
    const reports = reportsOf(page)
    await forceMswOverride(page, { method: 'get', path: '*/api/widgets/2', status: 404, body: { detail: 'Not found' } })
    await page.goto('/widgets/2')
    await expect(page.locator('[data-state="error"], [data-state="notfound"]').first()).toBeVisible()
    await page.waitForTimeout(500)
    expect(reports).toEqual([])
  })

  test('signed out, nothing is sent', async ({ page }) => {
    const reports = reportsOf(page)
    await forceLoggedOut(page)
    await page.goto('/login')
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error('a stray error on the login page')
      })
    })
    await page.waitForTimeout(500)
    expect(reports).toEqual([])
  })

  test('an uncaught error while signed in is reported', async ({ page }) => {
    const reports = reportsOf(page)
    await page.goto('/widgets')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
    await page.evaluate(() => {
      setTimeout(() => {
        throw new TypeError('a stray error on https://example.com/x?token=abc')
      })
    })
    await expect.poll(() => reports.length).toBe(1)
    const body = reports[0].postDataJSON()
    expect(body).toMatchObject({ source: 'window', type: 'TypeError', route: '/widgets' })
    expect(body.message).toBe('a stray error on https://example.com/x')
  })
})
