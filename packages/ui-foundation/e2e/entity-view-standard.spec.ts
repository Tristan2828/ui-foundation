import { expect, test, type Locator, type Page } from '@playwright/test'

// The record page standard in EntityView (4.81; app/EntityView "Record
// standard" and "Record standard, long title") in a real browser: the
// badges on the title's line, Print notes and Delete as icons with their
// tooltips, the strip's icons, and folded empties opening, edited in
// place, and joined by a value set elsewhere. Axe, the token check and the
// icons' 3:1 are e2e/fixtures-visual.spec.ts's.
const story = (id: string) => `http://localhost:6180/story.html?id=app-entityview--${id}`

async function open(page: Page, id: string, width: number) {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(story(id))
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

const box = async (locator: Locator) => (await locator.boundingBox())!
const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true })
const pageScrollsSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)

test.describe('EntityView header', () => {
  test('1280px: the status and badge on the title line, the subtitle under it', async ({ page }) => {
    await open(page, 'record-standard', 1280)
    const title = await box(page.getByRole('heading', { level: 1 }))
    const active = await box(page.getByText('Active', { exact: true }))
    const subtitle = await box(page.getByText('Timber and sheet goods for the workshop'))
    expect(active.x).toBeGreaterThan(title.x + title.width)
    expect(Math.abs(active.y + active.height / 2 - (title.y + title.height / 2))).toBeLessThan(4)
    expect(subtitle.y).toBeGreaterThanOrEqual(title.y + title.height)
    expect(await pageScrollsSideways(page)).toBe(false)
  })

  test('390px: badges too wide beside the title wrap under it, above the subtitle', async ({ page }) => {
    await open(page, 'record-standard', 390)
    const title = await box(page.getByRole('heading', { level: 1 }))
    const active = await box(page.getByText('Active', { exact: true }))
    const subtitle = await box(page.getByText('Timber and sheet goods for the workshop'))
    expect(active.y).toBeGreaterThanOrEqual(title.y + title.height - 1)
    expect(Math.abs(active.x - title.x)).toBeLessThan(2)
    expect(subtitle.y).toBeGreaterThanOrEqual(active.y + active.height)
    expect(await pageScrollsSideways(page)).toBe(false)
  })

  test('a long title pushes the badges to the next line', async ({ page }) => {
    await open(page, 'record-standard-long-title', 1280)
    const title = await box(page.getByRole('heading', { level: 1 }))
    const active = await box(page.getByText('Active', { exact: true }))
    expect(active.y).toBeGreaterThanOrEqual(title.y + title.height - 1)
    expect(Math.abs(active.x - title.x)).toBeLessThan(2)
  })

  test('Print notes and Delete are icons, each named, with its tooltip', async ({ page }) => {
    await open(page, 'record-standard', 1280)
    for (const name of ['Print notes', 'Delete']) {
      const button = page.getByRole('button', { name, exact: true })
      await expect(button).toHaveText('')
      const size = await box(button)
      expect(Math.round(size.width)).toBe(Math.round(size.height))
      await button.hover()
      await expect(page.getByText(name, { exact: true }).last()).toBeVisible()
      await page.mouse.move(0, 0)
    }
    // The record's own command stays in words.
    await expect(page.getByRole('button', { name: 'New order' })).toHaveText('New order')
  })

  test('Delete as a dialog trigger opens its confirm dialog', async ({ page }) => {
    await open(page, 'record-standard', 1280)
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Delete Northwind Lumber?' })).toBeVisible()
  })

  test('the strip draws each icon before its word, 13px', async ({ page }) => {
    await open(page, 'record-standard', 1280)
    const label = page.locator('[data-slot="key-stats"] dt', { hasText: 'Last order' })
    const icon = await box(label.locator('svg'))
    const words = await box(label)
    expect(Math.round(icon.width)).toBe(13)
    expect(icon.x).toBeLessThan(words.x + 2)
  })
})

