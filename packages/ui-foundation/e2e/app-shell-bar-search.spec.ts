import AxeBuilder from './axe'
import { expect, test, type Page } from '@playwright/test'

// Search on AppShell's bottom bar, at phone widths (the BottomBarSearch
// stories): a button like its neighbours that opens the header's own
// palette in place of the header's button, focus back on it however the
// palette closes (resized across md too), never current, nothing without
// the shell's search, nothing from md up, and axe in both themes with the
// bar and with the palette open.
const story = (id: string, theme?: 'light' | 'dark') =>
  `http://localhost:6180/story.html?id=app-appshell--${id}${theme ? `&theme=${theme}` : ''}`

const bar = (page: Page) => page.getByRole('navigation', { name: 'Bottom Bar' })
const search = (page: Page) => bar(page).getByRole('button', { name: 'Search', exact: true })
const palette = (page: Page) => page.getByRole('dialog', { name: 'Search Example' })
const headerButton = (page: Page) => page.getByRole('button', { name: 'Search Example', exact: true })
const headerBox = (page: Page) => page.getByRole('button', { name: /Search Example.*Ctrl K/ })
const box = (page: Page) => palette(page).getByRole('combobox', { name: 'Search Example' })

async function openPhone(page: Page, id: string, { width = 390, theme }: { width?: number; theme?: 'light' | 'dark' } = {}) {
  await page.setViewportSize({ width, height: 844 })
  await page.goto(story(id, theme))
  await expect(bar(page)).toBeVisible()
}

for (const width of [360, 390]) {
  test(`reads as its neighbours do: icon over label, the same size, no count (${width})`, async ({ page }) => {
    await openPhone(page, 'bottom-bar-search', { width })
    await expect(bar(page).getByRole('listitem')).toHaveText([/Home/, /News/, /^Search$/, /Collections/, /Household/])
    await expect(search(page)).toHaveAttribute('aria-haspopup', 'dialog')
    await expect(search(page).locator('svg')).toHaveCount(1)
    await expect(search(page).locator('[data-slot="bottom-bar-count"]')).toHaveCount(0)
    // Its neighbours' counts are there, so the bar does draw them.
    await expect(bar(page).locator('[data-slot="bottom-bar-count"]')).toHaveCount(2)
    const [own, home] = [(await search(page).boundingBox())!, (await bar(page).getByRole('link', { name: 'Home' }).boundingBox())!]
    expect(own.height).toBeCloseTo(home.height, 0)
    expect(own.width).toBeCloseTo(home.width, 0)
    expect(own.height).toBeGreaterThanOrEqual(44)
    expect(own.width).toBeGreaterThanOrEqual(44)
    // Its label is whole at this width.
    expect(await search(page).getByText('Search').evaluate((label) => label.scrollWidth <= label.clientWidth)).toBe(true)
    // The same type and colour as an item that isn't current.
    const look = (element: Element) => {
      const { color, fontSize, fontWeight } = getComputedStyle(element)
      return { color, fontSize, fontWeight }
    }
    expect(await search(page).evaluate(look)).toEqual(await bar(page).getByRole('link', { name: 'Home' }).evaluate(look))
  })
}

test("opens the header's palette, focus in its box, and is never the current item", async ({ page }) => {
  await openPhone(page, 'bottom-bar-search')
  await expect(bar(page).getByRole('button', { name: 'Household' })).toHaveAttribute('aria-current', 'true')
  await expect(search(page)).not.toHaveAttribute('aria-current')
  await search(page).click()
  await expect(box(page)).toBeFocused()
  // One palette, and the page's current item stays current under it.
  await expect(page.locator('[data-slot="search-palette"]')).toHaveCount(1)
  await expect(bar(page).locator('[aria-current]')).toHaveCount(0)
  await expect(page.locator('[data-slot="app-shell-bottom-bar"] [aria-current]')).toHaveText('Household')
  await box(page).fill('lamp')
  await expect(palette(page).getByRole('option', { name: /Desk lamp/ })).toBeVisible()
})

for (const [how, close] of [
  ['Escape', (page: Page) => page.keyboard.press('Escape')],
  ['the backdrop', (page: Page) => page.mouse.click(20, 820)],
  ['Ctrl K', (page: Page) => page.keyboard.press('Control+k')],
] as const) {
  test(`focus goes back to it when the palette closes: ${how}`, async ({ page }) => {
    await openPhone(page, 'bottom-bar-search')
    await search(page).click()
    await expect(box(page)).toBeFocused()
    await close(page)
    await expect(palette(page)).toBeHidden()
    await expect(search(page)).toBeFocused()
  })
}

