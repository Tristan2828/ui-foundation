import { expect, test, type Page } from '@playwright/test'

// ModuleStrip and ModuleCard (app/ModuleCard, #224): the strip's columns at
// a desktop width and a phone's, and the phone tile as one link. Axe, the
// token check and the glyph check are e2e/storybook-visual.spec.ts's.
const story = (name: string) => `http://localhost:6006/iframe.html?id=app-modulecard--${name}&viewMode=story`

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
