import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Tables in written text, on the RichTextEditor "Tables" story: columns
// that fit their words, the two looks, the grips' menus (insert, move,
// delete, align, sort, colour, header column), and the colours and header
// column kept as Markdown writes them, read back by <Markdown>.
const TABLES = 'http://localhost:6180/story.html?id=app-richtexteditor--tables'

const editor = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true })
const saved = (page: Page, name: string) => page.getByTestId(`saved-${name}`)
const table = (page: Page, name: string) => editor(page, name).locator('table')
const cell = (page: Page, name: string, row: number, column: number) =>
  table(page, name).locator('tr').nth(row).locator('th, td').nth(column)
const fixture = (page: Page, name: string) => page.locator(`[data-fixture="${name}"]`)
const columnGrip = (page: Page, name: string) => fixture(page, name).locator('[data-slot=rich-text-table-column-grip]')
const rowGrip = (page: Page, name: string) => fixture(page, name).locator('[data-slot=rich-text-table-row-grip]')
const item = (page: Page, name: string) => page.getByRole('menu').getByRole('menuitem', { name, exact: true })
const radio = (page: Page, name: string) => page.getByRole('menu').getByRole('menuitemradio', { name, exact: true })

// The body rows' first cells, top to bottom, as the Markdown saves them.
async function savedItems(page: Page, name: string) {
  const text = (await saved(page, name).textContent())!
  return text
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .slice(2)
    .map((line) => line.split('|')[1].trim())
}

