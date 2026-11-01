import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// The notes editor's highlight, full screen, Indent and Outdent, and the
// caret in a new task item, in a real browser. The Features story's
// editors: "formats" ("Format me here." and two more lines) and "tasks"
// ("Open item", "Done item"); each shows what it would save.
const FEATURES = 'http://localhost:6180/story.html?id=app-richtexteditor--features'
const DEFAULT = 'http://localhost:6180/story.html?id=app-richtexteditor--default'

const editor = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true })
const saved = (page: Page, name: string) => page.getByTestId(`saved-${name}`)
const field = (page: Page, name: string) => page.locator('[data-slot=rich-text-editor]', { has: editor(page, name) })
const button = (page: Page, name: string, within = page.locator('body')) => within.getByRole('button', { name, exact: true })

// Selects "Format", the first word of the formats editor.
async function selectFormat(page: Page) {
  await editor(page, 'formats').locator('p').first().dblclick({ position: { x: 8, y: 8 } })
  await page.waitForTimeout(100)
}

const AXE_RULES = ['landmark-one-main', 'page-has-heading-one', 'region']

test.describe('highlight', () => {
  test('a colour from the toolbar menu is written as ==…== and read back', async ({ page }) => {
    await page.goto(FEATURES)
    await selectFormat(page)
    await button(page, 'Highlight', field(page, 'formats')).first().click()
    await page.getByRole('menuitemradio', { name: 'Green' }).click()
    await expect(editor(page, 'formats').locator('mark[data-color=green]')).toHaveText('Format')
    await expect(saved(page, 'formats')).toContainText('=={green}Format== me here.')
    await expect(editor(page, 'formats')).toBeFocused()
  })

  test('amber is the default colour, and Remove highlight takes it off', async ({ page }) => {
    await page.goto(FEATURES)
    await selectFormat(page)
    await button(page, 'Highlight', field(page, 'formats')).first().click()
    await page.getByRole('menuitemradio', { name: 'Amber' }).click()
    await expect(saved(page, 'formats')).toContainText('==Format== me here.')
    await button(page, 'Highlight', field(page, 'formats')).first().click()
    await page.getByRole('menuitem', { name: 'Remove highlight' }).click()
    await expect(editor(page, 'formats').locator('mark')).toHaveCount(0)
    await expect(saved(page, 'formats')).toContainText('Format me here.')
  })

  test('the floating toolbar has the menu, and stays open through it', async ({ page }) => {
    await page.goto(FEATURES)
    await selectFormat(page)
    const bar = page.getByRole('toolbar', { name: 'Format selection' })
    await bar.getByRole('button', { name: 'Highlight' }).click()
    await page.getByRole('menuitemradio', { name: 'Red' }).click()
    await expect(saved(page, 'formats')).toContainText('=={red}Format== me here.')
    await expect(bar).toBeVisible()
  })

  test('the slash menu highlights what is typed next', async ({ page }) => {
    await page.goto(FEATURES)
    await editor(page, 'formats').locator('p').last().click()
    await page.waitForTimeout(100)
    await page.keyboard.press('ControlOrMeta+End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('/yellow')
    await expect(page.getByRole('option', { name: 'Yellow highlight' })).toBeVisible()
    await page.keyboard.press('Enter')
    await page.keyboard.type('marked')
    await expect(saved(page, 'formats')).toContainText('=={yellow}marked==')
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`all four colours and the open menu, zero axe violations (${theme})`, async ({ page }) => {
      await page.goto(`${DEFAULT}&theme=${theme}`)
      await expect(page.locator('mark')).toHaveCount(4)
      await button(page, 'Highlight').first().click()
      await expect(page.getByRole('menuitemradio', { name: 'Green' })).toBeVisible()
      const results = await new AxeBuilder({ page }).disableRules(AXE_RULES).analyze()
      expect(results.violations).toEqual([])
    })
  }
})

test.describe('full screen', () => {
  test('fills the window, keeps the text, and Esc leaves', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 700 })
    await page.goto(FEATURES)
    const box = field(page, 'formats')
    await button(page, 'Full screen', box).click()
    await expect(box).toHaveAttribute('data-full-screen', 'true')
    expect(await box.boundingBox()).toMatchObject({ x: 0, y: 0, width: 1000, height: 700 })
    await expect(editor(page, 'formats')).toBeFocused()
    await page.keyboard.type('Typed. ')
    await page.keyboard.press('Escape')
    await expect(box).not.toHaveAttribute('data-full-screen')
    await expect(saved(page, 'formats')).toContainText('Typed.')
    await expect(editor(page, 'formats')).toContainText('Typed.')
  })

  test('the button leaves it too, and Esc from the toolbar', async ({ page }) => {
    await page.goto(FEATURES)
    const box = field(page, 'formats')
    await button(page, 'Full screen', box).click()
    await button(page, 'Full screen', box).click()
    await expect(box).not.toHaveAttribute('data-full-screen')
    await button(page, 'Full screen', box).click()
    await button(page, 'Bold', box).focus()
    // The first Esc may close the button's tooltip, which has it first.
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(box).not.toHaveAttribute('data-full-screen')
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`zero axe violations (${theme})`, async ({ page }) => {
      await page.goto(`${DEFAULT}&theme=${theme}`)
      await button(page, 'Full screen').click()
      const results = await new AxeBuilder({ page }).disableRules(AXE_RULES).analyze()
      expect(results.violations).toEqual([])
    })
  }
})

