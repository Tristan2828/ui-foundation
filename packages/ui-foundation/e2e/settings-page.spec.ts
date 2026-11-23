import { expect, test, type Locator, type Page } from '@playwright/test'

// A settings page (design-language.md "A settings page") in the shell: its
// groups as routes, the cards and rows, the palette's tiles and the table
// rows, and a framed table under a card. The story is on a hash router, so
// the address, Back and a reload are the browser's own. Axe and the token
// check are e2e/fixtures-visual.spec.ts's.
const story = (id: string, { palette = 'indigo-cyan', hash = '', density = '' } = {}) =>
  `http://localhost:6180/story.html?id=app-settingspage--${id}&theme=dark` +
  `${palette && `&palette=${palette}`}${density && `&density=${density}`}${hash && `#${hash}`}`

const html = (page: Page) => page.locator('html')
const groups = (page: Page) => page.getByRole('navigation', { name: 'Settings' })
const group = (page: Page, name: string) => groups(page).getByRole('link', { name })
const trail = (page: Page) => page.getByRole('navigation', { name: 'You are here' })
// The trail's own crumb; PageTrail also keeps a hidden copy to measure by.
const here = (page: Page) => trail(page).locator('[aria-current="page"]')
const address = (page: Page) => page.evaluate(() => window.location.hash)
const saved = (page: Page, key: string) => page.evaluate((name) => localStorage.getItem(`ui-foundation:${name}`), key)
const sideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const row = (page: Page, label: string) =>
  page.locator('[data-slot="settings-row"]').filter({ has: page.getByText(label, { exact: true }) })

async function box(locator: Locator) {
  const found = await locator.boundingBox()
  if (!found) throw new Error('no box')
  return found
}
const right = (b: { x: number; width: number }) => b.x + b.width
const bottom = (b: { y: number; height: number }) => b.y + b.height

async function open(page: Page, url: string) {
  await page.goto(url)
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
}