test.describe('rich-text tables', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TABLES)
    await expect(table(page, 'compactTable')).toBeVisible()
  })

  test('columns fit their words: the table is narrower than the field, and a right-aligned column never wraps', async ({ page }) => {
    const field = await editor(page, 'compactTable').boundingBox()
    const box = await table(page, 'compactTable').boundingBox()
    expect(box!.width).toBeLessThan(field!.width / 2)
    const price = cell(page, 'compactTable', 1, 3)
    await expect(price).toHaveCSS('white-space', 'nowrap')
    await expect(price).toHaveCSS('text-align', 'right')
    await expect(price).toHaveCSS('font-variant-numeric', 'tabular-nums')
    // A long note wraps at about 18rem.
    const note = fixture(page, 'markdownCompact').locator('td').filter({ hasText: 'Store brand' })
    expect((await note.boundingBox())!.width).toBeLessThanOrEqual(18 * 16 + 1)
  })

  test('the grips show on the hovered cell only, and none show at rest', async ({ page }) => {
    await expect(columnGrip(page, 'compactTable')).toBeHidden()
    await expect(rowGrip(page, 'compactTable')).toBeHidden()
    await cell(page, 'compactTable', 2, 3).hover()
    await expect(columnGrip(page, 'compactTable')).toBeVisible()
    await expect(rowGrip(page, 'compactTable')).toBeVisible()
    await expect(columnGrip(page, 'compactTable')).toHaveAttribute('aria-label', 'Column: Price')
    await expect(rowGrip(page, 'compactTable')).toHaveAttribute('aria-label', 'Row 2')
  })

  test("a column's grip moves it, the caret going with it and focus back in the text", async ({ page }) => {
    await cell(page, 'compactTable', 1, 3).hover()
    await columnGrip(page, 'compactTable').click()
    await expect(item(page, 'Move column right')).toHaveAttribute('aria-disabled', 'true')
    await item(page, 'Move column left').click()
    await expect(saved(page, 'compactTable')).toContainText(/^\| Item +\| Store +\| +Price \| Size +\|\n\| -+ \| -+ \| -+: \| -+ \|/)
    await expect(editor(page, 'compactTable')).toBeFocused()
  })

  test("a row's grip moves it; the header row can't move", async ({ page }) => {
    await cell(page, 'compactTable', 1, 0).hover()
    await rowGrip(page, 'compactTable').click()
    await expect(item(page, 'Move row up')).toHaveAttribute('aria-disabled', 'true')
    await item(page, 'Move row down').click()
    await expect.poll(() => savedItems(page, 'compactTable')).toEqual(['Rice', 'Olive oil', 'Oats'])
    await cell(page, 'compactTable', 0, 0).hover()
    await rowGrip(page, 'compactTable').click()
    await expect(item(page, 'Move row down')).toHaveAttribute('aria-disabled', 'true')
    await expect(item(page, 'Delete row')).toHaveAttribute('aria-disabled', 'true')
  })

  test('sorting by a column rewrites the rows (numbers by value), one undo step', async ({ page }) => {
    await cell(page, 'compactTable', 1, 3).hover()
    await columnGrip(page, 'compactTable').click()
    await item(page, 'Sort ascending').click()
    await expect.poll(() => savedItems(page, 'compactTable')).toEqual(['Oats', 'Rice', 'Olive oil'])
    await cell(page, 'compactTable', 1, 0).hover()
    await columnGrip(page, 'compactTable').click()
    await item(page, 'Sort descending').click()
    await expect.poll(() => savedItems(page, 'compactTable')).toEqual(['Rice', 'Olive oil', 'Oats'])
    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(() => savedItems(page, 'compactTable')).toEqual(['Oats', 'Rice', 'Olive oil'])
  })

  test('a cell coloured from its menu (right-click) is its text in that highlight, and the cell is painted', async ({ page }) => {
    const price = cell(page, 'compactTable', 2, 3)
    await price.click({ button: 'right' })
    await radio(page, 'Green').click()
    await expect(saved(page, 'compactTable')).toContainText(/\| =={green}\$8\.99== \|/)
    await expect(price).toHaveAttribute('data-color', 'green')
    await price.click({ button: 'right' })
    await expect(radio(page, 'Green')).toHaveAttribute('aria-checked', 'true')
    await radio(page, 'No colour').click()
    await expect(saved(page, 'compactTable')).not.toContainText('==')
    await expect(price).not.toHaveAttribute('data-color')
  })

  test('Shift+F10 in a cell opens its menu; a whole row and a whole column take a colour', async ({ page }) => {
    await cell(page, 'compactTable', 1, 1).click()
    await page.waitForTimeout(100)
    await page.keyboard.press('Shift+F10')
    await expect(page.getByRole('menu')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(editor(page, 'compactTable')).toBeFocused()
    await cell(page, 'compactTable', 1, 1).hover()
    await rowGrip(page, 'compactTable').click()
    await radio(page, 'Yellow').click()
    await expect(saved(page, 'compactTable')).toContainText(/\| =={yellow}Olive oil== \| =={yellow}Corner shop== \|/)
    await cell(page, 'compactTable', 1, 2).hover()
    await columnGrip(page, 'compactTable').click()
    await radio(page, 'Red').click()
    await expect(cell(page, 'compactTable', 3, 2)).toHaveAttribute('data-color', 'red')
    // The header row's cells never take one.
    await expect(cell(page, 'compactTable', 0, 2)).not.toHaveAttribute('data-color')
  })

  test('the header column is the first cells in bold, and drawn as row headers', async ({ page }) => {
    await cell(page, 'compactTable', 1, 0).hover()
    await columnGrip(page, 'compactTable').click()
    await page.getByRole('menu').getByRole('menuitemcheckbox', { name: 'Header column' }).click()
    await expect(saved(page, 'compactTable')).toContainText('| **Olive oil** |')
    await expect(saved(page, 'compactTable')).toContainText('| **Oats** ')
    await expect(cell(page, 'compactTable', 1, 0)).toHaveAttribute('data-row-header', '')
    await cell(page, 'compactTable', 2, 0).hover()
    await columnGrip(page, 'compactTable').click()
    await expect(page.getByRole('menu').getByRole('menuitemcheckbox', { name: 'Header column' })).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('menu').getByRole('menuitemcheckbox', { name: 'Header column' }).click()
    await expect(saved(page, 'compactTable')).not.toContainText('**')
    await expect(cell(page, 'compactTable', 1, 0)).not.toHaveAttribute('data-row-header')
  })

  test('boxed: a rounded box, zebra rows; compact: a full grid on the heading band', async ({ page }) => {
    await expect(fixture(page, 'boxedTable').locator('[data-table-look=boxed]')).toHaveCount(1)
    const boxed = (row: number) => cell(page, 'boxedTable', row, 1)
    const odd = await boxed(1).evaluate((element) => getComputedStyle(element).backgroundColor)
    const even = await boxed(2).evaluate((element) => getComputedStyle(element).backgroundColor)
    expect(odd).not.toEqual(even)
    await expect(fixture(page, 'boxedTable').locator('.prose-table')).not.toHaveCSS('border-top-width', '0px')
    await expect(cell(page, 'compactTable', 2, 1)).toHaveCSS('border-left-width', '1px')
  })

  test('<Markdown> reads the same table: coloured cells, row headers, words only partly highlighted left alone', async ({ page }) => {
    const read = fixture(page, 'markdownCompact').locator('table')
    await expect(read.locator('th[scope=row]')).toHaveText(['Olive oil', 'Rice', 'Oats'])
    await expect(read.locator('td[data-color=green]')).toHaveText('$12.49')
    await expect(read.locator('td[data-color=red]')).toHaveText('$8.99')
    await expect(read.locator('td[data-color=amber]')).toHaveText('Buy two')
    await expect(read.locator('td').filter({ hasText: 'partly highlighted' })).not.toHaveAttribute('data-color')
    await expect(fixture(page, 'markdownBoxed').locator('[data-table-look=boxed]')).toHaveCount(1)
    // The editor draws it the same.
    await expect(table(page, 'markedTable').locator('[data-row-header]')).toHaveCount(3)
    await expect(table(page, 'markedTable').locator('td[data-color=green]')).toHaveText('$12.49')
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`both looks, coloured cells and row headers, a grip's menu open: zero axe violations (${theme})`, async ({ page }) => {
      await page.goto(`${TABLES}&theme=${theme}`)
      await expect(table(page, 'markedTable')).toBeVisible()
      await cell(page, 'markedTable', 1, 2).hover()
      await columnGrip(page, 'markedTable').click()
      await expect(page.getByRole('menu')).toBeVisible()
      const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
      expect(results.violations).toEqual([])
    })
  }
})
