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

function probe(): Promise<string> {
  // The one bare fetch in mocks (eslint.config.js): it tests the worker
  // itself, before any app code runs, and never reaches a server.
  return fetch(MOCK_PROBE_PATH, { cache: 'no-store' })
    .then((response) => (response.ok ? response.text() : ''))
    .catch(() => '')
}