test.describe('on a laptop', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('the groups are down the side, the current one marked', async ({ page }) => {
    await open(page, story('default'))
    const links = groups(page).getByRole('link')
    await expect(links).toHaveText(['Look', 'Shortcuts and Buttons', 'Labels'])
    await expect(group(page, 'Look')).toHaveAttribute('aria-current', 'page')
    await expect(groups(page).locator('[aria-current]')).toHaveCount(1)

    const look = (locator: Locator) =>
      locator.evaluate((el) => ({ shadow: getComputedStyle(el).boxShadow, fill: getComputedStyle(el).backgroundColor }))
    const current = await look(group(page, 'Look'))
    const other = await look(group(page, 'Labels'))
    expect(current.shadow).toMatch(/3px 0px 0px 0px inset/)
    expect(other.shadow).not.toMatch(/3px 0px 0px 0px inset/)
    expect(current.fill).not.toBe(other.fill)
    expect(other.fill).toBe('rgba(0, 0, 0, 0)')

    // A column of links, 180px wide, with the card beside it.
    const [first, second] = [await box(links.nth(0)), await box(links.nth(1))]
    expect(second.y).toBeGreaterThanOrEqual(bottom(first))
    expect((await box(groups(page))).width).toBeCloseTo(180, 0)
    const card = await box(page.locator('[data-slot="settings-card"]'))
    expect(card.x).toBeGreaterThanOrEqual(right(await box(groups(page))))

    // The group is named by its link.
    await expect(page.getByRole('region', { name: 'Look' })).toBeVisible()
  })

  test('a click opens a group at its own address, Back returns, and a reload stays', async ({ page }) => {
    await open(page, story('default'))
    expect(await address(page)).toBe('#/settings')
    await group(page, 'Labels').click()
    expect(await address(page)).toBe('#/settings/labels')
    await expect(group(page, 'Labels')).toHaveAttribute('aria-current', 'page')
    await expect(group(page, 'Look')).not.toHaveAttribute('aria-current', /.*/)
    await expect(page.getByRole('region', { name: 'Labels' })).toBeVisible()
    await expect(page.getByText('Suggest Labels')).toBeVisible()
    await expect(page.getByText('Text Size')).toHaveCount(0)

    await page.reload()
    await expect(page.getByText('Suggest Labels')).toBeVisible()
    await expect(group(page, 'Labels')).toHaveAttribute('aria-current', 'page')

    await page.goBack()
    await expect(page.getByText('Text Size')).toBeVisible()
    expect(await address(page)).toBe('#/settings')
    await expect(group(page, 'Look')).toHaveAttribute('aria-current', 'page')
  })

  test('a deep link opens its group, and the keyboard goes between them', async ({ page }) => {
    await open(page, story('default', { hash: '/settings/shortcuts' }))
    await expect(page.getByText('Up to five, in this order.')).toBeVisible()
    await group(page, 'Shortcuts and Buttons').focus()
    await page.keyboard.press('Tab')
    await expect(group(page, 'Labels')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByText('Suggest Labels')).toBeVisible()
    expect(await address(page)).toBe('#/settings/labels')
  })

  test("the bar's trail names the group past the first", async ({ page }) => {
    await open(page, story('default'))
    await expect(here(page)).toHaveText('Settings')
    await expect(trail(page).locator('a:visible')).toHaveCount(0)
    await group(page, 'Labels').click()
    await expect(trail(page).getByRole('link', { name: 'Settings' })).toBeVisible()
    await expect(here(page)).toHaveText('Labels')
    await trail(page).getByRole('link', { name: 'Settings' }).click()
    await expect(page.getByText('Text Size')).toBeVisible()
    expect(await address(page)).toBe('#/settings')
    await expect(trail(page).locator('a:visible')).toHaveCount(0)
  })

  test('a page below a group keeps it current and puts up no trail of its own', async ({ page }) => {
    await open(page, story('default', { hash: '/settings/labels/2' }))
    await expect(group(page, 'Labels')).toHaveAttribute('aria-current', 'page')
    await expect(here(page)).toHaveText('Settings')
    await expect(trail(page).locator('a:visible')).toHaveCount(0)
  })

  test('a row has its words at the left and its control at the right; a below row has it under them', async ({ page }) => {
    await open(page, story('default'))
    const beside = row(page, 'Text Size')
    const words = await box(beside.getByText('Text Size', { exact: true }))
    const control = await box(beside.locator('[data-slot="settings-row-control"]'))
    const whole = await box(beside)
    expect(control.x).toBeGreaterThanOrEqual(right(words))
    expect(right(whole) - right(control)).toBeCloseTo(16, 0)
    expect(words.x - whole.x).toBeCloseTo(16, 0)

    const below = row(page, 'Palette')
    await expect(below).toHaveAttribute('data-layout', 'below')
    const tiles = await box(below.locator('[data-slot="settings-row-control"]'))
    const help = await box(below.getByText('For this browser only.'))
    expect(tiles.y).toBeGreaterThanOrEqual(bottom(help))
    expect(tiles.x).toBeCloseTo(whole.x + 16, 0)
  })

  test('the label and the help name the control', async ({ page }) => {
    await open(page, story('default'))
    const size = page.getByRole('group', { name: 'Text Size', exact: true })
    await expect(size).toHaveAccessibleDescription('Grows text, spacing and controls on every page. For this browser only.')
    await expect(page.getByRole('combobox', { name: 'Opens On' })).toHaveAccessibleDescription('The first page after you sign in.')
    await expect(page.getByRole('radiogroup', { name: 'Palette' })).toHaveAccessibleDescription('For this browser only.')
    // No help, so nothing to point at.
    const sounds = page.getByRole('switch', { name: 'Sounds' })
    await expect(sounds).not.toHaveAttribute('aria-describedby', /settings|:r|_r/)
    // `htmlFor`: a click on the words reaches the control.
    await expect(sounds).toBeChecked()
    await page.getByText('Sounds', { exact: true }).click()
    await expect(sounds).not.toBeChecked()
  })

  test('the tiles: four, each in its own palette, picked by the arrow keys, kept after a reload', async ({ page }) => {
    await open(page, story('default'))
    const tiles = page.getByRole('radiogroup', { name: 'Palette' })
    const radio = (name: string) => tiles.getByRole('radio', { name, exact: true })
    await expect(page.locator('[data-slot="palette-tile"]')).toHaveText([
      'Indigo and Cyan',
      'Indigo and Rose',
      'Graphite and Periwinkle',
      'Violet',
    ])
    await expect(radio('Indigo and Cyan')).toBeChecked()

    // Each preview is its palette's own colours, whichever is on screen.
    const painted = await page.locator('[data-slot="palette-tile"] > span[aria-hidden]').evaluateAll((previews) =>
      previews.map((preview) => {
        const [strip, body] = [...preview.children]
        return [preview, strip, ...strip.children, ...body.children].map((el) => getComputedStyle(el).backgroundColor)
      }),
    )
    const expected = await page.evaluate(() => {
      const probe = document.body.appendChild(document.createElement('span'))
      const colours = ['indigo-cyan', 'indigo-rose', 'graphite-periwinkle', 'violet'].map((name) =>
        ['background', 'panel', 'accent', 'dim', 'dim', 'dim', 'second', 'accent'].map((part) => {
          probe.style.backgroundColor = `var(--palette-${name}-${part})`
          return getComputedStyle(probe).backgroundColor
        }),
      )
      probe.remove()
      return colours
    })
    expect(painted).toEqual(expected)
    expect(new Set(painted.map(String)).size).toBe(4)

    // The radio itself isn't seen, only its tile.
    expect((await box(radio('Indigo and Cyan'))).width).toBeLessThanOrEqual(1)

    // One tab stop: Shift+Tab and Tab come back to the picked one.
    await radio('Indigo and Cyan').focus()
    const background = () => page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor)
    const before = await background()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(radio('Graphite and Periwinkle')).toBeChecked()
    await expect(radio('Graphite and Periwinkle')).toBeFocused()
    await expect(html(page)).toHaveAttribute('data-palette', 'graphite-periwinkle')
    expect(await background()).not.toBe(before)
    expect(await saved(page, 'palette')).toBe('graphite-periwinkle')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Compact' })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(radio('Graphite and Periwinkle')).toBeFocused()

    await page.reload()
    await expect(html(page)).toHaveAttribute('data-palette', 'graphite-periwinkle')
    await expect(radio('Graphite and Periwinkle')).toBeChecked()
  })

  test('the tiles: a click anywhere on one picks it, and its edge is thicker', async ({ page }) => {
    await open(page, story('default'))
    const violet = page.locator('[data-slot="palette-tile"]').filter({ hasText: 'Violet' })
    const edge = () => violet.evaluate((el) => getComputedStyle(el).boxShadow)
    const plain = await edge()
    await violet.locator('> span[aria-hidden]').click()
    await expect(html(page)).toHaveAttribute('data-palette', 'violet')
    await expect(violet.getByRole('radio')).toBeChecked()
    expect(await edge()).not.toBe(plain)
    expect(await edge()).toMatch(/0px 0px 0px 1px/)
    expect(await saved(page, 'palette')).toBe('violet')
  })

  test('the focused tile wears the focus ring', async ({ page }) => {
    await open(page, story('default'))
    await page.locator('[data-slot="palette-tile"]').first().getByRole('radio').focus()
    await page.keyboard.press('ArrowRight')
    const rose = page.locator('[data-slot="palette-tile"]').filter({ hasText: 'Indigo and Rose' })
    await expect.poll(() => rose.evaluate((el) => getComputedStyle(el).boxShadow)).toMatch(/0px 0px 0px 3px/)
  })

  test('the table rows: Compact or Regular, kept after a reload', async ({ page }) => {
    await open(page, story('default'))
    const rows = page.getByRole('group', { name: 'Table Rows' })
    await expect(rows.getByRole('button')).toHaveText(['Compact', 'Regular'])
    await expect(rows.getByRole('button', { name: 'Compact' })).toHaveAttribute('aria-pressed', 'true')
    await rows.getByRole('button', { name: 'Regular' }).click()
    await expect(html(page)).toHaveAttribute('data-rows', 'regular')
    expect(await saved(page, 'rows')).toBe('regular')
    // Pressing the picked one keeps it.
    await rows.getByRole('button', { name: 'Regular' }).click()
    await expect(html(page)).toHaveAttribute('data-rows', 'regular')
    // The palette is untouched.
    await expect(html(page)).toHaveAttribute('data-palette', 'indigo-cyan')

    await page.reload()
    await expect(html(page)).toHaveAttribute('data-rows', 'regular')
    await expect(rows.getByRole('button', { name: 'Regular' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('the header has no look menu, and the pickers stay on the page', async ({ page }) => {
    await open(page, story('default'))
    await expect(page.getByRole('button', { name: /^(Palette|Rows):/ })).toHaveCount(0)
  })

  test("without the pickers neither setting is drawn, and the card's other rows are", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ui-foundation:palette', 'violet')
      localStorage.setItem('ui-foundation:rows', 'regular')
    })
    await open(page, story('no-picker'))
    await expect(page.locator('[data-slot="settings-row"]')).toHaveCount(3)
    await expect(page.getByRole('radiogroup')).toHaveCount(0)
    await expect(page.getByText('Table Rows')).toHaveCount(0)
    await expect(html(page)).toHaveAttribute('data-palette', 'indigo-cyan')
    await expect(html(page)).not.toHaveAttribute('data-rows', /.*/)
  })

  test('a light palette offers no tiles', async ({ page }) => {
    await open(page, story('default', { palette: 'palm-lcd' }))
    await expect(html(page)).toHaveAttribute('data-palette', 'palm-lcd')
    await expect(page.getByRole('radiogroup')).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Table Rows' })).toBeVisible()
  })
})

