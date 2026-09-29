import { expect, test } from '@playwright/test'
import { forceLoggedOut, forceMswOverride, waitForMswReady } from '@tristan2828/ui-foundation/testing'

// MSW defaults to signed in, so only the "start out logged out" cases
// override GET /auth/me; login, logout and a wrong password all exercise
// the real (mocked) POST /auth/login and /auth/logout handlers.
test.describe('auth', () => {
  test('logging in with valid credentials redirects to the home route', async ({ page }) => {
    await forceLoggedOut(page)
    await page.goto('/login')
    await page.getByLabel('Email').fill('dev@example.com')
    await page.getByLabel('Password', { exact: true }).fill('dev-password-123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible()
  })

  test('logging in with the wrong password shows an error and does not redirect', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('dev@example.com')
    await page.getByLabel('Password', { exact: true }).fill('not-the-right-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Invalid email or password')).toBeVisible()
    await expect(page).toHaveURL('/login')
  })

  test('visiting a protected route while unauthenticated redirects to /login', async ({ page }) => {
    await forceLoggedOut(page)
    await page.goto('/widgets')
    await expect(page).toHaveURL('/login')
  })

  test('logging out redirects to /login', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL('/login')
  })

  test('signing in after a redirect returns to the page that was requested', async ({ page }) => {
    await forceLoggedOut(page)
    await page.goto('/widgets')
    await expect(page).toHaveURL('/login')
    await page.getByLabel('Email').fill('dev@example.com')
    await page.getByLabel('Password', { exact: true }).fill('dev-password-123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/widgets')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
  })

  test('a 401 from any request mid-session ends the session and returns to /login', async ({ page }) => {
    await page.goto('/widgets')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
    await waitForMswReady(page)

    // The session expires server-side: every other resource now says 401.
    await page.evaluate(() => {
      const { worker, http, HttpResponse } = window.__msw
      worker.use(
        http.get('*/api/widgets', () =>
          HttpResponse.json({ detail: 'Session expired or invalid' }, { status: 401 }),
        ),
      )
    })
    await page.getByLabel('Search widgets').fill('mouse')

    await expect(page).toHaveURL('/login')
  })

  test('a failed session check shows a retry, not the login form', async ({ page }) => {
    await forceMswOverride(page, { method: 'get', path: '*/api/auth/me', status: 500, body: { detail: 'Internal error' } })
    await page.goto('/widgets')
    await expect(page.getByText('Something went wrong')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expect(page).toHaveURL('/widgets')
  })

  test("logging out drops the previous session's cached data", async ({ page }) => {
    await page.goto('/widgets')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL('/login')
    await waitForMswReady(page)

    // The next user's list is slow and empty. If the previous session's
    // rows were still cached, the (client-side) navigation below would
    // render them instantly instead of the loading state.
    await page.evaluate(() => {
      const { worker, http, HttpResponse, delay } = window.__msw
      worker.use(
        http.get('*/api/widgets', async () => {
          await delay(1500)
          return HttpResponse.json({ items: [], total: 0 })
        }),
      )
    })
    await page.getByLabel('Email').fill('dev@example.com')
    await page.getByLabel('Password', { exact: true }).fill('dev-password-123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/')
    await page.getByRole('link', { name: 'Widgets' }).click()

    await expect(page.locator('[data-state="loading"]')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toHaveCount(0)
    await expect(page.getByText('No widgets yet')).toBeVisible()
  })
})

test('the password toggle reveals and re-hides, on login and register', async ({ page }) => {
  // Three fields use <PasswordInput> (login, and register's password plus
  // its confirmation). The toggle is visual only — nothing leaves the page
  // — so what matters is that the input's type actually flips and the
  // button's accessible name says what it will do next.
  for (const [route, fieldId] of [
    ['/login', 'login-password'],
    ['/register', 'register-password'],
  ] as const) {
    await page.goto(route)
    const field = page.locator(`#${fieldId}`)
    await expect(field).toHaveAttribute('type', 'password')

    const show = page.getByRole('button', { name: 'Show password' }).first()
    await show.click()
    await expect(field).toHaveAttribute('type', 'text')

    const hide = page.getByRole('button', { name: 'Hide password' }).first()
    await hide.click()
    await expect(field).toHaveAttribute('type', 'password')
  }
})
