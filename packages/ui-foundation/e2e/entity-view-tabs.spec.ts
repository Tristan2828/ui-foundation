import { expect, test, type Page } from '@playwright/test'

// EntityView's 4.76 opt-ins in a real browser: tabs over the main column
// (#303; app/EntityView Tabs, Tabs column), the `leading` mark left of
// the title (Leading) and rail fields beside their labels (Rail fields
// beside), each at a desktop's and a phone's width. Axe and the token
// check in both themes are e2e/fixtures-visual.spec.ts's COMPOSITE_STORIES.
const story = (id: string, query = '') => `http://localhost:6180/story.html?id=app-entityview--${id}${query}`

async function open(page: Page, id: string, width: number, query = '') {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(story(id, query))
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
}

const tabList = (page: Page) => page.getByRole('tablist', { name: 'Packing a desk sections' })
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true })
const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true })
const address = (page: Page) => page.getByTestId('address')
const rail = (page: Page) => page.getByRole('complementary', { name: 'Packing a desk details' })
const pageScrollsSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)

test.describe('EntityView tabs', () => {
  test('desktop: the list under the strip, the first tab open, the rail beside', async ({ page }) => {
    await open(page, 'tabs', 1280)
    const strip = (await page.locator('[data-slot="entity-view-strip"]').boundingBox())!
    const list = (await tabList(page).boundingBox())!
    const overview = (await region(page, 'Overview').boundingBox())!
    expect(overview.y).toBeGreaterThan(strip.y + strip.height)
    expect(list.y).toBeGreaterThan(overview.y + overview.height)
    await expect(tab(page, 'Steps')).toHaveAttribute('aria-selected', 'true')
    await expect(region(page, 'Steps')).toBeVisible()
    await expect(region(page, 'Details')).toBeVisible()
    await expect(region(page, 'Where it applies')).toBeHidden()
    // The rail starts level with the main column, right of the list.
    const summary = (await region(page, 'Summary').boundingBox())!
    expect(Math.abs(summary.y - overview.y)).toBeLessThan(2)
    expect(list.x + list.width).toBeLessThan(summary.x)
    await expect(address(page)).toHaveText('Page at /')
  })

  test('a click selects a tab into the address; the first is the bare address again', async ({ page }) => {
    await open(page, 'tabs', 1280)
    await tab(page, 'Used in').click()
    await expect(region(page, 'Where it applies')).toBeVisible()
    await expect(region(page, 'Exceptions')).toContainText('No exceptions')
    await expect(region(page, 'Steps')).toBeHidden()
    await expect(rail(page)).toBeVisible()
    await expect(address(page)).toHaveText('Page at /?tab=used-in')
    await tab(page, 'Steps').click()
    await expect(address(page)).toHaveText('Page at /')
  })

  test('keyboard: arrows move and select, Home and End jump, Tab goes into the panel', async ({ page }) => {
    await open(page, 'tabs', 1280)
    await tab(page, 'Steps').focus()
    await page.keyboard.press('ArrowRight')
    await expect(tab(page, 'Used in')).toBeFocused()
    await expect(tab(page, 'Used in')).toHaveAttribute('aria-selected', 'true')
    await expect(address(page)).toHaveText('Page at /?tab=used-in')
    await page.keyboard.press('End')
    await expect(tab(page, 'Reasoning')).toBeFocused()
    await expect(region(page, 'Why this order')).toBeVisible()
    await page.keyboard.press('Home')
    await expect(tab(page, 'Steps')).toHaveAttribute('aria-selected', 'true')
    // Only the selected tab is a stop: Tab leaves the list.
    await page.keyboard.press('Tab')
    await expect(tabList(page).locator(':focus')).toHaveCount(0)
  })

  test('a link opens on its tab; an unknown one on the first', async ({ page }) => {
    await open(page, 'tabs', 1280, '&tab=reasoning')
    await expect(tab(page, 'Reasoning')).toHaveAttribute('aria-selected', 'true')
    await expect(region(page, 'Why this order')).toBeVisible()
    await open(page, 'tabs', 1280, '&tab=nope')
    await expect(tab(page, 'Steps')).toHaveAttribute('aria-selected', 'true')
  })

  test('a field open in place inside a tab keeps what was typed across a switch', async ({ page }) => {
    await open(page, 'tabs', 1280)
    await region(page, 'Details').getByRole('button', { name: /Owner/ }).first().click()
    const input = page.getByRole('textbox', { name: 'Owner' })
    await input.fill('Grace Hopper')
    await tab(page, 'Used in').click()
    await tab(page, 'Steps').click()
    await expect(input).toHaveValue('Grace Hopper')
  })

  test('phone, main first: header, Overview, the tabs and their panel, then the rail', async ({ page }) => {
    await open(page, 'tabs', 393)
    const overview = (await region(page, 'Overview').boundingBox())!
    const list = (await tabList(page).boundingBox())!
    const details = (await region(page, 'Details').boundingBox())!
    const summary = (await region(page, 'Summary').boundingBox())!
    expect(list.y).toBeGreaterThan(overview.y + overview.height)
    expect(details.y).toBeGreaterThan(list.y + list.height)
    expect(summary.y).toBeGreaterThan(details.y + details.height)
    expect(list.width).toBeLessThanOrEqual(393 - 32 + 1)
    expect(await pageScrollsSideways(page)).toBe(false)
    await tab(page, 'Reasoning').click()
    await expect(region(page, 'Why this order')).toBeVisible()
    await expect(region(page, 'Summary')).toBeVisible()
  })

  test('the column layout: untabbed sections, then the tabs', async ({ page }) => {
    await open(page, 'tabs-column', 1280)
    const overview = (await region(page, 'Overview').boundingBox())!
    const summary = (await region(page, 'Summary').boundingBox())!
    const list = (await tabList(page).boundingBox())!
    expect(summary.y).toBeLessThan(list.y)
    expect(overview.y).toBeLessThan(list.y)
    await expect(region(page, 'Steps')).toBeVisible()
  })

  test('a view with no tab has no tab list', async ({ page }) => {
    await open(page, 'rail', 1280)
    await expect(page.getByRole('tablist')).toHaveCount(0)
  })
})

