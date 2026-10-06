import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { MARKDOWN_FIXTURES } from '../src/components/app/rich-text-editor.fixtures'

// The rich-text editor's promise, in a real browser on the real editor:
// Markdown in, Markdown out, nothing the person didn't touch rewritten,
// and no HTML getting in. The RoundTrip story renders one editor per
// fixture, each with the Markdown it would save beside it.
const ROUND_TRIP = 'http://localhost:6006/iframe.html?id=app-richtexteditor--round-trip&viewMode=story'

const processor = unified().use(remarkParse).use(remarkGfm)
function lastBlockStart(markdown: string) {
  return processor.parse(markdown).children.at(-1)!.position!.start.offset!
}

function editor(page: Page, name: string) {
  return page.getByRole('textbox', { name, exact: true })
}

function saved(page: Page, name: string) {
  return page.getByTestId(`saved-${name}`)
}

// Puts the caret at the very end of the document: a click on its last
// block, then the end of the document. ProseMirror settles the selection
// a moment after it takes focus; a key pressed inside that moment (no
// person is that fast) can be undone by it, so focus settles first.
async function caretAtEnd(page: Page, name: string) {
  await editor(page, name).locator(':scope > *').last().click()
  await expect(editor(page, name)).toBeFocused()
  await page.waitForTimeout(100)
  await page.keyboard.press('ControlOrMeta+End')
}

test.describe('rich-text round trip', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ROUND_TRIP)
    await expect(editor(page, 'headings')).toBeVisible()
  })

  for (const [name, { markdown }] of Object.entries(MARKDOWN_FIXTURES)) {
    test(`${name}: typing and taking it back saves the text unchanged`, async ({ page }) => {
      await caretAtEnd(page, name)
      await page.keyboard.type('xyz')
      await expect(saved(page, name)).toContainText('xyz')
      for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace')
      expect(await saved(page, name).textContent()).toBe(markdown)
    })

    test(`${name}: editing the last block keeps every other block as written`, async ({ page }) => {
      await caretAtEnd(page, name)
      await page.keyboard.type(' Edited')
      await expect(saved(page, name)).toContainText('Edited')
      const text = (await saved(page, name).textContent())!
      const start = lastBlockStart(markdown)
      expect(text.slice(0, start)).toBe(markdown.slice(0, start))
    })
  }

  test('headings render under the page outline, from <h3>', async ({ page }) => {
    const headings = page.locator('[data-fixture="headings"]')
    await expect(headings.locator('h3')).toHaveText('Title')
    await expect(headings.locator('h4')).toHaveText('Second level')
    await expect(headings.locator('h1, h2')).toHaveCount(0)
  })

  test('raw HTML in the text shows as its characters, never as markup', async ({ page }) => {
    const box = editor(page, 'rawHtml')
    await expect(box).toContainText('<b>')
    await expect(box).toContainText('<script>alert(1)</script>')
    await expect(box.locator('b, script, div > div')).toHaveCount(0)
  })

  test('pasted HTML adds no markup: an HTML chip becomes plain text', async ({ page }) => {
    await caretAtEnd(page, 'headings')
    await editor(page, 'headings').evaluate((element) => {
      const data = new DataTransfer()
      data.setData(
        'text/html',
        '<p>Pasted <b>bold</b> <span data-type="html" data-value="<img src=x onerror=alert(1)>">chip</span></p>',
      )
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
    })
    await expect(saved(page, 'headings')).toContainText('Pasted **bold**')
    const text = (await saved(page, 'headings').textContent())!
    // The chip's HTML is now text, escaped so it can never parse as markup.
    expect(text).not.toMatch(/(^|[^\\])<img/)
    expect(text).toContain('\\<img')
  })

  test('an empty line is never written as HTML', async ({ page }) => {
    await caretAtEnd(page, 'headings')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.keyboard.type('After a gap')
    await expect(saved(page, 'headings')).toContainText('After a gap')
    expect(await saved(page, 'headings').textContent()).not.toContain('<br')
  })

  test("a task item's checkbox ticks it", async ({ page }) => {
    const box = page.locator('[data-fixture="taskList"]').getByRole('checkbox', { name: 'Done' }).first()
    await expect(box).not.toBeChecked()
    await box.click()
    await expect(box).toBeChecked()
    await expect(saved(page, 'taskList')).toContainText('- [x] Open item')
  })

  test('typing Markdown shortcuts formats as you go', async ({ page }) => {
    await caretAtEnd(page, 'headings')
    await page.keyboard.press('Enter')
    // `- ` turns the line into a list; the rest goes in the item.
    await page.keyboard.type('- ', { delay: 50 })
    await expect(editor(page, 'headings').locator('ul li')).toHaveCount(1)
    await page.keyboard.type('first item')
    await expect(editor(page, 'headings').locator('ul li')).toHaveText('first item')
    await expect(saved(page, 'headings')).toContainText('\n\n- first item\n')
  })
})

