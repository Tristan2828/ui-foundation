import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// The sidebar as icon tiles (#6C, AppShell's `navLook="tiles"`, the
// app/AppShell StandardTiles stories, on a record below Finance's
// Accounts): each area a grid of tiles, icon over label, with no visible
// heading but a list named by it; the current module's pages under its
// area's grid with hairlines in place of their headings; a section's own
// `look` kept (Tools, a list at the foot); the icon rail unchanged; the
// keyboard through the tiles; and on a phone each area's sheet as tiles
// with the current module's pages under them. Axe in both themes.
const story = (id: string, theme?: 'light' | 'dark') =>
  `http://localhost:6180/story.html?id=app-appshell--${id}${theme ? `&theme=${theme}` : ''}`

const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary' })
const bar = (page: Page) => page.getByRole('navigation', { name: 'Bottom bar' })

async function openWide(page: Page, id: string, theme?: 'light' | 'dark') {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.goto(story(id, theme))
  await expect(nav(page)).toBeVisible()
}

async function openPhone(page: Page, id: string, theme?: 'light' | 'dark') {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto(story(id, theme))
  await expect(bar(page)).toBeVisible()
}

test('each area is a grid of tiles, icon over label, named by its hidden heading', async ({ page }) => {
  await openWide(page, 'standard-tiles')
  for (const [area, tiles] of [
    ['Every day', ['Tasks', 'News', 'Timers']],
    ['Collections', ['Videos', 'Books']],
    ['Home and money', ['House', 'Finance']],
  ] as const) {
    const list = nav(page).getByRole('list', { name: area, exact: true })
    await expect(list.locator('[data-slot="nav-tile"]')).toHaveCount(tiles.length)
    for (const tile of tiles) await expect(list.getByRole('link', { name: new RegExp(`^${tile}`) })).toBeVisible()
    // The heading is for screen readers only.
    await expect(nav(page).getByText(area, { exact: true })).toHaveClass(/sr-only/)
  }
  // Three to a row: Tasks, News and Timers side by side.
  const row = nav(page).getByRole('list', { name: 'Every day', exact: true }).locator('[data-slot="nav-tile"]')
  const boxes = await Promise.all((await row.all()).map((tile) => tile.boundingBox()))
  expect(Math.abs(boxes[0]!.y - boxes[2]!.y)).toBeLessThan(1)
  expect(boxes[1]!.x).toBeGreaterThan(boxes[0]!.x + boxes[0]!.width - 1)
  // The icon over the label, and a finger's target each.
  const tasks = row.first()
  const icon = (await tasks.locator('svg').boundingBox())!
  const label = (await tasks.locator('span').first().boundingBox())!
  expect(icon.y + icon.height).toBeLessThanOrEqual(label.y + 1)
  for (const box of boxes) expect(box!.height).toBeGreaterThanOrEqual(44)
  // The Home entry's run is tiles too; no visible headings at all but Tools'.
  await expect(nav(page).locator('[data-slot="nav-tile"]', { hasText: 'Home' })).toHaveCount(1)
  await expect(nav(page).locator('[data-sidebar="group-label"]')).toHaveText(['Tools'])
})

test("the tile holding the page is marked, and the module's pages list under its area's grid", async ({ page }) => {
  await openWide(page, 'standard-tiles')
  const finance = nav(page).locator('[data-slot="nav-tile"]', { hasText: 'Finance' })
  await expect(finance).toHaveAttribute('aria-current', 'true')
  expect(await finance.evaluate((link) => getComputedStyle(link).boxShadow)).toMatch(/inset/)
  const house = nav(page).locator('[data-slot="nav-tile"]', { hasText: 'House' })
  expect(await house.evaluate((link) => getComputedStyle(link).boxShadow)).toBe('none')
  // Finance's pages, by heading but with no heading shown: a hairline before each run.
  const pages = nav(page).getByRole('group', { name: 'Finance pages' })
  for (const [heading, links] of [
    ['Money', ['Accounts', 'Savings']],
    ['Spending', ['Budget', 'Shopping list']],
    ['Taxes', ['Taxes']],
  ] as const) {
    await expect(pages.getByRole('list', { name: heading }).getByRole('link')).toHaveText([...links])
  }
  await expect(pages.getByRole('separator')).toHaveCount(3)
  await expect(pages.getByText('Money', { exact: true })).toHaveCount(0)
  await expect(nav(page).locator('a[aria-current="page"]')).toHaveText(['Accounts'])
  // Under the grid of its own area.
  const grid = (await nav(page).getByRole('list', { name: 'Home and money', exact: true }).boundingBox())!
  const first = (await pages.boundingBox())!
  expect(first.y).toBeGreaterThanOrEqual(grid.y + grid.height)
  // A count in the tile's corner, read with what it counts.
  await expect(nav(page).getByRole('link', { name: 'News 24 unread' }).locator('[data-slot="nav-count"]')).toHaveText('24')
})

test("a section's own look wins: Tools stays a list at the foot", async ({ page }) => {
  await openWide(page, 'standard-tiles')
  const foot = nav(page).locator('[data-slot="nav-foot"]')
  await expect(foot.locator('[data-slot="nav-tile"]')).toHaveCount(0)
  await expect(foot.getByRole('link', { name: 'Roadmap' })).toBeVisible()
})

