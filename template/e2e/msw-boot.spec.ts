import { expect, test } from '@tristan2828/ui-foundation/testing'

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
