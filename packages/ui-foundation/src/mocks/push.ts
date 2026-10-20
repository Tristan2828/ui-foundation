// MSW handlers for /push/* (openapi/foundation.yaml), for an app whose
// contract has them. Like the reference backend they need the mock
// session, and a device subscribing again gets its id back. Nothing is
// ever sent: under MSW, usePushPermission reads 'mock' and never
// subscribes, since MSW's own worker holds the page.
import { http, HttpResponse } from 'msw'
import type { components } from '@/api/schema'
import { isMockAuthenticated } from './auth'

type PushSubscriptionRequest = components['schemas']['PushSubscriptionRequest']

/** RFC 8291's example key: a valid P-256 point, and nobody's real one. */
export const MOCK_PUSH_PUBLIC_KEY =
  'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'

let subscriptions = new Map<string, { id: number; request: PushSubscriptionRequest }>()
let nextId = 1

/** What POST /push/subscriptions has saved since the last reset. */
export function getMockPushSubscriptions(): readonly PushSubscriptionRequest[] {
  return [...subscriptions.values()].map(({ request }) => request)
}

export function resetMockPush(): void {
  subscriptions = new Map()
  nextId = 1
}

const unauthorized = () => HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })

export const pushHandlers = [
  http.get('*/api/push/public-key', () =>
    isMockAuthenticated() ? HttpResponse.json({ publicKey: MOCK_PUSH_PUBLIC_KEY }) : unauthorized(),
  ),
  http.post('*/api/push/subscriptions', async ({ request }) => {
    if (!isMockAuthenticated()) return unauthorized()
    const body = (await request.json()) as PushSubscriptionRequest
    const id = subscriptions.get(body.endpoint)?.id ?? nextId++
    subscriptions.set(body.endpoint, { id, request: body })
    return HttpResponse.json({ id }, { status: 201 })
  }),
  http.delete('*/api/push/subscriptions/:id', ({ params }) => {
    if (!isMockAuthenticated()) return unauthorized()
    const entry = [...subscriptions.entries()].find(([, value]) => String(value.id) === params.id)
    if (!entry) return HttpResponse.json({ detail: 'No such subscription.' }, { status: 404 })
    subscriptions.delete(entry[0])
    return new HttpResponse(null, { status: 204 })
  }),
]