test("on a module's own page with no pages, nothing lists under the grids", async ({ page }) => {
  await openWide(page, 'standard-tiles-on-home')
  await expect(nav(page).locator('[data-slot="nav-tile-pages"]')).toHaveCount(0)
  await expect(nav(page).locator('[data-slot="nav-tile"]', { hasText: 'Home' })).toHaveAttribute('aria-current', 'page')
})

test('the keyboard goes through the tiles in reading order, each with a visible focus ring', async ({ page }) => {
  await openWide(page, 'standard-tiles')
  await nav(page).locator('[data-slot="nav-tile"]', { hasText: 'Home' }).focus()
  const order: string[] = []
  for (let step = 0; step < 4; step += 1) {
    await page.keyboard.press('Tab')
    const focused = page.locator(':focus')
    order.push((await focused.innerText()).split('\n')[0]!.trim())
    expect(await focused.evaluate((link) => getComputedStyle(link).boxShadow)).not.toBe('none')
  }
  expect(order).toEqual(['Tasks', 'News', 'Timers', 'Videos'])
  // Enter follows the tile.
  await nav(page).locator('[data-slot="nav-tile"]', { hasText: 'Books' }).focus()
  await page.keyboard.press('Enter')
  await expect(nav(page).locator('[data-slot="nav-tile"]', { hasText: 'Books' })).toHaveAttribute('aria-current', 'page')
  await expect(nav(page).locator('[data-slot="nav-tile-pages"]')).toHaveCount(0)
})

test('on the icon rail the tiles are the rail\'s icons, as in the list look', async ({ page }) => {
  await openWide(page, 'standard-tiles-rail')
  await expect(nav(page).locator('[data-slot="nav-tile"]')).toHaveCount(0)
  const finance = nav(page).getByRole('link', { name: 'Finance', exact: true })
  await expect(finance).toHaveAttribute('data-active', '')
  await finance.hover()
  await expect(page.getByText('Finance: Money, Spending, Taxes')).toBeVisible()
})

test("on a phone, an area's sheet is tiles with the current module's pages under them", async ({ page }) => {
  await openPhone(page, 'standard-tiles')
  await bar(page).getByRole('button', { name: 'Household' }).click()
  const sheet = page.getByRole('dialog', { name: 'Home and money' })
  const tiles = sheet.locator('[data-slot="app-shell-sheet-tiles"]')
  await expect(tiles.getByRole('link')).toHaveText(['House', 'Finance'])
  await expect(tiles.getByRole('link', { name: 'Finance' })).toHaveAttribute('aria-current', 'true')
  const pages = sheet.getByRole('group', { name: 'Finance pages' })
  await expect(pages.getByRole('list', { name: 'Money' }).getByRole('link')).toHaveText(['Accounts', 'Savings'])
  await expect(pages.getByRole('link', { name: 'Accounts' })).toHaveAttribute('aria-current', 'page')
  for (const link of await pages.getByRole('link').all()) {
    const box = (await link.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.width).toBeGreaterThanOrEqual(44)
  }
  await pages.getByRole('link', { name: 'Budget' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('link', { name: 'Back to Budget' })).toHaveCount(0)
  // An area without the page: tiles alone.
  await bar(page).getByRole('button', { name: 'Collections' }).click()
  const collections = page.getByRole('dialog', { name: 'Collections' })
  await expect(collections.locator('[data-slot="app-shell-sheet-tiles"]').getByRole('link')).toHaveText(['Videos', 'Books'])
  await expect(collections.locator('[data-slot="app-shell-sheet-pages"]')).toHaveCount(0)
})

test("on a phone, the sidebar's sheet shows the tiles too", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto(story('standard-tiles-on-home'))
  await page.getByRole('button', { name: 'Toggle Sidebar' }).click()
  await expect(page.locator('[data-slot="nav-tile"]', { hasText: 'Finance' })).toBeVisible()
})

for (const theme of ['light', 'dark'] as const) {
  // A story's page has no <h1> of its own (the app's screens do).
  const axe = (page: Page) =>
    new AxeBuilder({ page }).disableRules(['page-has-heading-one']).exclude('[data-base-ui-focus-guard]').analyze()

  test(`zero axe violations: tiles, on the rail, on a phone with a sheet open (${theme})`, async ({ page }) => {
    await openWide(page, 'standard-tiles', theme)
    expect((await axe(page)).violations).toEqual([])
    // A hovered tile and a focused one.
    await nav(page).locator('[data-slot="nav-tile"]', { hasText: 'Books' }).hover()
    await nav(page).locator('[data-slot="nav-tile"]', { hasText: 'Videos' }).focus()
    expect((await axe(page)).violations).toEqual([])
    await openWide(page, 'standard-tiles-rail', theme)
    expect((await axe(page)).violations).toEqual([])
    await openPhone(page, 'standard-tiles', theme)
    await bar(page).getByRole('button', { name: 'Household' }).click()
    await expect(page.getByRole('dialog', { name: 'Home and money' })).toBeVisible()
    await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))))
    expect((await axe(page)).violations).toEqual([])
  })
}
