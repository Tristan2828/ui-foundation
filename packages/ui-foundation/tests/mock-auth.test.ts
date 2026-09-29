import { setupServer } from 'msw/node'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { authHandlers, getMockCurrentUser, MOCK_PASSWORD, MOCK_USER, resetMockAuth } from '../src/mocks'

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
