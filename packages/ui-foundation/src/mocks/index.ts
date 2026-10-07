// `@tristan2828/ui-foundation/mocks` — MSW support. A separate entry point
// so msw (an optional peer dependency) never reaches an app's main bundle
// unless it imports this.
export {
  authHandlers,
  getMockCurrentUser,
  isMockAuthenticated,
  MOCK_PASSWORD,
  MOCK_USER,
  resetMockAuth,
  setMockAuthenticated,
} from './auth'
export { environmentHandlers } from './environment'
export { exposeMswForE2E } from './e2e-hooks'
export type { MswHandle, MswOverride } from './override'
