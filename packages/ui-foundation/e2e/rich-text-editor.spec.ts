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
