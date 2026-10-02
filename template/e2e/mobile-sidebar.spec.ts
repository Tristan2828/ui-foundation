import { expect, test, type Page } from '@playwright/test'

// The sidebar below the mobile breakpoint: an off-canvas Sheet instead of
// the persistent sidebar shell.spec.ts covers, so this runs only in the
// mobile-chrome project (playwright.config.ts). The a11y suite opens the
// sheet to read its links; this is what asserts the sheet itself works.
test.describe('mobile sidebar sheet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible()
  })

  const openSheet = async (page: Page) => {
    await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    return sheet
  }

  test('opens from the header trigger and closes on Escape', async ({ page }) => {
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await openSheet(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('closes when a nav link is followed', async ({ page }) => {
    const sheet = await openSheet(page)
    await sheet.getByRole('link', { name: 'Widgets' }).click()
    await expect(page).toHaveURL(/\/widgets$/)
    await expect(page.getByRole('heading', { name: 'Widgets' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('traps focus while open and returns it to the trigger', async ({ page }) => {
    const sheet = await openSheet(page)
    // More presses than the sheet has controls, so focus has to wrap.
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      await expect(sheet.locator(':focus')).toHaveCount(1)
    }
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Shift+Tab')
      await expect(sheet.locator(':focus')).toHaveCount(1)
    }
    // One press, with focus on a nav link: until the sidebar primitive
    // dropped its hidden mobile tooltip, this Escape closed that instead.
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Toggle Sidebar' }).first()).toBeFocused()
  })
})
