import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// DataTable's Group menu (`groupings`) and detail panel (`detailPanel`),
// app/DataTable grouping stories, in a real browser: None by default, a
// pick grouping the rows (the grouped column hidden), a multi-value row
// under each value, folding one heading and all of them, the pick in the
// URL, remembered and set by a saved view; then the panel: a click, Enter,
// ↑/↓, Escape and Close, a title link picking instead of leaving, and the
// phone's bottom sheet. Axe on the stories at rest is
// e2e/fixtures-visual.spec.ts's; the open panel and a folded heading are
// checked here, in both themes.
const story = (id: string, query = '', theme: 'light' | 'dark' = 'light') =>
  `http://localhost:6180/story.html?id=app-datatable-grouping--${id}&theme=${theme}${query}`

const groupMenu = (page: Page) => page.locator('[data-slot="data-table-group-menu"]')
const headings = (page: Page) => page.locator('[data-slot="table-group-heading"] button[aria-expanded]')
const row = (page: Page, title: string) => page.getByRole('row', { name: new RegExp(title) })

async function groupBy(page: Page, label: string) {
  await groupMenu(page).click()
  await page.getByRole('menuitemradio', { name: label }).click()
}

function analyze(page: Page) {
  return new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
}

test.describe('DataTable groupings', () => {
  test('None by default; Status groups in its order, hides its column, and None undoes it', async ({ page }) => {
    await page.goto(story('chores'))
    await expect(groupMenu(page)).toHaveText('Group')
    await expect(headings(page)).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Fold All' })).toHaveCount(0)

    await groupBy(page, 'Status')
    await expect(groupMenu(page)).toHaveText('Group: Status')
    await expect(headings(page)).toHaveText([/To do\s*5/, /Doing\s*2/, /Done\s*1/])
    await expect(page.locator('[data-slot="table-group-heading"]').first()).toContainText('2 quick · 2 h 25 m')
    await expect(page.getByRole('columnheader', { name: 'Status' })).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: 'Area' })).toBeVisible()

    await groupBy(page, 'None')
    await expect(headings(page)).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
  })

  test('a multi-value field shows a row under each of its values, and none under "No area"', async ({ page }) => {
    await page.goto(story('chores-by-area'))
    await expect(headings(page)).toHaveText([/Kitchen\s*2/, /Garden\s*3/, /Garage\s*2/, /Hall\s*2/, /No area\s*1/])
    await expect(page.getByRole('row', { name: /Wash the bins/ })).toHaveCount(2)
    await expect(page.getByRole('columnheader', { name: 'Area' })).toHaveCount(0)
  })

  test('a heading folds its rows; Fold all folds every one, and Unfold all opens them', async ({ page }) => {
    await page.goto(story('chores-by-area'))
    const kitchen = headings(page).filter({ hasText: 'Kitchen' })
    await expect(kitchen).toHaveAttribute('aria-expanded', 'true')
    await kitchen.click()
    await expect(kitchen).toHaveAttribute('aria-expanded', 'false')
    await expect(row(page, 'Descale the kettle')).toHaveCount(0)
    await expect(row(page, 'Rake the leaves')).toBeVisible()
    // The keyboard: it's a button.
    await kitchen.focus()
    await page.keyboard.press('Enter')
    await expect(kitchen).toHaveAttribute('aria-expanded', 'true')

    await page.getByRole('button', { name: 'Fold All' }).click()
    for (const heading of await headings(page).all()) await expect(heading).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('tbody tr[data-slot="table-row"]')).toHaveCount(0)
    await page.getByRole('button', { name: 'Unfold All' }).click()
    await expect(row(page, 'Descale the kettle')).toBeVisible()
  })

  test('the pick is remembered for the table, and a saved view can set it', async ({ page }) => {
    await page.goto(story('chores'))
    await groupBy(page, 'Ready')
    await expect(headings(page)).toHaveText([/Ready now\s*6/, /Not yet\s*2/])
    await page.goto(story('chores'))
    await expect(groupMenu(page)).toHaveText('Group: Ready')

    // By status turns on Status; All names no grouping, so it stays.
    await page.getByRole('button', { name: 'By Status' }).click()
    await expect(groupMenu(page)).toHaveText('Group: Status')
    await page.getByRole('button', { name: 'All', exact: true }).click()
    await expect(groupMenu(page)).toHaveText('Group: Status')
  })

  test('folded headings have zero axe violations in both themes', async ({ page }) => {
    for (const theme of ['light', 'dark'] as const) {
      await page.goto(story('chores-by-area', '', theme))
      await headings(page).filter({ hasText: 'Garden' }).click()
      await headings(page).filter({ hasText: 'Garage' }).focus()
      expect((await analyze(page)).violations).toEqual([])
    }
  })
})

