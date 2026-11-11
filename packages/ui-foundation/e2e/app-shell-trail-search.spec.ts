import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// The trail in AppShell's bar and search (the app/AppShell StandardTrail…
// and StandardSearch… stories, app/EntityView Record trail): a record's
// trail from EntityView's back.trail in the bar, not the page (R2, N5); a
// page's own from usePageTrail, its parent the phone's back arrow; a nav
// entry's label on a page that names none; and the palette (N6): Ctrl K
// or the box, the nav's pages and the app's records under their kinds,
// the arrows and Enter, the records opened lately before typing, and a
// search that fails. Axe in both themes, wide and on a phone, palette open.
const story = (id: string, theme?: 'light' | 'dark') =>
  `http://localhost:6180/story.html?id=${id}${theme ? `&theme=${theme}` : ''}`

const trail = (page: Page) => page.getByRole('navigation', { name: 'You are here' })
const palette = (page: Page) => page.getByRole('dialog', { name: 'Search Example' })
const box = (page: Page) => palette(page).getByRole('combobox', { name: 'Search Example' })
const options = (page: Page) => palette(page).getByRole('option')

async function openWide(page: Page, id: string, theme?: 'light' | 'dark') {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(story(`app-appshell--${id}`, theme))
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
}

async function openPhone(page: Page, id: string, theme?: 'light' | 'dark') {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto(story(`app-appshell--${id}`, theme))
  await expect(page.getByRole('navigation', { name: 'Bottom bar' })).toBeVisible()
}

test("R2, N5: a record's trail is in the bar, its title last, and the page has no back link", async ({ page }) => {
  await openWide(page, 'standard-trail')
  await expect(trail(page).getByRole('listitem').filter({ hasNotText: /^$/ })).toHaveText(['Finance', 'Accounts', 'Everyday checking'])
  await expect(trail(page).getByRole('link', { name: 'Accounts' })).toHaveAttribute('href', '/finance/accounts')
  await expect(trail(page).locator('[aria-current="page"]')).toHaveText('Everyday checking')
  // In the header, between the menu button and the search box.
  const header = page.locator('header').filter({ has: trail(page) })
  await expect(header.getByRole('button', { name: 'Toggle Sidebar' })).toBeVisible()
  await expect(page.locator('[data-state="success"]').getByRole('link', { name: 'Accounts' })).toHaveCount(0)
  await trail(page).getByRole('link', { name: 'Finance' }).click()
  await expect(trail(page).getByRole('listitem')).toHaveText(['Finance'])
})

test("N5: a page with no trail of its own shows its nav entry's", async ({ page }) => {
  await openWide(page, 'standard-trail-from-nav')
  await expect(trail(page).getByRole('listitem').filter({ hasNotText: /^$/ })).toHaveText(['Finance', 'Budget'])
  await expect(trail(page).locator('[aria-current="page"]')).toHaveText('Budget')
})

test("N5, N7: a page's own trail; on a phone the arrow goes to its parent, and the trail is hidden", async ({ page }) => {
  await openWide(page, 'standard-trail-page')
  await expect(trail(page).locator('[aria-current="page"]')).toHaveText('March statement')
  await openPhone(page, 'standard-trail-page')
  await expect(trail(page)).toBeHidden()
  const back = page.getByRole('link', { name: 'Back to Everyday checking' })
  await expect(back).toBeVisible()
  await back.click()
  await expect(page.getByRole('heading', { name: 'Everyday checking' })).toBeVisible()
  // The record's own trail now: its arrow goes to Accounts.
  await expect(page.getByRole('link', { name: 'Back to Accounts' })).toBeVisible()
})

test("R2: outside the shell, a record's trail is drawn above its title in the back link's place", async ({ page }) => {
  await page.goto(story('app-entityview--record-trail'))
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' })
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText('Northwind Lumber')
  await expect(crumbs.getByRole('link', { name: 'Suppliers' })).toHaveAttribute('href', '/suppliers')
  const crumbsBox = (await crumbs.boundingBox())!
  const title = (await page.getByRole('heading', { name: 'Northwind Lumber' }).boundingBox())!
  expect(crumbsBox.y).toBeLessThan(title.y)
})

