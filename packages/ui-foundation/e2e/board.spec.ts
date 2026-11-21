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

// 4.131: order, groups and the header's slots (app-board--ordered, --grouped, --slots).
const lastMove = (page: Page) => page.getByTestId('last-move')
const cardNames = (page: Page, name: string) => column(page, name).locator('[data-slot=board-card] a')
const half = async (page: Page, name: string, where: 'top' | 'bottom') => {
  const box = (await card(page, name).boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + (where === 'top' ? box.height * 0.25 : box.height * 0.75) }
}
// A drag with the mouse, so the page can be looked at before the drop.
async function dragOver(page: Page, from: string, to: { x: number; y: number }) {
  const start = await half(page, from, 'top')
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  // The drag's first moves start it; one more is the dragover there.
  await page.mouse.move(to.x + 1, to.y + 1)
}

test('an ordered column shows a line where a dragged card will land, and reports its new neighbours', async ({ page }) => {
  await page.goto(story('ordered'))
  await expect(cardNames(page, 'Idea')).toHaveText(['Repaint the fence', 'Plant a herb bed', 'Oil the hinges'])
  await dragOver(page, 'Oil the hinges', await half(page, 'Repaint the fence', 'top'))
  const line = page.locator('[data-slot=board-drop-line]')
  await expect(line).toHaveCount(1)
  expect(await line.evaluate((el) => getComputedStyle(el).height)).toBe('3px')
  await page.mouse.up()
  await expect(lastMove(page)).toHaveText('Oil the hinges → idea, before 1, after none')
  await expect(cardNames(page, 'Idea')).toHaveText(['Oil the hinges', 'Repaint the fence', 'Plant a herb bed'])
  await expect(page.getByRole('status')).toHaveText('Moved Oil the hinges to place 1 of 5 in Idea')
  await expect(line).toHaveCount(0)
})

test('a card dropped where it already is reports nothing', async ({ page }) => {
  await page.goto(story('ordered'))
  await dragOver(page, 'Plant a herb bed', await half(page, 'Oil the hinges', 'top'))
  await page.mouse.up()
  await expect(lastMove(page)).toHaveText('No move yet')
  await expect(cardNames(page, 'Idea')).toHaveText(['Repaint the fence', 'Plant a herb bed', 'Oil the hinges'])
})

test('a drop after the last shown card lands before the first hidden one', async ({ page }) => {
  await page.goto(story('ordered'))
  await card(page, 'Fix the gate latch').dragTo(card(page, 'Oil the hinges'), { targetPosition: { x: 20, y: 60 } })
  await expect(lastMove(page)).toHaveText('Fix the gate latch → idea, before 8, after 7')
})

test('the whole card drags from its title link', async ({ page }) => {
  await page.goto(story('ordered'))
  await column(page, 'Planned').getByRole('link', { name: 'Fix the gate latch' }).dragTo(column(page, 'Active'))
  await expect(column(page, 'Active')).toContainText('Fix the gate latch')
  await expect(lastMove(page)).toHaveText('Fix the gate latch → active, before none, after 5')
})

