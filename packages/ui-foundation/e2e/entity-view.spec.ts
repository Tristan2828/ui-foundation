import { expect, test, type Page } from '@playwright/test'

// EntityView's two layouts (app/EntityView stories), in a real browser:
// the rail beside the main column on wide screens, one column in the order
// header → rail → main on narrow ones, the rail sticky only while it fits,
// reading and tab order, and editing in place in the rail. Axe in both
// themes is e2e/fixtures-visual.spec.ts's COMPOSITE_STORIES.
const story = (id: string) => `http://localhost:6180/story.html?id=app-entityview--${id}`

async function open(page: Page, id: string, width: number, height = 900) {
  await page.setViewportSize({ width, height })
  await page.goto(story(id))
  await expect(page.getByRole('heading', { level: 1, name: 'Office move' })).toBeVisible()
}

const box = async (page: Page, name: string) => (await page.getByRole('region', { name, exact: true }).boundingBox())!
const rail = (page: Page) => page.getByRole('complementary', { name: 'Office move details' })
const header = (page: Page) => page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) })

// Whether the Markdown table in Notes is squeezed: wider than its scroll
// box, or any cell's text wrapped onto a second line to fit (a table
// cell breaks long words rather than overflow).
const tableSqueezed = (page: Page) =>
  page
    .getByRole('region', { name: 'Notes' })
    .locator('[data-slot="table-container"]')
    .evaluate((container) => {
      if (container.scrollWidth > container.clientWidth + 1) return true
      return [...container.querySelectorAll('th, td')].some((cell) => {
        // The tops of the cell's visible text; two lines are a line apart.
        const tops: number[] = []
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (node.parentElement?.closest('.sr-only')) continue
          const range = document.createRange()
          range.selectNodeContents(node)
          for (const rect of range.getClientRects()) tops.push(rect.top)
        }
        return tops.length > 0 && Math.max(...tops) - Math.min(...tops) > 8
      })
    })

const pageScrollsSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)

