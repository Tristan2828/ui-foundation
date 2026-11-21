// guardFetch, the rejoin after boot: a request the mock worker never
// handed to MSW (no `request:start`) went to the network, so the page joins
// the worker again and makes it once more. The worker and the network are
// stand-ins here; the template's e2e/msw-boot.spec.ts restarts a real one.
import { describe, expect, it, vi } from 'vitest'
import { guardFetch, MOCK_PROBE_PATH } from '../src/mocks/start-worker'

const BASE = 'http://localhost:4180/widgets'

type Start = (args: { request: Request }) => void

function setup({ rejoins = true, controlled = true } = {}) {
  let onStart: Start = () => {}
  // Whether the stand-in worker knows the page: if so it hands each request
  // over (request:start) before answering, as MSW's worker does.
  let known = true
  const calls: string[] = []
  const pageFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(new URL(input instanceof Request ? input.url : String(input), BASE), init)
    calls.push(`${request.method} ${new URL(request.url).pathname}`)
    if (known) {
      onStart({ request })
      return new Response('mocked')
    }
    return new Response('proxy', { status: 502 })
  })
  const rejoin = vi.fn(async () => {
    if (rejoins) known = true
    return rejoins
  })
  const guarded = guardFetch({
    fetch: pageFetch as typeof fetch,
    events: { on: (_event, listener) => (onStart = listener) },
    controlled: () => controlled,
    rejoin,
    baseUrl: BASE,
  })
  return { guarded, rejoin, calls, forget: () => (known = false) }
}

describe('guardFetch', () => {
  it('passes a request the worker handed over straight through, with no rejoin', async () => {
    const { guarded, rejoin, calls } = setup()
    const response = await guarded('/api/widgets?page=2')
    expect(await response.text()).toBe('mocked')
    expect(rejoin).not.toHaveBeenCalled()
    expect(calls).toEqual(['GET /api/widgets'])
    // A Request keeps `patch` as given; the worker's copy is matched all the same.
    await guarded('/api/widgets/1#notes', { method: 'patch', body: '{}' })
    expect(rejoin).not.toHaveBeenCalled()
  })

  it('rejoins and makes a bypassed request once more', async () => {
    const { guarded, rejoin, calls, forget } = setup()
    forget()
    const response = await guarded('/api/widgets', { method: 'patch', body: '{"name":"a"}' })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('mocked')
    expect(rejoin).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['patch /api/widgets', 'patch /api/widgets'])
  })

  it('replays a Request whose body the first try read', async () => {
    const { guarded, forget } = setup()
    forget()
    const response = await guarded(new Request(`${BASE.replace('/widgets', '')}/api/widgets`, { method: 'POST', body: 'x' }))
    expect(await response.text()).toBe('mocked')
  })

  it('shares one rejoin between requests bypassed together', async () => {
    const { guarded, rejoin, forget } = setup()
    forget()
    const answers = await Promise.all(['/api/a', '/api/b', '/api/c', '/api/d', '/api/e'].map((path) => guarded(path)))
    expect(await Promise.all(answers.map((answer) => answer.text()))).toEqual(Array(5).fill('mocked'))
    expect(rejoin).toHaveBeenCalledTimes(1)
  })

  it('stands down after a rejoin fails: the bypassed answer stands, and no more rejoins', async () => {
    const { guarded, rejoin, forget } = setup({ rejoins: false })
    forget()
    expect((await guarded('/api/widgets')).status).toBe(502)
    expect((await guarded('/api/widgets')).status).toBe(502)
    expect(rejoin).toHaveBeenCalledTimes(1)
  })

  it('leaves an uncontrolled page and the probe alone', async () => {
    const uncontrolled = setup({ controlled: false })
    uncontrolled.forget()
    expect((await uncontrolled.guarded('/api/widgets')).status).toBe(502)
    expect(uncontrolled.rejoin).not.toHaveBeenCalled()

    const probing = setup()
    probing.forget()
    expect((await probing.guarded(MOCK_PROBE_PATH)).status).toBe(502)
    expect(probing.rejoin).not.toHaveBeenCalled()
  })

  it("doesn't replay an aborted request", async () => {
    const { guarded, rejoin, forget } = setup()
    forget()
    const controller = new AbortController()
    controller.abort()
    expect((await guarded('/api/widgets', { signal: controller.signal })).status).toBe(502)
    expect(rejoin).not.toHaveBeenCalled()
  })
})