// What the editor does beyond formatting, on the Features story: paste
// and copy as Markdown, links, ticking a task from the keyboard, the
// placeholder and the length count.
const FEATURES = 'http://localhost:6006/iframe.html?id=app-richtexteditor--features&viewMode=story'

async function paste(page: Page, name: string, data: Record<string, string>) {
  await editor(page, name).evaluate((element, entries) => {
    const transfer = new DataTransfer()
    for (const [type, value] of Object.entries(entries)) transfer.setData(type, value)
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }))
  }, data)
}

// Selects the first word of the last line ("Plain"), from the keyboard.
async function selectFirstWord(page: Page, name: string) {
  await caretAtEnd(page, name)
  await page.keyboard.press('Home')
  for (let i = 0; i < 'Plain'.length; i++) await page.keyboard.press('Shift+ArrowRight')
  // ProseMirror reads a keyboard selection on the browser's next
  // selectionchange; a key pressed inside that moment sees the old one.
  await page.waitForTimeout(100)
}

test.describe('editing features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FEATURES)
    await expect(editor(page, 'links')).toBeVisible()
  })

  test('Markdown pasted as plain text arrives formatted, and still adds no HTML', async ({ page }) => {
    await caretAtEnd(page, 'links')
    await page.keyboard.press('Enter')
    await paste(page, 'links', { 'text/plain': '## Pasted\n\n**bold** and <b>tag</b>\n\n- one\n- two' })
    const box = editor(page, 'links')
    await expect(box.locator('h4')).toHaveText('Pasted')
    await expect(box.locator('strong')).toHaveText('bold')
    await expect(box.locator('ul li')).toHaveCount(2)
    await expect(box.locator('b')).toHaveCount(0)
    const text = (await saved(page, 'links').textContent())!
    expect(text).toContain('## Pasted\n\n**bold** and')
    expect(text).toContain('- one\n- two')
    expect(text).not.toMatch(/(^|[^\\])<b>/)
  })

  test('plain text with no Markdown in it pastes as typed, its spaces kept', async ({ page }) => {
    await caretAtEnd(page, 'links')
    await paste(page, 'links', { 'text/plain': ' and more' })
    await expect(saved(page, 'links')).toContainText('Plain words here. and more')
  })

  test('a copy is Markdown', async ({ page }) => {
    await editor(page, 'links').click()
    await page.keyboard.press('ControlOrMeta+a')
    const copied = await editor(page, 'links').evaluate((element) => {
      const transfer = new DataTransfer()
      element.dispatchEvent(new ClipboardEvent('copy', { clipboardData: transfer, bubbles: true, cancelable: true }))
      return transfer.getData('text/plain')
    })
    expect(copied).toContain('See the [setup guide](https://example.com/setup) for details.')
  })

  test('Ctrl/Cmd+K links the selected words: Enter applies, focus comes back', async ({ page }) => {
    await selectFirstWord(page, 'links')
    await page.keyboard.press('ControlOrMeta+k')
    const box = page.getByRole('dialog', { name: 'Add link' })
    const address = box.getByRole('textbox', { name: 'Link address' })
    await expect(address).toBeFocused()
    await address.fill('example.com/plain')
    await page.keyboard.press('Enter')
    await expect(box).toHaveCount(0)
    await expect(editor(page, 'links')).toBeFocused()
    await expect(editor(page, 'links').getByRole('link', { name: 'Plain', exact: true })).toHaveAttribute('href', 'https://example.com/plain')
    await expect(saved(page, 'links')).toContainText('[Plain](https://example.com/plain) words here.')
  })

  test('on a link, Ctrl/Cmd+K edits it, and Remove link takes it off', async ({ page }) => {
    await editor(page, 'links').getByText('setup guide').click()
    await page.waitForTimeout(100)
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ControlOrMeta+k')
    const box = page.getByRole('dialog', { name: 'Edit link' })
    await expect(box.getByRole('textbox', { name: 'Link address' })).toHaveValue('https://example.com/setup')
    await box.getByRole('button', { name: 'Remove link' }).click()
    await expect(box).toHaveCount(0)
    await expect(saved(page, 'links')).toContainText('See the setup guide for details.')
  })

  test('an address that could run code is refused; Esc closes the box', async ({ page }) => {
    const before = await saved(page, 'links').textContent()
    await selectFirstWord(page, 'links')
    await page.keyboard.press('ControlOrMeta+k')
    const box = page.getByRole('dialog', { name: 'Add link' })
    await box.getByRole('textbox', { name: 'Link address' }).fill('javascript:alert(1)')
    await page.keyboard.press('Enter')
    await expect(box.getByRole('alert')).toHaveText('Enter a web or email address, like https://example.com.')
    await expect(box.getByRole('textbox', { name: 'Link address' })).toHaveAccessibleDescription(
      'Enter a web or email address, like https://example.com.',
    )
    await page.keyboard.press('Escape')
    await expect(box).toHaveCount(0)
    await expect(editor(page, 'links')).toBeFocused()
    expect(await saved(page, 'links').textContent()).toBe(before)
  })

  test('Ctrl/Cmd+Shift+Enter ticks the task item the caret is in', async ({ page }) => {
    await editor(page, 'tasks').getByText('Open item').click()
    await page.waitForTimeout(100)
    await page.keyboard.press('ControlOrMeta+Shift+Enter')
    await expect(saved(page, 'tasks')).toContainText('- [x] Open item')
    await expect(page.locator('[data-fixture="tasks"]').getByRole('checkbox', { name: 'Done' }).first()).toBeChecked()
    await page.keyboard.press('ControlOrMeta+Shift+Enter')
    await expect(saved(page, 'tasks')).toContainText('- [ ] Open item')
  })

  test('the placeholder shows while the document is empty', async ({ page }) => {
    const box = editor(page, 'empty')
    await expect(box).toHaveAttribute('aria-placeholder', 'Write a description')
    await expect(box.locator('p[data-placeholder="Write a description"]')).toHaveCount(1)
    await box.click()
    await page.keyboard.type('Now it has words.')
    await expect(box.locator('p[data-placeholder]')).toHaveCount(0)
  })

  test('the count shows near the limit, describes the editor, and says when it is over', async ({ page }) => {
    await expect(editor(page, 'nearLimit')).toHaveAccessibleDescription('47 of 55 characters')
    await expect(editor(page, 'overLimit')).toHaveAccessibleDescription('9 characters over the limit of 20')
    // Below 80% of the limit there's no count.
    await caretAtEnd(page, 'nearLimit')
    for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace')
    await expect(page.locator('[data-fixture="nearLimit"] [data-slot=rich-text-editor-count]')).toHaveCount(0)
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`the link box has zero axe violations (${theme})`, async ({ page }) => {
      await page.goto(`${FEATURES}&globals=theme:${theme}`)
      await selectFirstWord(page, 'links')
      await page.keyboard.press('ControlOrMeta+k')
      const box = page.getByRole('dialog', { name: 'Add link' })
      await box.getByRole('textbox', { name: 'Link address' }).fill('javascript:x')
      await page.keyboard.press('Enter')
      await expect(box.getByRole('alert')).toBeVisible()
      const results = await new AxeBuilder({ page })
        .disableRules(['landmark-one-main', 'page-has-heading-one', 'region'])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }
})
