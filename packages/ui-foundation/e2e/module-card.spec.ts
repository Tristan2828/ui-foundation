import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// ModuleStrip and ModuleCard (app/ModuleCard, #224): the strip's columns at
// a desktop width and a phone's, the phone tile as one link, and
// `mobile="row"`'s chips. Axe, the token check and the glyph check are
// e2e/storybook-visual.spec.ts's, except for the chips, which only show at a
// phone's width: axe runs on those here, in both themes.
const story = (name: string, theme = 'light') =>
  `http://localhost:6006/iframe.html?id=app-modulecard--${name}&viewMode=story&globals=theme:${theme}`
const axe = (page: Page) =>
  new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
const pageScrollsSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)

const columns = (page: Page, label: string) =>
  page
    .getByRole('navigation', { name: label })
    .locator('ul')
    .evaluate((list) => getComputedStyle(list).gridTemplateColumns.split(' ').map(parseFloat))

// What a tap at the middle of an element's box lands on: the closest link
// or button there.
const tapTarget = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((element) => {
    const box = element.getBoundingClientRect()
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    const target = hit?.closest('a, button')
    return target ? `${target.tagName.toLowerCase()}:${target.textContent?.trim()}` : null
  })

test.describe('at a desktop width', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('the strip wraps in equal columns of 170px or more, each card with its action', async ({ page }) => {
    await page.goto(story('default'))
    const widths = await columns(page, 'Places')
    expect(widths.length).toBeGreaterThanOrEqual(6)
    for (const width of widths) {
      expect(width).toBeGreaterThanOrEqual(170)
      expect(width).toBeCloseTo(widths[0], 0)
    }
    const strip = page.getByRole('navigation', { name: 'Places' })
    await expect(strip.getByRole('listitem')).toHaveCount(7)
    await expect(strip.getByRole('link', { name: 'Today' })).toBeVisible()
    // The band names the place and is described by its number and note.
    await expect(strip.getByRole('link', { name: 'Projects', exact: true })).toHaveAccessibleDescription('5 open')
    // The action is described by the place, so several "Open" links stay distinct.
    await expect(strip.getByRole('link', { name: 'Today' })).toHaveAccessibleDescription('Projects')
    // A place outside the app opens in a new tab, and shows no number.
    const reading = strip.getByRole('link', { name: 'Reading (opens in a new tab)' })
    await expect(reading).toHaveAttribute('target', '_blank')
    await expect(page.locator('[data-slot=module-card]').filter({ hasText: 'Reading' }).locator('[data-slot=module-card-value]')).toHaveCount(0)
    // The note under the number is the card's body, not a link on its own.
    expect(await tapTarget(page, '[data-slot=module-card-value]')).toBeNull()
  })

  test('the states: a skeleton while loading, Retry inside a failed card', async ({ page }) => {
    await page.goto(story('all-states'))
    const loading = page.getByRole('navigation', { name: 'Places (loading)' })
    await expect(loading.locator('[aria-busy=true]')).toHaveCount(3)
    await expect(loading.locator('[data-slot=module-card-value]')).toHaveCount(0)
    const failed = page.getByRole('navigation', { name: 'Places (error)' })
    await expect(failed.getByText("Couldn't load")).toHaveCount(3)
    await expect(failed.getByRole('button', { name: 'Retry' })).toHaveCount(3)
    // The band still goes to the place.
    await expect(failed.getByRole('link', { name: 'Projects', exact: true })).toBeVisible()
  })
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('three columns of tiles, each tile one link of 44px or more, with no action', async ({ page }) => {
    await page.goto(story('default'))
    expect(await columns(page, 'Places')).toHaveLength(3)
    const strip = page.getByRole('navigation', { name: 'Places' })
    await expect(strip.getByRole('link', { name: 'Today' })).toBeHidden()
    const heights = await page.locator('[data-slot=module-card]').evaluateAll((cards) =>
      cards.map((card) => card.getBoundingClientRect().height),
    )
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(44)
    // A tap on the number lands on the band's link: the whole tile is it.
    expect(await tapTarget(page, '[data-slot=module-card-value]')).toBe('a:Projects')
  })

  test('Retry sits above the tile link', async ({ page }) => {
    await page.goto(story('all-states'))
    const retry = page.getByRole('navigation', { name: 'Places (error)' }).getByRole('button', { name: 'Retry' }).first()
    await expect(retry).toBeVisible()
    expect(await tapTarget(page, '[data-slot=module-card][data-state=error] button')).toBe('button:Retry')
  })

  test('a compact row keeps a 44px target', async ({ page }) => {
    await page.goto(story('compact'))
    const link = page.getByRole('link', { name: 'Repaint the shed' })
    const box = await link.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })
})

