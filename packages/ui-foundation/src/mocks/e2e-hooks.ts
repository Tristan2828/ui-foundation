// Exposes the running MSW worker, plus the handler-building functions, on
// `window` so Playwright specs can force loading/empty/error/validation
// states via worker.use(...), and applies a pre-navigation override if a
// spec set one (see ./override.ts for the protocol).
//
// Only ever wired when MSW mocking itself is active (the app's main.tsx
// checks mock mode first) — there is no real backend or real data behind
// this in that mode, so there is nothing sensitive to expose.
import { delay, http, HttpResponse } from 'msw'
import type { SetupWorker } from 'msw/browser'
import './override'

export function exposeMswForE2E(worker: SetupWorker): void {
  window.__msw = { worker, http, HttpResponse, delay }

  const override = window.__E2E_MSW_OVERRIDE__
  if (override) {
    worker.use(
      http[override.method](override.path, async () => {
        if (override.delayMs) await delay(override.delayMs)
        if (override.bodyBase64 !== undefined) {
          const bytes = Uint8Array.from(atob(override.bodyBase64), (character) => character.charCodeAt(0))
          return new HttpResponse(bytes, {
            status: override.status ?? 200,
            headers: { 'Content-Type': override.contentType ?? 'application/octet-stream' },
          })
        }
        return HttpResponse.json(override.body ?? {}, { status: override.status ?? 200 })
      }),
    )
  }
}