test.describe('EntityView, rail layout', () => {
  for (const width of [1280, 2289]) {
    test(`${width}px: main starts under the header, beside the rail`, async ({ page }) => {
      await open(page, 'rail', width)
      const headerBox = (await header(page).boundingBox())!
      const notes = await box(page, 'Notes')
      const summary = await box(page, 'Summary')
      expect(notes.y).toBeGreaterThan(headerBox.y + headerBox.height)
      expect(Math.abs(notes.y - summary.y)).toBeLessThan(2)
      expect(notes.x + notes.width).toBeLessThan(summary.x)
      // Full width: the header spans both columns, and the main column takes
      // what the rail (22rem) leaves.
      expect(headerBox.width).toBeGreaterThan(width - 100)
      expect(summary.width).toBeCloseTo(352, 0)
      expect(await pageScrollsSideways(page)).toBe(false)
    })
  }

  test('2289px: a wide Markdown table fits the main column; the column layout squeezes it', async ({ page }) => {
    await open(page, 'rail', 2289)
    expect(await tableSqueezed(page)).toBe(false)
    await open(page, 'column', 2289)
    expect(await tableSqueezed(page)).toBe(true)
  })

  test('phone width: one column, header → rail → main, nothing scrolls sideways', async ({ page }) => {
    await open(page, 'rail', 393, 851)
    const headerBox = (await header(page).boundingBox())!
    const summary = await box(page, 'Summary')
    const links = await box(page, 'Links')
    const notes = await box(page, 'Notes')
    expect(summary.y).toBeGreaterThan(headerBox.y + headerBox.height)
    expect(links.y).toBeGreaterThan(summary.y + summary.height)
    expect(notes.y).toBeGreaterThan(links.y + links.height)
    expect(Math.abs(notes.x - summary.x)).toBeLessThan(2)
    expect(await pageScrollsSideways(page)).toBe(false)
  })

  test('the rail stacks label above value; at full width beside it', async ({ page }) => {
    const owner = async () => {
      const label = (await rail(page).locator('dt').getByText('Owner', { exact: true }).boundingBox())!
      const value = (await rail(page).getByText('Ada Lovelace').boundingBox())!
      return { label, value }
    }
    await open(page, 'rail', 1280)
    const narrow = await owner()
    expect(narrow.value.y).toBeGreaterThanOrEqual(narrow.label.y + narrow.label.height)

    // One column but wider than a phone: the rail's lists are wide enough
    // for a label beside its value again.
    await open(page, 'rail', 800)
    const wide = await owner()
    expect(wide.value.x).toBeGreaterThan(wide.label.x + wide.label.width)
    expect(Math.abs(wide.value.y - wide.label.y)).toBeLessThan(4)
  })

  test('the rail stays in view while the main column scrolls', async ({ page }) => {
    await open(page, 'rail', 1280, 800)
    await expect(rail(page)).toHaveAttribute('data-fits', '')
    await page.evaluate(() => window.scrollTo(0, 1500))
    await expect(page.getByRole('region', { name: 'Notes' }).getByRole('heading', { name: 'Week 1' })).not.toBeInViewport()
    const summary = await box(page, 'Summary')
    expect(summary.y).toBeGreaterThanOrEqual(0)
    expect(summary.y).toBeLessThan(40)
    await expect(rail(page).getByRole('link', { name: "Movers' quote" })).toBeInViewport()
  })

  test('a rail taller than the window scrolls with the page to its end', async ({ page }) => {
    await open(page, 'rail', 1280, 420)
    await expect(rail(page)).not.toHaveAttribute('data-fits')
    expect(await rail(page).evaluate((element) => getComputedStyle(element).position)).toBe('static')
    // Scrolled just far enough for the rail's end, well before the main
    // column's: a sticky rail would still hold its end below the fold.
    const railEnd = await rail(page).evaluate((element) => element.getBoundingClientRect().bottom + window.scrollY)
    await page.evaluate((end) => window.scrollTo(0, end - window.innerHeight + 8), railEnd)
    await expect(rail(page).getByRole('link', { name: "Movers' quote" })).toBeInViewport()

    // A taller window: the same rail fits again, and sticks.
    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(rail(page)).toHaveAttribute('data-fits', '')
  })

  test('main first: phone width puts the main column straight after the header, then the rail', async ({ page }) => {
    await open(page, 'rail-main-first', 393, 851)
    const headerBox = (await header(page).boundingBox())!
    const notes = await box(page, 'Notes')
    const followUps = await box(page, 'Follow-ups')
    const summary = await box(page, 'Summary')
    expect(notes.y).toBeGreaterThan(headerBox.y + headerBox.height)
    expect(followUps.y).toBeGreaterThan(notes.y + notes.height)
    expect(summary.y).toBeGreaterThan(followUps.y + followUps.height)
    expect(Math.abs(notes.x - summary.x)).toBeLessThan(2)
    expect(await pageScrollsSideways(page)).toBe(false)
    // In the DOM too, so a screen reader reads it in that order.
    expect(await page.locator('[data-slot=card-header] h2').allTextContents()).toEqual([
      'Notes',
      'Follow-ups',
      'Summary',
      'Links',
    ])
  })

  test('main first: at a desktop width the rail is still on the right, beside main', async ({ page }) => {
    await open(page, 'rail-main-first', 1280)
    const notes = await box(page, 'Notes')
    const summary = await box(page, 'Summary')
    expect(Math.abs(notes.y - summary.y)).toBeLessThan(2)
    expect(notes.x + notes.width).toBeLessThan(summary.x)
    expect(summary.width).toBeCloseTo(352, 0)
  })

  test('tab order is header, rail, main, at every width', async ({ page }) => {
    for (const width of [1280, 393]) {
      await open(page, 'rail', width)
      await page.locator('body').click({ position: { x: 1, y: 1 } })
      const order: string[] = []
      for (let step = 0; step < 5; step++) {
        await page.keyboard.press('Tab')
        order.push(await page.evaluate(() => document.activeElement?.textContent?.trim() || document.activeElement?.getAttribute('aria-label') || ''))
      }
      expect(order).toEqual(['Projects', 'Edit', 'Edit Owner', 'Floor plan', "Movers' quote"])
    }
  })

  test('the rail is an <aside> named for the record; the column layout has none', async ({ page }) => {
    await open(page, 'rail', 1280)
    await expect(rail(page)).toHaveCount(1)
    await expect(rail(page).getByRole('region')).toHaveText([/^Summary/, /^Links/])
    await expect(page.getByRole('main')).toHaveCount(0)
    await open(page, 'column', 1280)
    await expect(page.getByRole('complementary')).toHaveCount(0)
  })

  test('editing in place works in the rail', async ({ page }) => {
    await open(page, 'rail', 1280)
    await rail(page).getByText('Ada Lovelace').click()
    const input = rail(page).getByRole('textbox', { name: 'Owner' })
    await expect(input).toBeFocused()
    // The control fits the narrow column.
    const inputBox = (await input.boundingBox())!
    const summary = await box(page, 'Summary')
    expect(inputBox.x + inputBox.width).toBeLessThanOrEqual(summary.x + summary.width)
    await input.fill('Grace Hopper')
    await page.keyboard.press('Enter')
    await expect(rail(page).getByText('Saving…')).toBeVisible()
    await expect(rail(page).getByText('Grace Hopper')).toBeVisible()
    await expect(rail(page).getByRole('button', { name: 'Edit Owner' })).toBeFocused()
  })

  test('loading: the skeleton has the rail on the right, as the page will', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('rail-loading'))
    const loading = page.locator('[data-state="loading"][data-layout="rail"]')
    await expect(loading).toBeVisible()
    const cards = loading.locator('[data-slot="card"]')
    await expect(cards).toHaveCount(2)
    const [railCard, mainCard] = [(await cards.nth(0).boundingBox())!, (await cards.nth(1).boundingBox())!]
    expect(railCard.x).toBeGreaterThan(mainCard.x + mainCard.width)
    expect(railCard.width).toBeCloseTo(352, 0)
  })
})

