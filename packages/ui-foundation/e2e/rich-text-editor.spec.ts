import AxeBuilder from './axe'
import { expect, test, type Locator, type Page } from '@playwright/test'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { MARKDOWN_FIXTURES } from '../src/components/app/rich-text-editor.fixtures'

// RichTextEditor reports an edit a pause after typing stops (300 ms, F6
// of the 2026-11-17 review): what it saved is read after that pause.
const afterPause = (page: Page) => page.waitForTimeout(400)

// The rich-text editor's promise, in a real browser on the real editor:
// Markdown in, Markdown out, nothing the person didn't touch rewritten,
// and no HTML getting in. The RoundTrip story renders one editor per
// fixture, each with the Markdown it would save beside it.
const ROUND_TRIP = 'http://localhost:6180/story.html?id=app-richtexteditor--round-trip'

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
      await afterPause(page)
      // Polled too: on a phone (Android) ProseMirror reads a Backspace from the DOM a moment later.
      await expect.poll(() => saved(page, name).textContent()).toBe(markdown)
    })

    test(`${name}: editing the last block keeps every other block as written`, async ({ page }) => {
      await caretAtEnd(page, name)
      await page.keyboard.type(' Edited')
      await expect(saved(page, name)).toContainText('Edited')
      await afterPause(page)
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
    await afterPause(page)
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
    await afterPause(page)
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

  test('>## at a line\'s start makes a toggle heading (># and >### likewise); ## stays plain', async ({ page }) => {
    await caretAtEnd(page, 'headings')
    await page.keyboard.press('Enter')
    await page.keyboard.type('>## ', { delay: 50 })
    await page.keyboard.type('Toggled')
    await expect(saved(page, 'headings')).toContainText('\n\n## Toggled {toggle="true"}\n')
    await page.keyboard.press('Enter')
    await page.keyboard.type('>### ', { delay: 50 })
    await page.keyboard.type('Smaller')
    await expect(saved(page, 'headings')).toContainText('\n\n### Smaller {toggle="true"}\n')
    await page.keyboard.press('Enter')
    await page.keyboard.type('## ', { delay: 50 })
    await page.keyboard.type('Plain')
    await expect(saved(page, 'headings')).toContainText('\n\n## Plain\n')
  })
})

// What the editor does beyond formatting, on the Features story: paste
// and copy as Markdown, links, ticking a task from the keyboard, the
// placeholder and the length count.
const FEATURES = 'http://localhost:6180/story.html?id=app-richtexteditor--features'

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
    await afterPause(page)
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
    const box = page.getByRole('dialog', { name: 'Add Link' })
    const address = box.getByRole('textbox', { name: 'Link Address' })
    await expect(address).toBeFocused()
    await address.fill('example.com/plain')
    await page.keyboard.press('Enter')
    await expect(box).toHaveCount(0)
    await expect(editor(page, 'links')).toBeFocused()
    await expect(editor(page, 'links').getByRole('link', { name: 'Plain', exact: true })).toHaveAttribute('href', 'https://example.com/plain')
    await expect(saved(page, 'links')).toContainText('[Plain](https://example.com/plain) words here.')
  })

  test('on a link, Ctrl/Cmd+K edits it, and Remove link takes it off', async ({ page }) => {
    // A click on the link would open it, so the caret goes in from the
    // keyboard: the start of "See the setup guide", then into "setup".
    await editor(page, 'links').locator('p').first().click({ position: { x: 2, y: 8 } })
    await page.waitForTimeout(100)
    await page.keyboard.press('Home')
    for (let i = 0; i < 'See the se'.length; i++) await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(100)
    await page.keyboard.press('ControlOrMeta+k')
    const box = page.getByRole('dialog', { name: 'Edit Link' })
    await expect(box.getByRole('textbox', { name: 'Link Address' })).toHaveValue('https://example.com/setup')
    await box.getByRole('button', { name: 'Remove Link' }).click()
    await expect(box).toHaveCount(0)
    await expect(saved(page, 'links')).toContainText('See the setup guide for details.')
  })

  test('a click on a link opens it in a new tab; the text is left as it was', async ({ page }) => {
    await page.context().route('https://example.com/**', (route) => route.fulfill({ body: 'opened' }))
    await afterPause(page)
    const before = await saved(page, 'links').textContent()
    const opened = page.waitForEvent('popup')
    await editor(page, 'links').getByRole('link', { name: 'setup guide' }).click()
    const tab = await opened
    expect(tab.url()).toBe('https://example.com/setup')
    // This page stays where it was, and nothing was typed or saved.
    expect(page.url()).toBe(FEATURES)
    await page.waitForTimeout(400)
    await afterPause(page)
    expect(await saved(page, 'links').textContent()).toBe(before)
  })

  test('a link opens only on a plain click: not on Shift+click or a drag over its words', async ({ page }) => {
    let popups = 0
    page.on('popup', () => popups++)
    const link = editor(page, 'links').getByRole('link', { name: 'setup guide' })
    await editor(page, 'links').locator('p').first().click({ position: { x: 2, y: 8 } })
    await page.waitForTimeout(100)
    await link.click({ modifiers: ['Shift'] })
    const box = (await link.boundingBox())!
    await page.mouse.move(box.x + 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 5 })
    await page.mouse.up()
    await page.waitForTimeout(300)
    expect(popups).toBe(0)
    await expect(link).toHaveCSS('cursor', 'pointer')
  })

  test('an address that could run code is refused; Esc closes the box', async ({ page }) => {
    await afterPause(page)
    const before = await saved(page, 'links').textContent()
    await selectFirstWord(page, 'links')
    await page.keyboard.press('ControlOrMeta+k')
    const box = page.getByRole('dialog', { name: 'Add Link' })
    await box.getByRole('textbox', { name: 'Link Address' }).fill('javascript:alert(1)')
    await page.keyboard.press('Enter')
    await expect(box.getByRole('alert')).toHaveText('Enter a web or email address, like https://example.com.')
    await expect(box.getByRole('textbox', { name: 'Link Address' })).toHaveAccessibleDescription(
      'Enter a web or email address, like https://example.com.',
    )
    // Two words are not an address either.
    await box.getByRole('textbox', { name: 'Link Address' }).fill('setup guide')
    await page.keyboard.press('Enter')
    await expect(box.getByRole('alert')).toHaveText('An address has no spaces. Remove them, or write each as %20.')
    await page.keyboard.press('Escape')
    await expect(box).toHaveCount(0)
    await expect(editor(page, 'links')).toBeFocused()
    await afterPause(page)
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
      await page.goto(`${FEATURES}&theme=${theme}`)
      await selectFirstWord(page, 'links')
      await page.keyboard.press('ControlOrMeta+k')
      const box = page.getByRole('dialog', { name: 'Add Link' })
      await box.getByRole('textbox', { name: 'Link Address' }).fill('javascript:x')
      await page.keyboard.press('Enter')
      await expect(box.getByRole('alert')).toBeVisible()
      const results = await new AxeBuilder({ page })
        .disableRules(['landmark-one-main', 'page-has-heading-one', 'region'])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }
})

