// The e2e override protocol, shared by the browser half (e2e-hooks.ts,
// running inside the app) and the Playwright half (../testing), so the two
// can't drift apart. A spec sets window.__E2E_MSW_OVERRIDE__ before the page
// loads (forced first-load states), or calls window.__msw.worker.use(...)
// once it has (states forced after load).
import type { SetupWorker } from 'msw/browser'
import type { delay, http, HttpResponse } from 'msw'

export type MswOverride = {
  method: 'get' | 'post' | 'patch' | 'delete'
  path: string
  status?: number
  body?: unknown
  delayMs?: number
  /**
   * Holds every matching request until the test releases it
   * (`forceMswOverride(page, override, { hold: true })` and its
   * `release()`, or `releaseMswOverride(page)`). Set by `forceMswOverride`.
   */
  hold?: boolean
  // A non-JSON body, for stubbing what an <img>, <script> or stylesheet
  // loads. A JSON body with the wrong content type makes an <img> fire
  // onError, which looks exactly like the failure a test is ruling out.
  // Base64 so a spec can inline a tiny fixture rather than commit a binary.
  bodyBase64?: string
  contentType?: string
  /** Response headers, e.g. a 429's `Retry-After`. */
  headers?: Record<string, string>
}

export type MswHandle = {
  worker: SetupWorker
  http: typeof http
  HttpResponse: typeof HttpResponse
  delay: typeof delay
}

declare global {
  interface Window {
    __msw: MswHandle
    // Set via page.addInitScript before a forced-first-load test navigates —
    // ordinary post-navigation `worker.use()` (via window.__msw) can't win a
    // race against the app's own first fetch, which may already be in
    // flight by the time a Playwright `page.evaluate` call runs.
    __E2E_MSW_OVERRIDE__?: MswOverride
    // A held override's gate (see MswOverride's `hold`): true once the test
    // has released it, set by releaseMswOverride in this page and by an
    // init script in every page loaded after.
    __E2E_MSW_RELEASED__?: boolean
    // Lets the requests held so far go, called by releaseMswOverride.
    __E2E_MSW_RELEASE__?: () => void
  }
}
