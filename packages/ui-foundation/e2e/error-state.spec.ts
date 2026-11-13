import { expect, test } from '@playwright/test'

// A lapsed sign-in at a proxy in front of the app (AppError kind
// `proxy_auth`), on the ErrorState story: every error state offers
// "Sign In Again" and no retry, and pressing it loads the page again, so
// the proxy's own sign-in runs. Axe in both themes, the token check and
// the glyph check are e2e/fixtures-visual.spec.ts's.
const STORY = 'http://localhost:6180/story.html?id=app-errorstate--sign-in-again'

test.beforeEach(async ({ page }) => {
  await page.goto(STORY)
  await expect(page.getByText('Sign-in expired').first()).toBeVisible()
})

test('full size, in a widget and on a module card: Sign In Again, never a retry', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Sign In Again' })).toHaveCount(3)
  await expect(page.getByRole('button', { name: /^(Try Again|Retry)$/ })).toHaveCount(0)
  await expect(page.locator('[data-slot=empty][data-state=error][data-size=default]')).toContainText(
    'Your sign-in has expired. Reload the page to sign in again.',
  )
  await expect(page.locator('[data-slot=empty][data-state=error][data-size=compact]')).toContainText('Sign-in expired')
})

for (const [where, index] of [
  ['full size', 0],
  ['in a widget', 1],
  ['on a module card', 2],
] as const) {
  test(`Sign In Again reloads the page (${where})`, async ({ page }) => {
    await page.evaluate(() => {
      ;(window as unknown as { beforeReload?: boolean }).beforeReload = true
    })
    await Promise.all([
      page.waitForEvent('load'),
      page.getByRole('button', { name: 'Sign In Again' }).nth(index).click(),
    ])
    await expect(page.getByText('Sign-in expired').first()).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { beforeReload?: boolean }).beforeReload)).toBeUndefined()
  })
}
