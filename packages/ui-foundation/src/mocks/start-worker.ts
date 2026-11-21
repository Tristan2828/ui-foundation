// Mock mode's boot, shared by every app: starts the MSW worker and returns
// only once the page's requests really reach the mocks, then exposes the
// worker for Playwright (./e2e-hooks.ts).
//
// Two waits after worker.start():
//
// 1. The controller. On a first visit start() can resolve before the new
//    service worker controls the page, and a request made in that gap goes
//    to the network.
// 2. A probe. Being controlled still isn't enough: MSW's worker mocks only
//    for the clients in its in-memory list, which the page joins with a
//    MOCK_ACTIVATE message during start(). A worker the browser stops and
//    starts again (it may, under load, at any time) has forgotten that list
//    and passes every request through, so the app's first queries came back
//    from the network (no `main`, "data is undefined"). So one request that
//    only a runtime handler answers is made first; until it comes back
//    mocked, the page joins the list again.
//
// After boot the same restart can happen mid-session (requests from a
// booted page go to the network). Nothing in
// the page hears it: a restarted worker is the same `controller`, so no
// `controllerchange` fires. What the page can see is a request the worker
// never handed it: MSW's client emits `request:start` for every request the
// worker forwards (passthroughs included), before the response, and a
// worker that has forgotten the page forwards none. So, after boot,
// `window.fetch` is guarded: a response (or network error) whose request
// was never handed over means the page joins the list again, probes until
// it's mocked, and makes the request once more. Bounded: one rejoin at a
// time, shared by every request that saw the bypass, and if a rejoin fails
// the guard stands down (the boot's message says why). A healthy page
// pays one map lookup per request and never probes.
import { http, HttpResponse } from 'msw'
import type { SetupWorker, StartOptions } from 'msw/browser'
import { exposeMswForE2E } from './e2e-hooks'

/** Answered only by the handler startMockWorker adds for the probe. */
export const MOCK_PROBE_PATH = '/__ui-foundation-msw-probe'
const PROBE_ANSWER = 'mocked'
const PROBE_TRIES = 20
const PROBE_PAUSE_MS = 100

/**
 * Starts MSW for an app's mock mode. Resolves once requests are answered by
 * the mocks, with the worker exposed for Playwright (`exposeMswForE2E`).
 * Render the app only after it resolves. `options` go to `worker.start()`;
 * unhandled requests are bypassed unless they say otherwise.
 */
export async function startMockWorker(worker: SetupWorker, options: StartOptions = {}): Promise<void> {
  await worker.start({ onUnhandledRequest: 'bypass', ...options })
  await untilControlled()
  await untilMocked(worker)
  // After the probe's resetHandlers(), so a spec's pre-navigation override
  // (applied here) stays in place.
  exposeMswForE2E(worker)
  const pageFetch = window.fetch.bind(window)
  window.fetch = guardFetch({
    fetch: pageFetch,
    events: worker.events,
    controlled: () => navigator.serviceWorker.controller !== null,
    rejoin: () => rejoin(worker, pageFetch),
    baseUrl: document.baseURI,
  })
}

// Bounded: a hard reload leaves the page uncontrolled for its whole life,
// and then the probe below says so instead of the boot hanging.
const CONTROLLER_WAIT_MS = 3000

function untilControlled(): Promise<void> {
  if (navigator.serviceWorker.controller) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, CONTROLLER_WAIT_MS)
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

async function untilMocked(worker: SetupWorker): Promise<void> {
  worker.use(http.get(MOCK_PROBE_PATH, () => HttpResponse.text(PROBE_ANSWER)))
  try {
    for (let attempt = 0; attempt < PROBE_TRIES; attempt += 1) {
      if ((await probe()) === PROBE_ANSWER) return
      // The worker doesn't know this page: join its client list again.
      navigator.serviceWorker.controller?.postMessage('MOCK_ACTIVATE')
      await new Promise((resolve) => setTimeout(resolve, PROBE_PAUSE_MS))
    }
    console.error(
      `[ui-foundation] The mock service worker still passes this page's requests to the network after ${PROBE_TRIES} tries. ` +
        'API calls may not be mocked; reload the page.',
    )
  } finally {
    // The probe's handler goes: the runtime handlers are the specs' alone.
    worker.resetHandlers()
  }
}