// The fixed toolbar, on the Features story's "formats" editor.
test.describe('toolbar', () => {
  const toolbar = (page: Page, name: string) =>
    page.locator(`[data-fixture="${name}"]`).getByRole('toolbar', { name: 'Formatting' })

  // Selects the first word of the first line ("Format"), from the keyboard.
  async function selectFormat(page: Page) {
    await editor(page, 'formats').locator('p').first().click()
    await page.waitForTimeout(100)
    await page.keyboard.press('Home')
    for (let i = 0; i < 'Format'.length; i++) await page.keyboard.press('Shift+ArrowRight')
    await page.waitForTimeout(100)
  }

  // The caret in the first line, for a block format.
  async function caretInFirstLine(page: Page) {
    await editor(page, 'formats').locator('p').first().click()
    await page.waitForTimeout(100)
  }

  const button = (page: Page, label: string) => toolbar(page, 'formats').getByRole('button', { name: label, exact: true })

  test.skip(({ isMobile }) => isMobile, 'a laptop: a phone has the bar pinned to its keyboard (rich-text-phone.spec.ts)')

  test.beforeEach(async ({ page }) => {
    await page.goto(FEATURES)
    await expect(editor(page, 'formats')).toBeVisible()
  })

  test('one row of named buttons, each with its shortcut, one tab stop', async ({ page }) => {
    const bar = toolbar(page, 'formats')
    const labels = [
      'Bold', 'Italic', 'Strikethrough', 'Code', 'Highlight', 'Heading 1', 'Heading 2', 'Heading 3', 'Toggle Heading',
      'Task List', 'Bulleted List', 'Numbered List', 'Quote', 'Callout', 'Code Block', 'Divider', 'Table', 'Link', 'Full Screen',
    ]
    await expect(bar.getByRole('button')).toHaveCount(labels.length)
    for (const label of labels) await expect(bar.getByRole('button', { name: label, exact: true })).toBeVisible()
    await expect(button(page, 'Bold')).toHaveAttribute('aria-keyshortcuts', /^(Control|Meta)\+B$/)
    // Notion's block keys: Ctrl+Shift and a digit, Cmd+Option on a Mac.
    await expect(button(page, 'Bulleted List')).toHaveAttribute('aria-keyshortcuts', /^(Control\+Shift|Meta\+Alt)\+5$/)
    await expect(button(page, 'Strikethrough')).toHaveAttribute('aria-keyshortcuts', /^(Control|Meta)\+Shift\+S$/)
    await expect(bar.locator('[tabindex="0"]')).toHaveCount(1)
    await expect(bar).toHaveAttribute('aria-controls', /.+/)
  })

  test('the arrow keys, Home and End move along it; Shift+Tab from the text reaches it', async ({ page }) => {
    await caretInFirstLine(page)
    await page.keyboard.press('Shift+Tab')
    await expect(button(page, 'Bold')).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(button(page, 'Italic')).toBeFocused()
    await page.keyboard.press('End')
    await expect(button(page, 'Full Screen')).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(button(page, 'Bold')).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(button(page, 'Full Screen')).toBeFocused()
    await page.keyboard.press('Home')
    await expect(button(page, 'Bold')).toBeFocused()
  })

  test('a mark: on the selection, pressed while on, off again; the text keeps focus', async ({ page }) => {
    await selectFormat(page)
    // The text never loses focus during a press (on a phone, losing it
    // closes the keyboard and opens it again).
    await editor(page, 'formats').evaluate((element) => {
      ;(window as unknown as { blurs: number }).blurs = 0
      element.addEventListener('blur', () => (window as unknown as { blurs: number }).blurs++)
    })
    await button(page, 'Bold').click()
    await expect(editor(page, 'formats')).toBeFocused()
    expect(await page.evaluate(() => (window as unknown as { blurs: number }).blurs)).toBe(0)
    await expect(saved(page, 'formats')).toContainText('**Format** me here.')
    await expect(button(page, 'Bold')).toHaveAttribute('aria-pressed', 'true')
    await expect(button(page, 'Italic')).toHaveAttribute('aria-pressed', 'false')
    await button(page, 'Bold').click()
    await expect(saved(page, 'formats')).toContainText('Format me here.')
    await expect(saved(page, 'formats')).not.toContainText('**')
    await button(page, 'Strikethrough').click()
    await expect(saved(page, 'formats')).toContainText('~~Format~~ me here.')
  })

  test('from the keyboard: Enter on a button formats, and focus goes back to the text', async ({ page }) => {
    await selectFormat(page)
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('ArrowRight')
    await expect(button(page, 'Italic')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(editor(page, 'formats')).toBeFocused()
    await expect(saved(page, 'formats')).toContainText('*Format* me here.')
  })

  test('headings, a quote and a code block turn the line into one, and back', async ({ page }) => {
    const first = () => saved(page, 'formats')
    await caretInFirstLine(page)
    await button(page, 'Heading 1').click()
    await expect(first()).toContainText('# Format me here.')
    await expect(button(page, 'Heading 1')).toHaveAttribute('aria-pressed', 'true')
    await button(page, 'Heading 2').click()
    await expect(first()).toContainText('## Format me here.')
    await button(page, 'Heading 3').click()
    await expect(first()).toContainText('### Format me here.')
    await expect(button(page, 'Heading 2')).toHaveAttribute('aria-pressed', 'false')
    await button(page, 'Heading 3').click()
    await expect(first()).not.toContainText('#')
    await button(page, 'Quote').click()
    await expect(first()).toContainText('> Format me here.')
    await button(page, 'Quote').click()
    await expect(first()).not.toContainText('>')
    await button(page, 'Code Block').click()
    await expect(first()).toContainText('```\nFormat me here.\n```')
    await button(page, 'Code Block').click()
    await expect(first()).not.toContainText('```')
  })

  test('Toggle heading turns a heading into a toggle one and back, its level kept; a plain line becomes a toggle ##', async ({ page }) => {
    const first = () => saved(page, 'formats')
    await caretInFirstLine(page)
    await button(page, 'Toggle Heading').click()
    await expect(first()).toContainText('## Format me here. {toggle="true"}')
    await expect(button(page, 'Toggle Heading')).toHaveAttribute('aria-pressed', 'true')
    await expect(button(page, 'Heading 2')).toHaveAttribute('aria-pressed', 'false')
    // Heading 3 makes it a plain ###.
    await button(page, 'Heading 3').click()
    await expect(first()).toContainText('### Format me here.\n')
    await expect(first()).not.toContainText('toggle')
    await button(page, 'Toggle Heading').click()
    await expect(first()).toContainText('### Format me here. {toggle="true"}')
    await button(page, 'Toggle Heading').click()
    await expect(first()).not.toContainText('toggle')
    await expect(button(page, 'Heading 3')).toHaveAttribute('aria-pressed', 'true')
  })

  test('lists: bulleted, then numbered, then tasks, then plain again', async ({ page }) => {
    const text = () => saved(page, 'formats')
    await caretInFirstLine(page)
    await button(page, 'Bulleted List').click()
    await expect(text()).toContainText('- Format me here.')
    await expect(button(page, 'Bulleted List')).toHaveAttribute('aria-pressed', 'true')
    await button(page, 'Numbered List').click()
    await expect(text()).toContainText('1. Format me here.')
    await expect(button(page, 'Bulleted List')).toHaveAttribute('aria-pressed', 'false')
    await button(page, 'Task List').click()
    await expect(text()).toContainText('- [ ] Format me here.')
    await expect(button(page, 'Task List')).toHaveAttribute('aria-pressed', 'true')
    await button(page, 'Task List').click()
    await expect(text()).toContainText('Format me here.\n\nSecond line.')
    await expect(text()).not.toContainText('- ')
  })

  test('Link opens the link box for the selection', async ({ page }) => {
    await selectFormat(page)
    await button(page, 'Link').click()
    const box = page.getByRole('dialog', { name: 'Add Link' })
    await box.getByRole('textbox', { name: 'Link Address' }).fill('example.com')
    await page.keyboard.press('Enter')
    await expect(saved(page, 'formats')).toContainText('[Format](https://example.com) me here.')
    await expect(button(page, 'Link')).toHaveAttribute('aria-pressed', 'true')
  })

  test('read-only, every button is disabled but Full screen (reading is what it is for)', async ({ page }) => {
    const buttons = toolbar(page, 'readOnly').getByRole('button')
    await expect(buttons).toHaveCount(19)
    for (const one of await buttons.all()) {
      if ((await one.getAttribute('aria-label')) === 'Full Screen') await expect(one).toBeEnabled()
      else await expect(one).toBeDisabled()
    }
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`pressed, focused and with its tooltip open, zero axe violations (${theme})`, async ({ page }) => {
      await page.goto(`${FEATURES}&theme=${theme}`)
      await selectFormat(page)
      await button(page, 'Bold').click()
      await button(page, 'Italic').hover()
      await expect(page.locator('[data-slot=tooltip-content][data-open]')).toHaveText(/^Italic \((⌘I|Ctrl\+I)\)$/)
      const results = await new AxeBuilder({ page })
        .disableRules(['landmark-one-main', 'page-has-heading-one', 'region'])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }
})

// The floating toolbar over selected words, on the Features story's
// "formats" editor ("Format me here.", "Second line.", "Third line.").
test.describe('floating toolbar', () => {
  test.skip(({ isMobile }) => isMobile, 'a laptop: on a phone the bar pinned to its keyboard has the formats for words (rich-text-phone.spec.ts)')
  const floating = (page: Page) => page.getByRole('toolbar', { name: 'Format Selection' })
  const floatingButton = (page: Page, label: string) => floating(page).getByRole('button', { name: label, exact: true })
  const fixed = (page: Page) => page.locator('[data-fixture="formats"]').getByRole('toolbar', { name: 'Formatting' })

  // Selects the first word of a line with the mouse: a double click on it
  // (a line's box is the text's full width, so not at its middle).
  async function pickWord(page: Page, line: number) {
    await editor(page, 'formats').locator('p').nth(line).dblclick({ position: { x: 8, y: 8 } })
    await page.waitForTimeout(100)
  }

  // Selects the first word of the first line ("Format"), from the keyboard.
  async function selectFormat(page: Page) {
    await editor(page, 'formats').locator('p').first().click()
    await page.waitForTimeout(100)
    await page.keyboard.press('Home')
    for (let i = 0; i < 'Format'.length; i++) await page.keyboard.press('Shift+ArrowRight')
    await page.waitForTimeout(100)
  }

  test.beforeEach(async ({ page }) => {
    await page.goto(FEATURES)
    await expect(editor(page, 'formats')).toBeVisible()
  })

  test('shows over selected words with the formats for words, and goes when the selection does', async ({ page }) => {
    await expect(floating(page)).toHaveCount(0)
    await pickWord(page, 1)
    await expect(floating(page)).toBeVisible()
    const labels = ['Bold', 'Italic', 'Strikethrough', 'Code', 'Highlight', 'Link']
    await expect(floating(page).getByRole('button')).toHaveCount(labels.length)
    for (const label of labels) await expect(floatingButton(page, label)).toBeVisible()
    await expect(floating(page).locator('[tabindex="0"]')).toHaveCount(1)
    await expect(floating(page)).toHaveAttribute('aria-controls', /.+/)
    await expect(editor(page, 'formats')).toHaveAttribute('aria-keyshortcuts', 'Alt+F10')
    await page.keyboard.press('ArrowRight')
    await expect(floating(page)).toHaveCount(0)
  })

  test('above the words when there is room in the text, centred on them', async ({ page }) => {
    await pickWord(page, 2)
    const words = (await editor(page, 'formats').locator('p').nth(2).boundingBox())!
    const bar = (await floating(page).boundingBox())!
    expect(bar.y + bar.height).toBeLessThanOrEqual(words.y)
    await expect(floating(page)).toHaveAttribute('data-side', 'top')
  })

  test('on the first line it shows below the words, never over the fixed toolbar', async ({ page }) => {
    await pickWord(page, 0)
    const bar = (await floating(page).boundingBox())!
    const top = (await fixed(page).boundingBox())!
    const words = (await editor(page, 'formats').locator('p').first().boundingBox())!
    expect(bar.y).toBeGreaterThan(words.y)
    expect(bar.y).toBeGreaterThanOrEqual(top.y + top.height)
    await expect(floating(page)).toHaveAttribute('data-side', 'bottom')
  })

  test('waits for the mouse to be up before showing', async ({ page }) => {
    await editor(page, 'formats').scrollIntoViewIfNeeded()
    const line = (await editor(page, 'formats').locator('p').nth(1).boundingBox())!
    await page.mouse.move(line.x + 2, line.y + line.height / 2)
    await page.mouse.down()
    await page.mouse.move(line.x + 60, line.y + line.height / 2, { steps: 5 })
    await page.waitForTimeout(100)
    await expect(floating(page)).toHaveCount(0)
    await page.mouse.up()
    await expect(floating(page)).toBeVisible()
  })

  test('a press formats the words, shows it pressed, and keeps focus in the text', async ({ page }) => {
    await pickWord(page, 0)
    await editor(page, 'formats').evaluate((element) => {
      ;(window as unknown as { blurs: number }).blurs = 0
      element.addEventListener('blur', () => (window as unknown as { blurs: number }).blurs++)
    })
    await floatingButton(page, 'Bold').click()
    await expect(editor(page, 'formats')).toBeFocused()
    expect(await page.evaluate(() => (window as unknown as { blurs: number }).blurs)).toBe(0)
    await expect(saved(page, 'formats')).toContainText('**Format** me here.')
    await expect(floatingButton(page, 'Bold')).toHaveAttribute('aria-pressed', 'true')
    await floatingButton(page, 'Code').click()
    await expect(saved(page, 'formats')).toContainText('**`Format`**')
  })

  test('Alt+F10 reaches it; arrows move along it; Enter formats and goes back to the text', async ({ page }) => {
    await selectFormat(page)
    await page.keyboard.press('Alt+F10')
    await expect(floatingButton(page, 'Bold')).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(floatingButton(page, 'Italic')).toBeFocused()
    await page.keyboard.press('End')
    await expect(floatingButton(page, 'Link')).toBeFocused()
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
    await expect(editor(page, 'formats')).toBeFocused()
    await expect(saved(page, 'formats')).toContainText('*Format* me here.')
    // Still selected, so it's still there.
    await expect(floating(page)).toBeVisible()
  })

  test('Esc or Tab on it goes back to the text, the words still selected', async ({ page }) => {
    await selectFormat(page)
    await page.keyboard.press('Alt+F10')
    await page.keyboard.press('Tab')
    await expect(editor(page, 'formats')).toBeFocused()
    await expect(floating(page)).toBeVisible()
    await page.keyboard.press('Alt+F10')
    // The focused button's tooltip is open: the first Esc closes it (as on
    // the fixed toolbar), the next one leaves.
    await expect(page.locator('[data-slot=tooltip-content][data-open]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-slot=tooltip-content][data-open]')).toHaveCount(0)
    await expect(floatingButton(page, 'Bold')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(editor(page, 'formats')).toBeFocused()
    await expect(floating(page)).toHaveCount(0)
    // The words are still selected: a shortcut formats them.
    await page.keyboard.press('ControlOrMeta+b')
    await expect(saved(page, 'formats')).toContainText('**Format** me here.')
  })

  test('Esc in the text hides it until the selection changes', async ({ page }) => {
    await selectFormat(page)
    await expect(floating(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(floating(page)).toHaveCount(0)
    await page.keyboard.press('Shift+ArrowRight')
    await expect(floating(page)).toBeVisible()
  })

  test('Alt+F10 with nothing selected reaches the fixed toolbar', async ({ page }) => {
    await editor(page, 'formats').locator('p').first().click()
    await page.waitForTimeout(100)
    await page.keyboard.press('Alt+F10')
    await expect(fixed(page).getByRole('button', { name: 'Bold', exact: true })).toBeFocused()
  })

  test('Link opens the link box for the words, and it steps aside while the box is open', async ({ page }) => {
    await pickWord(page, 1)
    await floatingButton(page, 'Link').click()
    const box = page.getByRole('dialog', { name: 'Add Link' })
    await expect(box).toBeVisible()
    await expect(floating(page)).toHaveCount(0)
    await box.getByRole('textbox', { name: 'Link Address' }).fill('example.com')
    await page.keyboard.press('Enter')
    await expect(saved(page, 'formats')).toContainText('[Second](https://example.com) line.')
  })

  test('not in a code block, and not read-only', async ({ page }) => {
    await editor(page, 'formats').locator('p').first().click()
    await page.waitForTimeout(100)
    await fixed(page).getByRole('button', { name: 'Code Block', exact: true }).click()
    await editor(page, 'formats').locator('pre').dblclick({ position: { x: 16, y: 16 } })
    await page.waitForTimeout(100)
    await expect(floating(page)).toHaveCount(0)
    await editor(page, 'readOnly').locator('p').dblclick({ position: { x: 8, y: 8 } })
    await page.waitForTimeout(100)
    await expect(floating(page)).toHaveCount(0)
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`pressed, focused and with its tooltip open, zero axe violations (${theme})`, async ({ page }) => {
      await page.goto(`${FEATURES}&theme=${theme}`)
      await pickWord(page, 1)
      await floatingButton(page, 'Bold').click()
      await page.keyboard.press('Alt+F10')
      await expect(floatingButton(page, 'Bold')).toBeFocused()
      await floatingButton(page, 'Italic').hover()
      await expect(page.locator('[data-slot=tooltip-content][data-open]')).toHaveText(/^Italic \((⌘I|Ctrl\+I)\)$/)
      const results = await new AxeBuilder({ page })
        .disableRules(['landmark-one-main', 'page-has-heading-one', 'region'])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }
})

// The slash menu, on the Features story's "formats" editor: a "/" typed
// at the start of a new line after "Third line.".
test.describe('slash menu', () => {
  const menu = (page: Page) => page.getByRole('listbox', { name: 'Blocks' })
  const option = (page: Page, name: string) => menu(page).getByRole('option', { name, exact: true })
  const BLOCKS = [
    'Heading 1', 'Heading 2', 'Heading 3', 'Toggle Heading 1', 'Toggle Heading 2', 'Toggle Heading 3',
    'Task List', 'Bulleted List', 'Numbered List',
    'Quote', 'Callout', 'Code Block', 'Divider', 'Table',
  ]

  // A new empty line at the end, the caret on it.
  async function newLine(page: Page) {
    await caretAtEnd(page, 'formats')
    await page.keyboard.press('Enter')
  }

  test.beforeEach(async ({ page }) => {
    await page.goto(FEATURES)
    await expect(editor(page, 'formats')).toBeVisible()
  })

  test('"/" at a line\'s start lists the blocks; the text keeps focus and names the highlighted one', async ({ page }) => {
    await newLine(page)
    await page.keyboard.type('/')
    await expect(menu(page)).toBeVisible()
    await expect(menu(page).getByRole('option')).toHaveCount(BLOCKS.length)
    for (const name of BLOCKS) await expect(option(page, name)).toBeVisible()
    const text = editor(page, 'formats')
    await expect(text).toBeFocused()
    await expect(text).toHaveAttribute('aria-autocomplete', 'list')
    await expect(text).toHaveAttribute('aria-controls', (await menu(page).getAttribute('id'))!)
    await expect(option(page, 'Heading 1')).toHaveAttribute('aria-selected', 'true')
    await expect(text).toHaveAttribute('aria-activedescendant', (await option(page, 'Heading 1').getAttribute('id'))!)
  })

  test('typing filters it; Enter turns the line into the block, the "/…" gone', async ({ page }) => {
    await newLine(page)
    await page.keyboard.type('/num')
    await expect(menu(page).getByRole('option')).toHaveCount(1)
    await expect(option(page, 'Numbered List')).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Enter')
    await expect(menu(page)).toHaveCount(0)
    await page.keyboard.type('Step one')
    await expect(saved(page, 'formats')).toContainText('Third line.\n\n1. Step one')
    await expect(saved(page, 'formats')).not.toContainText('/num')
  })

  test('keywords match too: "/h2" is Heading 2, "/todo" a task list', async ({ page }) => {
    await newLine(page)
    await page.keyboard.type('/h2')
    await expect(menu(page).getByRole('option')).toHaveCount(1)
    await expect(option(page, 'Heading 2')).toBeVisible()
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Backspace')
    await page.keyboard.type('todo')
    await expect(menu(page).getByRole('option')).toHaveCount(1)
    await expect(option(page, 'Task List')).toBeVisible()
  })

  test('"/toggle" lists the toggle headings; a pick makes one, written with its marker', async ({ page }) => {
    await newLine(page)
    await page.keyboard.type('/toggle')
    await expect(menu(page).getByRole('option')).toHaveText(['Toggle Heading 1', 'Toggle Heading 2', 'Toggle Heading 3'])
    await option(page, 'Toggle Heading 2').click()
    await page.keyboard.type('Folds')
    await expect(saved(page, 'formats')).toContainText('Third line.\n\n## Folds {toggle="true"}')
  })

  test('the arrow keys move the highlight, round the ends; Tab picks too', async ({ page }) => {
    await newLine(page)
    await page.keyboard.type('/')
    await page.keyboard.press('ArrowUp')
    await expect(option(page, 'Table')).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect(option(page, 'Heading 2')).toHaveAttribute('aria-selected', 'true')
    await expect(editor(page, 'formats')).toHaveAttribute('aria-activedescendant', (await option(page, 'Heading 2').getAttribute('id'))!)
    await page.keyboard.press('Tab')
    await expect(editor(page, 'formats')).toBeFocused()
    await page.keyboard.type('Notes')
    await expect(saved(page, 'formats')).toContainText('Third line.\n\n## Notes')
  })

  test('a click picks, and never takes focus from the text', async ({ page }) => {
    await newLine(page)
    await page.keyboard.type('/')
    await option(page, 'Quote').click()
    await expect(editor(page, 'formats')).toBeFocused()
    await page.keyboard.type('Wise words')
    await expect(saved(page, 'formats')).toContainText('Third line.\n\n> Wise words')
  })

  test('Esc closes it and keeps what was typed; it stays closed', async ({ page }) => {
    await newLine(page)
    await page.keyboard.type('/qu')
    await page.keyboard.press('Escape')
    await expect(menu(page)).toHaveCount(0)
    await expect(editor(page, 'formats')).toBeFocused()
    await expect(editor(page, 'formats')).not.toHaveAttribute('aria-activedescendant', /.*/)
    await page.keyboard.type('o')
    await expect(menu(page)).toHaveCount(0)
    await page.keyboard.press('Enter')
    await expect(saved(page, 'formats')).toContainText('Third line.\n\n/quo')
  })

  test('no match hides it, and Enter is a new line again', async ({ page }) => {
    await newLine(page)
    await page.keyboard.type('/usr')
    await expect(menu(page)).toHaveCount(0)
    await page.keyboard.press('Enter')
    await page.keyboard.type('next')
    await expect(saved(page, 'formats')).toContainText('/usr\n\nnext')
  })

  test('only at a line\'s start, and only when typed', async ({ page }) => {
    // Mid-line.
    await caretAtEnd(page, 'formats')
    await page.keyboard.type(' /')
    await expect(menu(page)).toHaveCount(0)
    // In a code block.
    await page.keyboard.press('Enter')
    await page.keyboard.press('Control+Shift+Digit8')
    await page.keyboard.type('/')
    await expect(menu(page)).toHaveCount(0)
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Control+Shift+Digit0')
    // A "/" already at a line's start: the caret coming to it doesn't open it.
    await page.keyboard.type('/q')
    await page.keyboard.press('Escape')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowRight')
    await expect(menu(page)).toHaveCount(0)
  })

  test('Ctrl/Cmd+Z after a pick brings the "/…" back', async ({ page }) => {
    await newLine(page)
    await page.keyboard.type('/quo')
    await page.waitForTimeout(600)
    await page.keyboard.press('Enter')
    await expect(saved(page, 'formats')).toContainText('Third line.\n\n>')
    await page.keyboard.press('ControlOrMeta+z')
    await expect(saved(page, 'formats')).toContainText('Third line.\n\n/quo')
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`open, highlighted and hovered, zero axe violations (${theme})`, async ({ page }) => {
      await page.goto(`${FEATURES}&theme=${theme}`)
      await newLine(page)
      await page.keyboard.type('/')
      await page.keyboard.press('ArrowDown')
      await option(page, 'Task List').hover()
      await expect(option(page, 'Task List')).toHaveAttribute('aria-selected', 'true')
      const results = await new AxeBuilder({ page })
        .disableRules(['landmark-one-main', 'page-has-heading-one', 'region'])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }
})

// How written text looks, in the editor and in <Markdown>: `#` and
// `##` on tinted bands, `#`'s stronger with a 2px rule along its foot,
// `###` a small uppercase label, the rest of the text lined up with the
// words in the band, links in their own colour.
test.describe('how written text looks', () => {
  for (const [where, url] of [
    ['the editor', 'http://localhost:6180/story.html?id=app-richtexteditor--default'],
    ['<Markdown>', 'http://localhost:6180/story.html?id=app-markdown--default'],
  ] as const) {
    test(`${where}: # and ## on bands, ### a label, the text lined up with the band's words; links coloured`, async ({
      page,
    }) => {
      await page.goto(url)
      const scope = page.locator(where === 'the editor' ? '.ProseMirror' : '[data-slot=markdown]')
      await expect(scope.locator('h3').first()).toBeVisible()
      const look = (selector: string) =>
        scope
          .locator(selector)
          .first()
          .evaluate((element) => {
            const style = getComputedStyle(element)
            return {
              size: parseFloat(style.fontSize),
              band: style.backgroundColor,
              foot: parseFloat(style.borderBottomWidth),
              left: element.getBoundingClientRect().left,
              paddingLeft: parseFloat(style.paddingLeft),
              transform: style.textTransform,
            }
          })
      const [h1, h2, h3, body] = [await look('h3'), await look('h4'), await look('h5'), await look('p')]
      const transparent = 'rgba(0, 0, 0, 0)'
      expect(h1.size).toBeGreaterThan(h2.size)
      expect(h2.size).toBeGreaterThan(body.size)
      expect(h3.size).toBeLessThan(body.size)
      expect(h3.transform).toBe('uppercase')
      expect(h1.band).not.toBe(transparent)
      expect(h2.band).not.toBe(transparent)
      expect(h1.band).not.toBe(h2.band)
      expect(h3.band).toBe(transparent)
      expect([h1.foot, h2.foot]).toEqual([2, 0])
      // The text starts where the words inside the band do.
      expect(Math.abs(body.left - (h1.left + h1.paddingLeft))).toBeLessThan(1)
      expect(Math.abs(h3.left - body.left)).toBeLessThan(1)
      const color = (selector: string) => scope.locator(selector).first().evaluate((element) => getComputedStyle(element).color)
      expect(await color('a')).not.toBe(await color('p'))
      // The divider is a 2px line, not a hairline.
      expect(await scope.locator('hr').evaluate((element) => element.getBoundingClientRect().height)).toBe(2)
    })
  }
})

// Notion's keys, on the Features story's "formats" editor.
test.describe('Notion shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FEATURES)
    await expect(editor(page, 'formats')).toBeVisible()
  })

  test('Ctrl+Shift and a digit turns the line into a block; 0 makes it text again', async ({ page }) => {
    await editor(page, 'formats').locator('p').first().click()
    await page.waitForTimeout(100)
    const text = () => saved(page, 'formats')
    const steps: [string, string][] = [
      ['1', '# Format me here.'],
      ['0', 'Format me here.'],
      ['2', '## Format me here.'],
      ['0', 'Format me here.'],
      ['3', '### Format me here.'],
      ['0', 'Format me here.'],
      ['4', '- [ ] Format me here.'],
      ['5', '- Format me here.'],
      ['6', '1. Format me here.'],
      ['0', 'Format me here.'],
      ['8', '```\nFormat me here.\n```'],
      ['0', 'Format me here.'],
    ]
    for (const [digit, starts] of steps) {
      await page.keyboard.press(`Control+Shift+Digit${digit}`)
      await expect.poll(async () => (await text().textContent())!.startsWith(`${starts}\n`), { message: `after ${digit}` }).toBe(true)
    }
    await expect(editor(page, 'formats')).toBeFocused()
  })

  test('Ctrl/Cmd+Shift+S strikes the selected words through', async ({ page }) => {
    await editor(page, 'formats').locator('p').first().click()
    await page.waitForTimeout(100)
    await page.keyboard.press('Home')
    for (let i = 0; i < 'Format'.length; i++) await page.keyboard.press('Shift+ArrowRight')
    // ProseMirror reads a keyboard selection a moment after it changes.
    await page.waitForTimeout(100)
    await page.keyboard.press('ControlOrMeta+Shift+S')
    await expect(saved(page, 'formats')).toContainText('~~Format~~ me here.')
  })
})

// Callouts (`> [!NOTE]`), on the Features story's "callout" editor and,
// for making one, its "formats" editor.
test.describe('callouts', () => {
  const kindButton = (page: Page, kind: string) =>
    page.locator('[data-fixture="callout"]').getByRole('button', { name: `${kind} callout: change its kind` })

  test.beforeEach(async ({ page }) => {
    await page.goto(FEATURES)
    await expect(editor(page, 'callout').locator('[data-callout=note]')).toBeVisible()
  })

  test('drawn as its kind; typing in one writes it back as a callout', async ({ page }) => {
    await editor(page, 'callout').getByText('Measure twice.').click()
    await page.waitForTimeout(100)
    await page.keyboard.press('End')
    await page.keyboard.type(' Then cut.')
    await expect(saved(page, 'callout')).toContainText('> [!NOTE]\n> Measure twice. Then cut.\n\nAfter the callout.')
  })

  test('"/callout" makes one; "/" at a line\'s start in one changes its kind', async ({ page }) => {
    await caretAtEnd(page, 'formats')
    await page.keyboard.press('Enter')
    await page.keyboard.type('/callout')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Heads up')
    await expect(saved(page, 'formats')).toContainText('Third line.\n\n> [!NOTE]\n> Heads up')
    await page.keyboard.press('Enter')
    await page.keyboard.type('/warn')
    await expect(page.getByRole('option', { name: 'Warning callout', exact: true })).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(saved(page, 'formats')).toContainText('Third line.\n\n> [!WARNING]\n> Heads up')
  })

  test('its icon is a menu of kinds, and Remove callout keeps the text', async ({ page }) => {
    await kindButton(page, 'Note').click()
    await page.getByRole('menuitemradio', { name: 'Tip' }).click()
    await expect(saved(page, 'callout')).toContainText('> [!TIP]\n> Measure twice.')
    await expect(editor(page, 'callout')).toBeFocused()
    await kindButton(page, 'Tip').click()
    await page.getByRole('menuitem', { name: 'Remove Callout' }).click()
    await expect(saved(page, 'callout')).toContainText('Measure twice.\n\nAfter the callout.')
    await expect(saved(page, 'callout')).not.toContainText('[!')
  })

  test("the toolbar's Callout puts the line in one, and takes it out again", async ({ page, isMobile }) => {
    test.skip(isMobile, "a laptop's toolbar: a phone has the bar pinned to its keyboard (rich-text-phone.spec.ts)")
    await editor(page, 'formats').locator('p').first().click()
    await page.waitForTimeout(100)
    const button = page.locator('[data-fixture="formats"]').getByRole('button', { name: 'Callout', exact: true })
    await button.click()
    await expect(saved(page, 'formats')).toContainText('> [!NOTE]\n> Format me here.')
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await button.click()
    await expect(saved(page, 'formats')).not.toContainText('[!NOTE]')
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`its menu open, zero axe violations (${theme})`, async ({ page }) => {
      await page.goto(`${FEATURES}&theme=${theme}`)
      await kindButton(page, 'Note').click()
      await expect(page.getByRole('menu')).toBeVisible()
      const results = await new AxeBuilder({ page })
        .disableRules(['landmark-one-main', 'page-has-heading-one', 'region'])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }
})

// Tables, on the Features story's "table" editor (Part/Count, Top 1,
// Leg 4) and, for making one, its "formats" editor.
test.describe('tables', () => {
  const table = (page: Page) => editor(page, 'table').locator('table')
  const rows = (page: Page) => table(page).locator('tr')
  const cell = (page: Page, row: number, column: number) => rows(page).nth(row).locator('th, td').nth(column)
  const tableButton = (page: Page) =>
    page.locator('[data-fixture="table"]').getByRole('toolbar', { name: 'Formatting' }).getByRole('button', { name: 'Table', exact: true })
  // The caret's cell menu (Shift+F10), and an item in it.
  const pick = async (page: Page, name: string) => {
    await page.keyboard.press('Shift+F10')
    await page.getByRole('menu').getByRole(/^(Left|Center|Right)$/.test(name) ? 'menuitemradio' : 'menuitem', { name, exact: true }).click()
    await expect(page.getByRole('menu')).toHaveCount(0)
  }

  async function caretIn(page: Page, row: number, column: number) {
    await cell(page, row, column).click()
    await page.waitForTimeout(100)
    await page.keyboard.press('End')
  }

  test.beforeEach(async ({ page }) => {
    await page.goto(FEATURES)
    await expect(table(page)).toBeVisible()
  })

  test('"/table" puts one in, the caret in its first cell; Tab moves along, and adds a row from the last cell', async ({ page }) => {
    await caretAtEnd(page, 'formats')
    await page.keyboard.press('Enter')
    await page.keyboard.type('/table')
    await page.keyboard.press('Enter')
    const made = editor(page, 'formats').locator('table')
    await expect(made.locator('tr')).toHaveCount(3)
    for (const [index, word] of ['A', 'B', 'C', 'a1', 'b1', 'c1', 'a2', 'b2', 'c2'].entries()) {
      if (index > 0) await page.keyboard.press('Tab')
      await page.keyboard.type(word)
    }
    await page.keyboard.press('Tab')
    await expect(made.locator('tr')).toHaveCount(4)
    await page.keyboard.type('a3')
    await expect(saved(page, 'formats')).toContainText(/\| A +\| B +\| C +\|\n\| -+ \| -+ \| -+ \|\n\| a1 +\| b1 +\| c1 +\|/)
    await expect(saved(page, 'formats')).toContainText(/\| a3 +\| +\| +\|/)
  })

  test('Enter goes down the column, and out of the table from its last row; Shift+Enter adds nothing', async ({ page }) => {
    await caretIn(page, 1, 0)
    await page.keyboard.press('Shift+Enter')
    await page.keyboard.press('Enter')
    await page.keyboard.type('X')
    await expect(saved(page, 'table')).toContainText(/\| XLeg +\| 4/)
    await page.keyboard.press('Enter')
    await page.keyboard.type('Y')
    await expect(saved(page, 'table')).toContainText('YAfter the table.')
    await expect(saved(page, 'table')).toContainText(/\| Top +\| 1/)
  })

  test("a cell's menu adds rows and columns, aligns a column, and deletes", async ({ page }) => {
    await caretIn(page, 1, 0)
    await pick(page, 'Insert Row Below')
    await expect(rows(page)).toHaveCount(4)
    await expect(editor(page, 'table')).toBeFocused()
    await pick(page, 'Insert Column Right')
    await expect(rows(page).first().locator('th')).toHaveCount(3)
    await pick(page, 'Center')
    await expect(saved(page, 'table')).toContainText(/\n\| :-+: \| -+ \| -+ \|\n/)
    await pick(page, 'Delete Column')
    await expect(rows(page).first().locator('th')).toHaveCount(2)
    await pick(page, 'Delete Row')
    await expect(rows(page)).toHaveCount(3)
    await pick(page, 'Delete Table')
    await expect(table(page)).toHaveCount(0)
    await expect(saved(page, 'table')).not.toContainText('|')
  })

  test("in the header row, the row can't be deleted, moved or have one put above it; the toolbar's Table only puts one in outside a table", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "a laptop's toolbar: a phone has the bar pinned to its keyboard (rich-text-phone.spec.ts)")
    await caretIn(page, 0, 0)
    await expect(tableButton(page)).toBeDisabled()
    await page.keyboard.press('Shift+F10')
    const menu = page.getByRole('menu')
    await expect(menu.getByRole('menuitem', { name: 'Delete Row' })).toHaveAttribute('aria-disabled', 'true')
    await expect(menu.getByRole('menuitem', { name: 'Insert Row Above' })).toHaveAttribute('aria-disabled', 'true')
    await expect(menu.getByRole('menuitem', { name: 'Move Row Down' })).toHaveAttribute('aria-disabled', 'true')
    await expect(menu.getByRole('menuitem', { name: 'Insert Row Below' })).not.toHaveAttribute('aria-disabled', 'true')
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(editor(page, 'table')).toBeFocused()
    await editor(page, 'table').getByText('After the table.').click()
    await page.waitForTimeout(100)
    await expect(tableButton(page)).toBeEnabled()
    await tableButton(page).click()
    await expect(editor(page, 'table').locator('table')).toHaveCount(2)
  })

  test('the bars add a row at the end and a column at the right', async ({ page }) => {
    const fixture = page.locator('[data-fixture="table"]')
    await table(page).hover()
    await fixture.getByRole('button', { name: 'Add a Row' }).click()
    await expect(rows(page)).toHaveCount(4)
    await page.keyboard.type('Foot')
    await expect(saved(page, 'table')).toContainText(/\| Foot +\| +\|/)
    await fixture.getByRole('button', { name: 'Add a Column' }).click()
    await expect(rows(page).first().locator('th')).toHaveCount(3)
    await page.keyboard.type('Note')
    await expect(saved(page, 'table')).toContainText(/\| Part +\| Count +\| Note +\|/)
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`the caret in a table and its cell menu open, zero axe violations (${theme})`, async ({ page }) => {
      await page.goto(`${FEATURES}&theme=${theme}`)
      await caretIn(page, 1, 0)
      await page.keyboard.press('Shift+F10')
      await expect(page.getByRole('menu')).toBeVisible()
      const results = await new AxeBuilder({ page })
        .disableRules(['landmark-one-main', 'page-has-heading-one', 'region'])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }
})

test('"/divider" puts in a divider and a line under it', async ({ page }) => {
  await page.goto(FEATURES)
  await caretAtEnd(page, 'formats')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/divider')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Below')
  await expect(saved(page, 'formats')).toContainText('Third line.\n\n---\n\nBelow')
})

// Images uploaded into the text, on the ImageUploads story: each editor
// has a fake upload (1.2s to store, one that always fails, one that takes
// up to 1 MB, one on the floating toolbar), and one has none.
const IMAGE_UPLOADS = 'http://localhost:6180/story.html?id=app-richtexteditor--image-uploads'

// A PNG's bytes (a 1×1 pixel), padded to `size` bytes, as an array the
// page can make a File from.
function pngBytes(size = 68) {
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  return [...Buffer.concat([pixel, Buffer.alloc(Math.max(0, size - pixel.length))])]
}

type FileSpec = { name: string; type: string; bytes: number[] }
const photo = (name = 'photo.png', size?: number): FileSpec => ({ name, type: 'image/png', bytes: pngBytes(size) })

// A paste of files (and any text/html with them), as a screenshot or a
// copied image arrives.
async function pasteFiles(page: Page, name: string, files: FileSpec[], data: Record<string, string> = {}) {
  await editor(page, name).evaluate(
    (element, { files, data }) => {
      const transfer = new DataTransfer()
      for (const file of files) transfer.items.add(new File([new Uint8Array(file.bytes)], file.name, { type: file.type }))
      for (const [type, value] of Object.entries(data)) transfer.setData(type, value)
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }))
    },
    { files, data },
  )
}

// A drop of files from outside onto the start of the text's first block.
async function dropFiles(page: Page, name: string, files: FileSpec[]) {
  await editor(page, name).evaluate((element, files) => {
    const transfer = new DataTransfer()
    for (const file of files) transfer.items.add(new File([new Uint8Array(file.bytes)], file.name, { type: file.type }))
    const block = element.firstElementChild!.getBoundingClientRect()
    const at = { clientX: block.left + 1, clientY: block.top + block.height / 2 }
    element.dispatchEvent(new DragEvent('dragover', { dataTransfer: transfer, bubbles: true, cancelable: true, ...at }))
    element.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true, ...at }))
  }, files)
}

test.describe('image upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(IMAGE_UPLOADS)
    await expect(editor(page, 'uploads')).toBeVisible()
  })

  test('a pasted image shows a placeholder, nothing saved for it, then goes in as ![](url)', async ({ page }) => {
    await caretAtEnd(page, 'uploads')
    await pasteFiles(page, 'uploads', [photo('screenshot.png')])
    const placeholder = editor(page, 'uploads').locator('[data-slot=rich-text-image-upload]')
    await expect(placeholder).toHaveText('Uploading screenshot.png…')
    await expect(page.locator('[data-fixture="uploads"]').getByRole('status')).toHaveText('Uploading an image…')
    // The placeholder isn't in the document: the Markdown is as it was.
    await afterPause(page)
    expect(await saved(page, 'uploads').textContent()).toBe('Paste or drop a photo here.\n')

    await expect(placeholder).toHaveCount(0)
    await expect(editor(page, 'uploads').locator('img[src^="blob:"]')).toHaveCount(1)
    await expect(saved(page, 'uploads')).toHaveText(/^Paste or drop a photo here\.!\[\]\(blob:[^)]+\)\n$/)
  })

  test('a dropped image goes in where it was dropped', async ({ page }) => {
    await dropFiles(page, 'uploads', [photo('dropped.png')])
    await expect(editor(page, 'uploads').locator('[data-slot=rich-text-image-upload]')).toHaveText('Uploading dropped.png…')
    await expect(saved(page, 'uploads')).toHaveText(/^!\[\]\(blob:[^)]+\)Paste or drop a photo here\.\n$/)
  })

  test("the toolbar's Image button picks files, which upload in order", async ({ page, isMobile }) => {
    test.skip(isMobile, "a laptop's toolbar: a phone has the bar pinned to its keyboard (rich-text-phone.spec.ts)")
    await caretAtEnd(page, 'uploads')
    const button = page.locator('[data-fixture="uploads"]').getByRole('button', { name: 'Image', exact: true })
    const chooser = page.waitForEvent('filechooser')
    await button.click()
    const picker = await chooser
    expect(picker.isMultiple()).toBe(true)
    await picker.setFiles([
      { name: 'one.png', mimeType: 'image/png', buffer: Buffer.from(pngBytes()) },
      { name: 'two.png', mimeType: 'image/png', buffer: Buffer.from(pngBytes()) },
    ])
    await expect(editor(page, 'uploads').locator('[data-slot=rich-text-image-upload]')).toHaveText(['Uploading one.png…', 'Uploading two.png…'])
    await expect(page.locator('[data-fixture="uploads"]').getByRole('status')).toHaveText('Uploading 2 images…')
    await expect(editor(page, 'uploads')).toBeFocused()
    await expect(editor(page, 'uploads').locator('img[src^="blob:"]')).toHaveCount(2)
    await afterPause(page)
    expect((await saved(page, 'uploads').textContent())!.match(/!\[\]\(blob:/g)).toHaveLength(2)
  })

  test('typing goes on while it uploads, and the image lands after the words typed before it', async ({ page }) => {
    await caretAtEnd(page, 'uploads')
    await pasteFiles(page, 'uploads', [photo()])
    await page.keyboard.type(' typed')
    await expect(saved(page, 'uploads')).toHaveText(/^Paste or drop a photo here\.!\[\]\(blob:[^)]+\) typed\n$/)
  })

  test('a failed upload takes the placeholder away and says why in a toast', async ({ page }) => {
    await caretAtEnd(page, 'failing')
    await pasteFiles(page, 'failing', [photo()])
    await expect(editor(page, 'failing').locator('[data-slot=rich-text-image-upload]')).toHaveCount(1)
    await expect(page.getByText('Storage is full. Free some space and try again.')).toBeVisible()
    await expect(editor(page, 'failing').locator('[data-slot=rich-text-image-upload], img[src]')).toHaveCount(0)
    await afterPause(page)
    expect(await saved(page, 'failing').textContent()).toBe('Every upload fails here.\n')
  })

  test('an image over the size limit, or a file that is not one, is refused before it is sent', async ({ page }) => {
    await caretAtEnd(page, 'sizeLimit')
    await pasteFiles(page, 'sizeLimit', [photo('huge.png', 2 * 1024 * 1024)])
    await expect(page.getByText('That image is 2 MB. The limit is 1 MB.')).toBeVisible()
    await dropFiles(page, 'sizeLimit', [{ name: 'notes.pdf', type: 'application/pdf', bytes: [37, 80, 68, 70] }])
    await expect(page.getByText('That file is a PDF. Choose a JPEG, PNG or WebP image.')).toBeVisible()
    await expect(editor(page, 'sizeLimit').locator('[data-slot=rich-text-image-upload], img[src]')).toHaveCount(0)
    await afterPause(page)
    expect(await saved(page, 'sizeLimit').textContent()).toBe('Images up to 1 MB.\n')
  })

  test("an office app's copy, words with a picture of them, pastes the words", async ({ page }) => {
    await caretAtEnd(page, 'uploads')
    await pasteFiles(page, 'uploads', [photo('image.png')], { 'text/html': '<p>Quarterly <b>numbers</b></p>', 'text/plain': 'Quarterly numbers' })
    await expect(saved(page, 'uploads')).toContainText('Quarterly **numbers**')
    await expect(editor(page, 'uploads').locator('[data-slot=rich-text-image-upload], img[src]')).toHaveCount(0)
  })

  test('with only the floating toolbar, paste still uploads, and no bar shows until the field has focus', async ({ page }) => {
    const field = page.locator('[data-fixture="floating"]')
    await expect(field.getByRole('toolbar')).toHaveCount(0)
    await caretAtEnd(page, 'floating')
    await pasteFiles(page, 'floating', [photo()])
    await expect(editor(page, 'floating').locator('img[src^="blob:"]')).toHaveCount(1)
  })

  // `toolbar="floating"` (forms' notes, 17.2): the Image button is on the
  // "Editor Tools" strip while the field has focus, the fixed toolbar's
  // button exactly: its file picker, types, upload and `![](url)`.
  test.describe('the floating toolbar\'s Image button', () => {
    test.skip(({ isMobile }) => isMobile, 'a laptop: a phone has it in the row pinned to its keyboard (rich-text-phone.spec.ts)')
    const tools = (page: Page) => page.locator('[data-fixture="floating"]').getByRole('toolbar', { name: 'Editor Tools' })

    test('picks images as the fixed toolbar does, they go in as ![](url), and focus stays in the text', async ({ page }) => {
      await caretAtEnd(page, 'floating')
      const button = tools(page).getByRole('button', { name: 'Image', exact: true })
      await expect(button).toBeVisible()
      // The same picker as the fixed toolbar's: the same types, several at once.
      const fixedAccept = await page.locator('[data-fixture="uploads"] input[type=file]').getAttribute('accept')
      expect(await page.locator('[data-fixture="floating"] input[type=file]').getAttribute('accept')).toBe(fixedAccept)
      const chooser = page.waitForEvent('filechooser')
      await button.click()
      const picker = await chooser
      expect(picker.isMultiple()).toBe(true)
      await picker.setFiles([{ name: 'note.png', mimeType: 'image/png', buffer: Buffer.from(pngBytes()) }])
      await expect(editor(page, 'floating').locator('[data-slot=rich-text-image-upload]')).toHaveText('Uploading note.png…')
      await expect(editor(page, 'floating')).toBeFocused()
      await expect(editor(page, 'floating').locator('img[src^="blob:"]')).toHaveCount(1)
      await afterPause(page)
      // No alt text, as the fixed toolbar's inserts it.
      await expect(saved(page, 'floating')).toHaveText(/^No bar above: paste, drop or the Image button upload\.!\[\]\(blob:[^)]+\)\n$/)
      await expect(editor(page, 'floating')).toBeFocused()
    })

    // Reached, not pressed: Chromium opens a file chooser for a keyboard
    // press only some of the time under Playwright (docs/DEFERRED.md, the
    // ImageField keyboard flake); the click it makes is the mouse's.
    test('the keyboard reaches it (Alt+F10), and Esc goes back to the text', async ({ page }) => {
      await caretAtEnd(page, 'floating')
      await page.keyboard.press('Alt+F10')
      await expect(tools(page).getByRole('button', { name: 'Image', exact: true })).toBeFocused()
      // Reached by the keyboard, so its tooltip is open: the first Esc
      // closes it (as on the toolbars), the next one goes back to the text.
      // Before prosemirror-view 1.43 the button wasn't :focus-visible after
      // a click in the text, no tooltip opened, and one Esc did both.
      await expect(page.locator('[data-slot=tooltip-content][data-open]')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.locator('[data-slot=tooltip-content][data-open]')).toHaveCount(0)
      await expect(tools(page).getByRole('button', { name: 'Image', exact: true })).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(editor(page, 'floating')).toBeFocused()
    })

    test('a file it refuses says why in a toast and changes nothing', async ({ page }) => {
      await caretAtEnd(page, 'floating')
      const chooser = page.waitForEvent('filechooser')
      await tools(page).getByRole('button', { name: 'Image', exact: true }).click()
      const picker = await chooser
      await picker.setFiles([{ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from([37, 80, 68, 70]) }])
      await expect(page.getByText('That file is a PDF. Choose a JPEG, PNG or WebP image.')).toBeVisible()
      await expect(editor(page, 'floating')).toBeFocused()
      await page.waitForTimeout(300)
      await expect(editor(page, 'floating').locator('[data-slot=rich-text-image-upload], img[src]')).toHaveCount(0)
      await afterPause(page)
      expect(await saved(page, 'floating').textContent()).toBe('No bar above: paste, drop or the Image button upload.\n')
    })
  })

  test("without `upload`: no button, and a pasted or dropped image changes nothing and says it can't go in", async ({ page }) => {
    const field = page.locator('[data-fixture="noUpload"]')
    await expect(field.getByRole('button', { name: 'Image', exact: true })).toHaveCount(0)
    await expect(field.locator('input[type=file]')).toHaveCount(0)
    await caretAtEnd(page, 'noUpload')
    await pasteFiles(page, 'noUpload', [photo()])
    await expect(page.getByText("Images can't be added here.")).toHaveCount(1)
    await dropFiles(page, 'noUpload', [photo()])
    await expect(page.getByText("Images can't be added here.")).toHaveCount(2)
    await page.waitForTimeout(300)
    await expect(editor(page, 'noUpload').locator('[data-slot=rich-text-image-upload], img[src]')).toHaveCount(0)
    await afterPause(page)
    expect(await saved(page, 'noUpload').textContent()).toBe('No upload: files are ignored.\n')
  })

  // An image a web page copies as `data:` in its HTML: never saved as
  // that, but uploaded where the field takes images.
  const DATA_PNG = `data:image/png;base64,${Buffer.from(pngBytes()).toString('base64')}`
  const pastedPicture = { 'text/html': `<p>A picture: <img src="${DATA_PNG}" alt=""></p>`, 'text/plain': 'A picture:' }

  test('a `data:` image in pasted HTML is uploaded, never saved as data', async ({ page }) => {
    await caretAtEnd(page, 'uploads')
    await page.keyboard.press('Enter')
    await pasteFiles(page, 'uploads', [], pastedPicture)
    await expect(editor(page, 'uploads').locator('img[src^="blob:"]')).toHaveCount(1)
    await afterPause(page)
    const markdown = (await saved(page, 'uploads').textContent())!
    expect(markdown).toContain('A picture:')
    expect(markdown).toMatch(/!\[\]\(blob:/)
    expect(markdown).not.toContain('data:')
  })

  test('without `upload`, a `data:` image in pasted HTML is left out and said so; its words paste', async ({ page }) => {
    await caretAtEnd(page, 'noUpload')
    await page.keyboard.press('Enter')
    await pasteFiles(page, 'noUpload', [], pastedPicture)
    await expect(page.getByText("Images can't be added here.")).toBeVisible()
    await afterPause(page)
    const markdown = (await saved(page, 'noUpload').textContent())!
    expect(markdown).toContain('A picture:')
    expect(markdown).not.toContain('data:')
    // Negative control: an image at a web address is kept as written.
    await pasteFiles(page, 'noUpload', [], { 'text/html': '<p><img src="https://example.com/a.png" alt="web"></p>' })
    await expect(saved(page, 'noUpload')).toContainText('![web](https://example.com/a.png')
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`the button and the placeholder are accessible (${theme})`, async ({ page }) => {
      await page.goto(`${IMAGE_UPLOADS}&theme=${theme}`)
      if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
      await caretAtEnd(page, 'uploads')
      await pasteFiles(page, 'uploads', [photo()])
      await expect(editor(page, 'uploads').locator('[data-slot=rich-text-image-upload]')).toBeVisible()
      const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
      expect(results.violations).toEqual([])
    })
  }
})

