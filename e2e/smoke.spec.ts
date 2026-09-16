import { test, expect } from '@playwright/test'

test('home route renders a shadcn button', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'UI Foundation' })).toBeVisible()
})
