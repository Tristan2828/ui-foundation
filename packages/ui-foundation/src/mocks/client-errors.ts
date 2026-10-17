// MSW handler for POST /client-errors (openapi/foundation.yaml), for an app
// that turns on FoundationProviders' errorReporting. It answers 204 like
// the reference backend and keeps what it was sent, so an app's tests can
// check a report was made and what it held. Like the backend, it needs the
// mock session.
import { http, HttpResponse } from 'msw'
import type { components } from '@/api/schema'
import { isMockAuthenticated } from './auth'

type ClientErrorReport = components['schemas']['ClientErrorReport']

let received: ClientErrorReport[] = []

/** What POST /client-errors has received since the last reset. */
export function getMockClientErrors(): readonly ClientErrorReport[] {
  return received
}

export function resetMockClientErrors(): void {
  received = []
}

export const clientErrorHandlers = [
  http.post('*/api/client-errors', async ({ request }) => {
    if (!isMockAuthenticated()) {
      return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
    }
    received = [...received, (await request.json()) as ClientErrorReport]
    return new HttpResponse(null, { status: 204 })
  }),
]