test.describe('EntityView, column layout (the default)', () => {
  test('one column capped at 896px, label beside value', async ({ page }) => {
    await open(page, 'column', 1280)
    const view = (await page.locator('[data-state="success"]').boundingBox())!
    expect(view.width).toBeLessThanOrEqual(896)
    const summary = await box(page, 'Summary')
    const notes = await box(page, 'Notes')
    expect(notes.y).toBeGreaterThan(summary.y + summary.height)
    const label = (await page.locator('dt').getByText('Owner', { exact: true }).boundingBox())!
    const value = (await page.getByText('Ada Lovelace').boundingBox())!
    expect(value.x).toBeGreaterThan(label.x + label.width)
  })
})

// A list of sub-items edited in place (app/EntityView Lists): a checklist
// in the main column, links in the rail. The template's
// e2e/widget-edit-in-place.spec.ts covers it against a real save.
test.describe('EntityView, a list edited in place', () => {
  const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true })
  const items = (page: Page, name: string) => region(page, name).getByRole('list', { name }).getByRole('listitem')

  test('in the main column: add from the keyboard, edit, move, remove; ticking still works', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('lists'))
    const checklist = region(page, 'Checklist')
    await expect(items(page, 'Checklist')).toHaveText(['Book the lift', 'Label the boxes', 'Return the keys'])

    await checklist.getByRole('button', { name: 'Add item' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('textbox', { name: 'Item 4 text' })).toBeFocused()
    await page.keyboard.type('Water the plants')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('textbox', { name: 'Item 5 text' })).toBeFocused()
    await page.keyboard.type('Hand back the badge')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('textbox', { name: 'Item 6 text' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(items(page, 'Checklist')).toHaveText([
      'Book the lift',
      'Label the boxes',
      'Return the keys',
      'Water the plants',
      'Hand back the badge',
    ])

    await checklist.getByText('Label the boxes', { exact: true }).click()
    await page.getByRole('textbox', { name: 'Item 2 text' }).fill('Label every box')
    await page.keyboard.press('Enter')
    await expect(items(page, 'Checklist').nth(1)).toHaveText('Label every box')

    await checklist.getByRole('button', { name: 'Move item 5 up' }).click()
    await expect(items(page, 'Checklist').nth(3)).toHaveText('Hand back the badge')
    await checklist.getByRole('button', { name: 'Remove item 1' }).click()
    await expect(items(page, 'Checklist')).toHaveCount(4)
    await expect(checklist.getByText('0/4 done')).toBeVisible()

    await checklist.getByRole('checkbox', { name: 'Done: Return the keys' }).click()
    await expect(checklist.getByText('1/4 done')).toBeVisible()
  })

  test('in the rail: a link added and refused, the reason under it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('lists'))
    const links = rail(page).getByRole('region', { name: 'Links' })
    await links.getByRole('button', { name: 'Add link' }).click()
    const label = page.getByRole('textbox', { name: 'Link 2 label' })
    await expect(label).toBeFocused()
    // The control fits the narrow column.
    const labelBox = (await label.boundingBox())!
    const card = (await links.boundingBox())!
    expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(card.x + card.width)

    await label.fill('refuse')
    await page.keyboard.press('Enter')
    await expect(links.getByRole('alert')).toHaveText('That one is refused, as a server would.')
    await expect(label).toHaveValue('refuse')
    await label.fill('Movers')
    await page.keyboard.press('Enter')
    await expect(items(page, 'Links')).toHaveText(['Floor plan', 'Movers'])
  })
})

