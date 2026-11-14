import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

// A rating in the facts rail (4.117): `kind: 'rating'` draws a score out
// of five as stars (the default) or hearts (RatingScore), a quality level
// as the step bar (StepBar), each one image named in words ("4 of 5"). An
// empty one reads its `emptyLabel`. Edited in place, a pick saves and the
// rail redraws the new score. The rail folds into Details on a phone, the
// rating drawn the same there, and hovering the editable rating moves
// nothing (4.115's rule): a click where the mouse rests opens it.
const HARNESS = 'http://localhost:6180/story.html?id=app-entityview--facts-rail-rating'

const rail = (page: Page) => page.getByRole('complementary', { name: 'Harbour Lights facts' })
const box = async (locator: Locator) => (await locator.boundingBox())!

test('each look draws its glyphs, named in words', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HARNESS)
  await expect(rail(page)).toBeVisible()
  const stars = rail(page).getByRole('img', { name: '4 of 5', exact: true })
  await expect(stars).toHaveAttribute('data-glyph', 'star')
  await expect(stars.locator('svg')).toHaveCount(5)
  await expect(stars.locator('svg[data-filled]')).toHaveCount(4)
  const hearts = rail(page).getByRole('img', { name: '3 of 5', exact: true })
  await expect(hearts).toHaveAttribute('data-glyph', 'heart')
  await expect(hearts.locator('svg[data-filled]')).toHaveCount(3)
  const bar = rail(page).getByRole('img', { name: 'High, 4 of 5' })
  await expect(bar).toHaveAttribute('data-slot', 'step-bar')
  await expect(bar).toContainText('High')
  // An empty rating is its words, not five empty stars.
  const critics = rail(page).locator('dt', { hasText: 'Critics' }).locator('xpath=following-sibling::dd[1]')
  await expect(critics).toHaveText('Not rated')
  await expect(critics.locator('[data-slot=rating-score]')).toHaveCount(0)
  // On the value's line, as tall as the text beside it.
  expect((await box(stars)).height).toBeLessThanOrEqual(24)
})

test('edited in place: a pick saves and the rail draws the new score', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HARNESS)
  await rail(page).getByRole('img', { name: '4 of 5', exact: true }).click()
  await page.getByRole('option', { name: '2 of 5' }).click()
  const stars = rail(page).locator('[data-slot=rating-score][data-glyph=star]')
  await expect(stars).toHaveAccessibleName('2 of 5')
  await expect(stars.locator('svg[data-filled]')).toHaveCount(2)
})

for (const width of [1440, 375]) {
  test(`hovering the rating moves nothing; a click there opens it (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(width < 960 ? `${HARNESS}&tab=details` : HARNESS)
    const scope = width < 960 ? page.getByRole('tabpanel') : rail(page)
    await expect(scope.locator('[data-slot=rating-score][data-glyph=star]')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const values = scope.locator('dd')
    const count = await values.count()
    const before = await Promise.all(Array.from({ length: count }, (_, at) => box(values.nth(at))))
    const stars = await box(scope.locator('[data-slot=rating-score][data-glyph=star]'))
    const x = stars.x + 8
    const y = stars.y + stars.height / 2
    await page.mouse.move(x, y)
    await page.waitForTimeout(250)
    const after = await Promise.all(Array.from({ length: count }, (_, at) => box(values.nth(at))))
    // Nothing moves: every value where it was, to the sub-pixel rounding of a line box.
    after.forEach((was, at) => {
      for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(was[key] - before[at][key])).toBeLessThan(0.5)
    })
    await page.mouse.click(x, y)
    await expect(page.getByRole('option', { name: '2 of 5' })).toBeVisible()
    await page.keyboard.press('Escape')
  })
}

test('on a phone the ratings are in Details, drawn the same', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(`${HARNESS}&tab=details`)
  await expect(page.locator('[data-slot=entity-view-facts-rail]')).toHaveCount(0)
  const details = page.getByRole('tabpanel')
  await expect(details.getByRole('img', { name: '4 of 5', exact: true })).toBeVisible()
  await expect(details.getByRole('img', { name: '3 of 5', exact: true })).toBeVisible()
  await expect(details.getByRole('img', { name: 'High, 4 of 5' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
})

for (const theme of ['light', 'dark'] as const) {
  for (const [name, width, query] of [
    ['the rail', 1440, ''],
    ['Details on a phone', 375, '&tab=details'],
  ] as const) {
    test(`${name} with ratings has no axe violations (${theme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${HARNESS}${query}&theme=${theme}`)
      await expect(page.getByRole('img', { name: '4 of 5', exact: true })).toBeVisible()
      const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
      expect(results.violations).toEqual([])
    })
  }

  // axe doesn't measure icon contrast: an empty glyph's outline must
  // clear 3:1 against the page itself, in both themes.
  test(`an empty glyph's outline clears 3:1 (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${HARNESS}&theme=${theme}`)
    const empty = rail(page).locator('[data-slot=rating-score] svg:not([data-filled])').first()
    await expect(empty).toBeVisible()
    const ratio = await empty.evaluate((svg) => {
      const rgb = (colour: string) => {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        const context = canvas.getContext('2d')!
        context.fillStyle = colour
        context.fillRect(0, 0, 1, 1)
        return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)]
      }
      const luminance = ([r, g, b]: number[]) => {
        const channel = (value: number) => {
          const c = value / 255
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
        }
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
      }
      let node: Element | null = svg.parentElement
      let background = 'rgba(0, 0, 0, 0)'
      while (node) {
        background = getComputedStyle(node).backgroundColor
        if (background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent') break
        node = node.parentElement
      }
      const ink = luminance(rgb(getComputedStyle(svg).color))
      const ground = luminance(rgb(background))
      return (Math.max(ink, ground) + 0.05) / (Math.min(ink, ground) + 0.05)
    })
    expect(ratio).toBeGreaterThanOrEqual(3)
  })
}
