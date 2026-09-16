import { test, expect } from '@playwright/test'

// Phase 2 exit criterion: the app serves Page<Widget>-shaped data from MSW
// with no backend process running at all. Runs against Playwright's
// preview (production) build, so MSW must be active there too — see the
// VITE_API flag in src/main.tsx.
test('MSW serves the widgets contract with no backend process running', async ({ page }) => {
  await page.goto('/')
  // .ready resolves once the worker is activated, but the current page isn't
  // guaranteed to be its controller (and therefore have its fetches
  // intercepted) in that same tick — waiting on .controller is the actual
  // precondition for interception and is what removed this test's
  // under-load flakiness (intermittent under heavy parallel test workers).
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

  const result = await page.evaluate(async () => {
    const res = await fetch('/api/widgets?offset=0&limit=20')
    return { status: res.status, body: await res.json() }
  })

  expect(result.status).toBe(200)
  expect(Array.isArray(result.body.items)).toBe(true)
  expect(typeof result.body.total).toBe('number')
})
