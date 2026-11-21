// watchMswBypass: an /api/ answer that didn't come from the mock
// service worker fails the test, unless the test routes requests itself,
// the app runs on the real API, or the same request was then answered by
// the worker (the rejoin healed it). The Page is a stand-in whose responses
// the test emits; the template's e2e/msw-boot.spec.ts runs it in a browser.
import { describe, expect, it, vi } from 'vitest'

vi.mock('@playwright/test', () => ({ test: { extend: () => ({}) }, expect: () => {} }))
vi.mock('@axe-core/playwright', () => ({ default: class {} }))

const { watchMswBypass } = await import('../src/testing')

const ORIGIN = 'http://localhost:4180'

type Listener = (response: unknown) => void

function fakePage() {
  let listener: Listener = () => {}
  const route = () => vi.fn(async (pattern: string, handler: () => void) => void [pattern, handler])
  const context = { route: route(), routeFromHAR: vi.fn(async () => {}) }
  const page = {
    url: () => `${ORIGIN}/widgets`,
    on: (_event: string, next: Listener) => (listener = next),
    context: () => context,
    route: route(),
    routeFromHAR: vi.fn(async () => {}),
  }
  const respond = (path: string, { fromServiceWorker, status = 200, method = 'GET', origin = ORIGIN }: { fromServiceWorker: boolean; status?: number; method?: string; origin?: string }) =>
    listener({
      url: () => `${origin}${path}`,
      fromServiceWorker: () => fromServiceWorker,
      status: () => status,
      request: () => ({ method: () => method }),
    })
  return { page, context, respond }
}

describe('watchMswBypass', () => {
  it('fails naming each /api/ answer that came from the network', () => {
    const { page, respond } = fakePage()
    const watch = watchMswBypass(page as never, { mockMode: true })
    respond('/api/widgets?page=1', { fromServiceWorker: true })
    respond('/api/widgets?page=2', { fromServiceWorker: false, status: 502 })
    respond('/assets/index.js', { fromServiceWorker: false })
    respond('/api/elsewhere', { fromServiceWorker: false, origin: 'https://api.example.com' })
    expect(watch.bypassed()).toEqual(['GET /api/widgets?page=2 answered 502 without MSW'])
    expect(() => watch.check()).toThrow(/GET \/api\/widgets\?page=2 answered 502 without MSW/)
  })

  it('passes once the worker answered the same request again (the rejoin healed it)', () => {
    const { page, respond } = fakePage()
    const watch = watchMswBypass(page as never, { mockMode: true })
    respond('/api/widgets', { fromServiceWorker: false, status: 502, method: 'POST' })
    respond('/api/widgets', { fromServiceWorker: true, method: 'GET' })
    expect(() => watch.check()).toThrow(/POST/)
    respond('/api/widgets', { fromServiceWorker: true, method: 'POST' })
    expect(() => watch.check()).not.toThrow()
  })

  it('leaves a test alone that routes requests itself, on the page or its context', async () => {
    for (const routeVia of ['page', 'context'] as const) {
      const { page, context, respond } = fakePage()
      const watch = watchMswBypass(page as never, { mockMode: true })
      const target = routeVia === 'page' ? page : context
      await target.route('**/api/widgets', () => {})
      expect(watch.routed()).toBe(true)
      respond('/api/widgets', { fromServiceWorker: false })
      expect(() => watch.check()).not.toThrow()
    }
  })

  it('checks nothing against the real API', () => {
    const { page, respond } = fakePage()
    const watch = watchMswBypass(page as never, { mockMode: false })
    respond('/api/widgets', { fromServiceWorker: false })
    expect(() => watch.check()).not.toThrow()
  })
})
