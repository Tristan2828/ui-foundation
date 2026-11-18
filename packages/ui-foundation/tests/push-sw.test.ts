// The service worker pwa() writes (vite/push-sw.js), run in a sandbox with
// a fake `self.registration`, `clients` and fetch: what a push shows (the
// Done button where the browser has buttons, renotify on a nag), that the
// button posts to the app's own path with the session cookie and opens
// nothing, falls back to opening the message's path when that fails, and
// that a payload naming another origin is neither posted to nor opened.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const SOURCE = fs.readFileSync(path.join(import.meta.dirname, '../vite/push-sw.js'), 'utf8')
const ORIGIN = 'https://app.example.com'

type Listener = (event: Record<string, unknown>) => void
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the options the worker built, read field by field
type Options = Record<string, any>
type Shown = { title: string; options: Options }

function worker({ maxActions = 2 as number | null, fetchOk = true, fetchThrows = false } = {}) {
  const listeners: Record<string, Listener> = {}
  const shown: Shown[] = []
  const fetch = vi.fn(async () => {
    if (fetchThrows) throw new TypeError('offline')
    return { ok: fetchOk, status: fetchOk ? 204 : 401 }
  })
  const opened: string[] = []
  const clients = {
    claim: vi.fn(),
    matchAll: vi.fn(async () => []),
    openWindow: vi.fn(async (href: string) => {
      opened.push(href)
    }),
  }
  const self = {
    location: new URL(`${ORIGIN}/push-sw.js`),
    registration: {
      showNotification: vi.fn(async (title: string, options: Options) => {
        shown.push({ title, options })
      }),
    },
    clients,
    skipWaiting: vi.fn(),
    addEventListener: (type: string, listener: Listener) => {
      listeners[type] = listener
    },
  }
  // null: no Notification global at all in the worker.
  const Notification = maxActions === null ? undefined : { maxActions }
  vm.runInNewContext(SOURCE, { self, clients, fetch, URL, JSON, Number, Array, Notification })

  async function push(data: unknown) {
    const waits: Promise<unknown>[] = []
    listeners.push({
      data: { json: () => data, text: () => String(data) },
      waitUntil: (promise: Promise<unknown>) => waits.push(promise),
    })
    await Promise.all(waits)
    return shown[shown.length - 1]
  }

  async function click(notification: Shown, action = '') {
    const waits: Promise<unknown>[] = []
    const close = vi.fn()
    listeners.notificationclick({
      action,
      notification: { data: notification.options.data, close },
      waitUntil: (promise: Promise<unknown>) => waits.push(promise),
    })
    await Promise.all(waits)
    return { close }
  }

  return { push, click, fetch, opened }
}

const DONE = { title: 'Done', path: '/api/reminders/7/done', body: { occurrence: '2026-11-05T09:00:00+00:00' } }
const NAG = { title: 'Water the plants', body: '', url: '/reminders/7', tag: 'reminder-7', renotify: true, action: DONE }

describe('a push', () => {
  it('shows a Done button where the browser has buttons, and sounds again on a nag', async () => {
    const shown = await worker().push(NAG)
    expect(shown.title).toBe('Water the plants')
    expect(shown.options).toMatchObject({ tag: 'reminder-7', renotify: true, actions: [{ action: 'action', title: 'Done' }] })
  })

  it('shows no button on a browser without them (iOS Safari), and still opens on a tap', async () => {
    for (const maxActions of [0, null]) {
      const sw = worker({ maxActions })
      const shown = await sw.push(NAG)
      expect(shown.options.actions).toBeUndefined()
      await sw.click(shown)
      expect(sw.opened).toEqual([`${ORIGIN}/reminders/7`])
      expect(sw.fetch).not.toHaveBeenCalled()
    }
  })

  it('reads as before without the new fields: no renotify, no button', async () => {
    const shown = await worker().push({ title: 'Hi', url: '/x', tag: 't' })
    expect(shown.options.renotify).toBeUndefined()
    expect(shown.options.actions).toBeUndefined()
    // renotify needs a tag: a browser refuses it alone.
    expect((await worker().push({ title: 'Hi', renotify: true })).options.renotify).toBeUndefined()
  })

  it('drops a button whose path is another origin or not a path', async () => {
    for (const bad of ['https://evil.example/x', '//evil.example/x', '/\\evil.example/x', 'api/done', '/a\nb', 42]) {
      const shown = await worker().push({ ...NAG, action: { ...DONE, path: bad } })
      expect(shown.options.actions).toBeUndefined()
      expect(shown.options.data.action).toBeNull()
    }
    expect((await worker().push({ ...NAG, action: { ...DONE, title: ' ' } })).options.actions).toBeUndefined()
  })
})

describe('the Done button', () => {
  it('posts its body to the app’s path with the session cookie, closes, and opens nothing', async () => {
    const sw = worker()
    const { close } = await sw.click(await sw.push(NAG), 'action')
    expect(sw.fetch).toHaveBeenCalledWith(`${ORIGIN}/api/reminders/7/done`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DONE.body),
    })
    expect(close).toHaveBeenCalled()
    expect(sw.opened).toEqual([])
  })

  it('opens the message’s path when the app refuses it or can’t be reached', async () => {
    for (const options of [{ fetchOk: false }, { fetchThrows: true }]) {
      const sw = worker(options)
      const { close } = await sw.click(await sw.push(NAG), 'action')
      expect(close).toHaveBeenCalled()
      expect(sw.opened).toEqual([`${ORIGIN}/reminders/7`])
    }
  })

  it('posts nowhere when the stored action was altered to another origin', async () => {
    const sw = worker()
    const shown = await sw.push(NAG)
    shown.options.data.action = { ...DONE, path: '//evil.example/x' }
    await sw.click(shown, 'action')
    expect(sw.fetch).not.toHaveBeenCalled()
    // Read as no button: a plain tap, which opens the app's path.
    expect(sw.opened).toEqual([`${ORIGIN}/reminders/7`])
  })

  it('never opens another site from a tap', async () => {
    const sw = worker()
    await sw.click(await sw.push({ title: 'Hi', url: 'https://evil.example/' }))
    expect(sw.opened).toEqual([])
  })
})