// Long text that autosaves (app/EntityView Autosave): Notes is the editor
// itself (`alwaysEditable`), Summary opens on a click (`autosave`). Each
// save takes 500ms; text with "refuse" in it is refused. The template's
// e2e/widget-edit-in-place.spec.ts covers autosave against a real save.
test.describe('EntityView, long text that autosaves', () => {
  const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true })
  const saves = (page: Page) =>
    page.locator('dl > div').filter({ has: page.locator('dt').getByText('Saves', { exact: true }) }).locator('dd')

  async function openAutosave(page: Page) {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('autosave'))
    await expect(page.getByRole('heading', { level: 1, name: 'Office move' })).toBeVisible()
  }

  async function typeAtEnd(page: Page, editor: ReturnType<Page['getByRole']>, text: string) {
    await editor.locator('p').last().click()
    await page.keyboard.press('ControlOrMeta+End')
    await page.keyboard.type(text)
  }

  test('always editable: the notes are the editor; typing saves with no click away, and stays editable while saving', async ({ page }) => {
    await openAutosave(page)
    const notes = region(page, 'Notes')
    const editor = notes.getByRole('textbox', { name: 'Notes' })
    // At rest, no click to open and no pencil.
    await expect(editor).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit Notes' })).toHaveCount(0)

    await typeAtEnd(page, editor, ' Then desks.')
    // Saves on its own after the pause, the caret still in the text.
    await expect(notes.getByRole('status')).toHaveText('Saving…')
    await expect(editor).toBeFocused()
    await expect(editor).toHaveAttribute('aria-readonly', 'false')
    // Typing mid-save is kept, and saved next.
    await page.keyboard.type(' Then chairs.')
    await expect(notes.getByRole('status')).toHaveText('Saved', { timeout: 5000 })
    await expect(page.getByTestId('saved-notes')).toHaveText('Pack the shared shelves first. Then desks. Then chairs.')
    await expect(saves(page)).toHaveText('2')
    await expect(editor).toBeFocused()
  })

  test('always editable: a refusal keeps exactly what was typed, with the reason', async ({ page }) => {
    await openAutosave(page)
    const notes = region(page, 'Notes')
    const editor = notes.getByRole('textbox', { name: 'Notes' })
    await typeAtEnd(page, editor, ' refuse')
    await expect(notes.getByText('The server refused it, as a server would.')).toBeVisible({ timeout: 5000 })
    await expect(editor).toContainText('Pack the shared shelves first. refuse')
    await expect(editor).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByTestId('saved-notes')).toHaveText('Pack the shared shelves first.')
  })

  test('autosave on a click: saves while open; Esc saves what is left and closes, reverting nothing', async ({ page }) => {
    await openAutosave(page)
    const summary = region(page, 'Summary')
    await summary.getByText('Moving to the third floor.').click()
    const editor = summary.getByRole('textbox', { name: 'Summary' })
    await expect(editor).toBeFocused()
    await typeAtEnd(page, editor, ' In March.')
    await expect(summary.getByRole('status')).toHaveText('Saved', { timeout: 5000 })
    await expect(editor).toBeVisible()
    await page.keyboard.type(' Week one.')
    await page.keyboard.press('Escape')
    await expect(editor).toHaveCount(0, { timeout: 5000 })
    await expect(summary.getByText('Moving to the third floor. In March. Week one.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit Summary' })).toBeFocused()
  })

  test('leaving the page saves first and goes on, asking only when the save fails', async ({ page }) => {
    await openAutosave(page)
    const editor = region(page, 'Notes').getByRole('textbox', { name: 'Notes' })
    await typeAtEnd(page, editor, ' refuse')
    await page.getByRole('link', { name: 'Projects' }).click()
    const prompt = page.getByRole('dialog', { name: 'Discard your changes?' })
    await expect(prompt).toBeVisible({ timeout: 5000 })
    await prompt.getByRole('button', { name: 'Keep editing' }).click()
    await expect(prompt).toHaveCount(0)

    // Fixed, then leaving: saved on the way out, no prompt.
    await editor.locator('p').last().click()
    await page.keyboard.press('ControlOrMeta+End')
    for (let i = 0; i < ' refuse'.length; i++) await page.keyboard.press('Backspace')
    await page.keyboard.type(' Then desks.')
    await page.getByRole('link', { name: 'Projects' }).click()
    await expect(page.getByText('Projects', { exact: true })).toBeVisible({ timeout: 5000 })
    await expect(prompt).toHaveCount(0)
  })
})

