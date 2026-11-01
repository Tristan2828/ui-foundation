import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Notes edited where they're read (#183), on the RichTextEditor Inline
// story: `editInPlace`'s `inline` over RichTextEditor's `inline` and
// `toolbar="floating"`. Notes holds "Pack the **shared** shelves first."
// and "Then the desks."; Next steps is empty. Each save takes 300ms.
const INLINE = 'http://localhost:6180/story.html?id=app-richtexteditor--inline'

const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true })
const notes = (page: Page) => region(page, 'Notes').getByRole('textbox', { name: 'Notes' })
const floating = (page: Page) => page.getByRole('toolbar', { name: 'Format selection' })
const menu = (page: Page) => page.getByRole('listbox', { name: 'Blocks' })

async function openInline(page: Page, theme?: 'light' | 'dark') {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(theme ? `${INLINE}&theme=${theme}` : INLINE)
  await expect(notes(page)).toBeVisible()
}

// The caret at the end of the notes. ProseMirror settles the selection a
// moment after it takes focus, so focus settles first.
async function caretAtEnd(page: Page) {
  await notes(page).locator('p').last().click()
  await expect(notes(page)).toBeFocused()
  await page.waitForTimeout(100)
  await page.keyboard.press('ControlOrMeta+End')
}

// Selects "Pack", the first word, with a double click on it.
async function pickWord(page: Page) {
  await notes(page).locator('p').first().dblclick({ position: { x: 8, y: 8 } })
  await page.waitForTimeout(100)
}

