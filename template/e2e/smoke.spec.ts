import { test, expect } from '@playwright/test'

// See e2e/shell.spec.ts — same real-backend-only login step, needed for the
// same reason (this spec runs against VITE_API=real in check-backend-postgres.sh,
// which has no MSW to default-authenticate it).
test.beforeEach(async ({ page }) => {
  if (process.env.VITE_API === 'real') {
    await page.request.post('/api/auth/login', {
      data: { email: 'dev@example.com', password: 'dev-password-123' },
    })
  }
})

test('home route renders a shadcn button', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible()
})