test.describe('DataTable detail panel', () => {
  const panel = (page: Page) => page.getByRole('complementary', { name: 'Chore' })

  test('a click opens the panel beside the list and marks the row; Close closes it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('chores-with-panel'))
    await expect(panel(page)).toHaveCount(0)
    await row(page, 'Rake the leaves').getByRole('cell', { name: 'Garden' }).click()
    await expect(panel(page)).toContainText('Front lawn first, then the path.')
    await expect(row(page, 'Rake the leaves')).toHaveAttribute('aria-selected', 'true')
    await expect(row(page, 'Descale the kettle')).toHaveAttribute('aria-selected', 'false')
    // Beside the list, not under it.
    const tableBox = await page.getByRole('table').boundingBox()
    const panelBox = await panel(page).boundingBox()
    expect(panelBox!.x).toBeGreaterThan(tableBox!.x + tableBox!.width - 1)

    await panel(page).getByRole('button', { name: 'Close' }).click()
    await expect(panel(page)).toHaveCount(0)
    await expect(row(page, 'Rake the leaves')).toBeFocused()
  })

  test("a title link picks the row instead of leaving; the panel's Open page link leaves", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('chores-with-panel'))
    await page.getByRole('link', { name: 'Oil the hinges' }).click()
    await expect(panel(page)).toContainText('Back door still squeaks a little.')
    await panel(page).getByRole('link', { name: 'Open Page' }).click()
    await expect(page.getByText("A chore's page")).toBeVisible()
  })

  test('↑/↓ move the pick while the list has focus; Escape closes; Enter on a row opens it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('chores-with-panel'))
    await row(page, 'Descale the kettle').getByRole('cell', { name: 'Kitchen' }).click()
    await page.keyboard.press('ArrowDown')
    await expect(row(page, 'Rake the leaves')).toHaveAttribute('aria-selected', 'true')
    await expect(row(page, 'Rake the leaves')).toBeFocused()
    await expect(panel(page)).toContainText('Front lawn first')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowUp')
    await expect(panel(page)).toContainText('Front lawn first')
    await page.keyboard.press('Escape')
    await expect(panel(page)).toHaveCount(0)
    await expect(row(page, 'Rake the leaves')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(panel(page)).toContainText('Front lawn first')
  })

  test('under a multi-value grouping, ↓ walks each place a row is shown', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('chores-with-panel'))
    await groupBy(page, 'Area')
    await row(page, 'Rake the leaves').getByRole('cell', { name: '40 m' }).click()
    // Garden: leaves, bins, gutters; then Garage: the tool wall, bins again.
    for (let step = 0; step < 4; step++) await page.keyboard.press('ArrowDown')
    const bins = page.getByRole('row', { name: /Wash the bins/ })
    await expect(bins.nth(1)).toHaveAttribute('aria-selected', 'true')
    await expect(bins.nth(0)).toHaveAttribute('aria-selected', 'false')
  })

  test('on a phone the panel is a bottom sheet, closed by Escape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(story('chores-with-panel'))
    await row(page, 'Rake the leaves').getByRole('cell', { name: 'Garden' }).click()
    const sheet = page.getByRole('dialog', { name: 'Chore' })
    await expect(sheet).toContainText('Front lawn first, then the path.')
    await expect(panel(page)).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
  })

  test('the open panel and the picked row have zero axe violations in both themes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    for (const theme of ['light', 'dark'] as const) {
      await page.goto(story('chores-with-panel', '', theme))
      await row(page, 'Rake the leaves').getByRole('cell', { name: 'Garden' }).click()
      await expect(panel(page)).toBeVisible()
      expect((await analyze(page)).violations).toEqual([])
    }
  })

  test('muted text in the picked row clears 4.5:1 in both themes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    for (const theme of ['light', 'dark'] as const) {
      await page.goto(story('chores-with-panel', '', theme))
      // "Find the spare keys" has no area: a muted "No area" cell.
      await row(page, 'Find the spare keys').getByRole('cell', { name: '10 m' }).click()
      await expect(panel(page)).toBeVisible()
      const picked = page.locator('tbody tr[aria-selected="true"]')
      await expect(picked.getByText('No area')).toBeVisible()
      const results = await new AxeBuilder({ page }).include('tbody tr[aria-selected="true"]').withRules(['color-contrast']).analyze()
      expect(results.passes.find((rule) => rule.id === 'color-contrast')?.nodes.length).toBeGreaterThan(0)
      expect(results.violations).toEqual([])
    }
  })
})

