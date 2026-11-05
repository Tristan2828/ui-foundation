import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// DataTable's Group menu (`groupings`) and detail panel (`detailPanel`),
// app/DataTable grouping stories, in a real browser: None by default, a
// pick grouping the rows (the grouped column hidden), a multi-value row
// under each value, folding one heading and all of them, the pick in the
// URL, remembered and set by a saved view; then the panel: a click, Enter,
// ↑/↓, Escape and Close, a title link picking instead of leaving, and the
// phone's bottom sheet. Axe on the stories at rest is
// e2e/fixtures-visual.spec.ts's; the open panel and a folded heading are
// checked here, in both themes.
const story = (id: string, query = '', theme: 'light' | 'dark' = 'light') =>
  `http://localhost:6180/story.html?id=app-datatable-grouping--${id}&theme=${theme}${query}`

const groupMenu = (page: Page) => page.locator('[data-slot="data-table-group-menu"]')
const headings = (page: Page) => page.locator('[data-slot="table-group-heading"] button[aria-expanded]')
const row = (page: Page, title: string) => page.getByRole('row', { name: new RegExp(title) })

async function groupBy(page: Page, label: string) {
  await groupMenu(page).click()
  await page.getByRole('menuitemradio', { name: label }).click()
}

function analyze(page: Page) {
  return new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
}

test.describe('DataTable groupings', () => {
  test('None by default; Status groups in its order, hides its column, and None undoes it', async ({ page }) => {
    await page.goto(story('chores'))
    await expect(groupMenu(page)).toHaveText('Group')
    await expect(headings(page)).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Fold all' })).toHaveCount(0)

    await groupBy(page, 'Status')
    await expect(groupMenu(page)).toHaveText('Group: Status')
    await expect(headings(page)).toHaveText([/To do\s*5/, /Doing\s*2/, /Done\s*1/])
    await expect(page.locator('[data-slot="table-group-heading"]').first()).toContainText('2 quick · 2 h 25 m')
    await expect(page.getByRole('columnheader', { name: 'Status' })).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: 'Area' })).toBeVisible()

    await groupBy(page, 'None')
    await expect(headings(page)).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
  })

  test('a multi-value field shows a row under each of its values, and none under "No area"', async ({ page }) => {
    await page.goto(story('chores-by-area'))
    await expect(headings(page)).toHaveText([/Kitchen\s*2/, /Garden\s*3/, /Garage\s*2/, /Hall\s*2/, /No area\s*1/])
    await expect(page.getByRole('row', { name: /Wash the bins/ })).toHaveCount(2)
    await expect(page.getByRole('columnheader', { name: 'Area' })).toHaveCount(0)
  })

  test('a heading folds its rows; Fold all folds every one, and Unfold all opens them', async ({ page }) => {
    await page.goto(story('chores-by-area'))
    const kitchen = headings(page).filter({ hasText: 'Kitchen' })
    await expect(kitchen).toHaveAttribute('aria-expanded', 'true')
    await kitchen.click()
    await expect(kitchen).toHaveAttribute('aria-expanded', 'false')
    await expect(row(page, 'Descale the kettle')).toHaveCount(0)
    await expect(row(page, 'Rake the leaves')).toBeVisible()
    // The keyboard: it's a button.
    await kitchen.focus()
    await page.keyboard.press('Enter')
    await expect(kitchen).toHaveAttribute('aria-expanded', 'true')

    await page.getByRole('button', { name: 'Fold all' }).click()
    for (const heading of await headings(page).all()) await expect(heading).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('tbody tr[data-slot="table-row"]')).toHaveCount(0)
    await page.getByRole('button', { name: 'Unfold all' }).click()
    await expect(row(page, 'Descale the kettle')).toBeVisible()
  })

  test('the pick is remembered for the table, and a saved view can set it', async ({ page }) => {
    await page.goto(story('chores'))
    await groupBy(page, 'Ready')
    await expect(headings(page)).toHaveText([/Ready now\s*6/, /Not yet\s*2/])
    await page.goto(story('chores'))
    await expect(groupMenu(page)).toHaveText('Group: Ready')

    // By status turns on Status; All names no grouping, so it stays.
    await page.getByRole('button', { name: 'By status' }).click()
    await expect(groupMenu(page)).toHaveText('Group: Status')
    await page.getByRole('button', { name: 'All', exact: true }).click()
    await expect(groupMenu(page)).toHaveText('Group: Status')
  })

  test('folded headings have zero axe violations in both themes', async ({ page }) => {
    for (const theme of ['light', 'dark'] as const) {
      await page.goto(story('chores-by-area', '', theme))
      await headings(page).filter({ hasText: 'Garden' }).click()
      await headings(page).filter({ hasText: 'Garage' }).focus()
      expect((await analyze(page)).violations).toEqual([])
    }
  })
})

