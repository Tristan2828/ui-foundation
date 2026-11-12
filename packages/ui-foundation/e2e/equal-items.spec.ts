import { expect, test } from '@playwright/test'

// EqualItems (record standard R10, app/EqualItems): what markup tests
// can't say. Featured's toggles work from the keyboard, several open at
// once, and every part has its accessible name; cards and panels sit side
// by side on a laptop and stack on a phone, and no look scrolls the page
// sideways. Axe, the token colours and the glyph check, in both themes and
// each palette, are e2e/fixtures-visual.spec.ts's.
const story = (id: string) => `http://localhost:6180/story.html?id=app-equalitems--${id}`

const noPageScroll = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

test.describe('featured', () => {
  test('the toggles open and close from the keyboard, several at once, in place', async ({ page }) => {
    await page.goto(story('featured'))
    const phases = page.getByRole('group', { name: 'Phases' })
    // The current phase in full, its fields read with their labels.
    const featured = phases.getByRole('region', { name: 'Phase 2' })
    await expect(featured.getByRole('heading', { name: 'Phase 2' })).toBeVisible()
    await expect(featured.getByRole('definition').filter({ hasText: 'Hills and tempo' })).toBeVisible()

    const first = phases.getByRole('button', { name: 'Phase 1 Done' })
    const third = phases.getByRole('button', { name: 'Phase 3 Planned' })
    await expect(first).toHaveAttribute('aria-expanded', 'false')
    await expect(phases.getByText('Easy base miles')).toHaveCount(0)

    await first.focus()
    await page.keyboard.press('Enter')
    await expect(first).toHaveAttribute('aria-expanded', 'true')
    await expect(phases.getByText('Easy base miles')).toBeVisible()
    const url = page.url()

    await page.keyboard.press('Tab')
    await expect(third).toBeFocused()
    await page.keyboard.press('Space')
    await expect(third).toHaveAttribute('aria-expanded', 'true')
    await expect(phases.getByText('Race pace')).toBeVisible()
    // Both stay open: opening one never closes another.
    await expect(first).toHaveAttribute('aria-expanded', 'true')

    await page.keyboard.press('Space')
    await expect(third).toHaveAttribute('aria-expanded', 'false')
    await expect(phases.getByText('Race pace')).toHaveCount(0)
    // In place, never navigation.
    expect(page.url()).toBe(url)

    // A toggle is a button inside its own heading, at the items' level.
    await expect(phases.getByRole('heading', { level: 3, name: 'Phase 1 Done' })).toBeVisible()
  })

  test('defaultOpenIds opens one when it first shows', async ({ page }) => {
    await page.goto(story('featured'))
    const options = page.getByRole('group', { name: 'Options' })
    await expect(options.getByRole('button', { name: 'Pro Over budget' })).toHaveAttribute('aria-expanded', 'true')
    await expect(options.getByRole('button', { name: 'Basic Free' })).toHaveAttribute('aria-expanded', 'false')
  })
})

test.describe('names', () => {
  test('cards and panels are named lists of headed items; the table has its caption and row headers', async ({ page }) => {
    await page.goto(story('cards'))
    const cards = page.getByRole('list', { name: 'Phases' })
    await expect(cards.getByRole('listitem')).toHaveCount(3)
    await expect(cards.getByRole('heading', { level: 3 })).toHaveText(['Phase 1', 'Phase 2', 'Phase 3'])

    await page.goto(story('table-look'))
    const table = page.getByRole('table', { name: 'Options' })
    await expect(table.getByRole('columnheader')).toHaveText(['Name', 'Status', 'Price', 'Seats', 'Storage', 'Support'])
    await expect(table.getByRole('rowheader')).toHaveText(['Basic', 'Plus', 'Pro'])
    // A missing value is the record's dash, read as Not set.
    await expect(table.getByRole('row', { name: /Basic/ }).getByText('Not set')).toHaveCount(1)
  })
})

test.describe('widths', () => {
  test('on a laptop, cards and panels sit side by side', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    for (const id of ['cards', 'panels']) {
      await page.goto(story(id))
      const tops = await page
        .getByRole('list', { name: 'Phases' })
        .locator('[data-slot="equal-item"]')
        .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)))
      expect(new Set(tops).size, id).toBe(1)
    }
  })

  test('on a phone, cards and panels stack, and no look scrolls the page sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    for (const id of ['cards', 'panels']) {
      await page.goto(story(id))
      const lefts = await page
        .getByRole('list', { name: 'Phases' })
        .locator('[data-slot="equal-item"]')
        .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)))
      expect(lefts, id).toHaveLength(3)
      expect(new Set(lefts).size, id).toBe(1)
    }
    for (const id of ['cards', 'table-look', 'featured', 'panels', 'long-titles', 'seven-items']) {
      await page.goto(story(id))
      await expect(page.locator('[data-slot="equal-items"]').first()).toBeVisible()
      expect(await noPageScroll(page), id).toBe(true)
    }
  })
})