test('N6: Ctrl K opens the palette, the pages and records it finds under their kinds, Enter opens one', async ({ page }) => {
  await openWide(page, 'standard-search')
  await page.keyboard.press('Control+k')
  await expect(box(page)).toBeFocused()
  await box(page).fill('la')
  await expect(palette(page).getByRole('group', { name: 'Tasks' }).getByRole('option')).toHaveText([
    'Fix the gate latch',
    'Plan the garden',
  ])
  await expect(palette(page).getByRole('group')).toHaveText([/^Planned purchases/, /^Tasks/, /^Books/])
  // The first is highlighted; the arrows move it, and Enter opens it.
  await expect(options(page).first()).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowDown')
  await expect(box(page)).toHaveAttribute('aria-activedescendant', (await options(page).nth(1).getAttribute('id'))!)
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  await expect(options(page).last()).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expect(palette(page)).toBeHidden()
  await expect(trail(page).getByRole('listitem')).toHaveText(['Books'])
})

test('N6: the box in the bar opens it; a page by its name, a module page with its module', async ({ page }) => {
  await openWide(page, 'standard-search')
  const open = page.getByRole('button', { name: /Search Example/ })
  await expect(open).toContainText('Ctrl K')
  await open.click()
  await box(page).fill('budget')
  await expect(palette(page).getByRole('group', { name: 'Pages' }).getByRole('option')).toHaveText(['Finance · Budget'])
  await palette(page).getByRole('option', { name: 'Finance · Budget' }).click()
  await expect(palette(page)).toBeHidden()
  await expect(trail(page).locator('[aria-current="page"]')).toHaveText('Budget')
  await page.keyboard.press('Control+k')
  await page.keyboard.press('Escape')
  await expect(palette(page)).toBeHidden()
})

test('N6: before typing, the records opened lately, then pages; nothing found says so', async ({ page }) => {
  await openWide(page, 'standard-search')
  await page.keyboard.press('Control+k')
  await expect(palette(page).getByRole('group', { name: 'Recent' }).getByRole('option')).toHaveText([
    /^Everyday checking/,
    /^Emergency savings/,
    /^Desk lamp/,
  ])
  await expect(palette(page).getByRole('group', { name: 'Pages' })).toBeVisible()
  await box(page).fill('zzz')
  await expect(palette(page).getByText('Nothing found for “zzz”.')).toBeVisible()
})

test('N6: without findRecords the palette finds pages only; a failing search says so and keeps the pages', async ({ page }) => {
  await openWide(page, 'standard-search-pages')
  await page.keyboard.press('Control+k')
  await expect(palette(page).getByRole('group', { name: 'Recent' })).toHaveCount(0)
  await box(page).fill('acc')
  await expect(options(page)).toHaveText(['Finance · Accounts'])
  await openWide(page, 'standard-search-failing')
  await page.keyboard.press('Control+k')
  await box(page).fill('acc')
  await expect(palette(page).getByText("Couldn't search records.", { exact: false })).toBeVisible()
  await expect(options(page)).toHaveText(['Finance · Accounts'])
})

test('N6: on a phone a button in the bar opens it', async ({ page }) => {
  await openPhone(page, 'standard-search')
  await expect(page.getByRole('button', { name: /Ctrl K/ })).toBeHidden()
  await page.getByRole('button', { name: 'Search Example', exact: true }).click()
  await expect(box(page)).toBeFocused()
})

for (const theme of ['light', 'dark'] as const) {
  const axe = (page: Page) =>
    new AxeBuilder({ page }).disableRules(['page-has-heading-one']).exclude('[data-base-ui-focus-guard]').analyze()
  const settle = (page: Page) =>
    page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))))

  test(`zero axe violations: the trail and the palette, wide (${theme})`, async ({ page }) => {
    await openWide(page, 'standard-trail', theme)
    expect((await axe(page)).violations).toEqual([])
    await openWide(page, 'standard-search', theme)
    await page.keyboard.press('Control+k')
    await box(page).fill('la')
    await expect(options(page)).not.toHaveCount(0)
    await settle(page)
    expect((await axe(page)).violations).toEqual([])
  })

  test(`zero axe violations: the trail page and the palette on a phone (${theme})`, async ({ page }) => {
    await openPhone(page, 'standard-trail-page', theme)
    expect((await axe(page)).violations).toEqual([])
    await openPhone(page, 'standard-search', theme)
    await page.getByRole('button', { name: 'Search Example', exact: true }).click()
    await expect(options(page)).not.toHaveCount(0)
    await settle(page)
    expect((await axe(page)).violations).toEqual([])
  })
}
