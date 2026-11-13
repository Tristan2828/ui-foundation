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
  await expect(page.getByRole('button', { name: 'Toggle Dark Mode' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Palette/ })).toHaveCount(0)
  await expect(html(page)).not.toHaveAttribute('data-palette')
})

test('a fixed palette: no toggle and no picker', async ({ page }) => {
  await open(page, 'with-palette')
  await expect(html(page)).toHaveAttribute('data-palette', 'indigo-cyan')
  await expect(page.getByRole('button', { name: 'Toggle Dark Mode' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Palette/ })).toHaveCount(0)
})

test('the picker lists the four, switches at once and remembers the choice on this device', async ({ page }) => {
  await open(page, 'with-palette-picker')
  await expect(page.getByRole('button', { name: 'Toggle Dark Mode' })).toHaveCount(0)
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

// Palm LCD, the light palette an app opts into by name: it forces light,
// the shell has neither the toggle nor the picker (asked for or not), and a
// device's saved dark palette doesn't replace it.
test('the light palette: light, on its green, with no toggle and no picker', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ui-foundation:palette', 'violet'))
  await open(page, 'with-light-palette', 'theme=light&palette=palm-lcd')
  await expect(html(page)).toHaveAttribute('data-palette', 'palm-lcd')
  await expect(html(page)).not.toHaveClass(/dark/)
  expect(await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(201, 209, 178)')
  await expect(page.getByRole('button', { name: 'Toggle Dark Mode' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Palette/ })).toHaveCount(0)
})

// Rows on this device (lib/rows.ts): compact until a device picks Regular,
// which rides on <html> as data-rows and retunes every table's cells; the
// choice survives a reload. Measured on the tokens the cells read.
const cellPadding = (page: Page) =>
  page.evaluate(() => parseFloat(getComputedStyle(document.body).getPropertyValue('--table-cell-py')))

test('the rows picker sits under the palettes and remembers Regular on this device', async ({ page }) => {
  await open(page, 'with-palette-picker-and-rows')
  await expect(html(page)).not.toHaveAttribute('data-rows')
  expect(await cellPadding(page)).toBe(0.25)

  await page.getByRole('button', { name: 'Palette: Indigo and Cyan' }).click()
  await expect(page.getByText('Rows on This Device')).toBeVisible()
  await expect(page.getByRole('menuitemradio', { name: 'Compact' })).toBeChecked()
  await page.getByRole('menuitemradio', { name: 'Regular' }).click()
  await expect(html(page)).toHaveAttribute('data-rows', 'regular')
  expect(await cellPadding(page)).toBe(0.5)
  expect(await page.evaluate(() => localStorage.getItem('ui-foundation:rows'))).toBe('regular')
  // The palette is untouched.
  await expect(html(page)).toHaveAttribute('data-palette', 'indigo-cyan')

  await page.reload()
  await expect(html(page)).toHaveAttribute('data-rows', 'regular')
  await page.getByRole('button', { name: 'Palette: Indigo and Cyan' }).click()
  await page.getByRole('menuitemradio', { name: 'Compact' }).click()
  await expect(html(page)).not.toHaveAttribute('data-rows')
  expect(await cellPadding(page)).toBe(0.25)
})

test('without a palette the rows get a menu of their own beside the toggle', async ({ page }) => {
  await open(page, 'with-rows-picker', 'theme=light')
  await expect(page.getByRole('button', { name: 'Toggle Dark Mode' })).toBeVisible()
  await page.getByRole('button', { name: 'Rows: Compact' }).click()
  await expect(page.getByText('Palette on This Device')).toHaveCount(0)
  await page.getByRole('menuitemradio', { name: 'Regular' }).click()
  await expect(html(page)).toHaveAttribute('data-rows', 'regular')
  await expect(page.getByRole('button', { name: 'Rows: Regular' })).toBeVisible()
})

test('a saved Regular is ignored without the rows picker', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ui-foundation:rows', 'regular'))
  await open(page, 'with-palette-picker')
  await expect(html(page)).not.toHaveAttribute('data-rows')
  await page.getByRole('button', { name: 'Palette: Indigo and Cyan' }).click()
  await expect(page.getByText('Rows on This Device')).toHaveCount(0)
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

// The glow (the shared style guide), under a dark palette only: the primary
// button on hover and keyboard focus, never another variant; a hovered
// widget's edge; a slider's thumb. Without a palette, none of it, and none
// under Palm LCD, the light one.
const shadow = (locator: import('@playwright/test').Locator) => locator.evaluate((el) => getComputedStyle(el).boxShadow)
const glows = (value: string) => /\b38px 2px\b/.test(value)

test('a primary button glows on hover and focus in a palette, and not without one', async ({ page }) => {
  await page.goto('http://localhost:6180/story.html?id=ui-button--variants&theme=dark&palette=indigo-cyan')
  const primary = page.getByRole('button', { name: 'Primary' })
  const secondary = page.getByRole('button', { name: 'Secondary' })
  expect(glows(await shadow(primary))).toBe(false)
  await primary.hover()
  await expect.poll(() => shadow(primary).then(glows)).toBe(true)
  await secondary.hover()
  await expect.poll(() => shadow(secondary).then(glows)).toBe(false)
  await primary.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect.poll(() => shadow(primary).then(glows)).toBe(true)

  await page.goto('http://localhost:6180/story.html?id=ui-button--variants&theme=dark')
  await page.getByRole('button', { name: 'Primary' }).hover()
  await page.waitForTimeout(200)
  expect(glows(await shadow(page.getByRole('button', { name: 'Primary' })))).toBe(false)
})

test('a hovered widget’s edge turns the accent in a palette', async ({ page }) => {
  const edge = async (query: string) => {
    await page.goto(`http://localhost:6180/story.html?id=app-widgetcard--default&${query}`)
    const card = page.locator('[data-slot=widget-card] [data-slot=card]').first()
    await expect(card).toBeVisible()
    const before = await shadow(card)
    await card.hover()
    await page.waitForTimeout(300)
    return { before, after: await shadow(card) }
  }
  const inPalette = await edge('theme=dark&palette=violet')
  expect(inPalette.after).not.toBe(inPalette.before)
  const plain = await edge('theme=dark')
  expect(plain.after).toBe(plain.before)
})

test('a slider’s thumb glows in a palette', async ({ page }) => {
  await page.goto('http://localhost:6180/story.html?id=ui-slider--default&theme=dark&palette=indigo-rose')
  const thumb = page.locator('[data-slot=slider-thumb]').first()
  await expect(thumb).toBeVisible()
  expect(await shadow(thumb)).toMatch(/10px 2px/)
  await page.goto('http://localhost:6180/story.html?id=ui-slider--default&theme=dark')
  expect(await shadow(page.locator('[data-slot=slider-thumb]').first())).not.toMatch(/10px 2px/)
})

test('nothing glows under the light palette', async ({ page }) => {
  await page.goto('http://localhost:6180/story.html?id=ui-button--variants&theme=light&palette=palm-lcd')
  await expect(html(page)).toHaveAttribute('data-palette', 'palm-lcd')
  const primary = page.getByRole('button', { name: 'Primary' })
  await primary.hover()
  await page.waitForTimeout(200)
  expect(glows(await shadow(primary))).toBe(false)
  const shine = await primary.evaluate((el) => getComputedStyle(el, '::after').content)
  expect(shine).toBe('none')

  await page.goto('http://localhost:6180/story.html?id=ui-slider--default&theme=light&palette=palm-lcd')
  const thumb = page.locator('[data-slot=slider-thumb]').first()
  await expect(thumb).toBeVisible()
  expect(await shadow(thumb)).not.toMatch(/10px 2px/)

  await page.goto('http://localhost:6180/story.html?id=app-widgetcard--default&theme=light&palette=palm-lcd')
  const card = page.locator('[data-slot=widget-card] [data-slot=card]').first()
  await expect(card).toBeVisible()
  const before = await shadow(card)
  await card.hover()
  await page.waitForTimeout(300)
  expect(await shadow(card)).toBe(before)
})
