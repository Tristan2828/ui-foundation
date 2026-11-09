import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Column widths in tables, on the RichTextEditor "Table widths" story: an
// edge dragged to a width, kept as the comment after the table, in both
// looks, read back by <Markdown>; a column or row changed in the editor
// keeping widths right; the menu's items; a phone; paper.
const STORY = 'http://localhost:6180/story.html?id=app-richtexteditor--table-widths'

const editor = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true })
const saved = (page: Page, name: string) => page.getByTestId(`saved-${name}`)
const table = (page: Page, name: string) => editor(page, name).locator('table')
const cell = (page: Page, name: string, row: number, column: number) =>
  table(page, name).locator('tr').nth(row).locator('th, td').nth(column)
const fixture = (page: Page, name: string) => page.locator(`[data-fixture="${name}"]`)
const edge = (page: Page, name: string) => fixture(page, name).locator('[data-slot=rich-text-table-column-edge]')
const columnGrip = (page: Page, name: string) => fixture(page, name).locator('[data-slot=rich-text-table-column-grip]')
const item = (page: Page, name: string) => page.getByRole('menu').getByRole('menuitem', { name, exact: true })
const width = async (page: Page, name: string, row: number, column: number) => (await cell(page, name, row, column).boundingBox())!.width

// Points at a column's right edge, in the header row, so its handle shows.
async function pointAtEdge(page: Page, name: string, column: number) {
  const box = (await cell(page, name, 0, column).boundingBox())!
  await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2)
  await expect(edge(page, name)).toBeVisible()
}

async function dragEdge(page: Page, name: string, column: number, by: number) {
  await pointAtEdge(page, name, column)
  const box = (await edge(page, name).boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + 10)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + by, box.y + 10, { steps: 8 })
}

const openColumnMenu = async (page: Page, name: string, column: number) => {
  await cell(page, name, 1, column).hover()
  await columnGrip(page, name).click()
}