test.describe('DataTable row click and a controlled panel', () => {
  const panel = (page: Page) => page.getByRole('complementary', { name: 'Chore' })

  test('a row click runs onRowClick; the panel opens from a control in the row', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('chores-with-quick-look'))
    await page.getByRole('button', { name: 'Quick look: Rake the leaves' }).click()
    await expect(panel(page)).toContainText('Front lawn first, then the path.')
    await expect(row(page, 'Rake the leaves')).toHaveAttribute('aria-selected', 'true')
    await panel(page).getByRole('button', { name: 'Close' }).click()
    await expect(panel(page)).toHaveCount(0)

    await row(page, 'Rake the leaves').getByRole('cell', { name: 'Garden' }).click()
    await expect(page.getByText("A chore's page")).toBeVisible()
  })

  test('a title link keeps its own navigation, and Status headings lead with an icon', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('chores-with-quick-look'))
    await expect(page.locator('[data-slot="table-group-heading"] svg').first()).toBeVisible()
    await page.getByRole('link', { name: 'Oil the hinges' }).click()
    await expect(page.getByText("A chore's page")).toBeVisible()
  })
})

// `stickyGroupHeadings`, app/DataTable's Sticky groups stories, read from the
// real layout: which cell is on top where the pinned bands sit, at every
// density, at a desktop's width and a phone's.
test.describe('DataTable stickyGroupHeadings', () => {
  const stickyStory = (id: string, density?: string) =>
    `http://localhost:6180/story.html?id=app-datatable--${id}&theme=light${density ? `&density=${density}` : ''}`

  // Scrolls so the group's sixth row is at the top of whatever scrolls, then
  // reports where the pinned bands are, and what's on top at the heading.
  const measure = (page: Page, day: string, sixthRow: string) =>
    page.evaluate(
      async ({ day, sixthRow }) => {
        const rowOf = [...document.querySelectorAll('tbody tr')].find((row) => row.textContent?.includes(sixthRow))!
        rowOf.scrollIntoView({ block: 'start' })
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const container = document.querySelector('[data-slot="table-container"]') as HTMLElement
        const ownScroll = container.scrollHeight > container.clientHeight
        const headingOf = (text: string) =>
          [...document.querySelectorAll('[data-slot="table-group-heading"] th')].find((cell) =>
            cell.textContent?.includes(text),
          ) as HTMLElement
        const heading = headingOf(day).getBoundingClientRect()
        const head = document.querySelector('thead th')!.getBoundingClientRect()
        const hit = document.elementFromPoint(heading.x + 40, heading.y + heading.height / 2)
        return {
          top: ownScroll ? container.getBoundingClientRect().top : 0,
          headTop: head.top,
          headBottom: head.bottom,
          headingTop: heading.top,
          headingBottom: heading.bottom,
          onTop: hit?.closest('[data-slot="table-group-heading"]')?.textContent ?? '',
          ownScroll,
          overflowX: getComputedStyle(container).overflowX,
          pageScrollsSideways: document.documentElement.scrollWidth > window.innerWidth + 1,
        }
      },
      { day, sixthRow },
    )

  for (const viewport of [
    { name: 'a desktop', width: 1280, height: 600 },
    { name: 'a phone', width: 390, height: 600 },
  ]) {
    test.describe(`at ${viewport.name}'s width`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } })

      for (const density of [undefined, 'compact', 'comfortable', 'large']) {
        test(`the heading pins under the column header on the page's scroll (${density ?? 'default'})`, async ({ page }) => {
          await page.goto(stickyStory('sticky-groups', density))
          await expect(page.getByText('Thursday')).toBeVisible()
          // Tuesday's rows are 13 to 24.
          const at = await measure(page, 'Tuesday', 'Entry 18')
          // At large on a phone these four columns no longer fit, so the
          // table takes its own box there.
          const overflows = viewport.width < 768 && density === 'large'
          expect(at.ownScroll).toBe(overflows)
          expect(at.overflowX).toBe(overflows ? 'auto' : 'clip')
          expect(at.headTop).toBeCloseTo(at.top, 0)
          expect(at.headingTop).toBeCloseTo(at.headBottom, 0)
          // Tuesday's has slid over Monday's, which is still there beneath it.
          expect(at.onTop).toContain('Tuesday')
          expect(at.pageScrollsSideways).toBe(false)
        })
      }

      test('with no header row the heading pins at the very top', async ({ page }) => {
        await page.goto(stickyStory('sticky-groups-no-header'))
        await expect(page.getByText('Thursday')).toBeVisible()
        const at = await measure(page, 'Wednesday', 'Entry 30')
        expect(at.headingTop).toBeCloseTo(0, 0)
        expect(at.onTop).toContain('Wednesday')
      })

      for (const density of [undefined, 'large']) {
        test(`a table wider than its box scrolls in a box of its own, and pins inside it (${density ?? 'default'})`, async ({ page }) => {
          await page.goto(stickyStory('sticky-groups-wide', density))
          await expect(page.getByText('Thursday')).toBeVisible()
          const at = await measure(page, 'Tuesday', 'Entry 18')
          expect(at.ownScroll).toBe(true)
          expect(at.overflowX).toBe('auto')
          expect(at.headTop).toBeCloseTo(at.top, 0)
          expect(at.headingTop).toBeCloseTo(at.headBottom, 0)
          expect(at.onTop).toContain('Tuesday')
          expect(at.pageScrollsSideways).toBe(false)
          const box = await page.locator('[data-slot="table-container"]').boundingBox()
          expect(box!.height).toBeLessThanOrEqual(viewport.height)

          // Sideways too: the label stays in view, over the pinned column.
          await page.locator('[data-slot="table-container"]').evaluate((element) => {
            element.scrollLeft = 300
          })
          const label = page.locator('[data-slot="table-group-heading"]').filter({ hasText: 'Tuesday' }).getByText('Tuesday')
          const labelBox = await label.boundingBox()
          expect(labelBox!.x).toBeGreaterThanOrEqual(0)
          expect(labelBox!.x).toBeLessThan(viewport.width / 2)
        })
      }

      // `stickyTop`: the page pins a bar of its own (3.5rem on a phone, 3rem
      // from md), and the bands sit below it, never under it.
      test('below a bar the page pins, the bands sit under the bar', async ({ page }) => {
        await page.goto(stickyStory('sticky-groups-below-a-bar'))
        await expect(page.getByText('Thursday')).toBeVisible()
        await page.evaluate(() => {
          const row = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent?.includes('Entry 18'))!
          // At the top of the screen, under the bar: Tuesday's heading has
          // scrolled up to where it pins.
          row.scrollIntoView({ block: 'start' })
        })
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        const bar = (await page.getByTestId('page-bar').boundingBox())!
        expect(bar.y).toBeCloseTo(0, 0)
        expect(bar.height).toBeCloseTo(viewport.width < 768 ? 56 : 48, 0)
        const head = (await page.locator('thead th').first().boundingBox())!
        expect(head.y).toBeCloseTo(bar.y + bar.height, 0)
        const heading = page.locator('[data-slot="table-group-heading"]').filter({ hasText: 'Tuesday' }).locator('th')
        const headingBox = (await heading.boundingBox())!
        expect(headingBox.y).toBeCloseTo(head.y + head.height, 0)
        // What's on top just under the bar is the column header, not a row.
        const onTop = await page.evaluate((y) => document.elementFromPoint(60, y)?.closest('thead, [data-slot="table-group-heading"]')?.tagName ?? '', bar.height + 4)
        expect(onTop).toBe('THEAD')
      })

      test('below a bar, a table wider than its box fits its box under the bar', async ({ page }) => {
        await page.goto(stickyStory('sticky-groups-wide-below-a-bar'))
        await expect(page.getByText('Thursday')).toBeVisible()
        const bar = (await page.getByTestId('page-bar').boundingBox())!
        const box = page.locator('[data-slot="table-container"]')
        expect((await box.boundingBox())!.height).toBeLessThanOrEqual(viewport.height - bar.height + 0.5)
        // Scrolled to below the bar, then inside: the bands pin to the box's
        // top, not the bar's offset again.
        const at = await page.evaluate(async (barHeight) => {
          const row = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent?.includes('Entry 18'))!
          row.scrollIntoView({ block: 'start' })
          window.scrollBy(0, -barHeight)
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
          const container = document.querySelector('[data-slot="table-container"]') as HTMLElement
          const heading = [...document.querySelectorAll('[data-slot="table-group-heading"] th')].find((cell) => cell.textContent?.includes('Tuesday'))!.getBoundingClientRect()
          const head = document.querySelector('thead th')!.getBoundingClientRect()
          const hit = document.elementFromPoint(heading.x + 40, heading.y + heading.height / 2)
          return {
            boxTop: container.getBoundingClientRect().top,
            ownScroll: container.scrollHeight > container.clientHeight,
            headTop: head.top,
            headBottom: head.bottom,
            headingTop: heading.top,
            onTop: hit?.closest('[data-slot="table-group-heading"]')?.textContent ?? '',
            pageScrollsSideways: document.documentElement.scrollWidth > window.innerWidth + 1,
          }
        }, bar.height)
        expect(at.ownScroll).toBe(true)
        expect(at.boxTop).toBeCloseTo(bar.height, 0)
        expect(at.headTop).toBeCloseTo(at.boxTop, 0)
        expect(at.headingTop).toBeCloseTo(at.headBottom, 0)
        expect(at.onTop).toContain('Tuesday')
        expect(at.pageScrollsSideways).toBe(false)
      })

      test('below a bar, focus moved to a row clears the bar and the pinned bands', async ({ page }) => {
        await page.goto(stickyStory('sticky-groups-below-a-bar'))
        await expect(page.getByText('Thursday')).toBeVisible()
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        const button = page.getByRole('button', { name: 'Open Entry 18', exact: true })
        await button.focus()
        const bar = (await page.getByTestId('page-bar').boundingBox())!
        const head = (await page.locator('thead th').first().boundingBox())!
        const box = (await button.boundingBox())!
        expect(box.y).toBeGreaterThanOrEqual(bar.y + bar.height + head.height + 20)
      })

      test('focus moved to a row clears the pinned bands', async ({ page }) => {
        await page.goto(stickyStory('sticky-groups'))
        await expect(page.getByText('Thursday')).toBeVisible()
        const at = await measure(page, 'Tuesday', 'Entry 18')
        const button = page.getByRole('button', { name: 'Open Entry 18', exact: true })
        await button.focus()
        const box = await button.boundingBox()
        expect(box!.y).toBeGreaterThanOrEqual(at.headingBottom - 1)
      })
    })
  }

  test('a table that does not ask scrolls as before', async ({ page }) => {
    await page.goto(`http://localhost:6180/story.html?id=app-datatable--grouped&theme=light`)
    await expect(page.getByText('Earlier This Week')).toBeVisible()
    expect(await page.locator('[data-slot="table-container"]').evaluate((element) => getComputedStyle(element).overflowX)).toBe('auto')
    expect(await page.locator('[data-slot="table-group-heading"] th').first().evaluate((element) => getComputedStyle(element).position)).toBe('static')
  })
})
