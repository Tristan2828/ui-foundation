import { expect, test, type Page } from '@playwright/test'

// Board (app/Board): moving a card by dragging it and by its Move menu
// (with the mouse and the keyboard), and a read-only board. Axe and the token check are
// e2e/fixtures-visual.spec.ts's.
const story = (name: string) => `http://localhost:6180/story.html?id=app-board--${name}`

const column = (page: Page, name: string) => page.getByRole('region', { name: new RegExp(`^${name} \\d+$`) })
const card = (page: Page, name: string) => page.locator('[data-slot=board-card]', { hasText: name })

test('a card dragged onto another column moves there, and the counts follow', async ({ page }) => {
  await page.goto(story('default'))
  await expect(column(page, 'Idea')).toContainText('Repaint the fence')
  await card(page, 'Repaint the fence').dragTo(column(page, 'Active'))
  await expect(column(page, 'Active')).toContainText('Repaint the fence')
  await expect(column(page, 'Idea')).not.toContainText('Repaint the fence')
  await expect(column(page, 'Active').getByRole('heading')).toHaveText('Active3')
})

test('the Move menu moves a card, and a value with no column takes it off the board', async ({ page }) => {
  await page.goto(story('default'))
  await page.getByRole('button', { name: 'Move Fix the gate latch' }).click()
  await expect(page.getByRole('menuitemradio', { name: 'Planned' })).toBeChecked()
  await page.getByRole('menuitemradio', { name: 'Finished' }).click()
  await expect(column(page, 'Finished')).toContainText('Fix the gate latch')
  await expect(column(page, 'Planned')).toContainText('No planned projects')

  await page.getByRole('button', { name: 'Move Plant a herb bed' }).click()
  await page.getByRole('menuitemradio', { name: 'Archived' }).click()
  await expect(card(page, 'Plant a herb bed')).toHaveCount(0)
})

test('from the keyboard, a move keeps the focus on the card and says where it went', async ({ page }) => {
  await page.goto(story('default'))
  const button = page.getByRole('button', { name: 'Move Fix the gate latch' })
  await button.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitemradio', { name: 'Idea' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitemradio', { name: 'Finished' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(column(page, 'Finished')).toContainText('Fix the gate latch')
  await expect(column(page, 'Finished').getByRole('button', { name: 'Move Fix the gate latch' })).toBeFocused()
  await expect(page.getByRole('status')).toHaveText('Moved Fix the gate latch to Finished')

  // Off the board: the board keeps the focus, inside the page.
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitemradio', { name: 'Idea' })).toBeFocused()
  await page.keyboard.press('End')
  await expect(page.getByRole('menuitemradio', { name: 'Archived' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(card(page, 'Fix the gate latch')).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Projects by stage' })).toBeFocused()
  await expect(page.getByRole('status')).toHaveText('Moved Fix the gate latch to Archived')
})

test('without moveTo, the Move menu is the columns by their names', async ({ page }) => {
  await page.goto(story('columns-only'))
  await page.getByRole('button', { name: 'Move Repaint the fence' }).click()
  await expect(page.getByRole('menuitemradio')).toHaveText(['Idea', 'Planned', 'Active', 'Finished'])
})

test('a read-only board has no drag and no Move button', async ({ page }) => {
  await page.goto(story('read-only'))
  await expect(column(page, 'Idea')).toContainText('Repaint the fence')
  await expect(page.locator('[draggable=true]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Move / })).toHaveCount(0)
})

test('the columns share a desktop’s width and scroll sideways on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(story('default'))
  const board = page.getByRole('group', { name: 'Projects by stage' })
  expect(await board.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.setViewportSize({ width: 390, height: 800 })
  expect(await board.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
  // One column at a time, with the edge of the next one showing.
  const [boardWidth, columnWidth] = await board.evaluate((el) => [
    el.clientWidth,
    el.querySelector('[data-slot=board-column]')!.getBoundingClientRect().width,
  ])
  expect(columnWidth).toBeGreaterThan(boardWidth * 0.86)
  expect(columnWidth).toBeLessThan(boardWidth)
})
