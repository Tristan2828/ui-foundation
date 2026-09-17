import { expect, test } from '@playwright/test'

// Mirrors e2e/auth.spec.ts's state coverage (docs/BUILD-PLAN.md Phase 11):
// validation (duplicate email, weak password, mismatched confirmation) and
// success (redirects in, authenticated). No forced MSW override needed —
// /register sits outside AppShell's auth redirect (same as /login) and the
// real mocked POST /auth/register handler (src/mocks/handlers.ts) already
// covers every case exercised here.

test.describe('register', () => {
  test('success: registering with a new email creates an account and redirects in', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Name').fill('New Person')
    await page.getByLabel('Email').fill('new-person@example.com')
    await page.getByLabel('Password', { exact: true }).fill('a-strong-password')
    await page.getByLabel('Confirm password').fill('a-strong-password')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible()
  })

  test('validation: registering with an already-registered email shows a field error and does not redirect', async ({
    page,
  }) => {
    await page.goto('/register')
    await page.getByLabel('Name').fill('Dev User')
    // Same email as the seeded dev user (src/mocks/data.ts's mockUser).
    await page.getByLabel('Email').fill('dev@example.com')
    await page.getByLabel('Password', { exact: true }).fill('a-strong-password')
    await page.getByLabel('Confirm password').fill('a-strong-password')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('email already registered')).toBeVisible()
    await expect(page).toHaveURL('/register')
  })

  test('validation: a password under 8 characters is rejected client-side, before any request', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Name').fill('New Person')
    await page.getByLabel('Email').fill('short-pw@example.com')
    await page.getByLabel('Password', { exact: true }).fill('short')
    await page.getByLabel('Confirm password').fill('short')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible()
    await expect(page).toHaveURL('/register')
  })

  test('validation: a mismatched confirmation is rejected client-side, before any request', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Name').fill('New Person')
    await page.getByLabel('Email').fill('mismatch@example.com')
    await page.getByLabel('Password', { exact: true }).fill('a-strong-password')
    await page.getByLabel('Confirm password').fill('a-different-password')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('Passwords do not match')).toBeVisible()
    await expect(page).toHaveURL('/register')
  })

  test('the login and register screens link to each other', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL('/register')
    await page.getByRole('button', { name: 'Sign in instead' }).click()
    await expect(page).toHaveURL('/login')
  })
})
