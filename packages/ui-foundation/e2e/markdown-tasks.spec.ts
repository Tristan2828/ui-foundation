import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// <Markdown onTasksChange>: task items ticked where they're read, by
// mouse and keyboard, each box named for its item, and only that item's
// box changing in the text. The TickableTasks story shows what it would
// save and the count (countTasks) a table would show.
const TASKS = 'http://localhost:6180/story.html?id=app-markdown--tickable-tasks'
const DEFAULT = 'http://localhost:6180/story.html?id=app-markdown--default'
const SLOW = 'http://localhost:6180/story.html?id=app-markdown--tasks-saved-slowly'

const AXE_RULES = ['landmark-one-main', 'page-has-heading-one', 'region']

test.describe('ticking task items where they are read', () => {
  test('without onTasksChange, the boxes are pictures, nothing to tick', async ({ page }) => {
    await page.goto(DEFAULT)
    await expect(page.getByText('Booked the van')).toBeVisible()
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    await expect(page.getByRole('img', { name: 'Done', exact: true })).toBeVisible()
  })

  test('each box is a checkbox named for its item; a code block has none', async ({ page }) => {
    await page.goto(TASKS)
    await expect(page.getByRole('checkbox')).toHaveCount(7)
    await expect(page.getByRole('checkbox', { name: 'Order boxes' })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Book the van' })).not.toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Label every box', exact: true })).toBeVisible()
    await expect(page.getByTestId('task-count')).toHaveText('2/7 done')
  })

  test('a click ticks one item in the text, and again unticks it', async ({ page }) => {
    await page.goto(TASKS)
    const van = page.getByRole('checkbox', { name: 'Book the van' })
    await van.click()
    await expect(van).toBeChecked()
    await expect(page.getByTestId('saved-tasks')).toContainText('- [x] Book the van\n- [x] Order boxes\n  - [ ] Small boxes')
    await expect(page.getByTestId('task-count')).toHaveText('3/7 done')
    await van.click()
    await expect(van).not.toBeChecked()
    await expect(page.getByTestId('saved-tasks')).toContainText('- [ ] Book the van\n')
  })

  test('from the keyboard: Tab reaches each box, Space ticks it', async ({ page }) => {
    await page.goto(TASKS)
    await page.keyboard.press('Tab')
    await expect(page.getByRole('checkbox', { name: 'Book the van' })).toBeFocused()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('checkbox', { name: 'Small boxes' })).toBeFocused()
    await page.keyboard.press('Space')
    await expect(page.getByTestId('saved-tasks')).toContainText('  - [x] Small boxes\n  - [x] Wardrobe boxes')
  })

  test('items numbered, loose and in a callout tick in place', async ({ page }) => {
    await page.goto(TASKS)
    await page.getByRole('checkbox', { name: 'Read the meters' }).click()
    await page.getByRole('checkbox', { name: 'Label every box', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Keep the receipt' }).click()
    const saved = page.getByTestId('saved-tasks')
    await expect(saved).toContainText('1. [x] Read the meters')
    await expect(saved).toContainText('- [x] Label every box\n\n  Kitchen first')
    await expect(saved).toContainText('> - [x] Keep the receipt')
    await expect(saved).toContainText('```\n- [ ] not a task, just text\n```')
    await expect(page.getByTestId('task-count')).toHaveText('5/7 done')
  })

  test('on a slow save, two quick ticks both show at once and both are saved', async ({ page }) => {
    await page.goto(SLOW)
    const slow = page.locator('[data-fixture="slow"]')
    await slow.getByRole('checkbox', { name: 'Water the ferns' }).click()
    await slow.getByRole('checkbox', { name: 'Feed the fish' }).click()
    await expect(slow.getByRole('checkbox', { name: 'Water the ferns' })).toBeChecked()
    await expect(slow.getByRole('checkbox', { name: 'Feed the fish' })).toBeChecked()
    await expect(page.getByTestId('saved-slow')).toHaveText('- [x] Water the ferns\n- [x] Feed the fish\n')
    await expect(slow.getByRole('checkbox', { name: 'Water the ferns' })).toBeChecked()
  })

  test('a save that fails puts the box back', async ({ page }) => {
    await page.goto(SLOW)
    const box = page.locator('[data-fixture="failing"]').getByRole('checkbox', { name: 'Water the ferns' })
    await box.click()
    await expect(box).toBeChecked()
    await expect(box).not.toBeChecked()
    await expect(page.getByTestId('saved-failing')).toHaveText('- [ ] Water the ferns\n- [ ] Feed the fish\n')
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`zero axe violations (${theme})`, async ({ page }) => {
      await page.goto(`${TASKS}&theme=${theme}`)
      await page.getByRole('checkbox', { name: 'Book the van' }).click()
      const results = await new AxeBuilder({ page }).disableRules(AXE_RULES).analyze()
      expect(results.violations).toEqual([])
    })
  }
})
