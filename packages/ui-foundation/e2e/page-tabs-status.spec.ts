import { expect, test, type Locator, type Page } from '@playwright/test'

// 4.110's looks, in a real browser and every theme: a page's line tabs
// (ui/Tabs) draw the open tab's name in --primary-text and its line in
// --primary, the way a record's tabs do; and StatusMark's done and ended
// kinds have colours of their own, apart from active's and attention's
// and never the muted grey. Axe and the 3:1 glyph check are
// fixtures-visual.spec.ts's (ui-tabs--default, app-statusmark--all-kinds).
const HARNESS = 'http://localhost:6180/story.html?id='
const THEMES = [
  'theme=light',
  'theme=dark',
  ...['indigo-cyan', 'indigo-rose', 'graphite-periwinkle', 'violet'].map((palette) => `theme=dark&palette=${palette}`),
  'theme=light&palette=palm-lcd',
]

const tokenColour = (page: Page, token: string, property: 'color' | 'backgroundColor' = 'color') =>
  page.evaluate(
    ({ token, property }) => {
      const probe = document.createElement('div')
      probe.style[property] = `var(${token})`
      document.body.append(probe)
      const colour = getComputedStyle(probe)[property]
      probe.remove()
      return colour
    },
    { token, property },
  )
// bg-primary/12, as the browser resolves it.
const primaryTint = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement('div')
    probe.style.backgroundColor = 'color-mix(in oklab, var(--primary) 12%, transparent)'
    document.body.append(probe)
    const colour = getComputedStyle(probe).backgroundColor
    probe.remove()
    return colour
  })
const colour = (locator: Locator) => locator.evaluate((node) => getComputedStyle(node).color)
const after = (locator: Locator, property: 'backgroundColor' | 'opacity') =>
  locator.evaluate((node, property) => getComputedStyle(node, '::after')[property], property)

test.describe("a page's line tabs open in the theme colour", () => {
  for (const query of THEMES) {
    test(query, async ({ page }) => {
      await page.goto(`${HARNESS}ui-tabs--default&${query}`)
      const tabs = page.getByTestId('page-tabs').getByRole('tablist')
      const open = tabs.getByRole('tab', { name: 'Overview' })
      const other = tabs.getByRole('tab', { name: 'Projects' })
      await expect(open).toHaveAttribute('aria-selected', 'true')
      expect(await colour(open)).toBe(await tokenColour(page, '--primary-text'))
      expect(await colour(other)).toBe(await tokenColour(page, '--muted-foreground'))
      expect(await colour(other)).not.toBe(await colour(open))
      expect(await after(open, 'backgroundColor')).toBe(await tokenColour(page, '--primary', 'backgroundColor'))
      expect(await after(open, 'opacity')).toBe('1')
      expect(await open.evaluate((node) => getComputedStyle(node, '::after').height)).toBe('3px')
      // Clearly picked: semibold on a primary tint, the closed ones medium on nothing.
      expect(await open.evaluate((node) => getComputedStyle(node).fontWeight)).toBe('600')
      expect(await other.evaluate((node) => getComputedStyle(node).fontWeight)).toBe('500')
      expect(await open.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(await primaryTint(page))
      expect(await other.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
      expect(await after(other, 'opacity')).toBe('0')
      // The pill look keeps its own: the open one in the text colour.
      const pill = page.getByTestId('pill-tabs').getByRole('tab', { name: 'Week' })
      expect(await colour(pill)).toBe(await tokenColour(page, '--foreground'))
    })
  }

  test('under graphite-periwinkle the open name is the accent, not the text colour', async ({ page }) => {
    await page.goto(`${HARNESS}ui-tabs--default&theme=dark&palette=graphite-periwinkle`)
    const open = page.getByTestId('page-tabs').getByRole('tab', { name: 'Overview' })
    expect(await colour(open)).not.toBe(await tokenColour(page, '--foreground'))
  })
})

test.describe('done and ended have colours of their own', () => {
  for (const query of THEMES) {
    test(query, async ({ page }) => {
      await page.goto(`${HARNESS}app-statusmark--all-kinds&${query}`)
      const mark = (word: string) => page.locator('[data-slot=status-mark]', { hasText: word }).first()
      const done = await colour(mark('Done'))
      const ended = await colour(mark('Ended'))
      expect(done).toBe(await tokenColour(page, '--status-done-text'))
      expect(ended).toBe(await tokenColour(page, '--status-ended-text'))
      for (const token of ['--muted-foreground', '--success-text', '--destructive-text', '--warning-text', '--info-text']) {
        const other = await tokenColour(page, token)
        expect(done).not.toBe(other)
        expect(ended).not.toBe(other)
      }
      expect(done).not.toBe(ended)
    })
  }
})
