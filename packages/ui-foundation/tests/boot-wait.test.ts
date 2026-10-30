// withBootWait: a page's goto() and reload() return once the app has
// rendered into #root, and a file of the app's refused before then loads
// the page once more. The Page is a stand-in whose render and refusals the
// test drives; the real browser runs it in the template's e2e specs.
import { describe, expect, it, vi } from 'vitest'

vi.mock('@playwright/test', () => ({ test: { extend: () => ({}) }, expect: () => {} }))
vi.mock('@axe-core/playwright', () => ({ default: class {} }))

const { withBootWait } = await import('../src/testing')

const ORIGIN = 'http://localhost:4173'

type Failed = (request: { url: () => string; failure: () => { errorText: string } | null }) => void

function fakePage() {
  const listeners = new Set<Failed>()
  let render: () => void = () => {}
  const page = {
    url: () => `${ORIGIN}/tasks`,
    on: (_event: string, listener: Failed) => listeners.add(listener),
    off: (_event: string, listener: Failed) => listeners.delete(listener),
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
      for (const listener of listeners) listener({ url: () => url, failure: () => ({ errorText }) })
    },
    listeners,
  }
}

describe('withBootWait', () => {
  it("goto returns its response once the app has rendered, and doesn't reload", async () => {
    const { original, booted, render, listeners } = fakePage()
    const loaded = booted.goto('/tasks')
    await render()
    await expect(loaded).resolves.toBe('goto response')
    expect(original.reload).not.toHaveBeenCalled()
    expect(listeners.size).toBe(0)
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