test.describe('mobile="row" on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('one row of chips that scrolls inside itself; the page never scrolls sideways', async ({ page }) => {
    await page.goto(story('row'))
    const strip = page.getByRole('navigation', { name: 'Places' })
    await expect(strip.locator('[data-slot=module-card]').first()).toBeHidden()
    const chips = strip.locator('[data-slot=module-card-chip]')
    await expect(chips).toHaveCount(7)
    const boxes = await chips.evaluateAll((all) => all.map((chip) => chip.getBoundingClientRect().toJSON()))
    for (const box of boxes) {
      expect(box.top).toBeCloseTo(boxes[0].top, 0)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
    // Icon, name and number.
    await expect(strip.getByRole('link', { name: 'Projects 5', exact: true })).toBeVisible()
    // The row overflows and scrolls; the page doesn't, sr-only text included
    // (the new-tab note on the last chip).
    expect(await strip.evaluate((nav) => nav.scrollWidth > nav.clientWidth)).toBe(true)
    expect(await pageScrollsSideways(page)).toBe(false)
    const reading = strip.getByRole('link', { name: 'Reading (opens in a new tab)' })
    await expect(reading).toHaveAttribute('target', '_blank')
    // Focusing a chip past the edge scrolls the row to it, not the page.
    await reading.focus()
    await expect(reading).toBeInViewport()
    expect(await pageScrollsSideways(page)).toBe(false)
  })

  test('a chip shows a skeleton while loading and a dash on an error', async ({ page }) => {
    await page.goto(story('row-states'))
    const loading = page.getByRole('navigation', { name: 'Places (loading)' })
    await expect(loading.locator('[data-slot=module-card-chip][data-state=loading] [data-slot=skeleton]')).toHaveCount(3)
    await expect(loading.getByRole('link', { name: 'Projects Loading' })).toBeVisible()
    const failed = page.getByRole('navigation', { name: 'Places (error)' })
    await expect(failed.locator('[data-slot=module-card-chip][data-state=error]')).toHaveCount(3)
    await expect(failed.getByRole('link', { name: "Projects Couldn't load" })).toBeVisible()
    await expect(failed.getByText('—').first()).toBeVisible()
    await expect(failed.getByRole('button', { name: 'Retry' })).toBeHidden()
    expect(await pageScrollsSideways(page)).toBe(false)
  })

  for (const theme of ['light', 'dark'] as const) {
    for (const name of ['row', 'row-states']) {
      test(`${name}: zero axe violations (${theme})`, async ({ page }) => {
        await page.goto(story(name, theme))
        if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
        await expect(page.locator('[data-slot=module-card-chip]').first()).toBeVisible()
        expect((await axe(page)).violations).toEqual([])
      })
    }
  }
})

test.describe('mobile="row" at a desktop width', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('the strip is the cards, as without it', async ({ page }) => {
    await page.goto(story('row'))
    const widths = await columns(page, 'Places')
    expect(widths.length).toBeGreaterThanOrEqual(6)
    for (const width of widths) expect(width).toBeGreaterThanOrEqual(170)
    await expect(page.locator('[data-slot=module-card-chip]').first()).toBeHidden()
    await expect(page.getByRole('link', { name: 'Today' })).toBeVisible()
  })
})
