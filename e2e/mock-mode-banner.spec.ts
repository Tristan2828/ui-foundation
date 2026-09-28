import { expect, test } from '@playwright/test'

// The default `npm run verify` run is MSW-backed (VITE_API unset), so the
// banner must be present. A real-backend build is the inverse and is not
// exercised here — VITE_API is baked in at build time, so covering it
// would need a second build.
test('mock mode is announced on every route, including logged-out ones', async ({ page }) => {
  const banner = page.getByRole('status').filter({ hasText: 'Mock data' })

  await page.goto('/widgets')
  await expect(banner).toBeVisible()

  // /login is the route that actually mattered: a mock session looks like
  // a real one, and that is where the confusion started.
  await page.goto('/login')
  await expect(banner).toBeVisible()
})