test.describe('EntityView tabs, touch', () => {
  test.use({ hasTouch: true, isMobile: true })
  test('each tab is a finger tall (44px)', async ({ page }) => {
    await open(page, 'tabs', 393)
    for (const name of ['Steps', 'Used in', 'Reasoning']) {
      expect((await tab(page, name).boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
  })
})

test.describe('EntityView leading', () => {
  for (const width of [1280, 393]) {
    test(`${width}px: the mark left of the title, top-aligned, the subtitle beside it too`, async ({ page }) => {
      await open(page, 'leading', width)
      const mark = (await page.locator('[data-slot="entity-view-leading"]').first().boundingBox())!
      const title = (await page.getByRole('heading', { level: 1, name: 'Ada Lovelace' }).boundingBox())!
      const subtitle = (await page.getByText('Facilities lead, third floor').boundingBox())!
      expect(title.x).toBeGreaterThan(mark.x + mark.width)
      expect(subtitle.x).toBeCloseTo(title.x, 0)
      expect(Math.abs(mark.y - title.y)).toBeLessThan(8)
      expect(await pageScrollsSideways(page)).toBe(false)
    })
  }
})

test.describe('EntityView rail fields beside', () => {
  const rows = async (page: Page) => {
    const summary = region(page, 'Summary')
    const label = (await summary.locator('dt', { hasText: 'Floor' }).boundingBox())!
    const value = (await summary.locator('dd', { hasText: 'Third' }).boundingBox())!
    return { label, value }
  }

  for (const width of [1280, 393]) {
    test(`${width}px: each label left of its value, on one line`, async ({ page }) => {
      await open(page, 'rail-fields-beside', width)
      const { label, value } = await rows(page)
      expect(value.x).toBeGreaterThan(label.x + label.width)
      expect(Math.abs(value.y - label.y)).toBeLessThan(4)
      expect(await pageScrollsSideways(page)).toBe(false)
    })
  }

  test('320px: too narrow for both, labels above values again', async ({ page }) => {
    await open(page, 'rail-fields-beside', 320)
    const { label, value } = await rows(page)
    expect(value.y).toBeGreaterThan(label.y + label.height - 1)
    expect(Math.abs(value.x - label.x)).toBeLessThan(2)
  })

  test('without it, the rail beside main stacks its labels as before', async ({ page }) => {
    await open(page, 'rail', 1280)
    const summary = region(page, 'Summary')
    const label = (await summary.locator('dt', { hasText: 'Floor' }).boundingBox())!
    const value = (await summary.locator('dd', { hasText: 'Third' }).boundingBox())!
    expect(value.y).toBeGreaterThan(label.y + label.height - 1)
  })
})
