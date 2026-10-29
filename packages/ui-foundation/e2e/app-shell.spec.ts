import { expect, test, type Page } from '@playwright/test'

// AppShell's sidebar (app/AppShell stories), in a real browser: sections
// render as labelled groups inside the Primary nav, a flat nav keeps its one
// "Navigation" group, and one entry is current, the most specific match,
// even when its `to` opens a list on a saved view. The browser tab's title
// comes from the nav, and from a record's view inside the shell in either
// order (the rules themselves: tests/use-document-title.test.ts).
// Axe in both themes is e2e/storybook-visual.spec.ts's COMPOSITE_STORIES.
const story = (id: string) => `http://localhost:6006/iframe.html?id=app-appshell--${id}&viewMode=story`

async function open(page: Page, id: string) {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(story(id))
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary' })
const current = (page: Page) => nav(page).locator('a[aria-current="page"]')

test('sections: a labelled group per section, in order, inside the Primary nav', async ({ page }) => {
  await open(page, 'sections')
  const labels = nav(page).locator('[data-sidebar="group-label"]')
  await expect(labels).toHaveText(['Projects', 'Reading'])
  await expect(nav(page).getByText('Navigation', { exact: true })).toHaveCount(0)
  await expect(nav(page).getByRole('link')).toHaveText(['Home', 'Projects', 'Categories', 'Checklists', 'Books'])
})

test('sections: only the most specific entry is current', async ({ page }) => {
  await open(page, 'sections')
  await expect(current(page)).toHaveCount(1)
  await expect(current(page)).toHaveText('Categories')
  await expect(nav(page).getByRole('link', { name: 'Projects' })).not.toHaveAttribute('aria-current')
})

test('flat: one "Navigation" group, current on a page below its entry', async ({ page }) => {
  await open(page, 'flat')
  await expect(nav(page).locator('[data-sidebar="group-label"]')).toHaveText(['Navigation'])
  await expect(current(page)).toHaveCount(1)
  await expect(current(page)).toHaveText('Projects')
})

test('version: the short commit and PR in the footer, linking to the PR', async ({ page }) => {
  await open(page, 'version')
  const entry = nav(page).getByRole('link', { name: 'Version 3655449 · PR #139' })
  await expect(entry).toHaveAttribute('href', 'https://github.com/example/app/pull/139')
  await expect(entry).toHaveAttribute('target', '_blank')
})

test('flat: no version entry without a version', async ({ page }) => {
  await open(page, 'flat')
  await expect(nav(page).getByText(/^Version /)).toHaveCount(0)
})

test.describe('collapsible sections (#152)', () => {
  const section = (page: Page, label: string) => nav(page).getByRole('button', { name: label, exact: true })

  test('a collapsible label is a button that says whether its section is open, and controls it', async ({ page }) => {
    await open(page, 'collapsible')
    await expect(section(page, 'Media')).toHaveAttribute('aria-expanded', 'true')
    await expect(section(page, 'Reading')).toHaveAttribute('aria-expanded', 'false')
    const controlled = await section(page, 'Reading').getAttribute('aria-controls')
    await expect(page.locator(`[id="${controlled}"]`)).toBeHidden()
    await expect(nav(page).getByRole('link', { name: 'Books' })).toBeHidden()
    await expect(nav(page).getByRole('link', { name: 'Channels' })).toBeVisible()
  })

  test('a click folds and unfolds, and the choice is remembered after a reload', async ({ page }) => {
    await open(page, 'collapsible')
    await section(page, 'Media').click()
    await expect(section(page, 'Media')).toHaveAttribute('aria-expanded', 'false')
    await expect(nav(page).getByRole('link', { name: 'Channels' })).toBeHidden()
    await section(page, 'Reading').click()
    await expect(nav(page).getByRole('link', { name: 'Books' })).toBeVisible()

    await page.reload()
    await expect(section(page, 'Media')).toHaveAttribute('aria-expanded', 'false')
    await expect(section(page, 'Reading')).toHaveAttribute('aria-expanded', 'true')
  })

  test('Enter and Space toggle it, and focus stays on the label', async ({ page }) => {
    await open(page, 'collapsible')
    await section(page, 'Media').focus()
    await page.keyboard.press('Enter')
    await expect(section(page, 'Media')).toHaveAttribute('aria-expanded', 'false')
    await expect(section(page, 'Media')).toBeFocused()
    await page.keyboard.press('Space')
    await expect(section(page, 'Media')).toHaveAttribute('aria-expanded', 'true')
    await expect(section(page, 'Media')).toBeFocused()
  })

  test('the section holding the current page is open and does not fold', async ({ page }) => {
    await open(page, 'collapsible')
    // Even when this browser had folded it.
    await page.evaluate(() => window.localStorage.setItem('ui-foundation:nav-section:Projects', 'closed'))
    await page.reload()
    await expect(section(page, 'Projects')).toHaveAttribute('aria-expanded', 'true')
    await expect(section(page, 'Projects')).toHaveAttribute('aria-disabled', 'true')
    // Playwright won't click an aria-disabled button; Enter does the same.
    await section(page, 'Projects').focus()
    await page.keyboard.press('Enter')
    await expect(section(page, 'Projects')).toHaveAttribute('aria-expanded', 'true')
    await expect(current(page)).toBeVisible()
    await expect(current(page)).toHaveText('Categories')
  })

  test('arriving at a page inside a folded section unfolds it, and it stays unfolded', async ({ page }) => {
    await open(page, 'collapsible')
    await section(page, 'Media').click()
    expect(await page.evaluate(() => window.localStorage.getItem('ui-foundation:nav-section:Media'))).toBe('closed')
    // The same browser opens a page inside Media.
    await open(page, 'collapsible-in-media')
    await expect(section(page, 'Media')).toHaveAttribute('aria-expanded', 'true')
    await expect(current(page)).toHaveText('Channels')
    expect(await page.evaluate(() => window.localStorage.getItem('ui-foundation:nav-section:Media'))).toBe('open')
  })

  test('on the icon rail every section shows its items, folded or not, and no label takes a tab stop', async ({ page }) => {
    await open(page, 'collapsible-rail')
    await expect(nav(page).getByRole('link', { name: 'Books' })).toBeVisible()
    await expect(nav(page).getByRole('link', { name: 'Channels' })).toBeVisible()
    await expect(nav(page).getByRole('button', { name: 'Reading', exact: true })).toHaveCount(0)
  })
})

// #188: `to` carries a query string, the list's saved view.
test.describe('an entry opening a list on a saved view', () => {
  test('is current on its page and opens its folded section', async ({ page }) => {
    await open(page, 'saved-view')
    await expect(current(page)).toHaveCount(1)
    await expect(current(page)).toHaveText('Unread books')
    await expect(current(page)).toHaveAttribute('href', '/reading?status=unread&sort=title:asc')
    await expect(nav(page).getByRole('button', { name: 'Reading', exact: true })).toHaveAttribute('aria-expanded', 'true')
  })
})

// #186: "<page> · <app>" from the nav, the record's title from EntityView.
test.describe("the browser tab's title", () => {
  test("names the nav's page with the app", async ({ page }) => {
    await open(page, 'sections')
    await expect(page).toHaveTitle('Categories · Example')
  })

  test("is the app's title alone on the home entry", async ({ page }) => {
    await open(page, 'home')
    await expect(page).toHaveTitle('Example')
  })

  test('names a page under an entry whose `to` has a query string', async ({ page }) => {
    await open(page, 'saved-view')
    await expect(page).toHaveTitle('Unread books · Example')
  })

  test("a view's title set before the nav's still wins", async ({ page }) => {
    await open(page, 'with-view')
    await expect(page.getByRole('heading', { level: 1, name: 'Apollo' })).toBeVisible()
    await expect(page).toHaveTitle('Apollo · Example')
  })

  test("a view's title arriving after the nav's replaces it", async ({ page }) => {
    await open(page, 'with-loading-view')
    await expect(page.locator('[data-state="loading"]')).toBeVisible()
    await expect(page).toHaveTitle('Projects · Example')
    await page.getByRole('button', { name: 'Finish loading' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Apollo' })).toBeVisible()
    await expect(page).toHaveTitle('Apollo · Example')
  })

  test("leaving the view puts the nav's title back", async ({ page }) => {
    await open(page, 'with-view')
    await expect(page).toHaveTitle('Apollo · Example')
    await page.getByRole('main').getByRole('link', { name: 'Projects' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Apollo' })).toHaveCount(0)
    await expect(page).toHaveTitle('Projects · Example')
  })

  test("documentTitle names the record otherwise, and false leaves the nav's", async ({ page }) => {
    await open(page, 'with-view-document-title')
    await expect(page).toHaveTitle('Project Apollo · Example')
    await open(page, 'with-view-no-document-title')
    await expect(page.getByRole('heading', { level: 1, name: 'Apollo' })).toBeVisible()
    await expect(page).toHaveTitle('Projects · Example')
  })
})

test.describe("the app's logo (#211)", () => {
  const header = (page: Page) => nav(page).locator('[data-sidebar="header"]')

  test('sits before the title, decorative, centred on its line', async ({ page }) => {
    await open(page, 'with-logo')
    const logo = header(page).getByTestId('app-logo')
    const title = header(page).getByText('Example', { exact: true })
    await expect(logo).toBeVisible()
    await expect(logo).toHaveAttribute('aria-hidden', 'true')
    const [logoBox, titleBox] = [await logo.boundingBox(), await title.boundingBox()]
    expect(logoBox!.x + logoBox!.width).toBeLessThanOrEqual(titleBox!.x)
    expect(Math.abs(logoBox!.y + logoBox!.height / 2 - (titleBox!.y + titleBox!.height / 2))).toBeLessThanOrEqual(1)
  })

  test('on the icon rail it stays alone, centred over the nav icons', async ({ page }) => {
    await open(page, 'with-logo-rail')
    const logo = header(page).getByTestId('app-logo')
    await expect(logo).toBeVisible()
    await expect(header(page).getByText('Example', { exact: true })).toBeHidden()
    const logoBox = (await logo.boundingBox())!
    const iconBox = (await nav(page).getByRole('link', { name: 'Home' }).locator('svg').boundingBox())!
    expect(logoBox.width).toBeCloseTo(iconBox.width, 0)
    expect(Math.abs(logoBox.x + logoBox.width / 2 - (iconBox.x + iconBox.width / 2))).toBeLessThanOrEqual(1)
  })
})

// #239: a module's own pages under its entry.
test.describe('nested entries', () => {
  const entry = (page: Page, name: string) =>
    nav(page).locator('[data-sidebar="menu-item"]').filter({ has: page.getByRole('link', { name, exact: true }) }).first()

  test("on one of a module's pages: its pages are a list inside its entry, the page current, the tab named for it", async ({ page }) => {
    await open(page, 'nested')
    await expect(current(page)).toHaveText('Channels')
    await expect(nav(page).getByRole('link', { name: 'YouTube' })).not.toHaveAttribute('aria-current')
    const youtube = entry(page, 'YouTube')
    await expect(youtube.getByRole('list').getByRole('link')).toHaveText(['Channels', 'Playlists'])
    // Another module's pages wait until you're in it; an `open: 'always'` entry's never do.
    await expect(nav(page).getByRole('link', { name: 'Series' })).toBeHidden()
    await expect(nav(page).getByRole('link', { name: 'Accounts' })).toBeVisible()
    await expect(page).toHaveTitle('Channels · Example')
  })

  test("on the module's own page its pages show too; elsewhere they fold away", async ({ page }) => {
    await open(page, 'nested-on-parent')
    await expect(current(page)).toHaveText('YouTube')
    await expect(nav(page).getByRole('link', { name: 'Playlists' })).toBeVisible()
    await open(page, 'nested-elsewhere')
    await expect(nav(page).getByRole('link', { name: 'Channels' })).toBeHidden()
    await expect(nav(page).getByRole('link', { name: 'Series' })).toBeHidden()
  })

  test('on the icon rail: no child icons, the module looks current, its tooltip names its pages', async ({ page }) => {
    await open(page, 'nested-rail')
    await expect(nav(page).getByRole('link', { name: 'Channels' })).toBeHidden()
    const youtube = nav(page).getByRole('link', { name: 'YouTube' })
    await expect(youtube).toHaveAttribute('data-active', '')
    await expect(youtube).not.toHaveAttribute('aria-current')
    await youtube.hover()
    await expect(page.locator('[data-slot=tooltip-content][data-open]')).toHaveText('YouTube: Channels, Playlists')
  })
})