test.describe('EntityView folded empties', () => {
  for (const width of [1280, 390]) {
    test(`${width}px: a card shows its filled fields, then "N empty" opens the rest in place`, async ({ page }) => {
      await open(page, 'record-standard', width)
      const contact = region(page, 'Contact')
      await expect(contact.locator('dt')).toHaveText(['Address'])
      const toggle = contact.getByRole('button', { name: '3 empty' })
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await toggle.click()
      await expect(contact.locator('dt')).toHaveText(['Phone', 'Fax', 'Website', 'Address'])
      await expect(contact.getByRole('button', { name: 'Hide empty' })).toHaveAttribute('aria-expanded', 'true')
      // The dash, read as "Not set".
      await expect(contact.locator('dd').first()).toHaveText('—Not set')
      expect(await pageScrollsSideways(page)).toBe(false)
    })
  }

  test('an opened empty field is still edited in place', async ({ page }) => {
    await open(page, 'record-standard', 1280)
    const contact = region(page, 'Contact')
    await contact.getByRole('button', { name: '3 empty' }).click()
    await contact.getByRole('button', { name: 'Edit Fax' }).click()
    await page.getByRole('textbox', { name: 'Fax' }).fill('555-0199')
    await page.keyboard.press('Enter')
    await expect(contact.getByText('555-0199')).toBeVisible()
    // Folded again, the filled one stays in the card.
    await contact.getByRole('button', { name: 'Hide empty' }).click()
    await expect(contact.locator('dt')).toHaveText(['Fax', 'Address'])
    await expect(contact.getByRole('button', { name: '2 empty' })).toBeVisible()
  })

  test('a value set elsewhere moves its field into the card', async ({ page }) => {
    await open(page, 'record-standard', 1280)
    const contact = region(page, 'Contact')
    await page.getByRole('button', { name: 'Add the phone' }).click()
    await expect(contact.locator('dt')).toHaveText(['Phone', 'Address'])
    await expect(contact.getByRole('button', { name: '2 empty' })).toBeVisible()
  })
})

// The title edited in place (app/EntityView "Record standard, title edited
// in place", and its long title). Before 4.94 the editable box's negative
// margins made the title 0.75rem too narrow for its own text, so a short
// name broke over two lines ("Dr. / Example").
test.describe('EntityView title edited in place', () => {
  // The lines the title's text sits on, and the words broken across two.
  const titleLines = (page: Page) =>
    page.getByRole('heading', { level: 1 }).evaluate((heading) => {
      const value = heading.querySelector('[data-slot="editable-value"] > span')!
      const text = document.createTreeWalker(value, NodeFilter.SHOW_TEXT).nextNode() as Text
      const tops = (start: number, end: number) => {
        const range = document.createRange()
        range.setStart(text, start)
        range.setEnd(text, end)
        return new Set([...range.getClientRects()].filter((rect) => rect.width > 0).map((rect) => Math.round(rect.top))).size
      }
      const broken: string[] = []
      for (const match of text.data.matchAll(/\S+/g)) {
        if (tops(match.index, match.index + match[0].length) > 1) broken.push(match[0])
      }
      return { lines: tops(0, text.data.length), broken }
    })

  for (const width of [1280, 375]) {
    test(`${width}px: a short name stays on one line`, async ({ page }) => {
      await open(page, 'record-standard-editable-title', width)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dr. Example')
      expect(await titleLines(page)).toEqual({ lines: 1, broken: [] })
      expect(await pageScrollsSideways(page)).toBe(false)
    })

    test(`${width}px: a long name wraps within its column, between words`, async ({ page }) => {
      await open(page, 'record-standard-editable-long-title', width)
      const { lines, broken } = await titleLines(page)
      expect(lines).toBeGreaterThan(1)
      expect(broken).toEqual([])
      const heading = await box(page.getByRole('heading', { level: 1 }))
      const value = await box(page.getByRole('heading', { level: 1 }).locator('[data-slot="editable-value"]'))
      // The hover tint reaches 0.375rem past the text on each side, no further.
      expect(value.x + value.width).toBeLessThanOrEqual(heading.x + heading.width + 6.5)
      expect(await pageScrollsSideways(page)).toBe(false)
    })
  }
})
