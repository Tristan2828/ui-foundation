import AxeBuilder from './axe'
import { expect, test, type Page } from '@playwright/test'

// AppShell's back arrow on a phone (the app/AppShell Standard story, on a
// record below Finance's Accounts): a finger's 44px target on a touch
// screen (the phone project), the 32px ghost button with a mouse (the
// chromium project at the same width), the 56px bar the same height on
// both. Axe in both themes with the arrow showing.
const story = (theme: 'light' | 'dark' = 'light') =>
  `http://localhost:6180/story.html?id=app-appshell--standard&theme=${theme}`

async function openPhoneWidth(page: Page, theme?: 'light' | 'dark') {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto(story(theme))
  await expect(page.getByRole('link', { name: 'Back to Accounts' })).toBeVisible()
}

const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!

test('on a touch screen the back arrow is a 44px target inside the bar', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the phone project only')
  await openPhoneWidth(page)
  const back = await box(page, '[data-slot="app-shell-back"]')
  const header = await box(page, '[data-slot="app-shell-column"] > header')
  expect(back.height).toBeGreaterThanOrEqual(44)
  expect(back.width).toBeGreaterThanOrEqual(44)
  // The bar doesn't grow to fit it, and it sits inside the bar.
  expect(header.height).toBe(56)
  expect(back.y).toBeGreaterThanOrEqual(header.y)
  expect(back.y + back.height).toBeLessThanOrEqual(header.y + header.height)
})

test('with a mouse the back arrow keeps the 32px button, the bar its 56px', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the desktop project only')
  await openPhoneWidth(page)
  expect((await box(page, '[data-slot="app-shell-back"]')).height).toBe(32)
  expect((await box(page, '[data-slot="app-shell-column"] > header')).height).toBe(56)
})

for (const theme of ['light', 'dark'] as const) {
  test(`zero axe violations with the back arrow showing (${theme})`, async ({ page }) => {
    await openPhoneWidth(page, theme)
    const results = await new AxeBuilder({ page }).disableRules(['page-has-heading-one']).exclude('[data-base-ui-focus-guard]').analyze()
    expect(results.violations).toEqual([])
  })
}
