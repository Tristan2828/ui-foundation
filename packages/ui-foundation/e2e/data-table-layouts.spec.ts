import { expect, test, type Page } from '@playwright/test'

// DataTable's card layouts (issue #252, app/DataTable layouts stories) in
// a real browser: the switch, the URL and the remembered pick, the grid's
// columns from the table's width, groups and paging in every layout, and
// every state. Axe and the token check on the stories at rest, in both
// themes, are e2e/fixtures-visual.spec.ts's COMPOSITE_STORIES.
const story = (id: string, query = '') =>
  `http://localhost:6180/story.html?id=app-datatable-layouts--${id}&theme=light${query}`

const layoutSwitch = (page: Page) => page.getByRole('group', { name: 'Layout' })
const root = (page: Page) => page.locator('[data-layout]')

async function columnsOf(page: Page) {
  return page.locator('[data-slot="data-table-cards"] ul').first().evaluate((list) => getComputedStyle(list).gridTemplateColumns.split(' ').length)
}

test.describe('DataTable layouts', () => {
  test('the switch moves between rows, grid and compact; each keeps the day headings and paging', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('feed'))
    await expect(root(page)).toHaveAttribute('data-layout', 'table')
    await expect(layoutSwitch(page).getByRole('button', { name: 'Rows' })).toHaveAttribute('aria-pressed', 'true')

    await layoutSwitch(page).getByRole('button', { name: 'Grid' }).click()
    await expect(root(page)).toHaveAttribute('data-layout', 'grid')
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /^Today/ })).toBeVisible()
    await expect(page.locator('[data-slot="data-table-card"]')).toHaveCount(6)
    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(page.locator('[data-slot="data-table-card"]')).toHaveCount(2)
    await expect(root(page)).toHaveAttribute('data-layout', 'grid')

    await layoutSwitch(page).getByRole('button', { name: 'Compact' }).click()
    await expect(root(page)).toHaveAttribute('data-layout', 'compact')
    await expect(page.getByRole('button', { name: 'Open Autumn walks' })).toBeVisible()
  })

  test('the pick is remembered for the table: a new visit with no ?layout= opens on it', async ({ page }) => {
    await page.goto(story('feed'))
    await layoutSwitch(page).getByRole('button', { name: 'Compact' }).click()
    await expect(root(page)).toHaveAttribute('data-layout', 'compact')
    await page.goto(story('feed'))
    await expect(root(page)).toHaveAttribute('data-layout', 'compact')
    // Another table keeps its own: Covers opens on its default.
    await page.goto(story('covers'))
    await expect(root(page)).toHaveAttribute('data-layout', 'covers')
  })

  test('the keyboard: one tab stop, arrows along it, Enter picks', async ({ page }) => {
    await page.goto(story('feed'))
    await layoutSwitch(page).getByRole('button', { name: 'Rows' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(layoutSwitch(page).getByRole('button', { name: 'Grid' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(root(page)).toHaveAttribute('data-layout', 'grid')
  })

  test("the grid's columns come from the width: several on a laptop, a fixed few on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('covers'))
    expect(await columnsOf(page)).toBeGreaterThanOrEqual(5)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => columnsOf(page)).toBe(3)
    await page.goto(story('feed-grid'))
    await expect.poll(() => columnsOf(page)).toBe(2)
    // On a phone the switch is its icons, still named.
    await expect(layoutSwitch(page).getByRole('button', { name: 'Grid' })).toBeVisible()
  })

  test('loading, empty and error in a card layout', async ({ page }) => {
    await page.goto(story('feed-grid'))
    const state = page.getByRole('group', { name: 'State' })
    await state.getByRole('button', { name: 'loading' }).click()
    await expect(page.locator('[data-state="loading"]')).toBeVisible()
    await state.getByRole('button', { name: 'empty' }).click()
    await expect(page.getByText('Nothing in the feed yet')).toBeVisible()
    await state.getByRole('button', { name: 'error' }).click()
    await expect(page.getByText('The server had a problem.')).toBeVisible()
    await expect(root(page)).toHaveAttribute('data-layout', 'grid')
  })

  test('a round button on a cover marks the record, and a record without a picture shows the placeholder', async ({ page }) => {
    await page.goto(story('covers'))
    const read = page.getByRole('button', { name: 'Read: Harbour Lights' })
    await expect(read).toHaveAttribute('aria-pressed', 'false')
    await read.click()
    await expect(read).toHaveAttribute('aria-pressed', 'true')
    const winter = page.locator('[data-slot="data-table-card"]').filter({ hasText: 'Winter Orchard' })
    await expect(winter.locator('[data-slot="artwork-placeholder"]')).toBeVisible()
  })
})