test.describe('rich text edited inline', () => {
  test('at rest the notes are the editor, drawn as the text: no box, no pencil, no fixed toolbar', async ({ page }) => {
    await openInline(page)
    await expect(page.getByRole('button', { name: 'Edit Notes' })).toHaveCount(0)
    await expect(page.getByRole('toolbar')).toHaveCount(0)
    const field = region(page, 'Notes').locator('[data-slot="rich-text-editor"]')
    const look = await field.evaluate((element) => {
      const style = getComputedStyle(element)
      const text = element.querySelector('.ProseMirror')!.parentElement!
      return { border: style.borderTopWidth, radius: style.borderTopLeftRadius, padding: getComputedStyle(text).paddingLeft }
    })
    expect(look).toEqual({ border: '0px', radius: '0px', padding: '0px' })
    // The text starts where the section's own text does.
    const heading = (await region(page, 'Notes').getByRole('heading', { name: 'Notes' }).boundingBox())!
    const text = (await notes(page).locator('p').first().boundingBox())!
    expect(Math.abs(text.x - heading.x)).toBeLessThan(1)
  })

  test('an empty one shows the placeholder, not "Not set"', async ({ page }) => {
    await openInline(page)
    const next = region(page, 'Next steps')
    await expect(next.getByRole('textbox', { name: 'Next steps' })).toHaveAttribute(
      'aria-placeholder',
      'Write something, or type / for blocks',
    )
    await expect(next.locator('p[data-placeholder="Write something, or type / for blocks"]')).toBeVisible()
    await expect(next.getByText('Not set')).toHaveCount(0)
  })

  test('typing straight into the shown text saves it, with no click to open', async ({ page }) => {
    await openInline(page)
    await caretAtEnd(page)
    await page.keyboard.type(' And chairs.')
    await expect(region(page, 'Notes').getByRole('status')).toHaveText('Saved', { timeout: 5000 })
    await expect(page.getByTestId('saved-notes')).toHaveText('Pack the **shared** shelves first.\n\nThen the desks. And chairs.\n')
    await expect(page.getByTestId('saves')).toHaveText('1')
    await expect(notes(page)).toBeFocused()
  })

  test('a selection shows the floating toolbar, which formats it; Alt+F10 reaches it', async ({ page }) => {
    await openInline(page)
    await expect(floating(page)).toHaveCount(0)
    await pickWord(page)
    await expect(floating(page)).toBeVisible()
    await expect(notes(page)).toHaveAttribute('aria-keyshortcuts', 'Alt+F10')
    await page.keyboard.press('Alt+F10')
    await expect(floating(page).getByRole('button', { name: 'Bold', exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('saved-notes')).toContainText('**Pack** the **shared** shelves first.', { timeout: 5000 })
    // Still no bar above the text.
    await expect(page.getByRole('toolbar', { name: 'Formatting' })).toHaveCount(0)
  })

  test('"/" at a line\'s start opens the blocks menu; a pick turns the line into one', async ({ page }) => {
    await openInline(page)
    await caretAtEnd(page)
    await page.keyboard.press('Enter')
    await page.keyboard.type('/')
    await expect(menu(page)).toBeVisible()
    await page.keyboard.type('h2')
    await page.keyboard.press('Enter')
    await expect(menu(page)).toHaveCount(0)
    await page.keyboard.type('Later')
    await expect(page.getByTestId('saved-notes')).toContainText('Then the desks.\n\n## Later', { timeout: 5000 })
  })

  test('leaving the page saves first and goes on, with no prompt', async ({ page }) => {
    await openInline(page)
    await caretAtEnd(page)
    await page.keyboard.type(' And chairs.')
    await page.getByRole('link', { name: 'Projects' }).click()
    await expect(page.getByText('Projects', { exact: true })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('dialog', { name: 'Discard your changes?' })).toHaveCount(0)
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`at rest, empty, and with the floating toolbar and the menu, zero axe violations (${theme})`, async ({ page }) => {
      await openInline(page, theme)
      const axe = () => new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
      expect((await axe()).violations).toEqual([])
      await pickWord(page)
      await expect(floating(page)).toBeVisible()
      expect((await axe()).violations).toEqual([])
      await caretAtEnd(page)
      await page.keyboard.press('Enter')
      await page.keyboard.type('/')
      await expect(menu(page)).toBeVisible()
      expect((await axe()).violations).toEqual([])
    })
  }
})

// The tools strip a floating-toolbar field carries while it has focus:
// Full screen, and Indent and Outdent on a phone (rich-text-tools-bar.tsx).
test.describe('the tools strip', () => {
  const tools = (page: Page) => page.getByRole('toolbar', { name: 'Editor tools' })

  test('only while the field has focus: Full screen, and no Indent with a mouse', async ({ page }) => {
    await openInline(page)
    await expect(tools(page)).toHaveCount(0)
    await caretAtEnd(page)
    await expect(tools(page)).toBeVisible()
    await expect(tools(page).getByRole('button')).toHaveCount(1)
    await expect(tools(page).getByRole('button', { name: 'Full screen' })).toBeVisible()
    await notes(page).blur()
    await page.mouse.click(5, 5)
    await expect(tools(page)).toHaveCount(0)
  })

  test('Full screen fills the window, keeps the text, and Esc leaves', async ({ page }) => {
    await openInline(page)
    await caretAtEnd(page)
    await tools(page).getByRole('button', { name: 'Full screen' }).click()
    const field = region(page, 'Notes').locator('[data-slot=rich-text-editor]')
    await expect(field).toHaveAttribute('data-full-screen', 'true')
    await expect(notes(page)).toBeFocused()
    await page.keyboard.type(' Typed.')
    await page.keyboard.press('Escape')
    await expect(field).not.toHaveAttribute('data-full-screen')
    await expect(page.getByTestId('saved-notes')).toContainText('Typed.', { timeout: 5000 })
  })

  test('on a phone it has Indent and Outdent, which nest a list item', async ({ page }) => {
    await openInline(page)
    await page.setViewportSize({ width: 390, height: 800 })
    await caretAtEnd(page)
    await page.keyboard.press('Enter')
    await page.keyboard.type('- One')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Two')
    await tools(page).getByRole('button', { name: 'Indent' }).click()
    await expect(page.getByTestId('saved-notes')).toContainText('- One\n  - Two', { timeout: 5000 })
    await tools(page).getByRole('button', { name: 'Outdent' }).click()
    await expect(page.getByTestId('saved-notes')).toContainText('- One\n- Two', { timeout: 5000 })
    await expect(notes(page)).toBeFocused()
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`on a phone, and full screen, zero axe violations (${theme})`, async ({ page }) => {
      await openInline(page, theme)
      await page.setViewportSize({ width: 390, height: 800 })
      await caretAtEnd(page)
      await expect(tools(page).getByRole('button', { name: 'Indent' })).toBeVisible()
      const axe = () => new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
      expect((await axe()).violations).toEqual([])
      await tools(page).getByRole('button', { name: 'Full screen' }).click()
      expect((await axe()).violations).toEqual([])
    })
  }
})