// Headings sit where the text does in the page's outline (`headingLevel`,
// prose-look.ts): the HeadingLevels stories put one note under a page's
// title (`#` an <h2>), under a section's <h2> (the default, from <h3>),
// and deeper (from <h5>, capped at <h6>).
const LEVELS = {
  editor: 'http://localhost:6180/story.html?id=app-richtexteditor--heading-levels',
  markdown: 'http://localhost:6180/story.html?id=app-markdown--heading-levels',
}

// Each heading in the text, as its element and its words.
function headingsIn(scope: Locator) {
  return scope
    .locator('h1, h2, h3, h4, h5, h6')
    .evaluateAll((elements) => elements.map((element) => `${element.tagName.toLowerCase()} ${element.textContent}`))
}

test.describe('heading levels', () => {
  const expected: Record<string, string[]> = {
    underPage: ['h2 Overview', 'h3 Details', 'h4 Small print'],
    underSection: ['h3 Overview', 'h4 Details', 'h5 Small print'],
    capped: ['h5 Overview', 'h6 Details', 'h6 Small print'],
    // headingFrom="text": the text's own highest heading takes headingLevel.
    fromText: ['h2 Imported details', 'h3 Imported small print'],
    fromTextDeep: ['h2 Deep small print'],
  }

  for (const where of ['editor', 'markdown'] as const) {
    const scope = (page: Page, name: string) => (where === 'editor' ? editor(page, name) : page.getByTestId(name))

    test(`${where}: # renders at headingLevel, each level one below it, never past <h6>; <h3> by default`, async ({ page }) => {
      await page.goto(LEVELS[where])
      for (const [name, headings] of Object.entries(expected)) {
        await expect.poll(() => headingsIn(scope(page, name)), { message: name }).toEqual(headings)
      }
    })

    test(`${where}: each level looks the same wherever it sits`, async ({ page }) => {
      await page.goto(LEVELS[where])
      await expect(scope(page, 'capped').locator('h5')).toBeVisible()
      const look = (name: string, index: number) =>
        scope(page, name)
          .locator('h1, h2, h3, h4, h5, h6')
          .nth(index)
          .evaluate((element) => {
            const style = getComputedStyle(element)
            return { size: style.fontSize, band: style.backgroundColor, transform: style.textTransform }
          })
      for (const index of [0, 1, 2]) {
        const first = await look('underSection', index)
        expect(await look('underPage', index)).toEqual(first)
        expect(await look('capped', index)).toEqual(first)
      }
      // The text beside a band is still lined up with the band's words.
      const start = (selector: string) =>
        scope(page, 'capped')
          .locator(selector)
          .first()
          .evaluate((element) => element.getBoundingClientRect().left + parseFloat(getComputedStyle(element).paddingLeft))
      expect(Math.abs((await start('p')) - (await start('h5')))).toBeLessThan(1)
    })

    for (const theme of ['light', 'dark'] as const) {
      test(`${where}: the page's outline never skips a level, zero axe violations (${theme})`, async ({ page }) => {
        await page.goto(`${LEVELS[where]}&theme=${theme}`)
        await expect(scope(page, 'capped').locator('h5')).toBeVisible()
        const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'region']).analyze()
        expect(results.violations).toEqual([])
      })
    }
  }

  test('the editor saves the Markdown it opened with: the level moves the element, never the `#`', async ({ page }) => {
    await page.goto(LEVELS.editor)
    for (const name of ['underPage', 'capped', 'fromText']) {
      await afterPause(page)
      const opened = (await saved(page, name).textContent())!
      expect(opened.startsWith(name === 'fromText' ? '## Imported details\n' : '# Overview\n')).toBe(true)
      await caretAtEnd(page, name)
      await page.keyboard.type('xyz')
      await expect(saved(page, name)).toContainText('xyz')
      for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace')
      await afterPause(page)
      // Polled too: on a phone (Android) ProseMirror reads a Backspace from the DOM a moment later.
      await expect.poll(() => saved(page, name).textContent()).toBe(opened)
    }
    // A line made a Heading 1 under the page's title is an <h2>, saved as `#`.
    await editor(page, 'underPage').getByText('The last words.').click()
    await page.waitForTimeout(100)
    await page.keyboard.press('Control+Shift+Digit1')
    await expect(saved(page, 'underPage')).toContainText('\n# The last words.\n')
    await expect(editor(page, 'underPage').locator('h2')).toHaveCount(2)
  })
})

