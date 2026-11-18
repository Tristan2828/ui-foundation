import AxeBuilder from './axe'
import { expect, test, type Locator, type Page } from '@playwright/test'

// The notes editor on a phone (review F11, the looks picked 2026-11-18:
// 1A, 2A, 3A, 4A): the toolbar is a short row pinned to the keyboard, with
// Aa for every format; the small controls take a 40px tap; the slash menu
// fits above the keyboard; selected words get their formats in the row,
// not a floating bar. The phone project (Pixel 7) runs it; the laptop's
// look, unchanged, is checked on the desktop one.
const FEATURES = 'http://localhost:6180/story.html?id=app-richtexteditor--features'
const TABLES = 'http://localhost:6180/story.html?id=app-richtexteditor--tables'
const FOLDING = 'http://localhost:6180/story.html?id=app-richtexteditor--folding'

const editor = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true })
const saved = (page: Page, name: string) => page.getByTestId(`saved-${name}`)
const fixture = (page: Page, name: string) => page.locator(`[data-fixture="${name}"]`)
const bar = (page: Page) => page.locator('[data-slot=rich-text-keyboard-bar]').getByRole('toolbar', { name: 'Formatting' })

// The review's floor for anything tapped.
const TAP = 40

// The square a tap lands in: the element's own box, or its `::before`
// (the invisible area round a small glyph), whichever is bigger.
async function tapArea(target: Locator): Promise<{ width: number; height: number }> {
  return target.evaluate((element) => {
    const own = element.getBoundingClientRect()
    const before = getComputedStyle(element, '::before')
    const width = before.content !== 'none' && before.position === 'absolute' ? parseFloat(before.width) : 0
    const height = before.content !== 'none' && before.position === 'absolute' ? parseFloat(before.height) : 0
    return { width: Math.max(own.width, width), height: Math.max(own.height, height) }
  })
}

async function expectTappable(target: Locator) {
  const area = await tapArea(target)
  expect(area.width).toBeGreaterThanOrEqual(TAP)
  expect(area.height).toBeGreaterThanOrEqual(TAP)
}

async function tapText(page: Page, name: string, which: 'first' | 'last' = 'first') {
  const line = editor(page, name).locator('p')
  await (which === 'first' ? line.first() : line.last()).click()
  await expect(editor(page, name)).toBeFocused()
}