test.describe('rich-text table widths', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(STORY)
    await expect(table(page, 'plain')).toBeVisible()
  })

  for (const name of ['plain', 'boxed']) {
    test(`${name}: dragging an edge changes only that column, shows the width, and saves the comment`, async ({ page }) => {
      const start = await width(page, name, 1, 1)
      const other = await width(page, name, 1, 3)
      await dragEdge(page, name, 0, 90)
      await expect(fixture(page, name).locator('[data-slot=rich-text-table-column-size]')).toHaveText(/\d+ px$/)
      await page.mouse.up()
      await expect(saved(page, name)).toContainText(/<!-- table widths: Item=\d+ -->/)
      expect(await width(page, name, 1, 1)).toBeCloseTo(start, 0)
      expect(await width(page, name, 1, 3)).toBeCloseTo(other, 0)
      const stored = Number((await saved(page, name).textContent())!.match(/Item=(\d+)/)![1])
      expect(await width(page, name, 1, 0)).toBeCloseTo(stored, 0)
    })
  }

  test('the drag is free in pixels, catches on a size, and is one undo step', async ({ page }) => {
    const start = await width(page, 'plain', 0, 0)
    await dragEdge(page, 'plain', 0, 160 - start + 4)
    await expect(fixture(page, 'plain').locator('[data-slot=rich-text-table-column-size]')).toHaveText('M · 160 px')
    await page.mouse.up()
    await expect(saved(page, 'plain')).toContainText('<!-- table widths: Item=160 -->')
    await cell(page, 'plain', 1, 0).click()
    await page.keyboard.press('Control+z')
    await expect(saved(page, 'plain')).not.toContainText('table widths')
    expect(await width(page, 'plain', 0, 0)).toBeCloseTo(start, 0)
  })

  test('a column can get no narrower than the minimum, and its words wrap', async ({ page }) => {
    await dragEdge(page, 'plain', 3, -400)
    await page.mouse.up()
    await expect(saved(page, 'plain')).toContainText('Note=56')
    expect(await width(page, 'plain', 1, 3)).toBeCloseTo(56, 0)
    expect((await cell(page, 'plain', 1, 3).boundingBox())!.height).toBeGreaterThan((await cell(page, 'plain', 0, 3).boundingBox())!.height)
  })

  test('a press with no drag changes nothing', async ({ page }) => {
    await pointAtEdge(page, 'plain', 0)
    await page.mouse.down()
    await page.mouse.up()
    await expect(saved(page, 'plain')).not.toContainText('table widths')
    await expect(cell(page, 'plain', 1, 0)).not.toHaveAttribute('data-column-width')
  })

  test('double-clicking an edge puts the column back to fitting its words', async ({ page }) => {
    const before = await width(page, 'sized', 1, 0)
    await pointAtEdge(page, 'sized', 0)
    await edge(page, 'sized').dblclick()
    await expect(saved(page, 'sized')).toContainText('<!-- table widths: Note=320 -->')
    expect(await width(page, 'sized', 1, 0)).not.toBeCloseTo(before, 0)
  })

  test('the menu: Narrower, Wider, Fit to content, Fit all columns', async ({ page }) => {
    await openColumnMenu(page, 'sized', 0)
    await expect(page.getByRole('menu').getByText('Width: 200 px')).toBeVisible()
    await item(page, 'Wider').click()
    await expect(saved(page, 'sized')).toContainText('Item=216')
    await openColumnMenu(page, 'sized', 0)
    await item(page, 'Narrower').click()
    await expect(saved(page, 'sized')).toContainText('Item=200')
    await openColumnMenu(page, 'sized', 0)
    await item(page, 'Fit to content').click()
    await expect(saved(page, 'sized')).toContainText('<!-- table widths: Note=320 -->')
    await openColumnMenu(page, 'sized', 0)
    await expect(page.getByRole('menu').getByText('Width: fit to content')).toBeVisible()
    await item(page, 'Fit all columns').click()
    await expect(saved(page, 'sized')).not.toContainText('table widths')
    await expect(editor(page, 'sized')).toBeFocused()
  })

  test('the keyboard: Shift+F10 in a cell has the width items', async ({ page }) => {
    await cell(page, 'sized', 1, 0).click()
    await page.keyboard.press('Shift+F10')
    await expect(item(page, 'Wider')).toBeVisible()
    await item(page, 'Wider').focus()
    await page.keyboard.press('Enter')
    await expect(saved(page, 'sized')).toContainText('Item=216')
  })

  test('a column moved in the editor keeps its width', async ({ page }) => {
    await openColumnMenu(page, 'sized', 0)
    await item(page, 'Move column right').click()
    await expect(saved(page, 'sized')).toContainText(/^\| +Cost +\| Item /)
    await expect(saved(page, 'sized')).toContainText('<!-- table widths: Item=200, Note=320 -->')
    expect(await width(page, 'sized', 1, 1)).toBeCloseTo(200, 0)
  })

  test('a column added is automatic, and a column deleted takes its width with it', async ({ page }) => {
    await openColumnMenu(page, 'sized', 0)
    await item(page, 'Insert column right').click()
    await expect(saved(page, 'sized')).toContainText('<!-- table widths: Item=200, Note=320 -->')
    await expect(cell(page, 'sized', 1, 1)).not.toHaveAttribute('data-column-width')
    await openColumnMenu(page, 'sized', 0)
    await item(page, 'Delete column').click()
    await expect(saved(page, 'sized')).toContainText('<!-- table widths: Note=320 -->')
  })

  test('a row added or sorted keeps its columns’ widths', async ({ page }) => {
    await cell(page, 'sized', 2, 2).click()
    await page.keyboard.press('Tab')
    await expect(table(page, 'sized').locator('tr')).toHaveCount(4)
    await expect(cell(page, 'sized', 3, 0)).toHaveAttribute('data-column-width', '200')
    await openColumnMenu(page, 'sized', 0)
    await item(page, 'Sort descending').click()
    await expect(saved(page, 'sized')).toContainText('<!-- table widths: Item=200, Note=320 -->')
    await expect(cell(page, 'sized', 1, 0)).toHaveAttribute('data-column-width', '200')
  })

  test('renaming a header in the editor keeps its width under the new name', async ({ page }) => {
    await cell(page, 'sized', 0, 0).click()
    await page.keyboard.press('End')
    await page.keyboard.type('s')
    await expect(saved(page, 'sized')).toContainText('<!-- table widths: Items=200, Note=320 -->')
  })

  test('the read view: the widths, and no comment', async ({ page }) => {
    const reading = fixture(page, 'reading')
    await expect(reading).not.toContainText('table widths')
    expect((await reading.locator('tr').nth(1).locator('td').nth(0).boundingBox())!.width).toBeCloseTo(200, 0)
    expect((await reading.locator('tr').nth(1).locator('td').nth(2).boundingBox())!.width).toBeCloseTo(320, 0)
  })

  test('columns that add up to more than the note scroll sideways', async ({ page }) => {
    const box = fixture(page, 'wide').locator('[data-slot=table-container]')
    await expect(box).toHaveAttribute('tabindex', '0')
    const { client, scroll } = await box.evaluate((el) => ({ client: el.clientWidth, scroll: el.scrollWidth }))
    expect(scroll).toBeGreaterThan(client)
    expect((await box.locator('td').nth(1).boundingBox())!.width).toBeCloseTo(420, 0)
  })

  test('on paper, wide columns scale to the page instead of running off it', async ({ page }) => {
    await page.emulateMedia({ media: 'print' })
    await page.setViewportSize({ width: 720, height: 900 })
    const area = fixture(page, 'wide')
    const box = area.locator('[data-slot=table-container]')
    const room = (await area.boundingBox())!
    const printed = (await box.locator('table').boundingBox())!
    expect(printed.x + printed.width).toBeLessThanOrEqual(room.x + room.width + 1)
    await expect(area).toContainText('Notes that run on')
  })

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 375, height: 812 } })

    test('the widths are ignored, columns fit their words', async ({ page }) => {
      const reading = fixture(page, 'reading')
      await expect(reading.locator('td').first()).toHaveCSS('min-width', '48px')
      expect((await reading.locator('tr').nth(1).locator('td').nth(0).boundingBox())!.width).toBeLessThan(150)
    })

    test('nothing to resize with: no handle, and no width items in the menu', async ({ page }) => {
      await cell(page, 'sized', 1, 0).click()
      await expect(edge(page, 'sized')).toHaveCount(0)
      await page.keyboard.press('Shift+F10')
      await expect(item(page, 'Sort ascending')).toBeVisible()
      await expect(item(page, 'Wider')).toHaveCount(0)
    })
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`a drag in progress and the width items open, both looks: zero axe violations (${theme})`, async ({ page }) => {
      await page.goto(`${STORY}&theme=${theme}`)
      await expect(table(page, 'plain')).toBeVisible()
      await dragEdge(page, 'boxed', 0, 60)
      await expect(fixture(page, 'boxed').locator('[data-slot=rich-text-table-column-size]')).toBeVisible()
      const dragging = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
      expect(dragging.violations).toEqual([])
      await page.mouse.up()
      await openColumnMenu(page, 'sized', 0)
      await expect(item(page, 'Wider')).toBeVisible()
      const menu = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
      expect(menu.violations).toEqual([])
    })
  }
})
