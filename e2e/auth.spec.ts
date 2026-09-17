import { expect, test, type Page } from '@playwright/test'

// Same pre-navigation override mechanism as widgets-table.spec.ts — see
// src/mocks/e2e-hooks.ts. MSW defaults to authenticated (src/mocks/data.ts),
// so only the "start out logged out" cases need this; login/logout/wrong
// password all exercise the real (mocked) POST /auth/login and /auth/logout
// handlers directly.
async function forceLoggedOut(page: Page) {
  await page.addInitScript(() => {
    window.__E2E_MSW_OVERRIDE__ = { method: 'get', path: '*/api/auth/me', status: 401, body: { detail: 'Not authenticated' } }
  })
}

test.describe('auth', () => {
  test('logging in with valid credentials redirects to the home route', async ({ page }) => {
    await forceLoggedOut(page)
    await page.goto('/login')
    await page.getByLabel('Email').fill('dev@example.com')
    await page.getByLabel('Password').fill('dev-password-123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible()
  })

  test('logging in with the wrong password shows an error and does not redirect', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('dev@example.com')
    await page.getByLabel('Password').fill('not-the-right-password')
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
})