test.describe('on a phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'the phone project only')

  test('the toolbar is a row pinned to the bottom of what is visible, shown while the field has focus', async ({ page }) => {
    await page.goto(FEATURES)
    await expect(editor(page, 'formats')).toBeVisible()
    // No rows above the text on a touch screen.
    await expect(page.locator('[data-slot=rich-text-toolbar]')).toHaveCount(0)
    await expect(bar(page)).toHaveCount(0)
    await tapText(page, 'formats')
    await expect(bar(page)).toBeVisible()
    const box = (await bar(page).boundingBox())!
    const viewport = page.viewportSize()!
    expect(Math.abs(box.y + box.height - viewport.height)).toBeLessThanOrEqual(1)
    expect(box.width).toBeCloseTo(viewport.width, 0)
    // A keyboard opening shrinks what's visible: the row follows its top.
    await page.setViewportSize({ width: viewport.width, height: 480 })
    await expect.poll(async () => Math.round((await bar(page).boundingBox())!.y + (await bar(page).boundingBox())!.height)).toBe(480)
    // Every button in it is at least 40px.
    for (const button of await bar(page).getByRole('button').all()) await expectTappable(button)
    // Hide keyboard: focus leaves the text, and the row goes.
    await bar(page).getByRole('button', { name: 'Hide Keyboard' }).click()
    await expect(editor(page, 'formats')).not.toBeFocused()
    await expect(bar(page)).toHaveCount(0)
  })

  test('the row has the list buttons, Insert and Undo, and a press keeps focus in the text', async ({ page }) => {
    await page.goto(FEATURES)
    await tapText(page, 'formats')
    for (const name of ['All Formats', 'Task List', 'Bulleted List', 'Outdent', 'Indent', 'Insert Block', 'Undo'])
      await expect(bar(page).getByRole('button', { name, exact: true })).toBeVisible()
    await bar(page).getByRole('button', { name: 'Bulleted List', exact: true }).click()
    await expect(saved(page, 'formats')).toContainText('- Format me here.')
    await expect(editor(page, 'formats')).toBeFocused()
    await bar(page).getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(saved(page, 'formats')).not.toContainText('- Format me here.')
    await expect(editor(page, 'formats')).toBeFocused()
  })

  test('selected words get their formats first in the row, and no floating bar', async ({ page }) => {
    await page.goto(FEATURES)
    await editor(page, 'formats').locator('p').first().dblclick({ position: { x: 8, y: 8 } })
    await expect(bar(page).getByRole('button').nth(1)).toHaveAccessibleName('Bold')
    await expect(page.getByRole('toolbar', { name: 'Format selection' })).toHaveCount(0)
    await bar(page).getByRole('button', { name: 'Bold', exact: true }).click()
    await expect(saved(page, 'formats')).toContainText('**Format** me here.')
    await expect(bar(page).getByRole('button', { name: 'Bold', exact: true })).toHaveAttribute('aria-pressed', 'true')
  })

  test('Aa opens every format in the keyboard’s place, the caret kept; the keyboard button closes it', async ({ page }) => {
    await page.goto(FEATURES)
    await tapText(page, 'formats')
    await bar(page).getByRole('button', { name: 'All Formats' }).click()
    const panel = page.getByRole('group', { name: 'All Formats' })
    await expect(panel).toBeVisible()
    // The keyboard gives way: focus stays in the text, which asks for none.
    await expect(editor(page, 'formats')).toBeFocused()
    await expect(editor(page, 'formats')).toHaveAttribute('inputmode', 'none')
    // The row sits on the panel.
    const row = (await bar(page).boundingBox())!
    const box = (await panel.boundingBox())!
    expect(Math.abs(row.y + row.height - box.y)).toBeLessThanOrEqual(1)
    for (const button of await panel.getByRole('button').all()) await expectTappable(button)
    await panel.getByRole('button', { name: 'Heading 2', exact: true }).click()
    await expect(saved(page, 'formats')).toContainText('## Format me here.')
    await bar(page).getByRole('button', { name: 'Keyboard', exact: true }).click()
    await expect(panel).toHaveCount(0)
    await expect(editor(page, 'formats')).not.toHaveAttribute('inputmode', 'none')
    await expect(editor(page, 'formats')).toBeFocused()
  })

  test('Insert opens the slash menu on a new line, and the menu fits above the row', async ({ page }) => {
    await page.goto(FEATURES)
    // A keyboard's worth of the window gone.
    await page.setViewportSize({ width: page.viewportSize()!.width, height: 520 })
    await tapText(page, 'formats')
    await bar(page).getByRole('button', { name: 'Insert Block' }).click()
    const menu = page.getByRole('listbox', { name: 'Blocks' })
    await expect(menu).toBeVisible()
    await expect(saved(page, 'formats')).toContainText('Format me here.\n\n/')
    await expect.poll(async () => {
      const list = (await menu.boundingBox())!
      const row = (await bar(page).boundingBox())!
      return list.y >= 0 && list.y + list.height <= row.y
    }).toBe(true)
    // Its items are 40px, and one picked makes the block.
    await expectTappable(menu.getByRole('option').first())
    await page.keyboard.type('quote')
    await page.keyboard.press('Enter')
    await expect(saved(page, 'formats')).toContainText('Format me here.\n\n>')
  })

  test('a task box takes a tap 40px square, rows apart, and ticks', async ({ page }) => {
    await page.goto(FEATURES)
    const hit = fixture(page, 'tasks').locator('[data-slot=task-box]').first()
    await expectTappable(hit)
    // A tap 15px beside the box, inside the square, still ticks it.
    const box = (await hit.locator('input').boundingBox())!
    await page.touchscreen.tap(box.x + box.width / 2 - 15, box.y + box.height / 2)
    await expect(saved(page, 'tasks')).toContainText('- [x] Open item')
    // The two items' squares never overlap: rows are 40px apart.
    const rows = fixture(page, 'tasks').locator('li[data-item-type=task]')
    const first = (await rows.nth(0).boundingBox())!
    const second = (await rows.nth(1).boundingBox())!
    expect(first.height).toBeGreaterThanOrEqual(TAP)
    expect(second.y).toBeGreaterThanOrEqual(first.y + TAP)
  })

  test('a callout’s icon takes a 40px tap', async ({ page }) => {
    await page.goto(FEATURES)
    await expectTappable(fixture(page, 'callout').locator('[data-slot=rich-text-callout-kind]'))
  })

  test('a table’s grips take a 40px tap, and its rows are 40px', async ({ page }) => {
    await page.goto(TABLES)
    const cell = editor(page, 'compactTable').locator('tr').nth(1).locator('td').first()
    await cell.click()
    const column = fixture(page, 'compactTable').locator('[data-slot=rich-text-table-column-grip]')
    const row = fixture(page, 'compactTable').locator('[data-slot=rich-text-table-row-grip]')
    await expect(column).toBeVisible()
    await expect(row).toBeVisible()
    await expectTappable(column)
    await expectTappable(row)
    expect((await cell.boundingBox())!.height).toBeGreaterThanOrEqual(TAP)
  })

  test('a heading’s fold button takes a 40px tap', async ({ page }) => {
    await page.goto(FOLDING)
    await expectTappable(fixture(page, 'folding').locator('[data-slot=fold-button]:not(.invisible)').first())
  })

  test('Full Screen is in the Aa panel: the field fills the screen, the row stays on it, and the button leaves', async ({ page }) => {
    await page.goto(FEATURES)
    await tapText(page, 'formats')
    await bar(page).getByRole('button', { name: 'All Formats' }).click()
    await page.getByRole('group', { name: 'All Formats' }).getByRole('button', { name: 'Full Screen', exact: true }).click()
    const field = fixture(page, 'formats').locator('[data-slot=rich-text-editor]')
    await expect(field).toHaveAttribute('data-full-screen', 'true')
    await expect(page.getByRole('group', { name: 'All Formats' })).toHaveCount(0)
    await expect(editor(page, 'formats')).toBeFocused()
    await expect(bar(page)).toBeVisible()
    const box = (await bar(page).boundingBox())!
    expect(Math.abs(box.y + box.height - page.viewportSize()!.height)).toBeLessThanOrEqual(1)
    await bar(page).getByRole('button', { name: 'All Formats' }).click()
    await page.getByRole('group', { name: 'All Formats' }).getByRole('button', { name: 'Leave Full Screen', exact: true }).click()
    await expect(field).not.toHaveAttribute('data-full-screen', 'true')
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`the row and the panel have zero axe violations (${theme})`, async ({ page }) => {
      await page.goto(`${FEATURES}&theme=${theme}`)
      await tapText(page, 'formats')
      await expect(bar(page)).toBeVisible()
      let results = await new AxeBuilder({ page }).include('[data-slot=rich-text-keyboard-bar]').analyze()
      expect(results.violations).toEqual([])
      await bar(page).getByRole('button', { name: 'All Formats' }).click()
      await expect(page.getByRole('group', { name: 'All Formats' })).toBeVisible()
      results = await new AxeBuilder({ page }).include('[data-slot=rich-text-keyboard-bar]').analyze()
      expect(results.violations).toEqual([])
    })
  }
})

test.describe('on a laptop', () => {
  test.skip(({ isMobile }) => isMobile, 'the desktop project only')

  test('the rows above the text and the floating bar stay; no keyboard row, no tap areas', async ({ page }) => {
    await page.goto(FEATURES)
    await expect(fixture(page, 'formats').getByRole('toolbar', { name: 'Formatting' })).toBeVisible()
    await editor(page, 'formats').locator('p').first().dblclick({ position: { x: 8, y: 8 } })
    await expect(page.getByRole('toolbar', { name: 'Format selection' })).toBeVisible()
    await expect(page.locator('[data-slot=rich-text-keyboard-bar]')).toHaveCount(0)
    // The task box as it was: 16px, its row as tall as its line.
    const hit = fixture(page, 'tasks').locator('[data-slot=task-box]').first()
    expect((await tapArea(hit)).width).toBeLessThan(TAP)
    expect((await fixture(page, 'tasks').locator('li[data-item-type=task]').first().boundingBox())!.height).toBeLessThan(TAP)
  })
})
