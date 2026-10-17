import { setupServer } from 'msw/node'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  authHandlers,
  getMockCurrentUser,
  MOCK_PASSWORD,
  MOCK_RECOVERY_CODE,
  MOCK_TOTP_CODE,
  MOCK_TOTP_USER,
  MOCK_USER,
  resetMockAuth,
} from '../src/mocks'

// The mock session's current user, as an app's own handlers read it: the
// same answer GET /auth/me gives, through register, login and logout.
const server = setupServer(...authHandlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => resetMockAuth())

const post = (path: string, body?: unknown) =>
  fetch(`http://localhost/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

describe('getMockCurrentUser', () => {
  it('is MOCK_USER by default', () => {
    expect(getMockCurrentUser()).toEqual(MOCK_USER)
  })

  it('is the newly registered user after a mock registration, as /auth/me is', async () => {
    await post('register', { name: 'New Person', email: 'new@example.com', password: 'a-strong-password' })
    const me = await (await fetch('http://localhost/api/auth/me')).json()
    expect(getMockCurrentUser()).toEqual({ id: 2, name: 'New Person', email: 'new@example.com' })
    expect(getMockCurrentUser()).toEqual(me)
  })

  it('is null when signed out, and MOCK_USER again after logging in', async () => {
    await post('logout')
    expect(getMockCurrentUser()).toBeNull()
    await post('login', { email: MOCK_USER.email, password: MOCK_PASSWORD })
    expect(getMockCurrentUser()).toEqual(MOCK_USER)
  })
})

describe('the two-step mock account', () => {
  const totp = (code: string) => post('login/totp', { code })
  const passwordStep = () => post('login', { email: MOCK_TOTP_USER.email, password: MOCK_PASSWORD })

  it('answers the password with 202 and signs in on MOCK_TOTP_CODE', async () => {
    await post('logout')
    const first = await passwordStep()
    expect(first.status).toBe(202)
    expect(await first.json()).toEqual({ next: 'totp' })
    expect(getMockCurrentUser()).toBeNull()
    expect((await totp(MOCK_TOTP_CODE)).status).toBe(200)
    expect(getMockCurrentUser()).toEqual(MOCK_TOTP_USER)
  })

  it('takes the recovery code once', async () => {
    await passwordStep()
    expect((await totp(MOCK_RECOVERY_CODE)).status).toBe(200)
    await passwordStep()
    expect((await totp(MOCK_RECOVERY_CODE)).status).toBe(401)
  })

  it('ends the pending sign-in after five wrong codes, and 410s without one', async () => {
    expect((await totp(MOCK_TOTP_CODE)).status).toBe(410)
    await passwordStep()
    for (let n = 0; n < 4; n++) expect((await totp('000000')).status).toBe(401)
    expect((await totp('000000')).status).toBe(410)
    expect((await totp(MOCK_TOTP_CODE)).status).toBe(410)
  })
})
