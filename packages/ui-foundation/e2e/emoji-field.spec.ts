import { expect, test, type Page } from '@playwright/test'

// EmojiField (app/EmojiField stories): pick by click, search, keyboard,
// clear, the group tabs, Recent, the pictures, and the sheet on a phone.
const story = (id: string) => `http://localhost:6180/story.html?id=app-emojifield--${id}`

const popup = (page: Page) => page.locator('[data-slot=emoji-field-popup]')
const grid = (page: Page) => popup(page).locator('[data-slot=emoji-grid]')
const tab = (page: Page, name: string) => popup(page).getByRole('tab', { name, exact: true })
const suggested = (page: Page) => popup(page).getByRole('tabpanel', { name: 'Suggested' })

async function openList(page: Page) {
  await page.getByRole('button', { name: 'List Emoji' }).click()
  // Every group is there once the data has loaded.
  await expect(popup(page).getByRole('heading', { name: 'Flags' })).toHaveCount(1)
  await expect(popup(page).locator('[data-slot=emoji-loading]')).toHaveCount(0)
}

test('picks an emoji and shows it as its picture', async ({ page }) => {
  await page.goto(story('default'))
  await openList(page)
  await suggested(page).getByRole('button', { name: 'Alarm clock' }).click()
  await expect(page.getByTestId('empty-value')).toHaveText('⏰')
  const trigger = page.getByRole('button', { name: 'List Emoji' })
  await expect(trigger).toBeFocused()
  const picture = trigger.getByRole('img')
  await expect(picture).toHaveAttribute('src', '/assets/emoji-18.0/23f0.svg')
  await expect.poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
})

test('search narrows by name and keyword, and says when nothing matches', async ({ page }) => {
  await page.goto(story('default'))
  await openList(page)
  const search = popup(page).getByRole('searchbox', { name: 'Search Emoji' })
  await search.fill('coffee')
  await expect(popup(page).getByRole('button', { name: 'Hot beverage' })).toHaveCount(1)
  await expect(popup(page).getByRole('button', { name: 'Alarm clock' })).toHaveCount(0)
  await expect(popup(page).getByRole('heading', { name: 'Results' })).toBeVisible()
  await expect(popup(page).locator('[role=tab][aria-selected=true]')).toHaveCount(0)
  // Suggested's keywords reach the generated entry: "meds" isn't CLDR's.
  await search.fill('meds')
  await expect(popup(page).getByRole('button', { name: 'Pill' })).toHaveCount(1)
  await search.fill('zzzz')
  await expect(popup(page).getByText('No emoji match "zzzz".')).toBeVisible()
})

test('the keyboard picks, and Clear empties a clearable field', async ({ page }) => {
  await page.goto(story('default'))
  const chosen = page.getByRole('button', { name: 'Routine Emoji' })
  await chosen.focus()
  await page.keyboard.press('Enter')
  await popup(page).getByRole('searchbox', { name: 'Search Emoji' }).fill('bathtub')
  // Past the tab row (one stop) to the first result.
  await page.keyboard.press('Tab')
  await expect(popup(page).getByRole('tab').first()).toBeFocused()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('chosen-value')).toHaveText('🛁')
  await chosen.click()
  await popup(page).getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByTestId('chosen-value')).toHaveText('empty')
})

