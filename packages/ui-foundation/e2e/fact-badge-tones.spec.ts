import AxeBuilder from './axe'
import { expect, test, type Locator, type Page } from '@playwright/test'

// A record's flags as toned badges in the facts rail
// (src/components/app/fact-badge-tones.fixtures.tsx): "Blocked" in the
// destructive tone, "Needs you" in the warning tone, edited in place,
// beside an untoned badges fact. On a phone the rail folds into Details,
// the tones with it. Axe in both themes at both widths, an open edit too.
const STORY = (theme: 'light' | 'dark' = 'light') => `http://localhost:6180/story.html?id=app-fact-badge-tones--flags&theme=${theme}`
const box = async (locator: Locator) => (await locator.boundingBox())!

const rail = (page: Page) => page.locator('[data-slot=entity-view-facts-rail]')

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
  expect(results.violations).toEqual([])
}

// Where the facts are at this width: the rail on a laptop, Details on a phone.
async function facts(page: Page, width: number) {
  if (width >= 960) {
    await expect(rail(page)).toBeVisible()
    return rail(page)
  }
  await expect(rail(page)).toHaveCount(0)
  await page.getByRole('tab', { name: 'Details' }).click()
  const panel = page.getByRole('tabpanel', { name: 'Details' })
  await expect(panel).toBeVisible()
  return panel
}

for (const width of [1440, 375]) {
  test.describe(`at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
    })

    test('a set flag is its tone, the word kept; an untoned badge is the plain outline', async ({ page }) => {
      await page.goto(STORY())
      const where = await facts(page, width)
      const blocked = where.locator('[data-slot=badge][data-tone=destructive]')
      await expect(blocked).toHaveText('Blocked')
      await expect(blocked).toHaveAttribute('data-variant', 'outline-destructive')
      await expect(where.locator('[data-slot=badge][data-tone=warning]')).toHaveCount(0)
      // The Areas fact's badges have no tone, exactly as before.
      const plain = where.locator('[data-slot=badge]:not([data-tone])')
      await expect(plain).toHaveText(['Workshop', 'Storage'])
      await expect(plain.first()).toHaveAttribute('data-variant', 'outline')
      // The tone's text colour is not the plain badge's.
      const [toned, untoned] = await Promise.all([
        blocked.evaluate((node) => getComputedStyle(node).color),
        plain.first().evaluate((node) => getComputedStyle(node).color),
      ])
      expect(toned).not.toBe(untoned)
    })

    test('edited in place, as before: a pick saves and its badge comes in its tone', async ({ page }) => {
      await page.goto(STORY())
      const where = await facts(page, width)
      await where.getByRole('button', { name: 'Edit Flags' }).click()
      const picks = page.getByRole('group', { name: 'Flags' })
      await picks.getByRole('button', { name: 'Needs you', exact: true }).click()
      await expect(picks.getByRole('button', { name: 'Needs you', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await picks.getByRole('button', { name: 'Blocked', exact: true }).click()
      await expect(picks.getByRole('button', { name: 'Blocked', exact: true })).toHaveAttribute('aria-pressed', 'false')
      // Leaving the field saves it, as any value edited in place.
      await page.getByRole('heading', { level: 1, name: 'Shelving swap' }).click()
      await expect(picks).toHaveCount(0)
      await expect(where.locator('[data-slot=badge][data-tone=warning]')).toHaveText('Needs you')
      await expect(where.locator('[data-slot=badge][data-tone=destructive]')).toHaveCount(0)
    })

    test('the toned badges hold still under the mouse and the pencil', async ({ page }) => {
      await page.goto(STORY())
      const where = await facts(page, width)
      const blocked = where.locator('[data-slot=badge][data-tone=destructive]')
      await page.mouse.move(1, 1)
      const before = await box(blocked)
      await blocked.hover()
      await page.waitForTimeout(250)
      const hovered = await box(blocked)
      await where.getByRole('button', { name: 'Edit Flags' }).focus()
      await page.waitForTimeout(250)
      const focused = await box(blocked)
      for (const after of [hovered, focused]) {
        expect(Math.abs(after.x - before.x)).toBeLessThan(1)
        expect(Math.abs(after.y - before.y)).toBeLessThan(1)
        expect(Math.abs(after.width - before.width)).toBeLessThan(1)
      }
    })

    for (const theme of ['light', 'dark'] as const) {
      test(`both tones are accessible (${theme})`, async ({ page }) => {
        await page.goto(STORY(theme))
        const where = await facts(page, width)
        // Both flags set, so both tones are on the page for axe.
        await where.getByRole('button', { name: 'Edit Flags' }).click()
        await page.getByRole('group', { name: 'Flags' }).getByRole('button', { name: 'Needs you', exact: true }).click()
        await axe(page)
        await page.getByRole('heading', { level: 1, name: 'Shelving swap' }).click()
        await expect(where.locator('[data-slot=badge][data-tone=warning]')).toHaveText('Needs you')
        await expect(where.locator('[data-slot=badge][data-tone=destructive]')).toHaveText('Blocked')
        await axe(page)
      })
    }
  })
}
