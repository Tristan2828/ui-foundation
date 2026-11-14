import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

// A nav entry's count on a phone (4.113, the app/AppShell
// StandardTilesCounts and StandardCountsList stories, at 375 wide): a
// badge on a bar item's icon (a page's own count, or the sum of its
// area's), "99+" past 99 and nothing at 0; in the corner of a sheet's
// tiles and at the end of a list sheet's links; each read after its label
// ("News, 7 new"). Every bar item and tile a 44px target, and axe in both
// themes and every palette with the bar and a sheet open.
const HARNESS_URL = 'http://localhost:6180'
const PALETTES = ['indigo-cyan', 'indigo-rose', 'graphite-periwinkle', 'violet', 'palm-lcd'] as const

function story(id: string, look: 'light' | 'dark' | (typeof PALETTES)[number] = 'light') {
  const base = `${HARNESS_URL}/story.html?id=app-appshell--${id}`
  if (look === 'light' || look === 'dark') return `${base}&theme=${look}`
  return `${base}&theme=${look === 'palm-lcd' ? 'light' : 'dark'}&palette=${look}`
}

const bar = (page: Page) => page.getByRole('navigation', { name: 'Bottom bar' })

async function openPhone(page: Page, id: string, look?: Parameters<typeof story>[1]) {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(story(id, look))
  await expect(bar(page)).toBeVisible()
}

async function expectTarget(item: Locator) {
  const box = (await item.boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(44)
  expect(box.width).toBeGreaterThanOrEqual(44)
}

const settle = (page: Page) =>
  page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))))

test("a bar item's count is a badge on its icon, read after its label", async ({ page }) => {
  await openPhone(page, 'standard-tiles-counts')
  const badge = (item: Locator) => item.locator('[data-slot="bottom-bar-count"]')
  // A page of its own on the bar: its entry's count.
  const news = bar(page).getByRole('link', { name: 'News, 7 new', exact: true })
  await expect(badge(news)).toHaveText('7')
  // An area: the sum of its entries' (Timers' 0 adds nothing), with their shared label.
  const everyDay = bar(page).getByRole('button', { name: 'Every day, 7 new', exact: true })
  await expect(badge(everyDay)).toHaveText('7')
  // Past 99: "99+" drawn, the real number read.
  const collections = bar(page).getByRole('button', { name: 'Collections, 120 new', exact: true })
  await expect(badge(collections)).toHaveText('99+')
  // Nothing to count: no badge, and the label alone.
  await expect(badge(bar(page).getByRole('link', { name: 'Home', exact: true }))).toHaveCount(0)
  await expect(badge(bar(page).getByRole('button', { name: 'Household', exact: true }))).toHaveCount(0)
  // On the icon's top corner, inside its item, which keeps a finger's target.
  for (const item of [news, everyDay, collections]) {
    const icon = (await item.locator('svg').boundingBox())!
    const mark = (await badge(item).boundingBox())!
    const box = (await item.boundingBox())!
    expect(mark.y).toBeLessThan(icon.y + icon.height / 2)
    expect(mark.x).toBeGreaterThan(icon.x + icon.width / 2)
    expect(mark.x).toBeLessThan(icon.x + icon.width)
    expect(mark.y).toBeGreaterThanOrEqual(box.y)
    expect(mark.x + mark.width).toBeLessThanOrEqual(box.x + box.width)
  }
  for (const item of await bar(page).locator('a, button').all()) await expectTarget(item)
})

test("a sheet's tiles carry their counts in the corner, as the sidebar's do", async ({ page }) => {
  await openPhone(page, 'standard-tiles-counts')
  await bar(page).getByRole('button', { name: /^Every day/ }).click()
  const daily = page.getByRole('dialog', { name: 'Every day' }).locator('[data-slot="app-shell-sheet-tiles"]')
  await expect(daily.getByRole('link', { name: 'News, 7 new', exact: true }).locator('[data-slot="nav-count"]')).toHaveText('7')
  // At 0, nothing.
  const timers = daily.getByRole('link', { name: 'Timers', exact: true })
  await expect(timers.locator('[data-slot="nav-count"]')).toHaveCount(0)
  for (const tile of await daily.getByRole('link').all()) await expectTarget(tile)
  await page.keyboard.press('Escape')
  await bar(page).getByRole('button', { name: /^Collections/ }).click()
  const collections = page.getByRole('dialog', { name: 'Collections' }).locator('[data-slot="app-shell-sheet-tiles"]')
  await expect(
    collections.getByRole('link', { name: 'Videos, 120 new', exact: true }).locator('[data-slot="nav-count"]'),
  ).toHaveText('99+')
})

test("a list sheet's links carry their counts at their end", async ({ page }) => {
  await openPhone(page, 'standard-counts-list')
  await bar(page).getByRole('button', { name: /^Every day/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Every day' })
  const news = sheet.getByRole('link', { name: 'News, 7 new', exact: true })
  await expect(news.locator('[data-slot="nav-count"]')).toHaveText('7')
  const count = (await news.locator('[data-slot="nav-count"]').boundingBox())!
  const link = (await news.boundingBox())!
  expect(count.x + count.width).toBeGreaterThan(link.x + link.width - 24)
  await expect(sheet.getByRole('link', { name: 'Timers', exact: true })).toBeVisible()
})

test("the bar's badges follow the nav's counts", async ({ page }) => {
  await openPhone(page, 'standard-tiles-on-home')
  // STANDARD's counts sit on News, Videos and Fill in; Fill in isn't on this bar.
  await expect(bar(page).locator('[data-slot="bottom-bar-count"]')).toHaveCount(2)
  await expect(bar(page).getByRole('link', { name: 'Home', exact: true })).toBeVisible()
})

// A story's page has no <h1> of its own (the app's screens do).
const axe = (page: Page) =>
  new AxeBuilder({ page }).disableRules(['page-has-heading-one']).exclude('[data-base-ui-focus-guard]').analyze()

for (const look of ['light', 'dark', ...PALETTES] as const) {
  test(`zero axe violations: the bar's badges and a sheet's tile counts (${look})`, async ({ page }) => {
    await openPhone(page, 'standard-tiles-counts', look)
    if (look !== 'light' && look !== 'dark') await expect(page.locator('html')).toHaveAttribute('data-palette', look)
    expect((await axe(page)).violations).toEqual([])
    await bar(page).getByRole('button', { name: /^Collections/ }).click()
    await expect(page.getByRole('dialog', { name: 'Collections' })).toBeVisible()
    await settle(page)
    expect((await axe(page)).violations).toEqual([])
  })
}
