import { expect, test, type Page } from '@playwright/test'

// Page links (src/lib/page-link.ts) on the real editor and <Markdown>, and
// PageTrail at desktop and phone widths: the stories in
// src/components/app/page-links.fixtures.tsx. A page link opens its page
// in this tab, a removed one can be restored, "/page" makes one through
// the app and links it, a refusal leaves the text as it was, and the
// Markdown is never rewritten by any of it.
const STORY = (id: string) => `http://localhost:6180/story.html?id=app-pagelinks--${id}`

function notes(page: Page) {
  return page.getByRole('textbox', { name: 'Notes with pages' })
}
function saved(page: Page) {
  return page.getByTestId('saved-pages')
}

// The caret at the end of the text, focus settled first (as the round
// trip spec does: ProseMirror sets the selection a moment after focus).
async function caretAtEnd(page: Page) {
  await notes(page).locator(':scope > p').last().click()
  await expect(notes(page)).toBeFocused()
  await page.waitForTimeout(100)
  await page.keyboard.press('ControlOrMeta+End')
}

test.describe('page links, read', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(STORY('read'))
  })

  test('a page alone on its line is a page line; a click opens it in this tab', async ({ page }) => {
    const link = page.getByRole('link', { name: 'Getting Started' })
    await expect(link).toHaveAttribute('href', '/pages/3')
    await expect(link).not.toHaveAttribute('target', /.+/)
    await expect(page.locator('p.page-line')).toHaveCount(3)
    await link.click()
    await expect(page.getByTestId('page-screen')).toHaveText('Page at /pages/3')
  })

  test('a page in a sentence is inline, with the app’s title; other links are untouched', async ({ page }) => {
    // Written "packing list", titled "Packing list" by the app.
    await expect(page.getByRole('link', { name: 'Packing list', exact: true })).toHaveAttribute('href', '/pages/5')
    await expect(page.getByRole('link', { name: /docs/ })).toHaveAttribute('target', '_blank')
  })

  test('a removed page says so, and Restore brings its link back', async ({ page }) => {
    await expect(page.getByText('Page removed')).toHaveCount(2)
    await expect(page.getByRole('link', { name: 'Old plan' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Restore Lost notes' })).toHaveCount(0)
    const restore = page.getByRole('button', { name: 'Restore Old plan' })
    await restore.click()
    await expect(restore).toBeDisabled()
    await expect(page.getByRole('link', { name: 'Old plan' })).toHaveAttribute('href', '/pages/9')
    await expect(page.getByText('Page removed')).toHaveCount(1)
  })
})

test.describe('page links, edited', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(STORY('edit'))
    await expect(notes(page)).toBeVisible()
  })

  test('drawn as page links, the text unchanged', async ({ page }) => {
    const box = notes(page)
    await expect(box.locator('p.page-line')).toHaveCount(2)
    await expect(box.locator('.page-link-text')).toHaveCount(3)
    await expect(box.locator('.page-link-icon')).toHaveCount(3)
    await expect(box.getByRole('button', { name: 'Restore Old plan' })).toBeVisible()
  })

  test('a click on a page link opens it in this tab', async ({ page }) => {
    await notes(page).getByText('Getting Started').click()
    await expect(page.getByTestId('page-screen')).toHaveText('Page at /pages/3')
  })

  test('an edit elsewhere keeps every page link byte for byte', async ({ page }) => {
    const before = (await saved(page).textContent())!
    await caretAtEnd(page)
    await page.keyboard.type(' Edited')
    await expect(saved(page)).toContainText('Edited')
    const after = (await saved(page).textContent())!
    const last = before.lastIndexOf('Type /')
    expect(after.slice(0, last)).toBe(before.slice(0, last))
  })

  test('"/page" makes a page through the app and links it on its own line', async ({ page }) => {
    const before = (await saved(page).textContent())!
    await caretAtEnd(page)
    await page.keyboard.press('Enter')
    await page.keyboard.type('/page')
    await expect(page.getByRole('option', { name: 'Page' })).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Enter')
    const title = page.getByRole('textbox', { name: 'Page title' })
    await expect(title).toBeFocused()
    await title.fill('Release checklist')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Creating…' })).toBeDisabled()
    await expect(saved(page)).toContainText('[Release checklist](/pages/100)')
    expect((await saved(page).textContent())!).toBe(`${before}\n[Release checklist](/pages/100)\n`)
    await expect(notes(page)).toBeFocused()
    await expect(notes(page).locator('p.page-line')).toHaveCount(3)
    // What's typed next isn't part of the link.
    await page.keyboard.type(' x')
    await expect(saved(page)).toContainText('[Release checklist](/pages/100) x')
  })

  test('a refused page leaves the text as it was and says why in the box', async ({ page }) => {
    await caretAtEnd(page)
    await page.keyboard.press('Enter')
    await page.keyboard.type('/page')
    await page.keyboard.press('Enter')
    const typed = (await saved(page).textContent())!
    const title = page.getByRole('textbox', { name: 'Page title' })
    await title.fill('Fail on purpose')
    await page.getByRole('button', { name: 'Create page' }).click()
    await expect(page.getByText('The server is down. Try again.')).toBeVisible()
    await expect(title).toBeFocused()
    expect((await saved(page).textContent())!).toBe(typed)
    // Esc gives up: the "/page" typed stays, as it does closing the slash menu.
    await page.keyboard.press('Escape')
    await expect(title).toHaveCount(0)
    await expect(notes(page)).toBeFocused()
    expect((await saved(page).textContent())!).toBe(typed)
  })

  test('selected words become a page with Turn into page', async ({ page }) => {
    const words = notes(page).getByText('Type / and pick Page to add one.')
    await words.click()
    await expect(notes(page)).toBeFocused()
    await page.waitForTimeout(100)
    await words.dblclick({ position: { x: 8, y: 8 } })
    await page.waitForTimeout(100)
    await expect(page.getByRole('toolbar', { name: 'Format selection' })).toBeVisible()
    await page.getByRole('button', { name: 'Turn into page' }).click()
    const title = page.getByRole('textbox', { name: 'Page title' })
    await expect(title).toHaveValue('Type')
    await page.getByRole('button', { name: 'Create page' }).click()
    await expect(saved(page)).toContainText('\n[Type](/pages/100) / and pick Page to add one.\n')
  })
})

