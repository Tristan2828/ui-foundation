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

test('version: the short commit and PR in the footer, linking to the PR', async ({ page }) => {
  await open(page, 'version')
  const entry = nav(page).getByRole('link', { name: 'Version 3655449 · PR #139' })
  await expect(entry).toHaveAttribute('href', 'https://github.com/example/app/pull/139')
  await expect(entry).toHaveAttribute('target', '_blank')
})

test('flat: no version entry without a version', async ({ page }) => {
  await open(page, 'flat')
  await expect(nav(page).getByText(/^Version /)).toHaveCount(0)
})

test.describe('collapsible sections (#152)', () => {
  const section = (page: Page, label: string) => nav(page).getByRole('button', { name: label, exact: true })

  test('a collapsible label is a button that says whether its section is open, and controls it', async ({ page }) => {
    await open(page, 'collapsible')
    await expect(section(page, 'Media')).toHaveAttribute('aria-expanded', 'true')
    await expect(section(page, 'Reading')).toHaveAttribute('aria-expanded', 'false')
    const controlled = await section(page, 'Reading').getAttribute('aria-controls')
    await expect(page.locator(`[id="${controlled}"]`)).toBeHidden()
    await expect(nav(page).getByRole('link', { name: 'Books' })).toBeHidden()
    await expect(nav(page).getByRole('link', { name: 'Channels' })).toBeVisible()
  })

  test('a click folds and unfolds, and the choice is remembered after a reload', async ({ page }) => {
    await open(page, 'collapsible')
    await section(page, 'Media').click()
    await expect(section(page, 'Media')).toHaveAttribute('aria-expanded', 'false')
    await expect(nav(page).getByRole('link', { name: 'Channels' })).toBeHidden()
    await section(page, 'Reading').click()
    await expect(nav(page).getByRole('link', { name: 'Books' })).toBeVisible()

    await page.reload()
    await expect(section(page, 'Media')).toHaveAttribute('aria-expanded', 'false')
    await expect(section(page, 'Reading')).toHaveAttribute('aria-expanded', 'true')
  })

  test('Enter and Space toggle it, and focus stays on the label', async ({ page }) => {
    await open(page, 'collapsible')
    await section(page, 'Media').focus()
    await page.keyboard.press('Enter')
    await expect(section(page, 'Media')).toHaveAttribute('aria-expanded', 'false')
    await expect(section(page, 'Media')).toBeFocused()
    await page.keyboard.press('Space')
    await expect(section(page, 'Media')).toHaveAttribute('aria-expanded', 'true')
    await expect(section(page, 'Media')).toBeFocused()
  })

  test('the section holding the current page is open and does not fold', async ({ page }) => {
    await open(page, 'collapsible')
    // Even when this browser had folded it.
    await page.evaluate(() => window.localStorage.setItem('ui-foundation:nav-section:Projects', 'closed'))
    await page.reload()
    await expect(section(page, 'Projects')).toHaveAttribute('aria-expanded', 'true')
    await expect(section(page, 'Projects')).toHaveAttribute('aria-disabled', 'true')
    // Playwright won't click an aria-disabled button; Enter does the same.
    await section(page, 'Projects').focus()
    await page.keyboard.press('Enter')
    await expect(section(page, 'Projects')).toHaveAttribute('aria-expanded', 'true')
    await expect(current(page)).toBeVisible()
    await expect(current(page)).toHaveText('Categories')
  })

  test('arriving at a page inside a folded section unfolds it, and it stays unfolded', async ({ page }) => {
    await open(page, 'collapsible')
    await section(page, 'Media').click()
    expect(await page.evaluate(() => window.localStorage.getItem('ui-foundation:nav-section:Media'))).toBe('closed')
    // The same browser opens a page inside Media.
    await open(page, 'collapsible-in-media')
    await expect(section(page, 'Media')).toHaveAttribute('aria-expanded', 'true')
    await expect(current(page)).toHaveText('Channels')
    expect(await page.evaluate(() => window.localStorage.getItem('ui-foundation:nav-section:Media'))).toBe('open')
  })

  test('on the icon rail every section shows its items, folded or not, and no label takes a tab stop', async ({ page }) => {
    await open(page, 'collapsible-rail')
    await expect(nav(page).getByRole('link', { name: 'Books' })).toBeVisible()
    await expect(nav(page).getByRole('link', { name: 'Channels' })).toBeVisible()
    await expect(nav(page).getByRole('button', { name: 'Reading', exact: true })).toHaveCount(0)
  })
})
