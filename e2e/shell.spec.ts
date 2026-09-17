import { expect, test } from '@playwright/test'

const NAV_ENTRIES = [
  { path: '/', label: 'Home', content: { role: 'button', name: 'Get started' } },
  { path: '/widgets', label: 'Widgets', content: { role: 'heading', name: 'Widgets' } },
] as const

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