test.describe('DataTable detail panel', () => {
  const panel = (page: Page) => page.getByRole('complementary', { name: 'Chore' })

  test('a click opens the panel beside the list and marks the row; Close closes it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('chores-with-panel'))
    await expect(panel(page)).toHaveCount(0)
    await row(page, 'Rake the leaves').getByRole('cell', { name: 'Garden' }).click()
    await expect(panel(page)).toContainText('Front lawn first, then the path.')
    await expect(row(page, 'Rake the leaves')).toHaveAttribute('aria-selected', 'true')
    await expect(row(page, 'Descale the kettle')).toHaveAttribute('aria-selected', 'false')
    // Beside the list, not under it.
    const tableBox = await page.getByRole('table').boundingBox()
    const panelBox = await panel(page).boundingBox()
    expect(panelBox!.x).toBeGreaterThan(tableBox!.x + tableBox!.width - 1)

    await panel(page).getByRole('button', { name: 'Close' }).click()
    await expect(panel(page)).toHaveCount(0)
    await expect(row(page, 'Rake the leaves')).toBeFocused()
  })

  test("a title link picks the row instead of leaving; the panel's Open page link leaves", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('chores-with-panel'))
    await page.getByRole('link', { name: 'Oil the hinges' }).click()
    await expect(panel(page)).toContainText('Back door still squeaks a little.')
    await panel(page).getByRole('link', { name: 'Open page' }).click()
    await expect(page.getByText("A chore's page")).toBeVisible()
  })

  test('↑/↓ move the pick while the list has focus; Escape closes; Enter on a row opens it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('chores-with-panel'))
    await row(page, 'Descale the kettle').getByRole('cell', { name: 'Kitchen' }).click()
    await page.keyboard.press('ArrowDown')
    await expect(row(page, 'Rake the leaves')).toHaveAttribute('aria-selected', 'true')
    await expect(row(page, 'Rake the leaves')).toBeFocused()
    await expect(panel(page)).toContainText('Front lawn first')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowUp')
    await expect(panel(page)).toContainText('Front lawn first')
    await page.keyboard.press('Escape')
    await expect(panel(page)).toHaveCount(0)
    await expect(row(page, 'Rake the leaves')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(panel(page)).toContainText('Front lawn first')
  })

  test('under a multi-value grouping, ↓ walks each place a row is shown', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('chores-with-panel'))
    await groupBy(page, 'Area')
    await row(page, 'Rake the leaves').getByRole('cell', { name: '40 m' }).click()
    // Garden: leaves, bins, gutters; then Garage: the tool wall, bins again.
    for (let step = 0; step < 4; step++) await page.keyboard.press('ArrowDown')
    const bins = page.getByRole('row', { name: /Wash the bins/ })
    await expect(bins.nth(1)).toHaveAttribute('aria-selected', 'true')
    await expect(bins.nth(0)).toHaveAttribute('aria-selected', 'false')
  })

  test('on a phone the panel is a bottom sheet, closed by Escape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(story('chores-with-panel'))
    await row(page, 'Rake the leaves').getByRole('cell', { name: 'Garden' }).click()
    const sheet = page.getByRole('dialog', { name: 'Chore' })
    await expect(sheet).toContainText('Front lawn first, then the path.')
    await expect(panel(page)).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
  })

  test('the open panel and the picked row have zero axe violations in both themes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    for (const theme of ['light', 'dark'] as const) {
      await page.goto(story('chores-with-panel', '', theme))
      await row(page, 'Rake the leaves').getByRole('cell', { name: 'Garden' }).click()
      await expect(panel(page)).toBeVisible()
      expect((await analyze(page)).violations).toEqual([])
    }
  })

  test('muted text in the picked row clears 4.5:1 in both themes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    for (const theme of ['light', 'dark'] as const) {
      await page.goto(story('chores-with-panel', '', theme))
      // "Find the spare keys" has no area: a muted "No area" cell.
      await row(page, 'Find the spare keys').getByRole('cell', { name: '10 m' }).click()
      await expect(panel(page)).toBeVisible()
      const picked = page.locator('tbody tr[aria-selected="true"]')
      await expect(picked.getByText('No area')).toBeVisible()
      const results = await new AxeBuilder({ page }).include('tbody tr[aria-selected="true"]').withRules(['color-contrast']).analyze()
      expect(results.passes.find((rule) => rule.id === 'color-contrast')?.nodes.length).toBeGreaterThan(0)
      expect(results.violations).toEqual([])
    }
  })
})

test.describe('DataTable row click and a controlled panel', () => {
  const panel = (page: Page) => page.getByRole('complementary', { name: 'Chore' })

  test('a row click runs onRowClick; the panel opens from a control in the row', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('chores-with-quick-look'))
    await page.getByRole('button', { name: 'Quick look: Rake the leaves' }).click()
    await expect(panel(page)).toContainText('Front lawn first, then the path.')
    await expect(row(page, 'Rake the leaves')).toHaveAttribute('aria-selected', 'true')
    await panel(page).getByRole('button', { name: 'Close' }).click()
    await expect(panel(page)).toHaveCount(0)

    await row(page, 'Rake the leaves').getByRole('cell', { name: 'Garden' }).click()
    await expect(page.getByText("A chore's page")).toBeVisible()
  })

  test('a title link keeps its own navigation, and Status headings lead with an icon', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('chores-with-quick-look'))
    await expect(page.locator('[data-slot="table-group-heading"] svg').first()).toBeVisible()
    await page.getByRole('link', { name: 'Oil the hinges' }).click()
    await expect(page.getByText("A chore's page")).toBeVisible()
  })
})
