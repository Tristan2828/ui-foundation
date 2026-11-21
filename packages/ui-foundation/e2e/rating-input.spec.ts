import AxeBuilder from './axe'
import { devices, expect, test, type Page } from '@playwright/test'

// RatingInput: a score set by clicking a star, by keyboard and hover; as `inPlace.rating` in a record's
// facts rail and a table's rows it saves once, shows a refusal, and sizes its stars for a phone.
const STATES = 'http://localhost:6180/story.html?id=app-ratinginput--default'
const RECORD = 'http://localhost:6180/story.html?id=app-ratinginput--in-a-record'

const group = (page: Page, name: string) => page.getByRole('radiogroup', { name, exact: true })
const shown = (page: Page, name: string) => page.getByTestId(`${name} value`)
const filled = (page: Page, name: string) => group(page, name).locator('svg[data-filled]')

test('a click sets the score; a click on the set star clears it', async ({ page }) => {
  await page.goto(STATES)
  await group(page, 'Taste').getByRole('radio', { name: '5 of 5' }).click()
  await expect(shown(page, 'Taste')).toHaveText('5')
  await expect(group(page, 'Taste').getByRole('radio', { name: '5 of 5' })).toHaveAttribute('aria-checked', 'true')
  await page.mouse.move(0, 0)
  await expect(filled(page, 'Taste')).toHaveCount(5)
  await group(page, 'Taste').getByRole('radio', { name: '5 of 5' }).click()
  await expect(shown(page, 'Taste')).toHaveText('None')
  await page.mouse.move(0, 0)
  await expect(filled(page, 'Taste')).toHaveCount(0)
  await expect(group(page, 'Taste').locator('[aria-checked="true"]')).toHaveCount(0)
  // An empty one takes its first click.
  await group(page, 'Value').getByRole('radio', { name: '2 of 5' }).click()
  await expect(shown(page, 'Value')).toHaveText('2')
})

