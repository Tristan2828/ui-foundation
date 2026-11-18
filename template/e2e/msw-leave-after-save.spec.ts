import type { CDPSession, Page } from '@playwright/test'
import { expect, test } from '@tristan2828/ui-foundation/testing'

// A test that leaves a page right after a save. The save is answered by
// the mocks, but its follow-up refresh is sent once the page has started
// to unload, when MSW's client has already told the worker it's gone, so
// the worker passes the refresh to the network (the preview's proxy, a dead
// port during e2e) and the bypass check fails the test (unless the page lives long enough
// for #367's rejoin to make it again, which a test that has moved on
// doesn't wait for). One app saw it
// about 1 run in 20. The page's goto() and reload() (withBootWait) now
// first wait until none of the page's /api/ requests has been in flight for
// 150 ms, so the refresh lands on the page that sent it.
//
// Forced here: the save's PATCH is held 300 ms, and the next page's
// document is held 1 s over CDP, so the old page is still alive (and has
// said goodbye to the worker) when the refresh goes out. The first test is
// the control: the same leave, made without goto(), leaks the refresh.

test.skip(process.env.VITE_API === 'real', 'Mock mode only: the real build has no MSW.')

// Holds every document request of the page for `ms` before letting it go.
// Over CDP, not page.route(), which would exempt the test from the check.
async function holdDocuments(page: Page, ms: number): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page)
  cdp.on('Fetch.requestPaused', ({ requestId }) => {
    setTimeout(() => void cdp.send('Fetch.continueRequest', { requestId }).catch(() => {}), ms)
  })
  await cdp.send('Fetch.enable', { patterns: [{ resourceType: 'Document', requestStage: 'Request' }] })
  return cdp
}

async function startSlowSave(page: Page) {
  await page.goto('/widgets/1/edit')
  await expect(page.locator('#widget-name')).toBeVisible()
  await page.waitForFunction(() => window.__msw !== undefined)
  await page.evaluate(() => {
    const { worker, http, delay } = window.__msw
    worker.use(
      http.patch('*/api/widgets/1', async () => {
        await delay(300)
      }),
    )
  })
  await holdDocuments(page, 1000)
  await page.locator('#widget-name').fill('Saved Then Left')
  await page.getByRole('button', { name: 'Save changes' }).click()
}

// Every /api/ answer that didn't come from the worker, healed or not: in
// the case this covers the page is gone before #367's rejoin could make
// the request again, so any answer from the network is the leak.
function pastMsw(page: Page): string[] {
  const seen: string[] = []
  page.on('response', (response) => {
    const url = new URL(response.url())
    if (url.pathname.startsWith('/api/') && !response.fromServiceWorker()) seen.push(`${response.status()} ${url.pathname}${url.search}`)
  })
  return seen
}

test.describe('leaving a page right after a save', () => {
  test.describe('control: a leave made without goto()', () => {
    test.use({ mswBypass: 'allow' })

    test("sends the save's refresh past the mocks", async ({ page }) => {
      const leaked = pastMsw(page)
      await startSlowSave(page)
      await page.evaluate(() => window.location.assign('/'))
      await expect(page.getByRole('main').first()).toBeVisible()
      await expect(page.locator('#widget-name')).toHaveCount(0)
      expect(leaked).toContain('502 /api/widgets/1')
    })
  })

  test("goto() waits for the save's refresh, which stays on the mocks", async ({ page }) => {
    const leaked = pastMsw(page)
    await startSlowSave(page)
    await page.goto('/')
    await expect(page.getByRole('main').first()).toBeVisible()
    await expect(page.locator('#widget-name')).toHaveCount(0)
    expect(leaked).toEqual([])
  })
})
