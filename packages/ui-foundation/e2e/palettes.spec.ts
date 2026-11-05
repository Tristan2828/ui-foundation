import { expect, test, type Page } from '@playwright/test'

// An app with a palette (design-language.md "Palettes"), in the app shell's
// stories: no light/dark toggle in the header; with the picker, a palette
// menu in its place that puts the choice on <html> at once and remembers it
// on this device. Contrast in each palette is e2e/fixtures-visual.spec.ts;
// the store's rules are tests/palettes.test.ts.
const story = (id: string, query = 'theme=dark&palette=indigo-cyan') =>
  `http://localhost:6180/story.html?id=app-appshell--${id}&${query}`

async function open(page: Page, id: string, query?: string) {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(story(id, query))
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
}

const html = (page: Page) => page.locator('html')

test('without a palette: the light/dark toggle, and no palette on <html>', async ({ page }) => {
  await open(page, 'flat', 'theme=light')
  await expect(page.getByRole('button', { name: 'Toggle dark mode' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Palette/ })).toHaveCount(0)
  await expect(html(page)).not.toHaveAttribute('data-palette')
})

test('a fixed palette: no toggle and no picker', async ({ page }) => {
  await open(page, 'with-palette')
  await expect(html(page)).toHaveAttribute('data-palette', 'indigo-cyan')
  await expect(page.getByRole('button', { name: 'Toggle dark mode' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Palette/ })).toHaveCount(0)
})

test('the picker lists the four, switches at once and remembers the choice on this device', async ({ page }) => {
  await open(page, 'with-palette-picker')
  await expect(page.getByRole('button', { name: 'Toggle dark mode' })).toHaveCount(0)
  const background = () => page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor)
  const before = await background()

  await page.getByRole('button', { name: 'Palette: Indigo and Cyan' }).click()
  const items = page.getByRole('menuitemradio')
  await expect(items).toHaveText(['Indigo and Cyan', 'Indigo and Rose', 'Graphite and Periwinkle', 'Violet'])
  await expect(page.getByRole('menuitemradio', { name: 'Indigo and Cyan' })).toBeChecked()

  await page.getByRole('menuitemradio', { name: 'Graphite and Periwinkle' }).click()
  await expect(html(page)).toHaveAttribute('data-palette', 'graphite-periwinkle')
  expect(await background()).not.toBe(before)
  expect(await page.evaluate(() => localStorage.getItem('ui-foundation:palette'))).toBe('graphite-periwinkle')

  // A reload keeps it, and the trigger names it.
  await page.reload()
  await expect(html(page)).toHaveAttribute('data-palette', 'graphite-periwinkle')
  await expect(page.getByRole('button', { name: 'Palette: Graphite and Periwinkle' })).toBeVisible()
})

test('a saved choice is ignored without the picker, and an unknown one falls back to the default', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ui-foundation:palette', 'violet'))
  await open(page, 'with-palette')
  await expect(html(page)).toHaveAttribute('data-palette', 'indigo-cyan')

  await page.addInitScript(() => localStorage.setItem('ui-foundation:palette', 'tangerine'))
  await open(page, 'with-palette-picker')
  await expect(html(page)).toHaveAttribute('data-palette', 'indigo-cyan')
})

test('the link button reads in the palette’s link colour, not its accent', async ({ page }) => {
  await page.goto('http://localhost:6180/story.html?id=ui-button--variants&theme=dark&palette=indigo-rose')
  await expect(html(page)).toHaveAttribute('data-palette', 'indigo-rose')
  const link = page.getByRole('button', { name: 'Link' })
  const { colour, expected } = await link.evaluate((el) => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--link)'
    document.body.append(probe)
    const expected = getComputedStyle(probe).color
    probe.remove()
    return { colour: getComputedStyle(el).color, expected }
  })
  expect(colour).toBe(expected)
})
