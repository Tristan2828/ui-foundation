import AxeBuilder from './axe'
import { expect, test, type Page } from '@playwright/test'

// notify.done's Open link
// (src/components/app/notify-open.fixtures.tsx): a book added from a page of
// tiles stays on the tiles, says "Added <name>" and Open goes to its page,
// by a click and by the keyboard, at desktop and phone widths. Axe in both
// themes with the toast on screen.
const STORY = (theme: 'light' | 'dark' = 'light') => `http://localhost:6180/story.html?id=app-notifyopen--tiles&theme=${theme}`

const WIDTHS = [
  { name: 'desktop', size: { width: 1280, height: 800 } },
  { name: 'phone', size: { width: 375, height: 812 } },
] as const

const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]').filter({ hasText: text })

async function addBook(page: Page, title: string) {
  await page.getByRole('button', { name: 'New Book' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Book' })
  await dialog.getByLabel('Title').fill(title)
  await dialog.getByRole('button', { name: 'Add Book' }).click()
  await expect(dialog).toHaveCount(0)
}

for (const { name, size } of WIDTHS) {
  test.describe(`at ${name} width`, () => {
    test.use({ viewport: size })

    test('a book added from the tiles stays on the tiles, and Open lands on it', async ({ page }) => {
      await page.goto(STORY())
      await addBook(page, 'Paper Atlas')
      // Still on the tiles, the new one among them.
      await expect(page.getByRole('heading', { level: 1, name: 'Books' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Paper Atlas', exact: true })).toBeVisible()

      const added = toast(page, 'Added Paper Atlas')
      await expect(added).toBeVisible()
      const open = added.getByRole('link', { name: 'Open Paper Atlas' })
      await expect(open).toHaveText('Open')
      await open.click()

      await expect(page.getByRole('heading', { level: 1, name: 'Paper Atlas' })).toBeVisible()
      // Open closed its toast as it went.
      await expect(page.locator('[data-sonner-toast]')).toHaveCount(0)
    })

    test('Open is reached from the keyboard: Alt+T to the toast, Tab, Enter', async ({ page }) => {
      await page.goto(STORY())
      await addBook(page, 'Harbor Map')
      await expect(toast(page, 'Added Harbor Map')).toBeVisible()

      await page.keyboard.press('Alt+KeyT')
      const open = page.getByRole('link', { name: 'Open Harbor Map' })
      // Focus lands on the toast list; Tab steps to Open within a few presses.
      for (let i = 0; i < 4 && !(await open.evaluate((el) => el === document.activeElement)); i++) {
        await page.keyboard.press('Tab')
      }
      await expect(open).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('heading', { level: 1, name: 'Harbor Map' })).toBeVisible()
    })
  })
}

test('the toast keeps the standard 4 seconds', async ({ page }) => {
  await page.goto(STORY())
  await addBook(page, 'Paper Atlas')
  const added = toast(page, 'Added Paper Atlas')
  await expect(added).toBeVisible()
  // Not hovered or focused (which pause it): gone by about 4 seconds on.
  await page.mouse.move(0, 0)
  await page.waitForTimeout(2500)
  await expect(added).toBeVisible()
  await expect(added).toHaveCount(0, { timeout: 4000 })
})

for (const theme of ['light', 'dark'] as const) {
  test(`axe finds nothing with the Open toast on screen, ${theme}`, async ({ page }) => {
    await page.goto(STORY(theme))
    await addBook(page, 'Paper Atlas')
    const added = toast(page, 'Added Paper Atlas')
    await expect(added).toBeVisible()
    // Hovered, so it holds still while axe looks.
    await added.hover()
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })
}
