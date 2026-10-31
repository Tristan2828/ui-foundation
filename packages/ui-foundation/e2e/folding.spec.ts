import { expect, test, type Page } from '@playwright/test'
import { FOLDING_SAMPLE } from '../src/components/app/folding.fixtures'

// Folding by headings (`foldKey`) and NotesOutline, on the Folding stories
// of <Markdown> and the rich-text editor. Each opens with Watering folded
// (unless something already is), the outline beside the text. Their axe
// checks, in both themes, are storybook-visual.spec.ts's.
const MARKDOWN = 'http://localhost:6006/iframe.html?id=app-markdown--folding&viewMode=story'
const EDITOR = 'http://localhost:6006/iframe.html?id=app-richtexteditor--folding&viewMode=story'

const outline = (page: Page) => page.getByRole('navigation', { name: 'Outline' })
// A heading's fold button, in the text (the outline's buttons are its headings' words too).
const fold = (page: Page, name: string) => page.locator('[data-slot="fold-button"]').and(page.getByRole('button', { name, exact: true, includeHidden: true }))

test.describe('folding <Markdown>', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(MARKDOWN)
    await expect(page.getByText('Three raised beds along the fence.')).toBeVisible()
  })

  test('opens with Watering folded: its section hidden, its button collapsed, the rest showing', async ({ page }) => {
    await expect(page.getByText('Every other morning in July and August.')).toBeHidden()
    await expect(page.getByText('Water the roots, not the leaves.')).toBeHidden()
    await expect(fold(page, 'Watering')).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByText('Beans from July')).toBeVisible()
  })

  test("a heading's button folds its section, sub-headings and table included, and opens it again", async ({ page }) => {
    await fold(page, 'Beds').click()
    await expect(fold(page, 'Beds')).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByText('Three raised beds along the fence.')).toBeHidden()
    await expect(page.getByText('Compost in March')).toBeHidden()
    await expect(page.getByRole('table')).toBeHidden()
    await fold(page, 'Beds').click()
    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByText('Compost in March')).toBeVisible()
  })

  test('the keyboard folds and opens: the buttons are tab stops', async ({ page }) => {
    await fold(page, 'Harvest').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText('Beans from July')).toBeHidden()
    await page.keyboard.press('Space')
    await expect(page.getByText('Beans from July')).toBeVisible()
  })

  test('what is folded is remembered on reload', async ({ page }) => {
    await fold(page, 'Harvest').click()
    await page.reload()
    await expect(page.getByText('Three raised beds along the fence.')).toBeVisible()
    await expect(page.getByText('Beans from July')).toBeHidden()
    await expect(page.getByText('Every other morning in July and August.')).toBeHidden()
  })

  test('the outline lists the top two levels and folds and opens everything', async ({ page }) => {
    await expect(outline(page).getByRole('listitem')).toHaveText(['Garden plan', 'Beds', 'Watering (folded)', 'Harvest', 'Shopping list'])
    await outline(page).getByRole('button', { name: 'Fold all' }).click()
    await expect(page.getByText('What goes where this year')).toBeHidden()
    await expect(page.getByText('Twine')).toBeHidden()
    await expect(outline(page).getByRole('button', { name: 'Fold all' })).toBeDisabled()
    await outline(page).getByRole('button', { name: 'Open all' }).click()
    await expect(page.getByText('Every other morning in July and August.')).toBeVisible()
    await expect(page.getByText('Twine')).toBeVisible()
    await expect(outline(page).getByRole('button', { name: 'Open all' })).toBeDisabled()
  })

  test('a jump from the outline opens the sections around a heading and lands on its button', async ({ page }) => {
    await outline(page).getByRole('button', { name: 'Fold all' }).click()
    await outline(page).getByRole('button', { name: 'Harvest' }).click()
    await expect(fold(page, 'Harvest')).toBeFocused()
    await expect(fold(page, 'Garden plan')).toHaveAttribute('aria-expanded', 'true')
    // Harvest itself stays folded; Enter on its button now opens it.
    await expect(page.getByText('Beans from July')).toBeHidden()
    await page.keyboard.press('Enter')
    await expect(page.getByText('Beans from July')).toBeVisible()
  })
})

