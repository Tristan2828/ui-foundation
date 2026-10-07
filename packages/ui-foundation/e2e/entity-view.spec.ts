import { expect, test, type Page } from '@playwright/test'

// EntityView's two layouts (app/EntityView stories), in a real browser:
// the rail beside the main column on wide screens, one column in the order
// header → rail → main on narrow ones, the rail sticky only while it fits,
// reading and tab order, and editing in place in the rail. Axe in both
// themes is e2e/storybook-visual.spec.ts's COMPOSITE_STORIES.
const story = (id: string) => `http://localhost:6006/iframe.html?id=app-entityview--${id}&viewMode=story`

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