test('Move Up, Move Down and Move to Top from the keyboard keep the focus on the card’s ⋯ and say where it went', async ({ page }) => {
  await page.goto(story('ordered'))
  const actions = page.getByRole('button', { name: 'Actions for Oil the hinges' })
  for (const [item, said, order] of [
    ['Move Up', 'Moved Oil the hinges up', ['Repaint the fence', 'Oil the hinges', 'Plant a herb bed']],
    ['Move Down', 'Moved Oil the hinges down', ['Repaint the fence', 'Plant a herb bed', 'Oil the hinges']],
    ['Move to Top', 'Moved Oil the hinges to the top', ['Oil the hinges', 'Repaint the fence', 'Plant a herb bed']],
  ] as const) {
    await actions.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menu')).toBeVisible()
    await page.getByRole('menuitem', { name: item, exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(cardNames(page, 'Idea')).toHaveText([...order])
    await expect(page.getByRole('status')).toHaveText(said)
    await expect(actions).toBeFocused()
  }
})

test('Order items that can’t apply are disabled, and the app’s items follow', async ({ page }) => {
  await page.goto(story('ordered'))
  await page.getByRole('button', { name: 'Actions for Repaint the fence' }).click()
  await expect(page.getByRole('menuitem', { name: 'Move Up' })).toBeDisabled()
  await expect(page.getByRole('menuitem', { name: 'Move to Top' })).toBeDisabled()
  await expect(page.getByRole('menuitem', { name: 'Move Down' })).toBeEnabled()
  await expect(page.getByRole('menuitem', { name: 'Copy Link' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await page.getByRole('button', { name: 'Actions for Fix the gate latch' }).click()
  for (const item of ['Move Up', 'Move Down', 'Move to Top']) await expect(page.getByRole('menuitem', { name: item })).toBeDisabled()
})

test('a column with ordered: false has no line and no Order items', async ({ page }) => {
  await page.goto(story('ordered'))
  await page.getByRole('button', { name: 'Actions for Clear the garage' }).click()
  await expect(page.getByRole('menuitem', { name: 'Move Up' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Copy Link' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await dragOver(page, 'Fix the gate latch', await half(page, 'Wash the windows', 'top'))
  await expect(page.locator('[data-slot=board-drop-line]')).toHaveCount(0)
  await expect(column(page, 'Finished')).toHaveAttribute('data-over', 'true')
  await page.mouse.up()
  await expect(lastMove(page)).toHaveText('Fix the gate latch → finished, before none, after none')
})

test('Show N More shows the next page of a column', async ({ page }) => {
  await page.goto(story('ordered'))
  await column(page, 'Idea').getByRole('button', { name: 'Show 2 More' }).click()
  await expect(cardNames(page, 'Idea')).toHaveCount(5)
  await expect(column(page, 'Idea').getByRole('button', { name: /^Show/ })).toHaveCount(0)
})

test('groups fold under their headings; a drop reports its group, and on a folded heading lands at its end', async ({ page }) => {
  await page.goto(story('grouped'))
  const quick = page.getByRole('group', { name: 'Quick 3' })
  await expect(quick.getByRole('button', { name: 'Quick 3' })).toHaveAttribute('aria-expanded', 'true')
  await expect(quick.getByRole('button', { name: 'Show 1 More' })).toBeVisible()
  const big = page.getByRole('button', { name: /^Big \d+$/ })
  await expect(big).toHaveText('Big 1')
  await expect(big).toHaveAttribute('aria-expanded', 'false')
  await expect(card(page, 'Build a shed')).toHaveCount(0)

  await dragOver(page, 'Repaint the fence', await half(page, 'Plant a herb bed', 'top'))
  await page.mouse.up()
  await expect(lastMove(page)).toHaveText('Repaint the fence → idea (quick), before 2, after none')
  await expect(page.getByRole('status')).toHaveText('Moved Repaint the fence to Idea, Quick')

  const box = (await big.boundingBox())!
  await dragOver(page, 'Fix the gate latch', { x: box.x + box.width / 2, y: box.y + box.height / 2 })
  await expect(big).toHaveClass(/ring-foreground/)
  await page.mouse.up()
  await expect(lastMove(page)).toHaveText('Fix the gate latch → idea (big), before none, after 8')

  await big.click()
  await expect(card(page, 'Build a shed')).toBeVisible()
  await expect(card(page, 'Fix the gate latch')).toBeVisible()
})

test('the header’s slots, and a phone’s row of counts that picks the one column', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(story('slots'))
  await expect(column(page, 'Idea')).toHaveClass(/border-foreground/)
  await expect(column(page, 'Idea').getByRole('button', { name: 'Add an idea' })).toBeVisible()
  await expect(column(page, 'Active')).toContainText('1 waiting on parts')
  await expect(column(page, 'Planned')).toContainText('Has a date or the parts')
  await expect(page.getByRole('group', { name: 'Projects by stage: columns' })).toBeHidden()

  await page.setViewportSize({ width: 390, height: 800 })
  const counts = page.getByRole('group', { name: 'Projects by stage: columns' })
  await expect(counts.getByRole('button')).toHaveText(['5 Ideas', '1 Planned', '2 Active', '2 Done'])
  await expect(column(page, 'Idea')).toBeVisible()
  await expect(column(page, 'Active')).toBeHidden()
  await counts.getByRole('button', { name: '2 Active' }).click()
  await expect(counts.getByRole('button', { name: '2 Active' })).toHaveAttribute('aria-pressed', 'true')
  await expect(column(page, 'Active')).toBeVisible()
  await expect(column(page, 'Idea')).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('an ordered board’s cards have no grip: a grab hand over them', async ({ page }) => {
  await page.goto(story('ordered'))
  expect(await card(page, 'Repaint the fence').evaluate((el) => getComputedStyle(el).cursor)).toBe('grab')
})
