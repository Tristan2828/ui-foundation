import { expect, test } from '@playwright/test'

// <Markdown inline> in a real layout: a row with Markdown in it is as tall as
// the plain one, at a desktop's width and a phone's and at every density; it
// takes its cell's colour and font; a link opens only itself, never the row
// or the card it sits in. The words a block reads as are
// tests/markdown-inline.test.tsx's; axe and the token check are
// fixtures-visual.spec.ts's.
const INLINE = (theme = 'light', density?: string) =>
  `http://localhost:6180/story.html?id=app-markdown--inline&theme=${theme}${density ? `&density=${density}` : ''}`

for (const viewport of [
  { name: 'a desktop', width: 1280, height: 800 },
  { name: 'a phone', width: 390, height: 800 },
]) {
  test.describe(`<Markdown inline> at ${viewport.name}'s width`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    for (const density of [undefined, 'compact', 'large']) {
      test(`each row is as tall as the plain one (${density ?? 'default'})`, async ({ page }) => {
        await page.goto(INLINE('light', density))
        await expect(page.getByText('Waiting on the landlord')).toBeVisible()
        const heights = await page.locator('tbody tr').evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height))
        expect(heights).toHaveLength(5)
        // On a phone a value can wrap to a second line, which is the text's
        // length, not a block's margin: hold the desktop to one line. (The
        // last row has no rule under it, so it can be a hair shorter.)
        if (viewport.width >= 768) for (const height of heights) expect(height).toBeLessThanOrEqual(heights[0] + 0.25)
        // No block element and no margin inside any value.
        const blocks = await page.locator('[data-inline] :is(p, div, ul, ol, li, table, h1, h2, h3, h4, blockquote, pre)').count()
        expect(blocks).toBe(0)
      })
    }

    test('a list and a table read on one line', async ({ page }) => {
      await page.goto(INLINE())
      await expect(page.locator('tbody tr').nth(2)).toContainText('milk · eggs · ✓ bread')
      await expect(page.locator('tbody tr').nth(3)).toContainText('Size: S, Price: $4 · Size: L, Price: $6')
      await expect(page.locator('tbody tr').nth(4)).toContainText('Heading · First thought. Second, with emphasis.')
    })

    test("it takes its cell's colour and font", async ({ page }) => {
      await page.goto(INLINE())
      await expect(page.getByText('Waiting on the landlord')).toBeVisible()
      const look = await page.locator('tbody tr').first().locator('[data-inline]').evaluate((element) => {
        const own = getComputedStyle(element)
        const parent = getComputedStyle(element.parentElement!)
        return { color: own.color === parent.color, size: own.fontSize === parent.fontSize, family: own.fontFamily === parent.fontFamily, display: own.display }
      })
      expect(look).toEqual({ color: true, size: true, family: true, display: 'inline' })
    })

    test('a link opens only itself, never the row or the card it sits in', async ({ page, context }) => {
      await page.goto(INLINE())
      await context.route('https://example.com/**', (route) => route.fulfill({ body: 'elsewhere' }))
      await page.locator('tbody tr').first().click()
      await expect(page.getByTestId('opened')).toHaveText('Opened: Plain')

      for (const [where, name] of [
        ['tbody', 'the lease'],
        ['[data-testid="clickable-card"]', 'link'],
      ]) {
        const popup = context.waitForEvent('page')
        await page.locator(where).getByRole('link', { name }).click()
        await (await popup).close()
        await expect(page.getByTestId('opened')).toHaveText('Opened: Plain')

        // Enter on the link: the link's, not the row's or the card's.
        const keyed = context.waitForEvent('page')
        await page.locator(where).getByRole('link', { name }).press('Enter')
        await (await keyed).close()
        await expect(page.getByTestId('opened')).toHaveText('Opened: Plain')
      }

      await page.getByTestId('clickable-card').click({ position: { x: 8, y: 8 } })
      await expect(page.getByTestId('opened')).toHaveText('Opened: the card')
    })
  })
}
