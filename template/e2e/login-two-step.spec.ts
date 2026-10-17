import { expect, test, type Page } from '@playwright/test'
import {
  expectNoAxeViolations,
  forceLoggedOut,
  forceMswOverride,
  waitForMswReady,
} from '@tristan2828/ui-foundation/testing'

// Two-step sign-in (4.0) and the too-many-attempts refusal, against the
// package's mocks: two-step@example.com takes the usual password, then
// 123456 or the recovery code abcd-efgh (MOCK_TOTP_USER, MOCK_TOTP_CODE,
// MOCK_RECOVERY_CODE in @tristan2828/ui-foundation/mocks).
const TWO_STEP_EMAIL = 'two-step@example.com'
const PASSWORD = 'dev-password-123'

async function passwordStep(page: Page, email = TWO_STEP_EMAIL) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

const codeField = (page: Page) => page.getByRole('textbox', { name: 'Authentication code' })

test.describe('two-step sign-in', () => {
  test('the password, then a code from the authenticator app; a wrong code is the field’s error', async ({ page }) => {
    await forceLoggedOut(page)
    await page.goto('/login')
    await passwordStep(page)

    const code = codeField(page)
    await expect(code).toBeFocused()
    await expect(code).toHaveAttribute('autocomplete', 'one-time-code')
    await expect(code).toHaveAttribute('inputmode', 'numeric')
    await expect(page).toHaveURL('/login')

    await code.fill('000000')
    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(code).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText("That code isn't right. Check it and try again.")).toBeVisible()

    await code.fill('123456')
    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(page).toHaveURL('/')
  })

  test('a code that isn’t six digits is caught before it’s sent', async ({ page }) => {
    await page.goto('/login')
    await passwordStep(page)
    await codeField(page).fill('12345')
    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(page.getByText('Enter the 6-digit code from your authenticator app')).toBeVisible()
  })

  test('a recovery code signs in instead', async ({ page }) => {
    await forceLoggedOut(page)
    await page.goto('/login')
    await passwordStep(page)
    await page.getByRole('button', { name: 'Use a recovery code' }).click()
    const recovery = page.getByRole('textbox', { name: 'Recovery code' })
    await expect(recovery).toBeFocused()
    await expect(recovery).toHaveAttribute('autocomplete', 'off')
    await recovery.fill('abcd-efgh')
    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(page).toHaveURL('/')
  })

  test('when the pending sign-in has expired, it goes back to the password with the reason', async ({ page }) => {
    await page.goto('/login')
    await waitForMswReady(page)
    await passwordStep(page)
    await expect(codeField(page)).toBeVisible()
    await page.evaluate(() => {
      const { worker, http, HttpResponse } = window.__msw
      worker.use(
        http.post('*/api/auth/login/totp', () =>
          HttpResponse.json(
            { detail: 'Your sign-in timed out. Enter your email and password again.' },
            { status: 410 },
          ),
        ),
      )
    })
    await codeField(page).fill('123456')
    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(page.getByText('Your sign-in timed out. Enter your email and password again.')).toBeVisible()
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
  })

  test('Start over goes back to the password', async ({ page }) => {
    await page.goto('/login')
    await passwordStep(page)
    await page.getByRole('button', { name: 'Start over' }).click()
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
  })

  test('an account without a second step still signs in with the password alone', async ({ page }) => {
    await forceLoggedOut(page)
    await page.goto('/login')
    await passwordStep(page, 'dev@example.com')
    await expect(page).toHaveURL('/')
  })
})

test.describe('too many sign-in attempts', () => {
  test('a 429 says so on the form and holds the button', async ({ page }) => {
    await forceMswOverride(page, {
      method: 'post',
      path: '*/api/auth/login',
      status: 429,
      headers: { 'Retry-After': '600' },
      body: { detail: 'Too many sign-in attempts. Try again in 10 minutes.' },
    })
    await page.goto('/login')
    await passwordStep(page, 'dev@example.com')
    await expect(page.getByText('Too many attempts')).toBeVisible()
    await expect(page.getByText('Too many sign-in attempts. Try again in 10 minutes.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled()
    // No retry is offered.
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
    await expect(page).toHaveURL('/login')
  })
})

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`two-step sign-in accessibility (${colorScheme})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme })
    })

    test('the code step, with a wrong code shown', async ({ page }) => {
      await page.goto('/login')
      await passwordStep(page)
      await codeField(page).fill('000000')
      await page.getByRole('button', { name: 'Verify' }).click()
      await expect(codeField(page)).toHaveAttribute('aria-invalid', 'true')
      await expectNoAxeViolations(page)
    })

    test('the recovery code step', async ({ page }) => {
      await page.goto('/login')
      await passwordStep(page)
      await page.getByRole('button', { name: 'Use a recovery code' }).click()
      await expect(page.getByRole('textbox', { name: 'Recovery code' })).toBeVisible()
      await expectNoAxeViolations(page)
    })

    test('the too-many-attempts refusal', async ({ page }) => {
      await forceMswOverride(page, {
        method: 'post',
        path: '*/api/auth/login',
        status: 429,
        headers: { 'Retry-After': '600' },
        body: { detail: 'Too many sign-in attempts. Try again in 10 minutes.' },
      })
      await page.goto('/login')
      await passwordStep(page, 'dev@example.com')
      await expect(page.getByText('Too many attempts')).toBeVisible()
      await expectNoAxeViolations(page)
    })
  })
}
