import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// The navigation standard in AppShell (the app/AppShell Standard stories,
// on a record below Finance's Accounts): a long module's pages under
// small headings (N1), the current entry's tint and bar (N2), counts read
// with what they count and a dot on the rail (N3), a Tools section at the
// sidebar's foot (N4), the phone's back arrow (N7) and an area's sheet as
// tiles (N8). Axe in both themes at both widths, the sheet open.
const story = (id: string, theme?: 'light' | 'dark') =>
  `http://localhost:6180/story.html?id=app-appshell--${id}${theme ? `&theme=${theme}` : ''}`

const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary' })
const bar = (page: Page) => page.getByRole('navigation', { name: 'Bottom bar' })

async function openWide(page: Page, id: string, theme?: 'light' | 'dark') {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(story(id, theme))
  await expect(nav(page)).toBeVisible()
}

async function openPhone(page: Page, id: string, theme?: 'light' | 'dark') {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto(story(id, theme))
  await expect(bar(page)).toBeVisible()
}

test("N1: a module's pages under their headings, each a list named by it", async ({ page }) => {
  await openWide(page, 'standard')
  const finance = nav(page).getByRole('link', { name: 'Finance', exact: true }).locator('xpath=..')
  for (const [heading, links] of [
    ['Money', ['Accounts', 'Savings']],
    ['Spending', ['Budget', 'Shopping list']],
    ['Taxes', ['Taxes']],
  ] as const) {
    const list = finance.getByRole('list', { name: heading })
    await expect(list.getByRole('link')).toHaveText([...links])
  }
})

test('N2: the current entry alone has the tint and a bar at its start', async ({ page }) => {
  await openWide(page, 'standard')
  const accounts = nav(page).getByRole('link', { name: 'Accounts' })
  await expect(nav(page).locator('a[aria-current="page"]')).toHaveText(['Accounts'])
  const mark = await accounts.evaluate((link) => getComputedStyle(link).boxShadow)
  expect(mark).toMatch(/inset/)
  expect(mark).toMatch(/3px 0px 0px 0px/)
  const other = await nav(page).getByRole('link', { name: 'Budget' }).evaluate((link) => getComputedStyle(link).boxShadow)
  expect(other).toBe('none')
})

test('N3: a count at the entry\'s end, read with what it counts; none without one', async ({ page }) => {
  await openWide(page, 'standard')
  await expect(nav(page).getByRole('link', { name: 'News 24 unread' })).toBeVisible()
  await expect(nav(page).getByRole('link', { name: 'Fill in 5 to fill in' })).toBeVisible()
  const news = nav(page).getByRole('link', { name: 'News 24 unread' })
  await expect(news.locator('[data-slot="nav-count"]')).toHaveText('24')
  // At the entry's end.
  const link = (await news.boundingBox())!
  const count = (await news.locator('[data-slot="nav-count"]').boundingBox())!
  expect(link.x + link.width - (count.x + count.width)).toBeLessThan(12)
  await expect(nav(page).getByRole('link', { name: 'Tasks', exact: true }).locator('[data-slot="nav-count"]')).toHaveCount(0)
})

test('N3: on the icon rail a count is a dot on the icon', async ({ page }) => {
  await openWide(page, 'standard-rail')
  const news = nav(page).getByRole('link', { name: 'News 24 unread' })
  await expect(news.locator('[data-slot="nav-count-dot"]')).toBeVisible()
  await expect(news.locator('[data-slot="nav-count"]')).toBeHidden()
  // The rail's tooltip names Finance's headings.
  await nav(page).getByRole('link', { name: 'Finance', exact: true }).hover()
  await expect(page.getByText('Finance: Money, Spending, Taxes')).toBeVisible()
})

