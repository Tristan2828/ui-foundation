import { expect, test } from '@playwright/test'

const NAV_ENTRIES = [
  { path: '/', label: 'Home', content: { role: 'button', name: 'Get started' } },
  { path: '/widgets', label: 'Widgets', content: { role: 'heading', name: 'Widgets' } },
] as const

// This spec is MSW-independent by design (see docs/BUILD-PLAN.md Phase 8) —
// scripts/check-backend-postgres.sh also runs it against the real backend
// (VITE_API=real), which has no MSW to default-authenticate it. `page.request`
// shares the page's own cookie jar, so logging in here is enough to
// authenticate the rest of the test's navigation. No-op under the default
// MSW-backed `npm run verify` run, which is already authenticated.
test.beforeEach(async ({ page }) => {
  if (process.env.VITE_API === 'real') {
    await page.request.post('/api/auth/login', {
      data: { email: 'dev@example.com', password: 'dev-password-123' },
    })
  }
})

test.describe('app shell navigation', () => {
  for (const { path, label, content } of NAV_ENTRIES) {
    test(`visits ${label} without the error boundary rendering`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole(content.role, { name: content.name })).toBeVisible()
      await expect(page.getByText('This page hit an error')).toHaveCount(0)
    })
  }

  test('every sidebar nav entry is clickable and navigates', async ({ page }) => {
    await page.goto('/')
    for (const { label, content } of NAV_ENTRIES) {
      await page.getByRole('link', { name: label }).click()
      await expect(page.getByRole(content.role, { name: content.name })).toBeVisible()
      await expect(page.getByText('This page hit an error')).toHaveCount(0)
    }
  })
})
