import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Accessibility of the real screens, in light and dark mode — the app
// shell, every nav page (discovered from the sidebar, so a new entity's
// table is covered with no edit here), the entity form, and the logged-out
// screens. axe's color-contrast rule against the rendered dark DOM is also
// the check that dark-mode tokens stay readable. The theme follows the OS
// setting (ThemeProvider defaultTheme="system"), so emulateMedia switches it.

// Form screens aren't in the sidebar. Add each entity's create route here.
const FORM_ROUTES = ['/widgets/new']
const LOGGED_OUT_ROUTES = ['/login', '/register']

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
}

async function navRoutes(page: Page): Promise<string[]> {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Primary' })
  await expect(nav.getByRole('link').first()).toBeVisible()
  return nav.getByRole('link').evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).pathname))
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`accessibility (${colorScheme})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme })
    })

    test('every nav page has zero axe violations', async ({ page }) => {
      for (const route of await navRoutes(page)) {
        await page.goto(route)
        await expect(page.locator('html')).toHaveClass(colorScheme)
        // Wait for data, not the loading skeleton, so the real UI is checked.
        await expect(page.locator('[data-state="loading"]')).toHaveCount(0)
        await test.step(route, () => expectNoViolations(page))
      }
    })

    for (const route of FORM_ROUTES) {
      test(`${route} has zero axe violations`, async ({ page }) => {
        await page.goto(route)
        await expect(page.locator('form')).toBeVisible()
        await expectNoViolations(page)
      })
    }

    for (const route of LOGGED_OUT_ROUTES) {
      test(`${route} has zero axe violations`, async ({ page }) => {
        await page.goto(route)
        await expect(page.locator('form')).toBeVisible()
        await expectNoViolations(page)
      })
    }
  })
}
