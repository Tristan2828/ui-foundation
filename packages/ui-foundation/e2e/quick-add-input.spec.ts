import { expect, test } from '@playwright/test'
import AxeBuilder from './axe'

// QuickAddInput (F1, app/QuickAddInput): what's read is marked in the box
// under the typed words and shown as chips; ✕ gives a chip's words back to
// the title; the app's chips come after; Enter adds; no menu on a symbol;
// axe in both themes at a laptop's and a phone's width.
const story = (id: string, theme = 'light') => `http://localhost:6180/story.html?id=app-quickaddinput--${id}&theme=${theme}`

const LAPTOP = { width: 1280, height: 900 }
const PHONE = { width: 390, height: 844 }

test('marks what it read under the typed words, and shows it as chips', async ({ page }) => {
  await page.setViewportSize(LAPTOP)
  await page.goto(story('default'))
  const box = page.getByRole('textbox', { name: 'Add To-Do' })
  await expect(box).toHaveValue('Wipe the shelves monday every! 2 weeks #home')
  const marks = page.locator('[data-slot="quick-add-marks"] mark')
  await expect(marks).toHaveText(['monday', 'every! 2 weeks', '#home'])
  const chips = page.getByRole('list', { name: 'Read from the line' })
  await expect(chips.locator('[data-read="date"]')).toHaveText(/Due\s*Mon, Nov 23/)
  await expect(chips.locator('[data-read="recurrence"]')).toHaveText(/Repeats\s*Every other week on Mon after done/)
  await expect(chips.locator('[data-read="token-list"]')).toHaveText(/List\s*Home/)
  // The app's own chips after the read ones: Place and Block, nothing typed.
  await expect(chips.getByRole('button', { name: '+ Place' })).toBeVisible()
  await expect(page.getByTestId('reading')).toHaveText('Wipe the shelves · 2026-11-23 · FREQ=WEEKLY;INTERVAL=2 from done · list Home')

  // Each mark sits on its words: the box's text and the mark start at the same x.
  await box.click()
  await box.press('End')
  const markBox = (await marks.nth(2).boundingBox())!
  const textWidth = await box.evaluate((input: HTMLInputElement) => {
    const probe = document.createElement('span')
    const style = getComputedStyle(input)
    probe.style.font = style.font
    probe.style.whiteSpace = 'pre'
    probe.textContent = input.value.slice(0, input.value.indexOf('#home'))
    document.body.append(probe)
    const width = probe.getBoundingClientRect().width
    probe.remove()
    return width + input.getBoundingClientRect().left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth) - input.scrollLeft
  })
  expect(Math.abs(markBox.x - textWidth)).toBeLessThan(2)
})

test('reads as you type, with no menu on a symbol', async ({ page }) => {
  await page.setViewportSize(LAPTOP)
  await page.goto(story('empty'))
  const box = page.getByRole('textbox', { name: 'Add To-Do' })
  await box.pressSequentially('Pay the bill tomorrow at 3pm #err @')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.locator('[data-slot="quick-add-marks"] mark')).toHaveText(['tomorrow', 'at 3pm', '#err'])
  await expect(page.getByTestId('reading')).toHaveText('Pay the bill @ · 2026-11-21 · 15:00 · list Errands')
})

test('✕ gives a chip its words back, and they stay given back', async ({ page }) => {
  await page.setViewportSize(LAPTOP)
  await page.goto(story('given-back'))
  const box = page.getByRole('textbox', { name: 'A word that only looks like a day' })
  await expect(page.locator('[data-read="date"]')).toHaveText(/Sun, Nov 22/)
  await page.getByRole('button', { name: 'Not a due: put “sun” back in the title' }).click()
  await expect(page.locator('[data-read="date"]')).toHaveCount(0)
  await expect(page.locator('[data-slot="quick-add-marks"] mark')).toHaveCount(0)
  await expect(page.getByTestId('reading')).toHaveText('Read the sun article')
  // Focus goes back to the box, and typing on keeps "sun" a word.
  await expect(box).toBeFocused()
  await box.press('End')
  await box.pressSequentially(' tomorrow')
  await expect(page.getByTestId('reading')).toHaveText('Read the sun article · 2026-11-21')
})

test("Enter adds the line as read; the app's chip is pressed", async ({ page }) => {
  await page.setViewportSize(LAPTOP)
  await page.goto(story('empty'))
  const box = page.getByRole('textbox', { name: 'Add To-Do' })
  await page.getByRole('button', { name: '+ Place' }).click()
  await expect(page.getByRole('button', { name: /Place\s*At the Desk/ })).toBeVisible()
  await box.fill('Water the ferns every! 3 days')
  await box.press('Enter')
  await expect(page.getByRole('list', { name: 'Added' })).toHaveText('Added: Water the ferns · 2026-11-20 · FREQ=DAILY;INTERVAL=3 from done')
  await expect(box).toHaveValue('')
  // Nothing typed: Enter adds nothing.
  await box.press('Enter')
  await expect(page.getByRole('list', { name: 'Added' }).getByRole('listitem')).toHaveCount(1)
})

for (const theme of ['light', 'dark']) {
  for (const [name, size] of [['laptop', LAPTOP], ['phone', PHONE]] as const) {
    test(`axe, ${theme}, ${name}: no violations and no sideways scroll`, async ({ page }) => {
      await page.setViewportSize(size)
      for (const id of ['default', 'lines']) {
        await page.goto(story(id, theme))
        await expect(page.getByRole('textbox').first()).toBeVisible()
        const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
        expect(results.violations).toEqual([])
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
      }
    })
  }
}