// A table wider than the text scrolls sideways; while it does, its box is
// a tab stop, a region named for its columns, that the arrow keys scroll
// (prose-table-scroll.ts). The WideTable stories hold one that overflows
// and one that fits.
const TABLES = {
  editor: 'http://localhost:6180/story.html?id=app-richtexteditor--wide-table',
  markdown: 'http://localhost:6180/story.html?id=app-markdown--wide-table',
}

// The editor's table box: the first child of its node view.
function editorTableBox(page: Page, name: string) {
  return editor(page, name).locator('[data-slot=rich-text-table] > :first-child')
}

test.describe('table scroll', () => {
  for (const where of ['editor', 'markdown'] as const) {
    const box = (page: Page, name: string) =>
      where === 'editor' ? editorTableBox(page, name) : page.getByTestId(name).locator('[data-slot=table-container]')
    const scrollLeft = (page: Page) => box(page, 'wideTable').evaluate((element) => element.scrollLeft)

    test(`${where}: a table wider than the text is a named tab stop the arrow keys scroll; one that fits is neither`, async ({
      page,
    }) => {
      await page.goto(TABLES[where])
      const wide = box(page, 'wideTable')
      await expect(wide).toHaveAttribute('tabindex', '0')
      await expect(wide).toHaveAttribute('role', 'region')
      await expect(page.getByRole('region', { name: 'Table, scrolls sideways: Item, Size, Colour, …', exact: true })).toBeVisible()
      const narrow = box(page, 'narrowTable')
      await expect(narrow).toBeVisible()
      await expect(narrow).not.toHaveAttribute('tabindex')
      await expect(narrow).not.toHaveAttribute('role')
      await expect(narrow).not.toHaveAttribute('aria-label')

      await wide.focus()
      await expect(wide).toBeFocused()
      expect(await scrollLeft(page)).toBe(0)
      await page.keyboard.press('ArrowRight')
      await expect.poll(() => scrollLeft(page)).toBeGreaterThan(0)
      // Its focus ring shows.
      expect(await wide.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none')
    })

    for (const theme of ['light', 'dark'] as const) {
      test(`${where}: zero axe violations, the wide table's box included (${theme})`, async ({ page }) => {
        await page.goto(`${TABLES[where]}&theme=${theme}`)
        await expect(box(page, 'wideTable')).toHaveAttribute('role', 'region')
        const results = await new AxeBuilder({ page })
          .disableRules(['landmark-one-main', 'page-has-heading-one', 'region'])
          .analyze()
        expect(results.violations).toEqual([])
      })
    }
  }

  test('editor: Tab from the text reaches the box; End and Home scroll it; typing there adds nothing', async ({ page }) => {
    await page.goto(TABLES.editor)
    const wide = editorTableBox(page, 'wideTable')
    await expect(wide).toHaveAttribute('tabindex', '0')
    await afterPause(page)
    const opened = (await saved(page, 'wideTable').textContent())!
    await editor(page, 'wideTable').getByText('After the wide table.').click()
    await page.waitForTimeout(100)
    await page.keyboard.press('Tab')
    await expect(wide).toBeFocused()
    const position = () => wide.evaluate((element) => [element.scrollLeft, element.scrollWidth - element.clientWidth])
    await page.keyboard.press('End')
    await expect
      .poll(async () => {
        const [left, max] = await position()
        return max > 0 && Math.abs(left - max) < 1
      })
      .toBe(true)
    await page.keyboard.press('Home')
    await expect.poll(async () => (await position())[0]).toBe(0)
    await page.keyboard.type('q')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)
    await afterPause(page)
    expect(await saved(page, 'wideTable').textContent()).toBe(opened)
  })

  test('editor: a click in a cell puts the caret there, never on the box', async ({ page }) => {
    await page.goto(TABLES.editor)
    const wide = editorTableBox(page, 'wideTable')
    await expect(wide).toHaveAttribute('tabindex', '0')
    await wide.getByText('Shelf', { exact: true }).click()
    await expect(editor(page, 'wideTable')).toBeFocused()
    await page.waitForTimeout(100)
    await page.keyboard.press('End')
    await page.keyboard.type('Z')
    await expect(saved(page, 'wideTable')).toContainText(/\| ShelfZ +\|/)
  })

  test('editor: a table that grows past the field becomes a tab stop, and stops being one when it fits again', async ({
    page,
  }) => {
    await page.goto(TABLES.editor)
    const fixture = page.locator('[data-fixture="narrowTable"]')
    const narrow = editorTableBox(page, 'narrowTable')
    await expect(narrow).toBeVisible()
    await expect(narrow).not.toHaveAttribute('tabindex')
    // Empty columns are narrow (columns fit their words): nine of them.
    for (let i = 0; i < 9; i++) {
      await narrow.hover()
      await fixture.getByRole('button', { name: 'Add a Column' }).click()
    }
    await expect(narrow).toHaveAttribute('tabindex', '0')
    await expect(narrow).toHaveAttribute('role', 'region')
    await expect(narrow).toHaveAttribute('aria-label', 'Table, scrolls sideways: Item, Count')
    for (let i = 0; i < 9; i++) await page.keyboard.press('ControlOrMeta+z')
    await expect(fixture.locator('tr').first().locator('th')).toHaveCount(2)
    await expect(narrow).not.toHaveAttribute('tabindex')
    await expect(narrow).not.toHaveAttribute('role')
  })
})