// After boot: the worker forgot this page. Join again first, then probe. The
// probe's handler is a `once` handler and stays put, never reset: a spec's
// runtime handlers (worker.use) are in the same list and must survive.
async function rejoin(worker: SetupWorker, pageFetch: typeof fetch): Promise<boolean> {
  worker.use(http.get(MOCK_PROBE_PATH, () => HttpResponse.text(PROBE_ANSWER), { once: true }))
  for (let attempt = 0; attempt < PROBE_TRIES; attempt += 1) {
    navigator.serviceWorker.controller?.postMessage('MOCK_ACTIVATE')
    await new Promise((resolve) => setTimeout(resolve, PROBE_PAUSE_MS))
    if ((await probe(pageFetch)) === PROBE_ANSWER) return true
  }
  console.error(
    `[ui-foundation] The mock service worker stopped answering this page and still passes its requests to the network after ${PROBE_TRIES} tries. ` +
      'API calls may not be mocked; reload the page.',
  )
  return false
}

type RequestStarts = {
  on(event: 'request:start', listener: (args: { request: Request }) => void): void
}

export type FetchGuardOptions = {
  /** The page's own fetch, which the guard calls. */
  fetch: typeof fetch
  /** MSW's lifecycle events (`worker.events`): `request:start` for each request the worker hands the page. */
  events: RequestStarts
  /** Whether a service worker controls the page; an uncontrolled page (a hard reload) has nothing to rejoin. */
  controlled: () => boolean
  /** Joins the worker's client list again; true once requests are mocked. */
  rejoin: () => Promise<boolean>
  /** What relative request URLs resolve against (`document.baseURI`). */
  baseUrl: string
}

// One request's identity as both sides see it: the method (upper case: a
// Request keeps `patch` as given) and the absolute URL without a fragment.
const requestKey = (method: string, url: string) => `${method.toUpperCase()} ${url.split('#')[0]}`

function keyOf(input: RequestInfo | URL, init: RequestInit | undefined, baseUrl: string): string {
  const url = input instanceof Request ? input.url : new URL(input instanceof URL ? input.href : input, baseUrl).href
  return requestKey(init?.method ?? (input instanceof Request ? input.method : 'GET'), url)
}

const aborted = (input: RequestInfo | URL, init: RequestInit | undefined) =>
  Boolean(init?.signal?.aborted || (input instanceof Request && input.signal.aborted))

/**
 * A `fetch` that notices a request the mock worker passed to the network
 * without handing it to MSW, joins the worker again and makes it once
 * more. Exported for its unit test; `startMockWorker` installs it.
 */
export function guardFetch({ fetch: pageFetch, events, controlled, rejoin, baseUrl }: FetchGuardOptions): typeof fetch {
  // Per request key: guarded requests in flight, and how many of them the
  // worker has handed over. Only keys in flight are counted, so the
  // worker's other traffic (scripts, images) leaves nothing behind.
  const inFlight = new Map<string, number>()
  const handed = new Map<string, number>()
  const bump = (map: Map<string, number>, key: string, by: number) => {
    const next = (map.get(key) ?? 0) + by
    if (next > 0) map.set(key, next)
    else map.delete(key)
  }
  events.on('request:start', ({ request }) => {
    const key = requestKey(request.method, request.url)
    if (inFlight.has(key)) bump(handed, key, 1)
  })

  let rejoining: Promise<boolean> | null = null
  let standDown = false
  const rejoinOnce = () => {
    rejoining ??= rejoin().then((joined) => {
      rejoining = null
      if (!joined) standDown = true
      return joined
    })
    return rejoining
  }

  return async function guardedFetch(input, init) {
    if (standDown || !controlled()) return pageFetch(input, init)
    const key = keyOf(input, init, baseUrl)
    if (key.endsWith(MOCK_PROBE_PATH)) return pageFetch(input, init)
    // A Request's body can be read once: keep a copy for the second try.
    // A streamed init body can't be replayed at all.
    const again = input instanceof Request && input.body ? input.clone() : input
    const replayable = !(init?.body instanceof ReadableStream)

    bump(inFlight, key, 1)
    let outcome: { response: Response } | { error: unknown }
    try {
      outcome = { response: await pageFetch(input, init) }
    } catch (error) {
      outcome = { error }
    }
    const mocked = handed.has(key)
    bump(handed, key, -1)
    bump(inFlight, key, -1)
    if (!inFlight.has(key)) handed.delete(key)

    const settle = () => {
      if ('error' in outcome) throw outcome.error
      return outcome.response
    }
    if (mocked || aborted(input, init) || !replayable) return settle()
    if (!(await rejoinOnce())) return settle()
    if ('response' in outcome) void outcome.response.body?.cancel().catch(() => {})
    return pageFetch(again, init)
  }
}

function probe(pageFetch: typeof fetch = fetch): Promise<string> {
  // The one bare fetch in mocks (eslint.config.js): it tests the worker
  // itself, before any app code runs, and never reaches a server. After
  // boot it's given the page's own fetch, never the guarded one.
  return pageFetch(MOCK_PROBE_PATH, { cache: 'no-store' })
    .then((response) => (response.ok ? response.text() : ''))
    .catch(() => '')
}