test.describe('indent and outdent', () => {
  test('not on a wide screen with a mouse', async ({ page }) => {
    await page.goto(FEATURES)
    await expect(button(page, 'Indent', field(page, 'tasks'))).toHaveCount(0)
  })

  test('on a phone, they nest a list item and bring it back', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto(FEATURES)
    const tasks = field(page, 'tasks')
    await editor(page, 'tasks').getByText('Done item').click()
    await page.waitForTimeout(100)
    await button(page, 'Indent', tasks).click()
    await expect(saved(page, 'tasks')).toContainText('- [ ] Open item\n  - [x] Done item')
    await button(page, 'Outdent', tasks).click()
    await expect(saved(page, 'tasks')).toContainText('- [ ] Open item\n- [x] Done item')
    await expect(editor(page, 'tasks')).toBeFocused()
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`on a phone, zero axe violations (${theme})`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 800 })
      await page.goto(`${FEATURES}&theme=${theme}`)
      await expect(button(page, 'Indent', field(page, 'tasks'))).toBeVisible()
      const results = await new AxeBuilder({ page }).disableRules(AXE_RULES).analyze()
      expect(results.violations).toEqual([])
    })
  }
})

test.describe('a new task item', () => {
  test('shows where typing goes: a placeholder with room, and the caret there', async ({ page }) => {
    await page.goto(FEATURES)
    await editor(page, 'tasks').getByText('Done item').click()
    await page.waitForTimeout(100)
    await page.keyboard.press('ControlOrMeta+End')
    await page.keyboard.press('Enter')
    const empty = editor(page, 'tasks').locator('p[data-placeholder="To-do"]')
    await expect(empty).toBeVisible()
    const row = await empty.locator('xpath=ancestor::li').boundingBox()
    const item = await empty.boundingBox()
    expect(item!.width).toBeGreaterThan(row!.width / 2)
    await page.keyboard.type('Call')
    await expect(empty).toHaveCount(0)
    await expect(saved(page, 'tasks')).toContainText('] Call')
  })

  test('the Task list button makes one with the placeholder showing', async ({ page }) => {
    await page.goto(FEATURES)
    await editor(page, 'formats').locator('p').last().click()
    await page.waitForTimeout(100)
    await page.keyboard.press('ControlOrMeta+End')
    await page.keyboard.press('Enter')
    await button(page, 'Task list', field(page, 'formats')).click()
    await expect(editor(page, 'formats').locator('p[data-placeholder="To-do"]')).toBeVisible()
  })
})