// An edit form's field: the form holds the value and passes it back as
// `defaultValue`; the record loads after the editor has mounted (the
// editor's chunk already cached, as on a second Edit).
test.describe('a value that arrives later', () => {
  const LATE = 'http://localhost:6180/story.html?id=app-richtexteditor--late-value'

  test('a value loaded after it mounts shows; its own edits keep the caret; a reset clears it', async ({ page }) => {
    await page.goto(LATE)
    const box = editor(page, 'lateValue')
    await expect(box).toBeVisible()
    await expect(box).toHaveText('')
    await page.getByRole('button', { name: 'Load' }).click()
    await expect(box.locator('strong')).toHaveText('notes')
    await expect(saved(page, 'lateValue')).toHaveText('Loaded **notes**.')

    // Typing goes back as the value without reopening the editor: focus
    // and the caret stay, so every key lands in order where it's typed.
    await box.getByText('Loaded').click()
    await expect(box).toBeFocused()
    await page.waitForTimeout(100)
    await page.keyboard.press('Home')
    await page.keyboard.type('Freshly ')
    await expect(box).toBeFocused()
    await expect(saved(page, 'lateValue')).toHaveText('Freshly Loaded **notes**.')

    await page.getByRole('button', { name: 'Reset' }).click()
    await expect(box).toHaveText('')
    await expect(saved(page, 'lateValue')).toHaveText('')
  })
})