test.describe('page trail', () => {
  test('shows every crumb when there is room, the page itself current', async ({ page }) => {
    await page.goto(STORY('trail'))
    const short = page.getByRole('navigation', { name: 'One level', exact: true })
    // The page itself is text marked current, not a link of any kind (4.86).
    await expect(short.locator('a[href]')).toHaveCount(2)
    await expect(short.getByRole('link', { name: 'Getting Started' })).toHaveCount(0)
    await expect(short.getByRole('link', { name: 'Notes' })).toHaveAttribute('href', '/notes')
    await expect(short.locator('[aria-current=page]')).toHaveText('Getting Started')
    await expect(short.getByRole('button', { name: /more pages?/ })).toHaveCount(0)
    // However deep, every crumb is either shown or in the menu.
    const deep = page.getByRole('navigation', { name: 'Five levels deep', exact: true })
    const more = deep.getByRole('button', { name: /^Show \d+ more pages?$/ })
    const folded = (await more.count()) ? Number((await more.getAttribute('aria-label'))!.match(/\d+/)![0]) : 0
    await expect(deep.locator('a[href]')).toHaveCount(6 - folded)
    await expect(deep.locator('[aria-current=page]')).toHaveText('First steps for everyone new')
  })

  test('folds the middle into a menu when it doesn’t fit, keeping the first and the page', async ({ page }) => {
    await page.goto(STORY('trail'))
    const narrow = page.getByRole('navigation', { name: 'Five levels deep, narrow' })
    const more = narrow.getByRole('button', { name: /^Show \d+ more pages?$/ })
    await expect(more).toBeVisible()
    await expect(narrow.getByRole('link', { name: 'Notes' })).toBeVisible()
    await expect(narrow.locator('[aria-current=page]')).toHaveText('First steps for everyone new')
    // On one line: nothing wraps.
    const list = narrow.locator('[data-slot=breadcrumb-list]')
    const box = (await list.boundingBox())!
    expect(box.height).toBeLessThan(32)
    await more.click()
    await expect(page.getByRole('menuitem', { name: 'Project plan' })).toHaveAttribute('href', '/notes/12')
  })

  test('at a phone’s width the deep trail folds too, and the page itself is cut short', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(STORY('trail'))
    const deep = page.getByRole('navigation', { name: 'Five levels deep', exact: true })
    await expect(deep.getByRole('button', { name: /^Show \d+ more pages?$/ })).toBeVisible()
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scroll).toBeLessThanOrEqual(375)
  })
})
