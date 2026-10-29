import { expect, test, type Page } from '@playwright/test'

// Board (app/Board): moving a card by dragging it and by its Move menu,
// and a read-only board. Axe and the token check are
// e2e/storybook-visual.spec.ts's.
const story = (name: string) => `http://localhost:6006/iframe.html?id=app-board--${name}&viewMode=story`

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
  await expect(page.getByText('Plant a herb bed')).toHaveCount(0)
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
})