test.describe('on a wide screen', () => {
  test.use({ viewport: { width: 1920, height: 1080 } })

  test('the card stops at 832px and a framed table under it is wider', async ({ page }) => {
    await open(page, story('with-table'))
    const card = await box(page.locator('[data-slot="settings-card"]'))
    const frame = await box(page.locator('[data-slot="data-table-frame"]'))
    expect(card.width).toBeCloseTo(832, 0)
    expect(frame.width).toBeGreaterThan(card.width)
    expect(frame.x).toBeCloseTo(card.x, 0)
    expect(frame.y).toBeGreaterThanOrEqual(bottom(card))
    expect(await sideways(page)).toBeLessThanOrEqual(0)
  })

  test('the card grows with the density', async ({ page }) => {
    await open(page, story('default', { density: 'large' }))
    const card = await box(page.locator('[data-slot="settings-card"]'))
    expect(card.width).toBeCloseTo(1040, 0)
  })
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

  for (const id of ['default', 'below-rows', 'with-table']) {
    test(`${id}: the groups wrap in a row above, and nothing scrolls the page sideways`, async ({ page }) => {
      await open(page, story(id))
      const links = groups(page).getByRole('link')
      const boxes = [await box(links.nth(0)), await box(links.nth(1)), await box(links.nth(2))]
      expect(boxes[1].y).toBeCloseTo(boxes[0].y, 0)
      for (const link of boxes) expect(link.height).toBeGreaterThanOrEqual(40)
      const card = await box(page.locator('[data-slot="settings-card"]'))
      expect(card.y).toBeGreaterThanOrEqual(bottom(await box(groups(page))))
      expect(await sideways(page)).toBeLessThanOrEqual(0)
      expect(right(card)).toBeLessThanOrEqual(375)
    })
  }

  test('a control that does not fit drops under its words, at the start', async ({ page }) => {
    await open(page, story('default'))
    const size = row(page, 'Text Size')
    const words = await box(size.getByText('Text Size', { exact: true }))
    const control = await box(size.locator('[data-slot="settings-row-control"]'))
    expect(control.y).toBeGreaterThanOrEqual(bottom(words))
    expect(control.x).toBeCloseTo(words.x, 0)
    expect(right(control)).toBeLessThanOrEqual(375)
  })

  test("past the first group the header's back arrow goes to it", async ({ page }) => {
    await open(page, story('default'))
    await expect(page.locator('[data-slot="app-shell-back"]')).toHaveCount(0)
    await group(page, 'Labels').click()
    await page.getByRole('link', { name: 'Back to Settings' }).click()
    await expect(page.getByText('Text Size')).toBeVisible()
    expect(await address(page)).toBe('#/settings')
  })

  test('the table scrolls inside itself', async ({ page }) => {
    await open(page, story('with-table'))
    const container = page.locator('[data-slot="table-container"]')
    expect(await container.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeGreaterThan(0)
    // It scrolls, and only it: the frame stays inside the window.
    expect(await container.evaluate((el) => ((el.scrollLeft = 40), el.scrollLeft))).toBeGreaterThan(0)
    expect(right(await box(page.locator('[data-slot="data-table-frame"]')))).toBeLessThanOrEqual(375)
    expect(await sideways(page)).toBeLessThanOrEqual(0)
  })
})

// By the box's width, not the window's: at a window wide enough for the
// groups' column, the sidebar leaves the page too little for it.
test('the groups wrap by the width the page has, not the window’s', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 })
  await open(page, story('default'))
  const links = groups(page).getByRole('link')
  expect((await box(links.nth(1))).y).toBeCloseTo((await box(links.nth(0))).y, 0)
  await page.setViewportSize({ width: 1100, height: 800 })
  await expect.poll(async () => (await box(links.nth(1))).y > (await box(links.nth(0))).y).toBe(true)
})