// An edit the merge refuses, on an editor with no onProblem (a form that
// passes none): it says so in the field and is marked invalid, and
// nothing new is saved.
test.describe('a refused edit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FEATURES)
    await expect(editor(page, 'refused')).toBeVisible()
  })

  const problem = (page: Page) => page.locator('[data-fixture="refused"] [data-slot=rich-text-editor-problem]')

  test('with no onProblem, the field says why and is invalid; undoing the edit takes it back', async ({ page }) => {
    const box = editor(page, 'refused')
    // Negative control: an edit the merge takes says nothing.
    await caretAtEnd(page, 'refused')
    await page.keyboard.type(' Kept')
    await expect(saved(page, 'refused')).toContainText('Tail paragraph. Kept')
    await expect(problem(page)).toHaveCount(0)
    await expect(box).not.toHaveAttribute('aria-invalid', 'true')

    await box.locator('li').first().click()
    await page.waitForTimeout(100)
    await page.keyboard.press('End')
    await page.keyboard.type(' EDIT')
    await expect(problem(page)).toBeVisible()
    await expect(problem(page)).toHaveText(/can't be saved/)
    await expect(problem(page)).not.toHaveText(/in the form/)
    await expect(box).toHaveAttribute('aria-invalid', 'true')
    const problemId = (await problem(page).getAttribute('id'))!
    expect((await box.getAttribute('aria-describedby'))!.split(' ')).toContain(problemId)
    // What would be saved is the last text that could be.
    await afterPause(page)
    expect(await saved(page, 'refused').textContent()).toBe('1) a\n2) b\n10. ten\n11. eleven\n\nTail paragraph. Kept\n')

    for (let i = 0; i < ' EDIT'.length; i++) await page.keyboard.press('Backspace')
    await expect(problem(page)).toHaveCount(0)
    await expect(box).not.toHaveAttribute('aria-invalid', 'true')
  })
})