test.describe('folding in the rich-text editor', () => {
  const text = (page: Page) => page.getByRole('textbox', { name: 'folding', exact: true })
  const saved = (page: Page) => page.getByTestId('saved-folding')

  test.beforeEach(async ({ page }) => {
    await page.goto(EDITOR)
    await expect(text(page).getByText('Three raised beds along the fence.')).toBeVisible()
  })

  test('opens with Watering folded, and a fold button folds and opens a section', async ({ page }) => {
    await expect(text(page).getByText('Every other morning in July and August.')).toBeHidden()
    await fold(page, 'Beds').click()
    await expect(text(page).getByText('Three raised beds along the fence.')).toBeHidden()
    await expect(text(page).locator('table')).toBeHidden()
    await fold(page, 'Beds').click()
    await expect(text(page).locator('table')).toBeVisible()
  })

  test('folding never changes the Markdown, and an edit with sections folded keeps them', async ({ page }) => {
    await fold(page, 'Beds').click()
    expect(await saved(page).textContent()).toBe(FOLDING_SAMPLE)
    await text(page).getByText('Twine').click()
    await page.waitForTimeout(100)
    await page.keyboard.press('End')
    await page.keyboard.type(' and labels')
    await expect(saved(page)).toContainText('Twine and labels')
    expect(await saved(page).textContent()).toBe(FOLDING_SAMPLE.replace('Twine', 'Twine and labels'))
  })

  test('Ctrl+Alt+[ folds the section the caret is in, Ctrl+Alt+] opens it', async ({ page }) => {
    await text(page).getByText('Compost in March').click()
    await page.waitForTimeout(100)
    await page.keyboard.press('ControlOrMeta+Alt+BracketLeft')
    await expect(fold(page, 'Soil')).toHaveAttribute('aria-expanded', 'false')
    await expect(text(page).getByText('Compost in March')).toBeHidden()
    // The caret went to Soil's heading, which still shows.
    await page.keyboard.type('!')
    await expect(saved(page)).toContainText('### Soil!')
    await page.keyboard.press('Backspace')
    await page.keyboard.press('ControlOrMeta+Alt+BracketRight')
    await expect(text(page).getByText('Compost in March')).toBeVisible()
  })

  test('the caret put inside a folded section opens it (an undo there)', async ({ page }) => {
    await text(page).getByText('Compost in March').click()
    await page.waitForTimeout(100)
    await page.keyboard.press('End')
    await page.keyboard.type(' and May')
    await expect(saved(page)).toContainText('and May')
    // Folded around the caret, the caret goes to the heading that folded.
    await fold(page, 'Beds').click()
    await expect(text(page).getByText('Compost in March')).toBeHidden()
    await page.keyboard.type('!')
    await expect(saved(page)).toContainText('## Beds!')
    await page.keyboard.press('ControlOrMeta+z')
    await page.keyboard.press('ControlOrMeta+z')
    await expect(fold(page, 'Beds')).toHaveAttribute('aria-expanded', 'true')
    await expect(text(page).getByText('Compost in March')).toBeVisible()
    expect(await saved(page).textContent()).toBe(FOLDING_SAMPLE)
  })

  test('arrow keys pass over a folded section', async ({ page }) => {
    await fold(page, 'Beds').click()
    await text(page).getByText('Beds', { exact: true }).click()
    await page.waitForTimeout(100)
    await page.keyboard.press('End')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('End')
    await page.keyboard.type('!')
    await expect(saved(page)).toContainText('## Watering!')
    await expect(fold(page, 'Beds')).toHaveAttribute('aria-expanded', 'false')
  })

  test('the outline beside the editor folds it and jumps into it', async ({ page }) => {
    await outline(page).getByRole('button', { name: 'Fold all' }).click()
    await expect(text(page).getByText('What goes where this year')).toBeHidden()
    await outline(page).getByRole('button', { name: 'Harvest' }).click()
    await expect(fold(page, 'Garden plan')).toHaveAttribute('aria-expanded', 'true')
    await expect(fold(page, 'Harvest')).toBeFocused()
  })
})
