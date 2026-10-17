// MSW handlers for the foundation's /auth/* contract (openapi/foundation.yaml),
// against an in-memory session store. An app spreads `authHandlers` into its
// own handler list and calls `resetMockAuth()` from its own reset, so every
// app's mocks behave like the reference backend's auth without a copy of it.
import { http, HttpResponse } from 'msw'
import type { components } from '@/api/schema'

type User = components['schemas']['User']
type LoginRequest = components['schemas']['LoginRequest']
type TotpLoginRequest = components['schemas']['TotpLoginRequest']
type RegisterRequest = components['schemas']['RegisterRequest']
type ValidationIssue = components['schemas']['ValidationErrorBody']['detail'][number]

// Same demo credentials as the reference backend's seeded dev user
// (backend/app/config.py's SEED_USER_EMAIL/SEED_USER_PASSWORD defaults), so
// logging in behaves the same whether MSW or the real API answers.
export const MOCK_USER: User = { id: 1, email: 'dev@example.com', name: 'Dev User' }
export const MOCK_PASSWORD = 'dev-password-123'

// An account with two-step sign-in, for an app's e2e test of both steps:
// MOCK_PASSWORD, then MOCK_TOTP_CODE (always right, as a fixed clock would
// make it) or MOCK_RECOVERY_CODE (once per reset). Five wrong codes end
// the pending sign-in (410), as the reference backend does.
export const MOCK_TOTP_USER: User = { id: 1001, email: 'two-step@example.com', name: 'Two Step User' }
export const MOCK_TOTP_CODE = '123456'
export const MOCK_RECOVERY_CODE = 'abcd-efgh'
const PENDING_MAX_TRIES = 5

// Signed in by default: screen specs assume access, and only auth specs
// exercise the logged-out path (by overriding GET /auth/me to 401).
let authenticated = true
// Mirrors the backend's email-uniqueness check and its auto-login on
// register: a new registration becomes the session's current user.
let registeredUsers = new Map<string, User>([[MOCK_USER.email, MOCK_USER]])
let currentUser: User = MOCK_USER
let nextUserId = 2
// The pending sign-in after MOCK_TOTP_USER's password: wrong codes so far,
// or null when none is waiting.
let pendingTries: number | null = null
let recoveryCodeUsed = false

export function isMockAuthenticated(): boolean {
  return authenticated
}

export function setMockAuthenticated(value: boolean): void {
  authenticated = value
}

/**
 * The user the mock session is signed in as, or null when signed out — the
 * same answer GET /auth/me gives. For an app's own handlers that act as the
 * signed-in user (per-user rows): after a mock registration this is the new
 * user, not MOCK_USER. On null, answer 401 as /auth/me does.
 */
export function getMockCurrentUser(): User | null {
  return authenticated ? currentUser : null
}

export function resetMockAuth(): void {
  authenticated = true
  registeredUsers = new Map([[MOCK_USER.email, MOCK_USER]])
  currentUser = MOCK_USER
  nextUserId = 2
  pendingTries = null
  recoveryCodeUsed = false
}

export const authHandlers = [
  http.post('*/api/auth/register', async ({ request }) => {
    const body = (await request.json()) as Partial<RegisterRequest>
    // Mirrors the backend's register(): field validation, then the
    // duplicate-email check, both landing on the same 422 {detail:[...]}.
    const issues: ValidationIssue[] = []
    if (!body.name) issues.push({ loc: ['body', 'name'], msg: 'field required', type: 'value_error.missing' })
    if (!body.email) issues.push({ loc: ['body', 'email'], msg: 'field required', type: 'value_error.missing' })
    if (!body.password || body.password.length < 8) {
      issues.push({
        loc: ['body', 'password'],
        msg: 'ensure this value has at least 8 characters',
        type: 'value_error.any_str.min_length',
      })
    }
    if (body.email && registeredUsers.has(body.email)) {
      issues.push({ loc: ['body', 'email'], msg: 'email already registered', type: 'value_error.email_exists' })
    }
    if (issues.length > 0) {
      return HttpResponse.json({ detail: issues }, { status: 422 })
    }

    const user: User = { id: nextUserId++, email: body.email!, name: body.name! }
    registeredUsers.set(user.email, user)
    currentUser = user
    authenticated = true
    return HttpResponse.json(user)
  }),

  http.post('*/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as LoginRequest
    if (body.email === MOCK_TOTP_USER.email && body.password === MOCK_PASSWORD) {
      pendingTries = 0
      return HttpResponse.json({ next: 'totp' }, { status: 202 })
    }
    if (body.email !== MOCK_USER.email || body.password !== MOCK_PASSWORD) {
      return HttpResponse.json({ detail: 'Invalid email or password' }, { status: 401 })
    }
    currentUser = MOCK_USER
    authenticated = true
    return HttpResponse.json(MOCK_USER)
  }),

  http.post('*/api/auth/login/totp', async ({ request }) => {
    const { code } = (await request.json()) as TotpLoginRequest
    if (pendingTries === null) {
      return HttpResponse.json(
        { detail: 'Your sign-in timed out. Enter your email and password again.' },
        { status: 410 },
      )
    }
    const recovery = !recoveryCodeUsed && code.trim().toLowerCase() === MOCK_RECOVERY_CODE
    if (code.trim() === MOCK_TOTP_CODE || recovery) {
      if (recovery) recoveryCodeUsed = true
      pendingTries = null
      currentUser = MOCK_TOTP_USER
      authenticated = true
      return HttpResponse.json(MOCK_TOTP_USER)
    }
    pendingTries += 1
    if (pendingTries >= PENDING_MAX_TRIES) {
      pendingTries = null
      return HttpResponse.json(
        { detail: 'Too many wrong codes. Enter your email and password again.' },
        { status: 410 },
      )
    }
    return HttpResponse.json({ detail: "That code isn't right. Check it and try again." }, { status: 401 })
  }),

  http.post('*/api/auth/logout', () => {
    authenticated = false
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('*/api/auth/me', () => {
    if (!authenticated) {
      return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
    }
    return HttpResponse.json(currentUser)
  }),
]