test.describe('EntityView, notice and footer (#158, #159)', () => {
  async function openHeld(page: Page, width: number, height = 900) {
    await page.setViewportSize({ width, height })
    await page.goto(story('notice-and-footer'))
    await expect(page.getByRole('heading', { level: 1, name: 'The Fall of Hyperion' })).toBeVisible()
  }
  const notice = (page: Page) => page.locator('[data-slot="notice"]')
  const footer = (page: Page) => page.locator('[data-slot="entity-view-footer"]')

  for (const width of [1280, 393]) {
    test(`${width}px: the notice spans the page under the header; the footer comes after every section`, async ({
      page,
    }) => {
      await openHeld(page, width)
      const headerBox = (await header(page).boundingBox())!
      const noticeBox = (await notice(page).boundingBox())!
      const details = await box(page, 'Details')
      const notes = await box(page, 'Notes')
      const footerBox = (await footer(page).boundingBox())!
      expect(noticeBox.y).toBeGreaterThan(headerBox.y + headerBox.height)
      expect(Math.abs(noticeBox.width - headerBox.width)).toBeLessThan(2)
      // Above both columns, whichever comes first at this width.
      expect(noticeBox.y + noticeBox.height).toBeLessThan(Math.min(details.y, notes.y))
      expect(footerBox.y).toBeGreaterThan(Math.max(details.y + details.height, notes.y + notes.height))
      expect(await pageScrollsSideways(page)).toBe(false)
    })
  }

  test('the notice sits in a status region that is there before it changes, so clearing it is a change', async ({
    page,
  }) => {
    await openHeld(page, 1280)
    const status = page.locator('[data-slot="entity-view-notice"]')
    await expect(status).toHaveAttribute('role', 'status')
    // The notice itself isn't an alert: it was there when the page opened.
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(status).toContainText('On hold')
    await page.getByRole('button', { name: 'Release the hold' }).click()
    await expect(notice(page)).toHaveCount(0)
    await expect(status).toHaveAttribute('role', 'status')
    await expect(status).toBeEmpty()
  })

  test('each source opens in a new tab and says so', async ({ page }) => {
    await openHeld(page, 1280)
    const link = footer(page).getByRole('link', { name: 'Open Library (opens in a new tab)' })
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(footer(page)).toContainText(
      'Data from Open Library (opens in a new tab) and Wikidata (opens in a new tab). Covers and editions',
    )
  })
})
