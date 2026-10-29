import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// AppShell's bottom bar on a phone (#240), on the BottomBar story (a page
// inside Collections): each item, a section's sheet (its entries and
// children, focus inside, Escape and navigation closing it), the content
// padded clear of the bar, nothing at a desktop width, and axe in both
// themes.
const STORY = 'http://localhost:6006/iframe.html?id=app-appshell--bottom-bar&viewMode=story'

const bar = (page: Page) => page.getByRole('navigation', { name: 'Bottom bar' })

async function openAtPhoneWidth(page: Page, theme?: 'light' | 'dark') {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto(theme ? `${STORY}&globals=theme:${theme}` : STORY)
  await expect(bar(page)).toBeVisible()
}

test('a link or a section per item, the one holding the page marked current', async ({ page }) => {
  await openAtPhoneWidth(page)
  await expect(bar(page).getByRole('listitem')).toHaveCount(4)
  await expect(bar(page).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  const collections = bar(page).getByRole('button', { name: 'Collections' })
  await expect(collections).toHaveAttribute('aria-current', 'true')
  await expect(collections).toHaveAttribute('aria-expanded', 'false')
  // A section's shorter label, for the bar.
  await expect(bar(page).getByRole('button', { name: 'Household' })).not.toHaveAttribute('aria-current')
  // At the bottom of the screen, every item a finger's target.
  const box = (await bar(page).boundingBox())!
  expect(box.y + box.height).toBeCloseTo(852, 0)
  for (const item of await bar(page).locator('a, button').all()) expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44)
})

test("a section opens a sheet of its entries and their children; focus goes in, Escape closes it and returns focus", async ({ page }) => {
  await openAtPhoneWidth(page)
  const collections = bar(page).getByRole('button', { name: 'Collections' })
  await collections.click()
  const sheet = page.getByRole('dialog', { name: 'Collections' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('link')).toHaveText(['YouTube', 'Channels', 'Playlists', 'Comics', 'Series', 'Reading lists'])
  await expect(sheet.getByRole('link', { name: 'Channels' })).toHaveAttribute('aria-current', 'page')
  await expect.poll(() => sheet.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(collections).toBeFocused()
  await expect(collections).toHaveAttribute('aria-expanded', 'false')
})

test('following a link in the sheet closes it; a link item goes straight to its page', async ({ page }) => {
  await openAtPhoneWidth(page)
  await bar(page).getByRole('button', { name: 'Household' }).click()
  const sheet = page.getByRole('dialog', { name: 'Home and money' })
  await sheet.getByRole('link', { name: 'Accounts' }).click()
  await expect(sheet).toBeHidden()
  await expect(bar(page).getByRole('button', { name: 'Household' })).toHaveAttribute('aria-current', 'true')

  await bar(page).getByRole('link', { name: 'Comics' }).click()
  await expect(bar(page).getByRole('link', { name: 'Comics' })).toHaveAttribute('aria-current', 'page')
  await expect(bar(page).getByRole('button', { name: 'Collections' })).not.toHaveAttribute('aria-current')
})

test("the page's content clears the bar, and the header's menu button is still there", async ({ page }) => {
  await openAtPhoneWidth(page)
  const main = page.locator('[data-slot="sidebar-inset"] > div').last()
  const padding = await main.evaluate((element) => parseFloat(getComputedStyle(element).paddingBottom))
  const height = (await bar(page).boundingBox())!.height
  expect(padding).toBeGreaterThanOrEqual(height + 24)
  await expect(page.getByRole('button', { name: 'Toggle Sidebar' })).toBeVisible()
})

test('at a desktop width there is no bar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(STORY)
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  await expect(bar(page)).toBeHidden()
})

for (const theme of ['light', 'dark'] as const) {
  test(`zero axe violations, the bar and a sheet open (${theme})`, async ({ page }) => {
    await openAtPhoneWidth(page, theme)
    // A story's page has no <h1> of its own (the app's screens do).
    const axe = () =>
      new AxeBuilder({ page }).disableRules(['page-has-heading-one']).exclude('[data-base-ui-focus-guard]').analyze()
    expect((await axe()).violations).toEqual([])
    await bar(page).getByRole('button', { name: 'Collections' }).click()
    await expect(page.getByRole('dialog', { name: 'Collections' })).toBeVisible()
    await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))))
    expect((await axe()).violations).toEqual([])
  })
}
