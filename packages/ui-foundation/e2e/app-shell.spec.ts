import { expect, test, type Page } from '@playwright/test'

// AppShell's sidebar (app/AppShell stories), in a real browser: sections
// render as labelled groups inside the Primary nav, a flat nav keeps its one
// "Navigation" group, and one entry is current, the most specific match.
// Axe in both themes is e2e/storybook-visual.spec.ts's COMPOSITE_STORIES.
const story = (id: string) => `http://localhost:6006/iframe.html?id=app-appshell--${id}&viewMode=story`

async function open(page: Page, id: string) {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(story(id))
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary' })
const current = (page: Page) => nav(page).locator('a[aria-current="page"]')

test('sections: a labelled group per section, in order, inside the Primary nav', async ({ page }) => {
  await open(page, 'sections')
  const labels = nav(page).locator('[data-sidebar="group-label"]')
  await expect(labels).toHaveText(['Projects', 'Reading'])
  await expect(nav(page).getByText('Navigation', { exact: true })).toHaveCount(0)
  await expect(nav(page).getByRole('link')).toHaveText(['Home', 'Projects', 'Categories', 'Checklists', 'Books'])
})

test('sections: only the most specific entry is current', async ({ page }) => {
  await open(page, 'sections')
  await expect(current(page)).toHaveCount(1)
  await expect(current(page)).toHaveText('Categories')
  await expect(nav(page).getByRole('link', { name: 'Projects' })).not.toHaveAttribute('aria-current')
})

test('flat: one "Navigation" group, current on a page below its entry', async ({ page }) => {
  await open(page, 'flat')
  await expect(nav(page).locator('[data-sidebar="group-label"]')).toHaveText(['Navigation'])
  await expect(current(page)).toHaveCount(1)
  await expect(current(page)).toHaveText('Projects')
})
