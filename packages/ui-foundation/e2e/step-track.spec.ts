import { expect, test } from '@playwright/test'
import AxeBuilder from './axe'

// StepTrack (4.128, app/StepTrack): the stepper look's steps read only.
// A named list with nothing to press; the current step ringed with its
// caption under it; on a laptop one row, on a phone the row scrolls
// sideways in its own box (a tab stop then, so the keys can scroll it)
// with the current step in view; axe in both themes at both widths.
const story = (id: string, theme = 'light') => `http://localhost:6180/story.html?id=app-steptrack--${id}&theme=${theme}`

const LAPTOP = { width: 1280, height: 900 }
const PHONE = { width: 390, height: 844 }

const noPageScroll = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

test('a named list of steps, the current one ringed with its caption, nothing to press', async ({ page }) => {
  await page.setViewportSize(LAPTOP)
  await page.goto(story('on-a-card'))
  const track = page.getByRole('list', { name: 'Spring 10K plan, phases' })
  const steps = track.getByRole('listitem')
  await expect(steps).toHaveCount(4)
  // The mark's number is hidden; the text after it is what's read.
  await expect(steps.nth(0)).toHaveText(/Step 1: Foundation ?, done$/)
  await expect(steps.nth(2)).toHaveText(/^3Step 3: Peak ?, current ?Day 12$/)
  await expect(steps.nth(2)).toHaveAttribute('aria-current', 'step')
  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect(page.getByRole('tablist')).toHaveCount(0)
  // The caption sits under the current step's name.
  const name = (await steps.nth(2).getByText('Peak').boundingBox())!
  const caption = (await steps.nth(2).getByText('Day 12').boundingBox())!
  expect(caption.y).toBeGreaterThanOrEqual(name.y + name.height - 1)
  // The ring round the current mark, none round the others.
  const ring = (i: number) =>
    steps.nth(i).locator('[data-slot="step-track-step-mark"]').evaluate((el) => getComputedStyle(el).boxShadow)
  expect(await ring(2)).not.toBe('none')
  expect(await ring(0)).toBe('none')
  // It fits on a laptop: one row, no tab stop.
  const tops = await steps.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)))
  expect(new Set(tops).size).toBe(1)
  await expect(track).not.toHaveAttribute('tabindex')
})

test("its marks are the stepper's: the same size and place beside it", async ({ page }) => {
  await page.setViewportSize(LAPTOP)
  await page.goto(story('beside-the-stepper'))
  const size = (selector: string) =>
    page.locator(selector).evaluateAll((els) => els.map((el) => [Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().left)]))
  expect(await size('[data-slot="step-track-step-mark"]')).toEqual(await size('[data-slot="equal-item-step-mark"]'))
})

test('on a phone, the row scrolls sideways in its own box, the current step in view', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.goto(story('on-a-card'))
  const track = page.getByRole('list', { name: 'Strength block, weeks' })
  await expect(track).toBeVisible()
  expect(await track.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
  expect(await noPageScroll(page)).toBe(true)
  // Week 6, the current one, is scrolled into view.
  const inView = () =>
    track.evaluate((list) => {
      const step = list.querySelector('[aria-current="step"]')!
      const a = list.getBoundingClientRect()
      const b = step.getBoundingClientRect()
      return b.left >= a.left - 1 && b.right <= a.right + 1
    })
  expect(await inView()).toBe(true)
  // Overflowing, the box is a tab stop, and the arrow keys scroll it.
  await expect(track).toHaveAttribute('tabindex', '0')
  await track.focus()
  const before = await track.evaluate((el) => el.scrollLeft)
  await page.keyboard.press('ArrowLeft')
  await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeLessThan(before)
  // Every step is at least a finger's height, as the stepper's are.
  const heights = await track.getByRole('listitem').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44)
  // No track scrolls the page.
  await page.goto(story('edges'))
  expect(await noPageScroll(page)).toBe(true)
})

for (const theme of ['light', 'dark'] as const) {
  for (const [width, size] of [['laptop', LAPTOP], ['phone', PHONE]] as const) {
    for (const id of ['on-a-card', 'edges', 'beside-the-stepper']) {
      test(`${id} has no axe violations (${theme}, ${width})`, async ({ page }) => {
        await page.setViewportSize(size)
        await page.goto(story(id, theme))
        await expect(page.locator('[data-slot="step-track"]').first()).toBeVisible()
        // A story's page has no landmarks or <h1> of its own (the app's screens do).
        const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
        expect(results.violations).toEqual([])
      })
    }
  }
}
