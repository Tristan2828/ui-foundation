import AxeBuilder from './axe'
import { expect, test, type Locator, type Page } from '@playwright/test'

// The page standards' gaps apps worked around: src/components/app/page-gaps.fixtures.tsx.
const STORY = (id: string, theme: 'light' | 'dark' = 'light') => `http://localhost:6180/story.html?id=app-page-gaps--${id}&theme=${theme}`
const box = async (locator: Locator) => (await locator.boundingBox())!

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
  expect(results.violations).toEqual([])
}

test.describe('links and filters', () => {
  test('an IconAction given a link renders that link, its name and tooltip kept', async ({ page }) => {
    await page.goto(STORY('links-and-filters'))
    const print = page.locator('[data-slot=icon-action][aria-label=Print]')
    await print.hover()
    await expect(page.locator('[data-slot=tooltip-content][data-open]')).toHaveText('Print')
    // Once it has settled: a Button-drawn link lost its href after mounting.
    await page.waitForTimeout(300)
    expect(await print.evaluate((node) => [node.tagName, node.getAttribute('href'), node.getAttribute('type'), node.getAttribute('role')])).toEqual([
      'A',
      '/print',
      null,
      null,
    ])
    await expect(page.getByRole('link', { name: 'Print' })).toBeVisible()
    await expect(print).toHaveAttribute('data-slot', 'icon-action')
    const site = page.getByRole('link', { name: 'Open site' })
    await expect(site).toHaveAttribute('href', 'https://example.com')
    await expect(site).toHaveAttribute('target', '_blank')
    // No button left behind with those names; Pin stays a button.
    await expect(page.getByRole('button', { name: 'Print' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Pin' })).toBeVisible()
  })

  test("the search box's own keys reach the app", async ({ page }) => {
    await page.goto(STORY('links-and-filters'))
    const search = page.getByRole('searchbox', { name: 'Search' })
    await search.fill('#12')
    await search.press('Enter')
    await expect(page.getByTestId('opened')).toHaveText('Opened: record 12')
    await expect(search).toHaveValue('#12')
  })

  test('a filter select is named by its label first', async ({ page }) => {
    await page.goto(STORY('links-and-filters'))
    // "Any Kind" says the label: the name is the label alone.
    const kind = page.getByRole('combobox', { name: 'Kind', exact: true })
    await expect(kind).toContainText('Any Kind')
    // "Anywhere" doesn't: the label, then the words shown.
    await expect(page.getByRole('combobox', { name: 'Shelf: Anywhere', exact: true })).toBeVisible()
    await kind.click()
    await page.getByRole('option', { name: 'Tool' }).click()
    await expect(page.getByRole('combobox', { name: 'Kind: Tool', exact: true })).toBeVisible()
  })
})

test.describe('the record', () => {
  test('badge items take a tone, their word kept', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(STORY('record'))
    const rail = page.locator('[data-slot=entity-view-facts-rail]')
    for (const [word, tone] of [['Pinned', 'info'], ['Overdue', 'destructive'], ['Checked', 'success'], ['Low stock', 'warning']]) {
      await expect(rail.locator(`[data-slot=badge][data-tone=${tone}]`)).toHaveText(word)
    }
    await expect(rail.locator('[data-slot=badge]:not([data-tone])')).toHaveText('Plain')
    // A toned badge's icon wears the tone, not the muted colour.
    const pinned = rail.locator('[data-slot=badge][data-tone=info]')
    const [text, icon] = await Promise.all([
      pinned.evaluate((node) => getComputedStyle(node).color),
      pinned.locator('[data-slot=entity-view-fact-badge-icon]').evaluate((node) => getComputedStyle(node).color),
    ])
    expect(icon).toBe(text)
  })

  test('each Delete icon is named by its record; its tooltip says the verb', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(STORY('record'))
    const kit = page.getByRole('button', { name: 'Delete Cabinet repair kit', exact: true })
    await expect(kit).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete Workshop wall', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete Garage', exact: true })).toBeVisible()
    await kit.hover()
    await expect(page.locator('[data-slot=tooltip-content][data-open]')).toHaveText('Delete')
    await page.mouse.move(0, 0)
    await page.getByRole('button', { name: 'Delete Garage', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Delete Garage?' })).toBeVisible()
  })

  for (const width of [1440, 375]) {
    test(`a list fact edited in place holds still under the mouse (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(STORY('record'))
      const items = page.locator('[data-slot=fact-list-item]').filter({ hasText: 'Shelf bracket' })
      await expect(items).toBeVisible()
      await page.mouse.move(1, 1)
      const before = await box(items)
      await items.hover()
      await page.waitForTimeout(250)
      const after = await box(items)
      expect(Math.abs(after.x - before.x)).toBeLessThan(1)
      expect(Math.abs(after.y - before.y)).toBeLessThan(1)
      expect(Math.abs(after.width - before.width)).toBeLessThan(1)
    })
  }

  for (const theme of ['light', 'dark'] as const) {
    test(`is accessible (${theme})`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(STORY('record', theme))
      await expect(page.getByText('Low stock')).toBeVisible()
      await axe(page)
    })
  }
})

test.describe('forms', () => {
  test('a ToggleGroup in a Field is a choice: it pairs with ChoiceButtons', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(STORY('forms'))
    const fields = page.locator('[data-slot=field]')
    // A choice beside anything but a choice would start a row of its own.
    const [size, finish] = [await box(fields.nth(0)), await box(fields.nth(1))]
    expect(Math.abs(size.y - finish.y)).toBeLessThan(1)
    expect(finish.x).toBeGreaterThan(size.x + size.width - 1)
  })

  test("an editor with only the floating toolbar puts an image in through the slash menu's Image", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(STORY('forms'))
    const editor = page.getByRole('textbox', { name: 'Repair notes' })
    await editor.click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('/ima')
    const image = page.getByRole('option', { name: 'Image' })
    await expect(image).toBeVisible()
    const chooser = page.waitForEvent('filechooser')
    await page.keyboard.press('Enter')
    await (await chooser).setFiles({ name: 'hinge.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByTestId('notes-value')).toContainText('![](blob:')
    await expect(page.getByTestId('notes-value')).not.toContainText('/ima')
  })
})

test("an inline editor's text holds its place while the editor loads, so what's under it never moves", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  // The editor's code a second late, as on a slow first visit.
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route(/milkdown-editor/, async (route) => {
    await held
    await route.continue()
  })
  await page.goto(STORY('forms'))
  const after = page.getByTestId('after-guide')
  await expect(after).toBeVisible()
  await expect(page.locator('[data-slot=rich-text-editor][data-state=loading]').last()).toContainText('Turn the water off')
  const loading = await box(after)
  release()
  await expect(page.getByRole('textbox', { name: 'Guide' })).toBeVisible()
  await page.waitForTimeout(300)
  const loaded = await box(after)
  expect(Math.abs(loaded.y - loading.y)).toBeLessThan(4)
})

test.describe('the framed list', () => {
  test('pressing the default view writes no sort, and its sort still holds', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(STORY('framed-list'))
    await expect(page.getByTestId('address')).toHaveText('Address: (plain)')
    // The default view's sort (due) at the plain address.
    await expect(page.getByTestId('order')).toHaveText('Order: Bike tune-up, Cabinet repair')
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(page.getByTestId('address')).toContainText('sort=name')
    await page.getByRole('button', { name: 'Open', exact: true }).click()
    await expect(page.getByTestId('address')).toHaveText('Address: (plain)')
    await expect(page.getByTestId('order')).toHaveText('Order: Bike tune-up, Cabinet repair')
  })

  test("a ⋯ item can be disabled", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(STORY('framed-list'))
    await page.getByRole('button', { name: 'More for Kits' }).click()
    await expect(page.getByRole('menuitem', { name: 'Import' })).toBeDisabled()
    await expect(page.getByRole('menuitem', { name: 'Export' })).toBeEnabled()
  })

  test("the page bar sits between the header and the card, as wide as the card, and doesn't widen it", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(STORY('framed-list'))
    const header = await box(page.locator('[data-slot=list-header]'))
    const bar = await box(page.locator('[data-slot=data-table-page-bar]'))
    const card = await box(page.locator('[data-slot=data-table-frame]'))
    expect(bar.y).toBeGreaterThanOrEqual(header.y + header.height - 1)
    expect(card.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1)
    expect(Math.abs(bar.width - card.width)).toBeLessThan(1)
    expect(Math.abs(header.width - card.width)).toBeLessThan(1)
    // The long sentence wraps; the card is the table's width, not the sentence's.
    expect(bar.height).toBeGreaterThan(60)
    expect(card.width).toBeLessThan(900)
    // Plain words, whose own width is a whole line, don't widen it either.
    await page.locator('[data-slot=data-table-page-bar]').evaluate((node) => {
      const line = document.createElement('p')
      line.textContent = 'Totals for the month: planned spending, what came in, what went out, and what is left over after every bill on the list is paid in full.'
      node.append(line)
    })
    const after = await box(page.locator('[data-slot=data-table-frame]'))
    expect(Math.abs(after.width - card.width)).toBeLessThan(1)
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`is accessible (${theme})`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(STORY('framed-list', theme))
      await expect(page.getByText('Two kits are due this week')).toBeVisible()
      await axe(page)
    })
  }
})

for (const id of ['links-and-filters', 'forms']) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${id} is accessible (${theme})`, async ({ page }) => {
      await page.goto(STORY(id, theme))
      await expect(page.locator('#root')).not.toBeEmpty()
      await axe(page)
    })
  }
}

// A 1x1 PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
