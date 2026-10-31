import { expect, test } from '@playwright/test'

// EmojiField (app/EmojiField stories): pick by click, search, keyboard, clear.
const story = (id: string) => `http://localhost:6006/iframe.html?id=app-emojifield--${id}&viewMode=story`

test('picks an emoji and shows it', async ({ page }) => {
  await page.goto(story('default'))
  await page.getByRole('button', { name: 'List emoji' }).click()
  await page.getByRole('button', { name: 'Alarm clock' }).click()
  await expect(page.getByTestId('empty-value')).toHaveText('⏰')
  await expect(page.getByRole('button', { name: 'List emoji' })).toBeFocused()
})

test('search narrows by name and keyword, and says when nothing matches', async ({ page }) => {
  await page.goto(story('default'))
  await page.getByRole('button', { name: 'List emoji' }).click()
  await page.getByRole('searchbox', { name: 'Search emoji' }).fill('coffee')
  await expect(page.getByRole('button', { name: 'Hot beverage' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Alarm clock' })).toHaveCount(0)
  await page.getByRole('searchbox', { name: 'Search emoji' }).fill('zzzz')
  await expect(page.getByText('No emoji match "zzzz".')).toBeVisible()
})

test('the keyboard picks, and Clear empties a clearable field', async ({ page }) => {
  await page.goto(story('default'))
  const chosen = page.getByRole('button', { name: 'Routine emoji' })
  await chosen.focus()
  await page.keyboard.press('Enter')
  await page.getByRole('searchbox', { name: 'Search emoji' }).fill('bathtub')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('chosen-value')).toHaveText('🛁')
  await chosen.click()
  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByTestId('chosen-value')).toHaveText('empty')
})