// Paste and typed addresses.
test.describe('paste and addresses', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FEATURES)
    await expect(editor(page, 'links')).toBeVisible()
  })

  const text = async (page: Page, name: string) => {
    await afterPause(page)
    return (await saved(page, name).textContent())!
  }

  test('a typed address becomes a link on a space or Enter, saved unescaped', async ({ page }) => {
    const box = editor(page, 'links')
    await caretAtEnd(page, 'links')
    // Negative control: a word that isn't an address stays a word.
    await page.keyboard.type(' See example now ')
    await expect(box.locator('a')).toHaveCount(1)
    await page.keyboard.type('https://example.com/a_b now and www.site.org.')
    await page.keyboard.press('Enter')
    await page.keyboard.type('mail me@example.com ')
    await expect(box.locator('a[href="https://example.com/a_b"]')).toHaveText('https://example.com/a_b')
    await expect(box.locator('a[href="https://www.site.org"]')).toHaveText('www.site.org')
    await expect(box.locator('a[href="mailto:me@example.com"]')).toHaveText('me@example.com')
    const markdown = await text(page, 'links')
    expect(markdown).not.toContain('\\:')
    expect(markdown).not.toContain('www\\.')
    expect(markdown).toContain('https://example.com/a_b')
    expect(markdown).toContain('[www.site.org](https://www.site.org).')
  })

  test('an address in a code span stays text', async ({ page }) => {
    const box = editor(page, 'links')
    await caretAtEnd(page, 'links')
    await page.keyboard.type(' `https://example.com` ')
    await expect(box.locator('code')).toHaveText('https://example.com')
    await expect(box.locator('code a, a code')).toHaveCount(0)
  })

  test('an address pasted as plain text is a link; pasted over words, it links them', async ({ page, isMobile }) => {
    test.skip(isMobile, "a laptop's line: on a phone the pasted address wraps, and Home goes to the start of its second line")
    const box = editor(page, 'links')
    await caretAtEnd(page, 'links')
    await paste(page, 'links', { 'text/plain': ' ' })
    await paste(page, 'links', { 'text/plain': 'https://example.com/a_b?x=1&y=2' })
    await expect(box.locator('a[href="https://example.com/a_b?x=1&y=2"]')).toHaveText('https://example.com/a_b?x=1&y=2')
    let markdown = await text(page, 'links')
    expect(markdown).not.toContain('\\:')
    expect(markdown).not.toContain('\\&')

    // Negative control: words that aren't an address replace the selection.
    await selectFirstWord(page, 'links')
    await paste(page, 'links', { 'text/plain': 'Simple' })
    await expect(box).toContainText('Simple words here.')
    await page.keyboard.press('Home')
    for (let i = 0; i < 'Simple'.length; i++) await page.keyboard.press('Shift+ArrowRight')
    await page.waitForTimeout(100)
    await paste(page, 'links', { 'text/plain': 'https://example.com/guide', 'text/html': '<a href="https://example.com/guide">https://example.com/guide</a>' })
    await expect(box.locator('a[href="https://example.com/guide"]')).toHaveText('Simple')
    markdown = await text(page, 'links')
    expect(markdown).toContain('[Simple](https://example.com/guide) words here.')
  })

  test('pasted HTML keeps a web link and drops one that runs code, keeping its words', async ({ page }) => {
    await caretAtEnd(page, 'links')
    await page.keyboard.press('Enter')
    await paste(page, 'links', {
      'text/html': '<p><a href="javascript:alert(1)">evil link</a> and <a href="https://ok.example/">good link</a></p>',
      'text/plain': 'evil link and good link',
    })
    await expect(editor(page, 'links').getByText('evil link')).toBeVisible()
    const markdown = await text(page, 'links')
    expect(markdown).not.toContain('javascript')
    expect(markdown).toContain('evil link and [good link](https://ok.example/)')
  })

  test('plain lines stay lines: single line breaks are hard breaks', async ({ page }) => {
    const box = editor(page, 'links')
    await caretAtEnd(page, 'links')
    await page.keyboard.press('Enter')
    await paste(page, 'links', { 'text/plain': '12 Harbour Road\nFlat 3\nOslo 0150' })
    await expect(box.locator('p').filter({ hasText: 'Harbour' }).locator('br:not(.ProseMirror-trailingBreak)')).toHaveCount(2)
    expect(await text(page, 'links')).toMatch(/12 Harbour Road(\\| {2,})\nFlat 3(\\| {2,})\nOslo 0150/)
    // Negative control: a blank line between them still makes two paragraphs.
    await page.keyboard.press('Enter')
    await paste(page, 'links', { 'text/plain': 'First one\n\nSecond one' })
    expect(await text(page, 'links')).toContain('First one\n\nSecond one')
  })

  test("Notion's to-dos are task items, and code keeps its language", async ({ page }) => {
    await caretAtEnd(page, 'links')
    await page.keyboard.press('Enter')
    await paste(page, 'links', {
      'text/html':
        '<ul class="to-do-list"><li><div class="checkbox checkbox-on"></div> <span class="to-do-children-checked">Bought milk</span></li>' +
        '<li><div class="checkbox checkbox-off"></div> <span class="to-do-children-unchecked">Call the plumber</span></li></ul>' +
        '<pre><code class="language-JavaScript">let a = 1</code></pre>' +
        '<ul><li>A plain bullet</li></ul>',
      'text/plain': 'Bought milk\nCall the plumber\nlet a = 1\nA plain bullet',
    })
    const box = editor(page, 'links')
    await expect(box.locator('li[data-item-type=task]')).toHaveCount(2)
    const markdown = await text(page, 'links')
    expect(markdown).toMatch(/[-*] \[x\] Bought milk\n[-*] \[ \] Call the plumber/)
    expect(markdown).toContain('```javascript\nlet a = 1\n```')
    // Negative control: a plain list item is no task.
    expect(markdown).toMatch(/[-*] A plain bullet/)
    expect(markdown).not.toMatch(/\[.\] A plain bullet/)
  })

  test("Word's list paragraphs are list items, without their marker", async ({ page }) => {
    await caretAtEnd(page, 'links')
    await page.keyboard.press('Enter')
    const item = (level: number, marker: string, words: string) =>
      `<p class=MsoListParagraphCxSpMiddle style='margin-left:.5in;mso-list:l0 level${level} lfo1'><![if !supportLists]><span style='mso-list:Ignore'>${marker}<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span></span><![endif]>${words}</p>`
    await paste(page, 'links', {
      'text/html': `<p class=MsoNormal>Before</p>${item(1, '·', 'First')}${item(2, 'o', 'Under first')}${item(1, '·', 'Second')}<p class=MsoNormal>After</p>${item(1, '1.', 'Numbered')}`,
      'text/plain': 'Before\nFirst\nUnder first\nSecond\nAfter\nNumbered',
    })
    const box = editor(page, 'links')
    await expect(box.locator('ul li')).toHaveCount(3)
    await expect(box.locator('ol > li')).toHaveCount(1)
    const markdown = await text(page, 'links')
    expect(markdown).not.toContain('·')
    expect(markdown).toMatch(/[-*] First\n\s+[-*] Under first\n[-*] Second/)
    expect(markdown).toMatch(/1\. Numbered/)
    // Negative control: Word's plain paragraphs stay paragraphs.
    expect(markdown).toMatch(/\n\nBefore\n\n/)
  })

  test('lines pasted into a table cell join with spaces: no new column', async ({ page }) => {
    const table = editor(page, 'table').locator('table')
    await table.locator('td').first().click()
    await page.waitForTimeout(100)
    await page.keyboard.press('End')
    await paste(page, 'table', { 'text/plain': ' one\ntwo\nthree' })
    await paste(page, 'table', { 'text/html': '<p>four</p><ul><li>five</li></ul>', 'text/plain': 'four\nfive' })
    await expect(table.locator('tr').first().locator('th')).toHaveCount(2)
    await expect(table.locator('tr')).toHaveCount(3)
    const markdown = await text(page, 'table')
    expect(markdown).toMatch(/\| Top one two three ?four five +\| 1 +\|/)
    // Negative control: the row not pasted into is as it was.
    expect(markdown).toMatch(/\| Leg +\| 4 +\|/)
  })
})

// Full screen holds focus.
test.describe('full screen', () => {
  test.skip(({ isMobile }) => isMobile, "a laptop's toolbar button: on a phone it's in the keyboard bar's Aa panel (rich-text-phone.spec.ts)")
  test.beforeEach(async ({ page }) => {
    await page.goto(FEATURES)
    await expect(editor(page, 'links')).toBeVisible()
  })

  const field = (page: Page) => page.locator('[data-fixture="links"] [data-slot=rich-text-editor]')
  const focusInField = (page: Page) => field(page).evaluate((element) => element.contains(document.activeElement))

  test('is a dialog; Tab stays in it; Esc gives the page back', async ({ page }) => {
    await field(page).getByRole('button', { name: 'Full Screen' }).click()
    await expect(field(page)).toHaveAttribute('data-full-screen', 'true')
    await expect(page.getByRole('dialog', { name: 'links' })).toHaveAttribute('aria-modal', 'true')
    await editor(page, 'links').click()
    await page.waitForTimeout(100)
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      expect(await focusInField(page)).toBe(true)
    }
    await expect(page.locator('[data-fixture="tasks"]')).toHaveJSProperty('inert', true)
    // A second click on the same spot within half a second is a double
    // click to ProseMirror (1.43 handles the mouse itself), which selects
    // a word and opens the floating toolbar, and the first Esc is then the
    // toolbar's. Each click here is a single one.
    await page.waitForTimeout(600)
    await editor(page, 'links').click()
    await page.keyboard.press('Escape')
    await expect(field(page)).not.toHaveAttribute('data-full-screen', 'true')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    // Negative control: out of full screen, Tab leaves the field.
    await expect(page.locator('[data-fixture="tasks"]')).toHaveJSProperty('inert', false)
    await page.waitForTimeout(600)
    await editor(page, 'links').click()
    await page.waitForTimeout(100)
    let left = false
    for (let i = 0; i < 8 && !left; i++) {
      await page.keyboard.press('Tab')
      left = !(await focusInField(page))
    }
    expect(left).toBe(true)
  })

  test('the link box opened in full screen still takes typing', async ({ page }) => {
    await field(page).getByRole('button', { name: 'Full Screen' }).click()
    await selectFirstWord(page, 'links')
    await page.keyboard.press('ControlOrMeta+k')
    const address = page.getByRole('textbox', { name: 'Link Address' })
    await expect(address).toBeFocused()
    await address.fill('example.org')
    await page.keyboard.press('Enter')
    await expect(editor(page, 'links').locator('a[href="https://example.org"]')).toHaveText('Plain')
  })
})