test('the keyboard: one tab stop, the arrows move and set it, Space on the set star clears it', async ({ page }) => {
  await page.goto(STATES)
  await page.getByText('Ratings').click()
  await page.keyboard.press('Tab')
  const taste = group(page, 'Taste')
  await expect(taste.getByRole('radio', { name: '3 of 5' })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(shown(page, 'Taste')).toHaveText('4')
  await expect(taste.getByRole('radio', { name: '4 of 5' })).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect(shown(page, 'Taste')).toHaveText('2')
  await page.keyboard.press('Space')
  await expect(shown(page, 'Taste')).toHaveText('None')
  await expect(filled(page, 'Taste')).toHaveCount(0)
  await page.keyboard.press('Space')
  await expect(shown(page, 'Taste')).toHaveText('2')
  // One tab stop: Tab leaves the stars for the next group.
  await page.keyboard.press('Tab')
  await expect(group(page, 'Value').getByRole('radio', { name: '1 of 5' })).toBeFocused()
})

test('hovering previews the score and leaving puts it back, setting nothing', async ({ page }) => {
  await page.goto(STATES)
  await group(page, 'Taste').getByRole('radio', { name: '5 of 5' }).hover()
  await expect(filled(page, 'Taste')).toHaveCount(5)
  await group(page, 'Taste').getByRole('radio', { name: '1 of 5' }).hover()
  await expect(filled(page, 'Taste')).toHaveCount(1)
  await page.mouse.move(0, 0)
  await expect(filled(page, 'Taste')).toHaveCount(3)
  await expect(shown(page, 'Taste')).toHaveText('3')
})

test('hearts out of ten, and a disabled one ignores clicks and hover', async ({ page }) => {
  await page.goto(STATES)
  await expect(group(page, 'Loved').getByRole('radio')).toHaveCount(10)
  await expect(group(page, 'Loved')).toHaveAttribute('data-glyph', 'heart')
  await group(page, 'Loved').getByRole('radio', { name: '9 of 10' }).click()
  await expect(shown(page, 'Loved')).toHaveText('9')
  const locked = group(page, 'Locked')
  await locked.getByRole('radio', { name: '5 of 5' }).click({ force: true })
  await expect(filled(page, 'Locked')).toHaveCount(2)
  await expect(shown(page, 'Locked')).toHaveText('2')
})

test('stars are compact on a laptop: 24px targets, as wide at 1 as at 5', async ({ page }) => {
  await page.goto(STATES)
  const before = (await group(page, 'Taste').boundingBox())!
  for (const radio of await group(page, 'Taste').getByRole('radio').all()) {
    const box = (await radio.boundingBox())!
    expect(Math.round(box.width)).toBe(24)
    expect(Math.round(box.height)).toBe(24)
  }
  await group(page, 'Taste').getByRole('radio', { name: '1 of 5' }).click()
  expect((await group(page, 'Taste').boundingBox())!.width).toBe(before.width)
})

test.describe('saved in place', () => {
  const rail = (page: Page) => page.getByRole('complementary', { name: 'Lentil Soup facts' })

  test('a click in the facts rail saves at once; pressing it again saves none', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(RECORD)
    const stars = rail(page).getByRole('radiogroup', { name: 'My Rating' })
    await expect(stars).toHaveAttribute('data-value', '4')
    await stars.getByRole('radio', { name: '2 of 5' }).click()
    await expect(rail(page).getByRole('status').filter({ hasText: 'Saving…' })).toBeAttached()
    await expect(rail(page).getByRole('status').filter({ hasText: 'Saved' })).toBeAttached()
    await expect(stars).toHaveAttribute('data-value', '2')
    // The record holds it: a second press clears it, saved as none.
    await stars.getByRole('radio', { name: '2 of 5' }).click()
    await expect(stars).not.toHaveAttribute('data-value')
    await expect(rail(page).getByRole('status').filter({ hasText: 'Saved' })).toBeAttached()
    await page.mouse.move(0, 0)
    await expect(stars.locator('svg[data-filled]')).toHaveCount(0)
    // "Saved" goes after two seconds, so it doesn't sit beside the stars for good.
    await expect(rail(page).getByRole('status').filter({ hasText: 'Saved' })).toHaveCount(0, { timeout: 4000 })
  })

  test('a refusal shows under the stars, and the next pick saves', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(RECORD)
    const stars = rail(page).getByRole('radiogroup', { name: 'My Rating' })
    await stars.getByRole('radio', { name: '1 of 5' }).click()
    await expect(rail(page).getByText('One star needs a note first')).toBeVisible()
    await expect(stars).toHaveAttribute('aria-invalid', 'true')
    await stars.getByRole('radio', { name: '3 of 5' }).click()
    await expect(rail(page).getByText('One star needs a note first')).toHaveCount(0)
    await expect(stars).toHaveAttribute('data-value', '3')
    await expect(stars).not.toHaveAttribute('aria-invalid')
  })

  test('the arrow keys save once, after the last', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(RECORD)
    const stars = rail(page).getByRole('radiogroup', { name: 'My Rating' })
    await stars.getByRole('radio', { name: '4 of 5' }).focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await expect(stars).toHaveAttribute('data-value', '3')
    // Nothing in flight yet: the save waits for the pause.
    await expect(rail(page).getByRole('status').filter({ hasText: 'Saving…' })).toHaveCount(0)
    await expect(rail(page).getByRole('status').filter({ hasText: 'Saved' })).toBeAttached({ timeout: 3000 })
    await expect(stars).toHaveAttribute('data-value', '3')
  })

  test('a table cell sets its row’s rating by a click', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${RECORD}&tab=others`)
    const cell = page.getByRole('radiogroup', { name: 'Rating of Plum Tart' })
    await expect(cell).not.toHaveAttribute('data-value')
    await cell.getByRole('radio', { name: '5 of 5' }).click()
    await expect(cell).toHaveAttribute('data-value', '5')
    await expect(page.getByRole('radiogroup', { name: 'Rating of Green Salad' })).toHaveAttribute('data-value', '2')
  })
})

test.describe('on a phone', () => {
  // A touch screen (`pointer: coarse`) at a phone's width.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { defaultBrowserType, ...phone } = devices['Pixel 7']
  test.use(phone)

  test('every star is a 44px target, and a tap sets it', async ({ page }) => {
    await page.goto(STATES)
    for (const radio of await group(page, 'Taste').getByRole('radio').all()) {
      const box = (await radio.boundingBox())!
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
    await group(page, 'Taste').getByRole('radio', { name: '4 of 5' }).tap()
    await expect(shown(page, 'Taste')).toHaveText('4')
    // No hover on a touch screen: the preview never sticks after a tap.
    await expect(filled(page, 'Taste')).toHaveCount(4)
    await group(page, 'Taste').getByRole('radio', { name: '4 of 5' }).tap()
    await expect(shown(page, 'Taste')).toHaveText('None')
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
  })

  for (const width of [412, 360]) {
    test(`in Details the label goes above the stars, all on screen; a tap saves (${width})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 860 })
      await page.goto(`${RECORD}&tab=details`)
      const details = page.getByRole('tabpanel')
      const stars = details.getByRole('radiogroup', { name: 'My Rating' })
      const label = details.locator('dt', { hasText: 'My Rating' })
      const [labelBox, starsBox] = [(await label.boundingBox())!, (await stars.boundingBox())!]
      expect(starsBox.y).toBeGreaterThanOrEqual(labelBox.y + labelBox.height - 1)
      expect(starsBox.x + starsBox.width).toBeLessThanOrEqual(width)
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
      await stars.getByRole('radio', { name: '5 of 5' }).tap()
      await expect(stars).toHaveAttribute('data-value', '5')
    })
  }
})

for (const theme of ['light', 'dark'] as const) {
  for (const [name, url, width] of [
    ['every state', STATES, 1280],
    ['the rail', RECORD, 1440],
    ['a table', `${RECORD}&tab=others`, 1440],
    ['Details on a phone', `${RECORD}&tab=details`, 375],
  ] as const) {
    test(`${name} has no axe violations (${theme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${url}&theme=${theme}`)
      await expect(page.getByRole('radiogroup').first()).toBeVisible()
      const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
      expect(results.violations).toEqual([])
    })
  }
}
