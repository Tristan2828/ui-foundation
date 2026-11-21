import AxeBuilder from './axe'
import { expect, test, type Page } from '@playwright/test'

// OverviewPage's links: pages outside the app, one section after
// the parts, under its heading. Each link is its label (with its icon if
// it has one) and the external-link mark, opening in a new tab, said to a
// screen reader. In a row from 48rem, one per line on a phone, each a
// finger-sized target there.
const HARNESS = 'http://localhost:6180/story.html?id=app-overviewpage--links'

const section = (page: Page) => page.getByRole('region', { name: 'Links' })

test('the links are one section after the parts, each opening in a new tab', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HARNESS)
  await expect(section(page).getByRole('heading', { level: 2, name: 'Links' })).toBeVisible()
  const links = section(page).getByRole('link')
  await expect(links).toHaveCount(3)
  const bank = section(page).getByRole('link', { name: 'Bank account (opens in a new tab)' })
  await expect(bank).toHaveAttribute('href', 'https://example.com/bank')
  await expect(bank).toHaveAttribute('target', '_blank')
  await expect(bank).toHaveAttribute('rel', /noreferrer/)
  // The icon, then the label, then the external-link mark.
  await expect(bank.locator('svg')).toHaveCount(2)
  await expect(section(page).getByRole('link', { name: 'Budgeting guide (opens in a new tab)' }).locator('svg')).toHaveCount(1)
  // After the parts.
  const tiles = (await page.locator('[data-slot=overview-tiles]').boundingBox())!
  expect((await section(page).boundingBox())!.y).toBeGreaterThan(tiles.y + tiles.height)
  // In a row.
  const first = (await links.nth(0).boundingBox())!
  const second = (await links.nth(1).boundingBox())!
  expect(Math.abs(first.y - second.y)).toBeLessThan(1)
})

test('on a phone the links are one per line, finger-sized, after the parts', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(HARNESS)
  const links = section(page).getByRole('link')
  await expect(links).toHaveCount(3)
  const first = (await links.nth(0).boundingBox())!
  const second = (await links.nth(1).boundingBox())!
  expect(second.y).toBeGreaterThanOrEqual(first.y + first.height - 1)
  expect(first.height).toBeGreaterThanOrEqual(44)
  const cards = page.locator('[data-slot=widget-card]')
  const last = (await cards.last().boundingBox())!
  expect((await section(page).boundingBox())!.y).toBeGreaterThan(last.y + last.height - 1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
})

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 375]) {
    test(`an overview with links has no axe violations (${theme}, ${width})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${HARNESS}&theme=${theme}`)
      await expect(section(page)).toBeVisible()
      const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
      expect(results.violations).toEqual([])
    })
  }
}
