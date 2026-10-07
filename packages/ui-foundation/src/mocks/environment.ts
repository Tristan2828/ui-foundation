// MSW handler for GET /environment (openapi/foundation.yaml). Mock data is
// never production's, but MockModeBanner already says so: answering null
// keeps DataEnvironmentBanner out of mock mode. An app that renders the
// banner spreads `environmentHandlers` into its own handler list.
import { http, HttpResponse } from 'msw'
import type { components } from '@/api/schema'

type DataEnvironment = components['schemas']['DataEnvironment']

export const environmentHandlers = [
  http.get('*/api/environment', () => HttpResponse.json<DataEnvironment>({ dataLabel: null })),
]
