// withBootWait: a page's goto() and reload() first wait for the page's
// own /api/ requests to settle (150 ms with none in flight, at most 3 s),
// then return once the app has rendered into #root, and a file of the
// app's refused before then loads the page once more. The Page is a stand-in whose render and refusals the
// test drives; the real browser runs it in the template's e2e specs.
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@playwright/test', () => ({ test: { extend: () => ({}) }, expect: () => {} }))
vi.mock('@axe-core/playwright', () => ({ default: class {} }))

const { withBootWait } = await import('../src/testing')

const ORIGIN = 'http://localhost:4173'

type FakeRequest = { url: () => string; failure: () => { errorText: string } | null }
type Listener = (request: FakeRequest) => void

function fakePage() {
  const events = new Map<string, Set<Listener>>()
  const on = (event: string) => events.get(event) ?? events.set(event, new Set()).get(event)!
  // The boot's refusal watch, added and removed around each load.
  const listeners = on('requestfailed')
  const emit = (event: string, request: FakeRequest) => {
    for (const listener of on(event)) listener(request)
  }
  let render: () => void = () => {}
  const page = {
    url: () => `${ORIGIN}/tasks`,
    on: (event: string, listener: Listener) => on(event).add(listener),
    off: (event: string, listener: Listener) => on(event).delete(listener),
    goto: vi.fn(async () => 'goto response'),
    reload: vi.fn(async () => 'reload response'),
    // Resolves when the test says the app rendered.
    waitForFunction: vi.fn(() => new Promise<void>((resolve) => (render = resolve))),
  }
  // The originals, which withBootWait replaces on the page.
  const original = { goto: page.goto, reload: page.reload }
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
  return {
    original,
    booted: withBootWait(page as never) as unknown as { goto: (url: string) => Promise<unknown>; reload: () => Promise<unknown> },
    render: async () => (await settle(), render()),
    refuse: async (url: string, errorText = 'net::ERR_CONNECTION_REFUSED') => {
      await settle()
      emit('requestfailed', { url: () => url, failure: () => ({ errorText }) })
    },
    // A request the page sends, and its end (finished or failed).
    send: (url: string) => {
      const request = { url: () => url, failure: () => null }
      emit('request', request)
      return { finish: () => emit('requestfinished', request), fail: () => emit('requestfailed', request) }
    },
    // The boot's own listener plus the settle's one; the boot's goes away after.
    bootListeners: () => listeners.size - 1,
  }
}

describe('withBootWait', () => {
  it("goto returns its response once the app has rendered, and doesn't reload", async () => {
    const { original, booted, render, bootListeners } = fakePage()
    const loaded = booted.goto('/tasks')
    await render()
    await expect(loaded).resolves.toBe('goto response')
    expect(original.reload).not.toHaveBeenCalled()
    expect(bootListeners()).toBe(0)
  })

  it('a file of the app refused before boot loads the page once more', async () => {
    const { original, booted, render, refuse } = fakePage()
    const loaded = booted.goto('/tasks')
    await refuse(`${ORIGIN}/assets/index-abc.js`)
    await render()
    await expect(loaded).resolves.toBe('reload response')
    expect(original.reload).toHaveBeenCalledTimes(1)
  })

  it('a second refusal fails naming the file', async () => {
    const { booted, refuse } = fakePage()
    const loaded = booted.reload()
    await refuse(`${ORIGIN}/assets/index-abc.js`, 'net::ERR_CONNECTION_RESET')
    await refuse(`${ORIGIN}/assets/media-def.js`)
    await expect(loaded).rejects.toThrow('The server refused /assets/media-def.js twice: the app never booted')
  })

  it("another site's refused request, or another failure, is left alone", async () => {
    const { original, booted, render, refuse } = fakePage()
    const loaded = booted.goto('/tasks')
    await refuse('https://fonts.example.com/font.woff2')
    await refuse(`${ORIGIN}/api/tasks`, 'net::ERR_ABORTED')
    await render()
    await expect(loaded).resolves.toBe('goto response')
    expect(original.reload).not.toHaveBeenCalled()
  })
})

describe('withBootWait settles the API first', () => {
  afterEach(() => vi.useRealTimers())

  it('waits for an /api/ request in flight, then 150 ms of quiet, before navigating', async () => {
    vi.useFakeTimers()
    const { original, booted, render, send } = fakePage()
    const refresh = send(`${ORIGIN}/api/tasks`)
    const loaded = booted.goto('/elsewhere')
    await vi.advanceTimersByTimeAsync(1000)
    expect(original.goto).not.toHaveBeenCalled()
    refresh.finish()
    await vi.advanceTimersByTimeAsync(100)
    expect(original.goto).not.toHaveBeenCalled()
    // Another request starting in the quiet window starts the wait over.
    const again = send(`${ORIGIN}/api/tasks?page=2`)
    await vi.advanceTimersByTimeAsync(100)
    again.fail()
    await vi.advanceTimersByTimeAsync(140)
    expect(original.goto).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(20)
    expect(original.goto).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
    await render()
    await expect(loaded).resolves.toBe('goto response')
  })

  it("navigates at once when nothing's in flight, and ignores other paths and sites", async () => {
    vi.useFakeTimers()
    const { original, booted, render, send } = fakePage()
    send(`${ORIGIN}/assets/index-abc.js`)
    send('https://api.example.com/api/tasks')
    const loaded = booted.reload()
    await vi.advanceTimersByTimeAsync(0)
    expect(original.reload).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
    await render()
    await expect(loaded).resolves.toBe('reload response')
  })

  it('gives up waiting after 3 s without failing the test', async () => {
    vi.useFakeTimers()
    const { original, booted, render, send } = fakePage()
    send(`${ORIGIN}/api/stream`)
    const loaded = booted.goto('/elsewhere')
    await vi.advanceTimersByTimeAsync(2990)
    expect(original.goto).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(20)
    expect(original.goto).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
    await render()
    await expect(loaded).resolves.toBe('goto response')
  })
})
