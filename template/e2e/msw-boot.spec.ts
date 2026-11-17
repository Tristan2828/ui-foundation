import type { Page } from '@playwright/test'
import { MOCK_PROBE_PATH } from '@tristan2828/ui-foundation/mocks'
import { expect, expectDataViewsLoaded, test } from '@tristan2828/ui-foundation/testing'

// Mock mode's boot (startMockWorker in the foundation's mocks): a mock
// service worker that the browser stops and starts again after the page
// joined it forgets the page and passes every request to the network, so
// an app's first queries came back from the network instead of the mocks.
// Forced here: the page's first fetch waits until the test has stopped
// every service worker over CDP, so it meets a restarted worker. The app
// still boots on the mocks, and no /api/ answer comes from anywhere else.

test.skip(process.env.VITE_API === 'real', 'Mock mode only: the real build has no MSW.')

type Held = { __firstFetchHeld?: boolean; __releaseFirstFetch?: () => void }

test('a mock worker restarted before the first request still serves the app', async ({ page }) => {
  await page.addInitScript(() => {
    const real = window.fetch.bind(window)
    let release = () => {}
    const released = new Promise<void>((resolve) => (release = resolve))
    const held = window as unknown as Held
    held.__releaseFirstFetch = () => release()
    window.fetch = async (input, init) => {
      held.__firstFetchHeld = true
      await released
      return real(input, init)
    }
  })
  const pastMsw: string[] = []
  page.on('response', (response) => {
    if (response.url().includes('/api/') && !response.fromServiceWorker()) pastMsw.push(response.url())
  })

  const loaded = page.goto('/')
  await page.waitForFunction(() => (window as unknown as Held).__firstFetchHeld === true)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('ServiceWorker.enable')
  await cdp.send('ServiceWorker.stopAllWorkers')
  await page.evaluate(() => (window as unknown as Held).__releaseFirstFetch?.())
  await loaded

  await expect(page.getByRole('main').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible()
  expect(pastMsw).toEqual([])
})

// The same restart after boot (#367): the worker forgets the page mid-session
// and passes its next requests to the network (the preview's proxy, which
// points at a dead port during e2e). The page notices a request the worker
// never handed to MSW, joins again, and makes it once more, so the screen
// still shows the mocks' data. The test's own fixture (watchMswBypass) then
// passes, since every bypassed request was answered by the worker after.

// What reached the network past the worker, and the rejoin's probes, from
// the moment it's called.
function watchWorker(page: Page) {
  const pastMsw: string[] = []
  let probes = 0
  page.on('response', (response) => {
    if (response.url().includes('/api/') && !response.fromServiceWorker()) pastMsw.push(response.url())
  })
  page.on('request', (request) => {
    if (request.url().includes(MOCK_PROBE_PATH)) probes += 1
  })
  return { pastMsw, probes: () => probes }
}

async function openWidgets(page: Page) {
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Widgets' }).click()
  await expectDataViewsLoaded(page)
  await expect(page.getByRole('row').nth(1)).toBeVisible()
}

test('a mock worker restarted after boot rejoins, and the next page still runs on the mocks', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('main').first()).toBeVisible()
  const worker = watchWorker(page)

  const cdp = await page.context().newCDPSession(page)
  await cdp.send('ServiceWorker.enable')
  await cdp.send('ServiceWorker.stopAllWorkers')
  await openWidgets(page)

  // The restart really happened: something went past the worker, and the
  // page probed its way back.
  expect(worker.pastMsw.length).toBeGreaterThan(0)
  expect(worker.probes()).toBeGreaterThan(0)
})

test('a page whose worker never restarts never probes after boot', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('main').first()).toBeVisible()
  const worker = watchWorker(page)

  await openWidgets(page)
  await page.reload()
  await openWidgets(page)

  expect(worker.pastMsw).toEqual([])
  // Each reload boots once more, with one probe; none after.
  expect(worker.probes()).toBe(1)
})
