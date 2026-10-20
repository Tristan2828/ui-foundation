// `@tristan2828/ui-foundation/mocks` — MSW support. A separate entry point
// so msw (an optional peer dependency) never reaches an app's main bundle
// unless it imports this.
export {
  authHandlers,
  getMockCurrentUser,
  isMockAuthenticated,
  MOCK_PASSWORD,
  MOCK_RECOVERY_CODE,
  MOCK_TOTP_CODE,
  MOCK_TOTP_USER,
  MOCK_USER,
  resetMockAuth,
  setMockAuthenticated,
} from './auth'
export { clientErrorHandlers, getMockClientErrors, resetMockClientErrors } from './client-errors'
export { environmentHandlers } from './environment'
export { getMockPushSubscriptions, MOCK_PUSH_PUBLIC_KEY, pushHandlers, resetMockPush } from './push'
export { exposeMswForE2E } from './e2e-hooks'
export type { MswHandle, MswOverride } from './override'