test("N4: a bottom section sits at the sidebar's foot, under everything else", async ({ page }) => {
  // Tall enough for the whole nav, so there's space for the foot to sit under.
  await page.setViewportSize({ width: 1280, height: 1200 })
  await page.goto(story('standard'))
  await expect(nav(page).locator('[data-sidebar="group-label"]')).toHaveText(['Every day', 'Collections', 'Home and money', 'Tools'])
  const tools = (await nav(page).locator('[data-slot="nav-foot"]').boundingBox())!
  const footer = (await nav(page).locator('[data-sidebar="footer"]').boundingBox())!
  // Pushed down to the footer, with the space above it.
  expect(Math.abs(tools.y + tools.height - footer.y)).toBeLessThan(2)
  const finance = (await nav(page).getByRole('link', { name: 'Finance', exact: true }).boundingBox())!
  expect(tools.y).toBeGreaterThan(finance.y + 100)
})

test('N7: on a phone a page below an entry shows a back arrow to it in the menu button\'s place', async ({ page }) => {
  await openPhone(page, 'standard')
  const back = page.getByRole('link', { name: 'Back to Accounts' })
  await expect(back).toBeVisible()
  await expect(back).toHaveText('Accounts')
  await expect(page.getByRole('button', { name: 'Toggle Sidebar' })).toBeHidden()
  await back.click()
  // On the entry itself: the menu button.
  await expect(back).toBeHidden()
  await expect(page.getByRole('button', { name: 'Toggle Sidebar' })).toBeVisible()
})

test('N7: an entry\'s own page keeps the menu button; wide screens never show the arrow', async ({ page }) => {
  await openPhone(page, 'standard-on-entry')
  await expect(page.getByRole('link', { name: /^Back To/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Toggle Sidebar' })).toBeVisible()
  await openWide(page, 'standard')
  await expect(page.getByRole('link', { name: 'Back to Accounts' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Toggle Sidebar' })).toBeVisible()
})

test('N7: without a bottom bar the menu button stays beside the arrow', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto(story('standard-no-bar'))
  await expect(page.getByRole('link', { name: 'Back to Accounts' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Toggle Sidebar' })).toBeVisible()
})

test("N8: an area's sheet is a grid of tiles, icon over label, a finger's target each", async ({ page }) => {
  await openPhone(page, 'standard')
  await bar(page).getByRole('button', { name: 'Household' }).click()
  const sheet = page.getByRole('dialog', { name: 'Home and money' })
  const tiles = sheet.locator('[data-slot="app-shell-sheet-tiles"]')
  await expect(tiles.getByRole('link')).toHaveText(['House', 'Finance'])
  // The tile holding the page (Accounts is one of Finance's): marked, not as the page itself.
  await expect(tiles.getByRole('link', { name: 'Finance' })).toHaveAttribute('aria-current', 'true')
  const boxes = await Promise.all((await tiles.getByRole('link').all()).map((tile) => tile.boundingBox()))
  for (const box of boxes) {
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.width).toBeGreaterThanOrEqual(44)
  }
  // Side by side, in one row.
  expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThan(1)
  await tiles.getByRole('link', { name: 'House' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('link', { name: /^Back To/ })).toHaveCount(0)
  await bar(page).getByRole('button', { name: 'Household' }).click()
  await expect(sheet.getByRole('link', { name: 'House' })).toHaveAttribute('aria-current', 'page')
})

for (const theme of ['light', 'dark'] as const) {
  // A story's page has no <h1> of its own (the app's screens do).
  const axe = (page: Page) =>
    new AxeBuilder({ page }).disableRules(['page-has-heading-one']).exclude('[data-base-ui-focus-guard]').analyze()

  test(`zero axe violations, wide and on the rail (${theme})`, async ({ page }) => {
    await openWide(page, 'standard', theme)
    expect((await axe(page)).violations).toEqual([])
    await openWide(page, 'standard-rail', theme)
    expect((await axe(page)).violations).toEqual([])
  })

  test(`zero axe violations on a phone, the arrow and a tiles sheet (${theme})`, async ({ page }) => {
    await openPhone(page, 'standard', theme)
    expect((await axe(page)).violations).toEqual([])
    await bar(page).getByRole('button', { name: 'Every day' }).click()
    await expect(page.getByRole('dialog', { name: 'Every day' })).toBeVisible()
    await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))))
    expect((await axe(page)).violations).toEqual([])
  })
}