test('a tab scrolls its group to the top and is selected; scrolling lights the group in view', async ({ page }) => {
  await page.goto(story('default'))
  await openList(page)
  await expect(tab(page, 'Suggested')).toHaveAttribute('aria-selected', 'true')
  // Nothing picked yet on this device: no Recent.
  await expect(tab(page, 'Recent')).toHaveCount(0)
  await expect(popup(page).getByRole('tabpanel', { name: 'Recent' })).toHaveCount(0)

  await tab(page, 'Animals and Nature').click()
  await expect(tab(page, 'Animals and Nature')).toHaveAttribute('aria-selected', 'true')
  await expect(tab(page, 'Suggested')).toHaveAttribute('aria-selected', 'false')
  const offset = await grid(page).evaluate((box) => {
    const section = box.querySelector<HTMLElement>('[data-emoji-section="Animals and Nature"]')
    return section ? section.getBoundingClientRect().top - box.getBoundingClientRect().top : NaN
  })
  expect(Math.abs(offset)).toBeLessThan(2)

  // By hand, back to the top: Suggested lights again.
  await grid(page).hover()
  await page.mouse.wheel(0, -100_000)
  await expect(tab(page, 'Suggested')).toHaveAttribute('aria-selected', 'true')
  // Further down, whichever group is at the top of the view is the lit tab.
  await page.mouse.wheel(0, 3000)
  await expect(tab(page, 'Suggested')).toHaveAttribute('aria-selected', 'false')
  const top = await grid(page).evaluate((box) => {
    const edge = box.getBoundingClientRect().top
    const sections = [...box.querySelectorAll<HTMLElement>('[data-emoji-section]')]
    return sections.find((section) => section.getBoundingClientRect().bottom > edge + 1)?.dataset.emojiSection
  })
  await expect(tab(page, top ?? '')).toHaveAttribute('aria-selected', 'true')
})

test('a pick is first in Recent on reopening', async ({ page }) => {
  await page.goto(story('default'))
  await openList(page)
  await popup(page).getByRole('searchbox', { name: 'Search Emoji' }).fill('dog face')
  await popup(page).getByRole('button', { name: 'Dog face' }).click()
  await page.getByRole('button', { name: 'List Emoji' }).click()
  await expect(tab(page, 'Recent')).toHaveAttribute('aria-selected', 'true')
  const recent = popup(page).getByRole('tabpanel', { name: 'Recent' })
  await expect(recent.getByRole('button').first()).toHaveAccessibleName('Dog face')
  await expect(recent.getByRole('button', { name: 'Dog face' })).toHaveAttribute('aria-pressed', 'true')
  // A second pick goes before it.
  await suggested(page).getByRole('button', { name: 'Alarm clock' }).click()
  await page.getByRole('button', { name: 'List Emoji' }).click()
  await expect(recent.getByRole('button')).toHaveCount(2)
  await expect(recent.getByRole('button').first()).toHaveAccessibleName('Alarm clock')
})

test('opening downloads the pictures in view, not all of them', async ({ page }) => {
  const asked = new Set<string>()
  page.on('request', (request) => {
    if (request.url().includes('/assets/emoji-18.0/')) asked.add(request.url())
  })
  await page.goto(story('default'))
  await openList(page)
  await expect.poll(() => asked.size).toBeGreaterThan(8)
  await page.waitForTimeout(500)
  expect(asked.size).toBeLessThan(250)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('opens as a sheet from the bottom with bigger emoji, 8 across', async ({ page }) => {
    await page.goto(story('default'))
    await page.getByRole('button', { name: 'List Emoji' }).click()
    const sheet = page.getByRole('dialog', { name: 'Emoji' })
    await expect(sheet).toBeVisible()
    // At the bottom of the screen, once it has slid in.
    await expect.poll(async () => {
      const box = await sheet.boundingBox()
      return box && Math.round(box.y + box.height)
    }).toBe(812)
    const cells = sheet.getByRole('tabpanel', { name: 'Suggested' }).getByRole('button')
    const cell = await cells.first().boundingBox()
    expect(cell?.width).toBeGreaterThanOrEqual(40)
    expect(cell?.height).toBeGreaterThanOrEqual(40)
    const rows = await cells.evaluateAll(
      (buttons) => new Set(buttons.slice(0, 16).map((button) => Math.round(button.getBoundingClientRect().top))).size,
    )
    expect(rows).toBe(2)
    await sheet.getByRole('tabpanel', { name: 'Suggested' }).getByRole('button', { name: 'Alarm clock' }).click()
    await expect(sheet).toHaveCount(0)
    await expect(page.getByTestId('empty-value')).toHaveText('⏰')
  })
})
