// `@tristan2828/ui-foundation/gateway` — what an app's own gateway modules
// (src/api/gateway/<entity>.ts) build on: the single fetch path and the
// wire-error -> AppError translation. Lint allows importing this only from
// src/api/gateway/, which is what keeps every other layer off the network.
export { networkError, safeFetch, toAppError } from '@/api/gateway/errors'
export type { ApiResponse } from '@/api/transport'
