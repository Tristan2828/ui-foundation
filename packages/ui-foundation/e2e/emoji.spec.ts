import { expect, test } from '@playwright/test'

// Emoji and EmojiTile (app/Emoji stories): Noto's pictures load from
// /assets/emoji-18.0/ (the emoji() plugin, in the harness's build), one
// with no picture falls back to the character, and tiles keep the titles
// beside them lined up.
const story = (id: string) => `http://localhost:6180/story.html?id=app-emoji--${id}`

test('draws Noto pictures, and the character where there is none', async ({ page }) => {
  await page.goto(story('pictures'))
  for (const [name, file] of [
    ['Person in lotus position', '1f9d8'],
    ['Flag: United States', '1f1fa_1f1f8'],
    ['Rainbow flag', '1f3f3_200d_1f308'],
    ['Red heart', '2764'],
    ['Keycap: 1', '0031_20e3'],
  ]) {
    const picture = page.getByRole('img', { name })
    await expect(picture).toHaveAttribute('src', `/assets/emoji-18.0/${file}.svg`)
    await expect.poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth), { message: name }).toBeGreaterThan(0)
  }
  // Beside its words it is decorative.
  await expect(page.locator('img[alt=""][aria-hidden=true]')).toHaveCount(1)
  // No picture of a skin tone: the character itself, still named.
  const fallback = page.getByTestId('no-picture').locator('[data-slot=emoji]')
  await expect(fallback).toHaveAttribute('data-fallback', '')
  await expect(fallback).toHaveText('👍🏽')
  await expect(page.getByRole('img', { name: 'Thumbs up: medium skin tone' })).toBeVisible()
})

test('tiles are 26px, an empty one dashed, and the titles beside them line up', async ({ page }) => {
  await page.goto(story('tiles'))
  const tiles = page.locator('[data-slot=emoji-tile]')
  await expect(tiles).toHaveCount(3)
  for (const tile of await tiles.all()) {
    const box = await tile.boundingBox()
    expect(box?.width).toBe(26)
    expect(box?.height).toBe(26)
    await expect(tile).toHaveAttribute('aria-hidden', 'true')
  }
  const empty = tiles.nth(1)
  await expect(empty).toHaveAttribute('data-empty', '')
  await expect(empty).toHaveCSS('border-top-style', 'dashed')
  await expect(empty.locator('img')).toHaveCount(0)
  await expect(tiles.first().locator('img')).toHaveAttribute('src', '/assets/emoji-18.0/1f9f9.svg')
  const starts = await page.getByTestId('row-title').evaluateAll((titles) => titles.map((title) => title.getBoundingClientRect().left))
  expect(new Set(starts).size).toBe(1)
})
