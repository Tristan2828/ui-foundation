import { test, expect } from '@playwright/test'

// Phase 2 exit criterion: the app serves Page<Widget>-shaped data from MSW
// with no backend process running at all. Runs against Playwright's
// preview (production) build, so MSW must be active there too — see the
// VITE_API flag in src/main.tsx.
test('MSW serves the widgets contract with no backend process running', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)

  const result = await page.evaluate(async () => {
    const res = await fetch('/api/widgets?offset=0&limit=20')
    return { status: res.status, body: await res.json() }
  })

  expect(result.status).toBe(200)
  expect(Array.isArray(result.body.items)).toBe(true)
  expect(typeof result.body.total).toBe('number')
})
