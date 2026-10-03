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

// A spec can stub what an <img> loads, not only JSON. A JSON body would
// make the <img> fire onError, which looks like the very failure such a
// test rules out, so the override takes a base64 body and a content type
// (src/mocks/e2e-hooks.ts). Through MSW, not page.route: Playwright's
// page.route doesn't intercept requests a service worker makes.
test('the e2e override can serve a binary body an <img> accepts', async ({ page }) => {
  await page.addInitScript(() => {
    window.__E2E_MSW_OVERRIDE__ = {
      method: 'get',
      path: '*/e2e-fixture.gif',
      // A 1x1 transparent GIF.
      bodyBase64: 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      contentType: 'image/gif',
    }
  })
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  // A controlled page isn't enough: main.tsx starts the worker first and
  // installs this override only after (exposeMswForE2E), so an image
  // requested in between went past MSW to the dev server and failed, now
  // and then. window.__msw is set in the same synchronous step that
  // installs the override.
  await page.waitForFunction(() => window.__msw !== undefined)

  const result = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const img = new Image()
        img.onload = () => resolve(`loaded ${img.naturalWidth}x${img.naturalHeight}`)
        img.onerror = () => resolve('error')
        img.src = '/e2e-fixture.gif'
      }),
  )

  expect(result).toBe('loaded 1x1')
})