// How it behaves as you type (the RichTextEditor review's typing
// findings), on the RichTextEditor Typing story: each editor's Markdown
// beside it, as on the others.
test.describe('typing', () => {
  const TYPING = 'http://localhost:6180/story.html?id=app-richtexteditor-typing--typing'

  // The caret at the start of the document.
  async function caretAtStart(page: Page, name: string) {
    await editor(page, name).locator(':scope > *').first().click()
    await expect(editor(page, name)).toBeFocused()
    await page.waitForTimeout(100)
    await page.keyboard.press('ControlOrMeta+Home')
  }

  // The caret at the end of the line holding `text`.
  async function caretAfter(page: Page, name: string, text: string) {
    await editor(page, name).getByText(text, { exact: true }).click()
    await expect(editor(page, name)).toBeFocused()
    await page.waitForTimeout(100)
    await page.keyboard.press('End')
    await page.waitForTimeout(100)
  }

  // A key that moves the caret, then the moment ProseMirror takes to read
  // where it went.
  async function move(page: Page, key: string) {
    await page.keyboard.press(key)
    await page.waitForTimeout(100)
  }

  // A click `dy` from the bottom of an editor's text, scrolled into view first.
  async function clickNearBottom(page: Page, name: string, dy = 3) {
    await editor(page, name).scrollIntoViewIfNeeded()
    const box = (await editor(page, name).boundingBox())!
    await page.mouse.click(box.x + 40, box.y + box.height - dy)
  }

  test.beforeEach(async ({ page }) => {
    await page.goto(TYPING)
    await expect(editor(page, 'writing')).toBeVisible()
  })

  test('ArrowDown at the end of a last code block puts a line under it; a last paragraph gets none', async ({ page }) => {
    await caretAtEnd(page, 'onlyCode')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.type('after')
    await expect(saved(page, 'onlyCode')).toHaveText('```\nlast line\n```\n\nafter\n')
    // Negative control: past a paragraph there's nothing to leave.
    await caretAtEnd(page, 'plainLast')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.type('!')
    await expect(saved(page, 'plainLast')).toHaveText('Only a line.!\n')
  })

  test('ArrowUp at the start of a first code block or table puts a line above it; ArrowDown in a last table leaves it', async ({ page }) => {
    await caretAtStart(page, 'codeFirst')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.type('before')
    await expect(saved(page, 'codeFirst')).toHaveText('before\n\n```\nfirst line\n```\n\nAfter the code.\n')

    await editor(page, 'onlyTable').getByText('Part', { exact: true }).click()
    await page.waitForTimeout(100)
    await move(page, 'Home')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.type('above')
    await expect(saved(page, 'onlyTable')).toHaveText('above\n\n| Part | Count |\n| --- | --- |\n| Top | 1 |\n')
    await editor(page, 'onlyTable').getByText('Top', { exact: true }).click()
    await page.waitForTimeout(100)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.type('below')
    await expect(saved(page, 'onlyTable')).toContainText('| Top | 1 |\n\nbelow\n')
  })

  test('ArrowDown at the end of a last quote leaves it', async ({ page }) => {
    await caretAtEnd(page, 'quoteLast')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.type('Out')
    await expect(saved(page, 'quoteLast')).toHaveText('Before.\n\n> Quoted words.\n\nOut\n')
  })

  test('a click under a last code block puts the caret on a new line; under a paragraph, at its end', async ({ page }) => {
    await clickNearBottom(page, 'onlyCode')
    await expect(editor(page, 'onlyCode')).toBeFocused()
    await page.keyboard.type('below')
    await expect(saved(page, 'onlyCode')).toHaveText('```\nlast line\n```\n\nbelow\n')
    // Out of the field first: on a phone its keyboard bar would be over the next one.
    await editor(page, 'onlyCode').blur()
    await clickNearBottom(page, 'plainLast')
    await page.keyboard.type('!')
    await expect(saved(page, 'plainLast')).toHaveText('Only a line.!\n')
  })

  test('typed --- is a divider with a line under it, the caret there', async ({ page }) => {
    await caretAtEnd(page, 'writing')
    await page.keyboard.press('Enter')
    await page.keyboard.type('---', { delay: 50 })
    await expect(editor(page, 'writing').locator('hr')).toHaveCount(1)
    await page.keyboard.type('next')
    await expect(saved(page, 'writing')).toHaveText('Start here.\n\n---\n\nnext\n')
  })

  test('spaced stars stay as typed; *words*, **words** and ==words== format as typed', async ({ page }) => {
    const box = editor(page, 'writing')
    await caretAtEnd(page, 'writing')
    await page.keyboard.type(' Cost is 5 * 3 * 2 and 2 ** 3 ** 4.', { delay: 20 })
    await expect(box.locator('em, strong')).toHaveCount(0)
    await expect(saved(page, 'writing')).toContainText('Cost is 5 \\* 3 \\* 2 and 2 \\*\\* 3 \\*\\* 4.')
    await page.keyboard.type(' *one* **two** ==three== =={green}four== ', { delay: 20 })
    await expect(box.locator('em')).toHaveText('one')
    await expect(box.locator('strong')).toHaveText('two')
    await expect(box.locator('mark[data-color=amber]')).toHaveText('three')
    await expect(box.locator('mark[data-color=green]')).toHaveText('four')
    await expect(saved(page, 'writing')).toContainText('*one* **two** ==three== =={green}four==')
  })

  test("a paragraph's space at its end isn't saved (Markdown would drop it on reading)", async ({ page }) => {
    await caretAtEnd(page, 'writing')
    await page.keyboard.type(' more ')
    // Exactly: toHaveText would fold the space away.
    await expect.poll(() => saved(page, 'writing').textContent()).toBe('Start here. more\n')
  })

  test("Backspace at an item's start lifts it out of the list; a second joins it to the line above", async ({ page }) => {
    await caretAfter(page, 'list', 'two')
    await move(page, 'Home')
    await page.keyboard.press('Backspace')
    await expect(saved(page, 'list')).toHaveText('Above.\n\n- one\n\ntwo\n')
    await page.keyboard.press('Backspace')
    await expect(saved(page, 'list')).toHaveText('Above.\n\n- onetwo\n')
    // Mid-line, Backspace deletes a character as ever.
    await page.keyboard.press('Backspace')
    await expect(saved(page, 'list')).toHaveText('Above.\n\n- ontwo\n')
    // A nested item goes up a level, a list item still (it was fused into
    // the item above as a second paragraph).
    await caretAfter(page, 'nested', 'two')
    await move(page, 'Home')
    await page.keyboard.press('Backspace')
    await expect(saved(page, 'nested')).toHaveText('- one\n- two\n')
  })

  // The review's section 5: Tab and Shift+Tab.
  test('Tab and Shift+Tab move a list item and stay in the text; in code they indent', async ({ page }) => {
    await caretAfter(page, 'nested', 'one')
    await page.keyboard.press('Tab')
    await expect(editor(page, 'nested')).toBeFocused()
    await expect(saved(page, 'nested')).toHaveText('- one\n  - two\n')
    await caretAfter(page, 'nested', 'two')
    await page.keyboard.press('Shift+Tab')
    await expect(saved(page, 'nested')).toHaveText('- one\n- two\n')
    await page.keyboard.press('Tab')
    await expect(saved(page, 'nested')).toHaveText('- one\n  - two\n')

    await caretAtStart(page, 'onlyCode')
    await page.keyboard.press('Tab')
    await expect(editor(page, 'onlyCode')).toBeFocused()
    await expect(saved(page, 'onlyCode')).toHaveText('```\n  last line\n```\n')
    await page.keyboard.press('Shift+Tab')
    await expect(saved(page, 'onlyCode')).toHaveText('```\nlast line\n```\n')
  })

  test('the slash menu opens in a list item, and a pick applies there; in a cell it lists only what fits', async ({ page }) => {
    const menu = page.getByRole('listbox', { name: 'Blocks' })
    await caretAfter(page, 'list', 'two')
    await page.keyboard.press('Enter')
    await page.keyboard.type('/')
    await expect(menu).toBeVisible()
    await page.keyboard.type('h1')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Heading')
    await expect(saved(page, 'list')).toHaveText('Above.\n\n- one\n- two\n\n# Heading\n')

    await editor(page, 'cells').getByText('Top', { exact: true }).click()
    await page.waitForTimeout(100)
    await move(page, 'Home')
    await page.keyboard.type('/')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('option', { name: 'Heading 1', exact: true })).toHaveCount(0)
    await expect(menu.getByRole('option', { name: 'Table', exact: true })).toHaveCount(0)
    await expect(menu.getByRole('option', { name: 'Green highlight', exact: true })).toBeVisible()
  })

  test('redo after undoing through a slash pick brings back every word, and one too many does nothing', async ({ page }) => {
    await caretAtEnd(page, 'writing')
    await page.keyboard.press('Enter')
    await page.keyboard.type('/quo')
    await page.keyboard.press('Enter')
    await page.keyboard.type('quoted')
    await page.waitForTimeout(700)
    await page.keyboard.type(' more')
    await expect(saved(page, 'writing')).toHaveText('Start here.\n\n> quoted more\n')
    for (let i = 0; i < 12; i++) await page.keyboard.press('ControlOrMeta+z')
    await expect(saved(page, 'writing')).toHaveText('Start here.\n')
    // More presses than there are steps: the extra ones do nothing (with
    // nothing to redo, ProseMirror's keymap ran Mod+Z for them, an undo).
    for (let i = 0; i < 12; i++) await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(saved(page, 'writing')).toHaveText('Start here.\n\n> quoted more\n')
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await page.waitForTimeout(200)
    await expect(saved(page, 'writing')).toHaveText('Start here.\n\n> quoted more\n')
  })

  test('the block keys turn a heading into a list and an item into a heading; Ctrl/Cmd+Shift+H highlights', async ({ page }) => {
    await caretAfter(page, 'heading', 'Title')
    await page.keyboard.press('Control+Shift+Digit5')
    // Into the list under it: two lists side by side are one in Markdown.
    await expect(saved(page, 'heading')).toHaveText('- Title\n- item\n')
    await caretAfter(page, 'heading', 'item')
    await page.keyboard.press('Control+Shift+Digit1')
    await expect(saved(page, 'heading')).toHaveText('- Title\n\n# item\n')
    await move(page, 'Home')
    for (let i = 0; i < 'item'.length; i++) await page.keyboard.press('Shift+ArrowRight')
    await page.waitForTimeout(100)
    await page.keyboard.press('ControlOrMeta+Shift+H')
    await expect(saved(page, 'heading')).toContainText('# ==item==\n')
    await page.keyboard.press('ControlOrMeta+Shift+H')
    await expect(saved(page, 'heading')).toContainText('# item\n')
  })

  test("ticking a task's box keeps focus in the text, so Ctrl/Cmd+Z takes the tick back", async ({ page }) => {
    const box = page.locator('[data-fixture="tasks"]').getByRole('checkbox', { name: 'Done' }).first()
    await box.click()
    await expect(saved(page, 'tasks')).toContainText('- [x] Open item')
    await expect(editor(page, 'tasks')).toBeFocused()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(saved(page, 'tasks')).toContainText('- [ ] Open item')
  })
})