test('focus goes back to it where a press never focused it, as a tap in some browsers', async ({ page }) => {
  await openPhone(page, 'bottom-bar-search')
  await page.getByRole('button', { name: 'Toggle Sidebar' }).focus()
  // click() from script: the button is pressed, focus stays where it was.
  await search(page).evaluate((button: HTMLElement) => button.click())
  await expect(box(page)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(search(page)).toBeFocused()
})

for (const [id, has] of [
  ['bottom-bar-search', 'the bar draws Search'],
  ['bottom-bar-search-back', 'the bar draws Search, on a page with the back arrow'],
] as const) {
  test(`one Search on a phone, the bar's: ${has}`, async ({ page }) => {
    for (const width of [360, 390]) {
      await openPhone(page, id, { width })
      await expect(page.getByRole('button', { name: /^Search/ })).toHaveCount(1)
      await expect(search(page)).toBeVisible()
      await expect(page.locator('[data-slot="app-shell-search-button"]')).toHaveCount(0)
    }
  })
}

test('the header keeps its button where the bar does not draw Search: none on it, or past the fifth', async ({ page }) => {
  for (const id of ['standard-search', 'bottom-bar-search-sixth']) {
    await openPhone(page, id)
    await expect(search(page)).toHaveCount(0)
    await headerButton(page).click()
    await expect(box(page)).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(headerButton(page)).toBeFocused()
  }
})

test("the header's other parts keep their places, the theme toggle still at its end", async ({ page }) => {
  for (const id of ['bottom-bar-search', 'bottom-bar-search-back']) {
    await openPhone(page, id, { width: 360 })
    const header = (await page.locator('header').first().boundingBox())!
    const start = id === 'bottom-bar-search' ? page.getByRole('button', { name: 'Toggle Sidebar' }) : page.getByRole('link', { name: 'Back to Accounts' })
    const toggle = (await page.locator('header').first().getByRole('button').last().boundingBox())!
    expect((await start.boundingBox())!.x - header.x).toBeLessThanOrEqual(16)
    expect(header.x + header.width - (toggle.x + toggle.width)).toBeCloseTo(16, 0)
  }
})

test('Ctrl K at a phone width, from the page and from a button: focus goes back where it was', async ({ page }) => {
  await openPhone(page, 'bottom-bar-search')
  await page.keyboard.press('Control+k')
  await expect(box(page)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(palette(page)).toBeHidden()
  // Nothing had focus: it isn't on something that can't be seen.
  expect(await page.evaluate(() => document.activeElement!.getClientRects().length)).toBeGreaterThan(0)
  const menu = page.getByRole('button', { name: 'Toggle Sidebar' })
  await menu.focus()
  await page.keyboard.press('Control+k')
  await expect(box(page)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toBeFocused()
})

test('resized across md while open, focus goes to the one shown in its place', async ({ page }) => {
  const wide = () => page.setViewportSize({ width: 1280, height: 800 })
  const phone = () => page.setViewportSize({ width: 390, height: 844 })
  await openPhone(page, 'bottom-bar-search')
  await search(page).click()
  await expect(box(page)).toBeFocused()
  await wide()
  await expect(page.locator('[data-slot="app-shell-bottom-bar"]')).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(palette(page)).toBeHidden()
  await expect(headerBox(page)).toBeFocused()

  // The other way, from the header's box, pressed and by Ctrl K on it.
  for (const press of ['Enter', 'Control+k']) {
    await headerBox(page).focus()
    await page.keyboard.press(press)
    await expect(box(page)).toBeFocused()
    await phone()
    await expect(page.locator('[data-slot="app-shell-bottom-bar"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(search(page)).toBeFocused()
    await wide()
    await expect(headerBox(page)).toBeVisible()
  }
})

test('choosing a result goes to its page, marks its item and leaves Search unmarked', async ({ page }) => {
  await openPhone(page, 'bottom-bar-search')
  await search(page).click()
  await box(page).fill('news')
  await palette(page).getByRole('option', { name: 'News' }).click()
  await expect(palette(page)).toBeHidden()
  await expect(bar(page).getByRole('link', { name: /^News/ })).toHaveAttribute('aria-current', 'page')
  await expect(search(page)).not.toHaveAttribute('aria-current')
  // Where the header's own button leaves it too: on what opened the palette.
  await expect(search(page)).toBeFocused()
})

test("without the shell's search it isn't drawn, and the rest of the bar is", async ({ page }) => {
  await openPhone(page, 'bottom-bar-search-without')
  await expect(bar(page).getByRole('listitem')).toHaveText([/Home/, /News/, /Collections/, /Household/])
  await expect(page.getByRole('button', { name: /Search/ })).toHaveCount(0)
})

test('a bar of Search alone, without search, is no bar: no room kept for it, and the menu button stays', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(story('bottom-bar-search-only-without'))
  await expect(page.getByRole('link', { name: 'Back to Accounts' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Toggle Sidebar' })).toBeVisible()
  await expect(bar(page)).toHaveCount(0)
  const padding = await page
    .locator('[data-slot="sidebar-inset"] > div')
    .last()
    .evaluate((element) => parseFloat(getComputedStyle(element).paddingBottom))
  expect(padding).toBe(24)
})

test('nothing from md up', async ({ page }) => {
  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto(story('bottom-bar-search'))
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
    await expect(bar(page)).toBeHidden()
    await expect(page.getByRole('button', { name: 'Search', exact: true })).toHaveCount(0)
  }
})

for (const theme of ['light', 'dark'] as const) {
  test(`zero axe violations, the bar and the palette open (${theme})`, async ({ page }) => {
    await openPhone(page, 'bottom-bar-search', { width: 360, theme })
    // A story's page has no <h1> of its own (the app's screens do).
    const axe = () =>
      new AxeBuilder({ page }).disableRules(['page-has-heading-one']).exclude('[data-base-ui-focus-guard]').analyze()
    expect((await axe()).violations).toEqual([])
    await search(page).click()
    await expect(palette(page).getByRole('option')).not.toHaveCount(0)
    await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))))
    expect((await axe()).violations).toEqual([])
    await page.keyboard.press('Escape')
    await expect(search(page)).toBeFocused()
    expect((await axe()).violations).toEqual([])
  })
}
