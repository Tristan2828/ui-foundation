import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { expectDataViewsLoaded } from '../src/testing'

// DataTable's opt-ins for a small entity (app/DataTable stories), in a
// real browser: `width="content"` (issue #104), editing in its rows
// with InlineCreate (issue #105), and rows grouped under headings with a
// PillFilter and no header row (issue #135). Axe and the token check on the stories
// at rest, in both themes, are e2e/storybook-visual.spec.ts's
// COMPOSITE_STORIES; a cell open is checked here.
const story = (id: string, theme: 'light' | 'dark' = 'light') =>
  `http://localhost:6006/iframe.html?id=app-datatable--${id}&viewMode=story&globals=theme:${theme}`

const table = (page: Page) => page.locator('[data-width="content"]')
const width = async (page: Page) => (await table(page).boundingBox())!.width
const areaWidth = async (page: Page) => (await table(page).locator('..').boundingBox())!.width

test.describe('DataTable width="content"', () => {
  test('on a wide screen, a few short columns take the width they need (at least 36rem), actions beside them', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 900 })
    await page.goto(story('content-width'))
    await expect(page.getByRole('cell', { name: 'Finance', exact: true })).toBeVisible()
    const tableWidth = await width(page)
    expect(tableWidth).toBeGreaterThanOrEqual(576)
    expect(tableWidth).toBeLessThan(1000)
    // Every column whole: the table fits, nothing scrolls under the pinned columns.
    const overflow = await table(page)
      .locator('[data-slot="table-container"]')
      .evaluate((container) => container.scrollWidth - container.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    // The row's Delete sits at the table's right edge, not the page's.
    const area = (await table(page).boundingBox())!
    const remove = (await page.getByRole('button', { name: 'Delete Work' }).boundingBox())!
    expect(remove.x + remove.width).toBeLessThanOrEqual(area.x + area.width)
    // The pagination lines up with it.
    const next = (await page.getByRole('button', { name: 'Next page' }).boundingBox())!
    expect(next.x + next.width).toBeLessThanOrEqual(area.x + area.width + 1)
  })

  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 393, height: 852 },
  ]) {
    test(`at ${viewport.width}px nothing changes: the whole width, as today`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto(story('content-width'))
      await expect(page.getByRole('cell', { name: 'Finance', exact: true })).toBeVisible()
      expect(Math.abs((await width(page)) - (await areaWidth(page)))).toBeLessThanOrEqual(1)
    })
  }

  test('loading, empty and error keep the width it had loaded', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 900 })
    await page.goto(story('content-width'))
    await expect(page.getByRole('cell', { name: 'Finance', exact: true })).toBeVisible()
    const loaded = await width(page)
    // Wider than the 36rem minimum, so it's the kept width being measured.
    expect(loaded).toBeGreaterThan(620)
    for (const state of ['loading', 'empty', 'error', 'loaded']) {
      await page.getByRole('group', { name: 'State' }).getByRole('button', { name: state }).click()
      await expect(table(page).locator(`[data-state]`).first()).toBeVisible()
      expect(Math.abs((await width(page)) - loaded), state).toBeLessThanOrEqual(1)
    }
  })
})

test.describe('DataTable, editing in its rows', () => {
  const open = async (page: Page) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('edit-in-the-rows'))
    await expect(page.getByRole('button', { name: 'Edit Name of Finance' })).toBeVisible()
  }
  const row = (page: Page, name: string) => page.getByRole('row').filter({ has: page.getByRole('button', { name: `Edit Name of ${name}` }) })

  test("from the keyboard: Enter on a cell's pencil edits it, Enter saves, the caret comes back", async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Edit Name of Work' }).focus()
    await page.keyboard.press('Enter')
    const name = page.getByRole('textbox', { name: 'Name of Work' })
    await expect(name).toBeFocused()
    await name.fill('Workshop')
    await page.keyboard.press('Enter')
    await expect(page.getByText('Saving…')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit Name of Workshop' })).toBeFocused()
    await expect(row(page, 'Workshop')).toContainText('Green')
  })

  test('a choice cell: its list opens with it, and a pick saves', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Edit Colour of Home' }).click()
    await page.getByRole('option', { name: 'Purple' }).click()
    await expect(row(page, 'Home')).toContainText('Purple')
  })

  test("a refusal stays open in its cell with what was typed and the server's reason; Esc gives up", async ({ page }) => {
    await open(page)
    await row(page, 'Finance').getByText('Finance').click()
    const name = page.getByRole('textbox', { name: 'Name of Finance' })
    await name.fill('Home')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('row').filter({ has: name }).getByRole('alert')).toHaveText('A category with this name already exists')
    await expect(name).toHaveValue('Home')
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Edit Name of Finance' })).toBeFocused()
  })

  test('one cell at a time: opening another saves the open one first', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Edit Name of Travel' }).click()
    await page.getByRole('textbox', { name: 'Name of Travel' }).fill('Trips')
    await page.getByRole('button', { name: 'Edit Colour of Home' }).click()
    await expect(page.getByRole('button', { name: 'Edit Name of Trips' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Purple' })).toBeVisible()
  })

  test('leaving the page with a cell half typed asks first', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Edit Name of Health' }).click()
    await page.getByRole('textbox', { name: 'Name of Health' }).fill('Half typed')
    await page.getByRole('link', { name: 'Elsewhere' }).click()
    await expect(page.getByRole('dialog', { name: 'Discard your changes?' })).toBeVisible()
    await page.getByRole('button', { name: 'Discard' }).click()
    await expect(page.getByText('Somewhere else.')).toBeVisible()
  })

  test('InlineCreate: Enter adds a row and keeps the caret; a blank or taken name says why', async ({ page }) => {
    await open(page)
    const box = page.getByRole('textbox', { name: "New category's name" })
    await box.fill('Garden')
    await page.keyboard.press('Enter')
    await expect(row(page, 'Garden')).toBeVisible()
    await expect(box).toHaveValue('')
    await expect(box).toBeFocused()
    await expect(page.getByRole('status').filter({ hasText: 'Added Garden' })).toBeAttached()

    await page.keyboard.press('Enter')
    await expect(page.getByRole('alert')).toHaveText('Give the category a name')
    await box.fill('Home')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('alert')).toHaveText('A category with this name already exists')
    await expect(box).toHaveValue('Home')
    await expect(box).toHaveAccessibleDescription('A category with this name already exists')
    await expect(page.getByRole('row')).toHaveCount(7)
  })

  test('a link cell: a link out at rest, the not-set label when empty, and a click on the link follows it', async ({
    page,
  }) => {
    await open(page)
    const link = row(page, 'Home').getByRole('link', { name: 'example.com/home (opens in a new tab)' })
    await expect(link).toHaveAttribute('href', 'https://example.com/home')
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(row(page, 'Finance')).toContainText('No website')
    // Following the link doesn't open the cell.
    const popup = page.waitForEvent('popup')
    await link.click()
    await (await popup).close()
    await expect(page.getByRole('textbox', { name: 'Website of Home' })).toHaveCount(0)
  })

  test('a link cell: a bare address gains https, another scheme or a space is refused, a blank clears it', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Edit Website of Finance' }).click()
    const box = page.getByRole('textbox', { name: 'Website of Finance' })
    await box.fill('javascript:alert(1)')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('row').filter({ has: box }).getByRole('alert')).toHaveText('Use a web or email address')
    // Two words are not an address: never saved as https://finance wiki (#177).
    await box.fill('finance wiki')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('row').filter({ has: box }).getByRole('alert')).toHaveText('An address has no spaces')
    await box.fill('finance.example.org')
    await page.keyboard.press('Enter')
    await expect(row(page, 'Finance').getByRole('link', { name: /finance\.example\.org/ })).toHaveAttribute(
      'href',
      'https://finance.example.org',
    )

    await page.getByRole('button', { name: 'Edit Website of Home' }).click()
    await page.getByRole('textbox', { name: 'Website of Home' }).fill('   ')
    await page.keyboard.press('Enter')
    await expect(row(page, 'Home')).toContainText('No website')
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`axe: a cell open, and refused (${theme})`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto(story('edit-in-the-rows', theme))
      await page.getByRole('button', { name: 'Edit Name of Finance' }).click()
      await page.getByRole('textbox', { name: 'Name of Finance' }).fill('Home')
      const analyze = () => new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
      expect((await analyze()).violations).toEqual([])
      await page.keyboard.press('Enter')
      await expect(page.getByRole('alert')).toBeVisible()
      expect((await analyze()).violations).toEqual([])
    })
  }
})

test.describe('DataTable, rows grouped under headings, with a pill filter', () => {
  const headings = (page: Page) => page.locator('[data-slot="table-group-heading"] th')
  const pill = (page: Page, name: string) => page.getByRole('group', { name: 'Type' }).getByRole('button', { name })

  test('a heading row starts each day, spanning the row, with its summary', async ({ page }) => {
    await page.goto(story('grouped'))
    await expect(headings(page)).toHaveText(['Today2 · 1 h', 'Yesterday2 · 42 m', 'Earlier this week2 · 1 h 4 m'])
    const first = headings(page).first()
    await expect(first).toHaveAttribute('scope', 'rowgroup')
    await expect(first).toHaveAttribute('colspan', '2')
    // Each group's rows are in its own body, after its heading.
    await expect(page.locator('[data-slot="table-group"]').first().getByRole('cell', { name: /^Morning briefing/ })).toBeVisible()
  })

  test('a group split across pages repeats its heading on the next', async ({ page }) => {
    await page.goto(story('grouped'))
    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(headings(page)).toHaveText([
      'Earlier this week1 · 7 m',
      'Week of 5 Oct2 · 1 h 25 m',
      /^Week of 28 Sept?1 · 16 m$/,
      'August1 · 33 m',
    ])
  })

  test('header={false}: no header row on screen, but every column keeps its name, and nothing hidden takes focus', async ({ page }) => {
    await page.goto(story('grouped'))
    await expect(page.getByRole('columnheader', { name: 'Item' })).toBeAttached()
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeAttached()
    const head = (await page.locator('[data-slot="table-header"]').boundingBox())!
    expect(head.height).toBeLessThanOrEqual(1)
    await expect(page.locator('[data-slot="table-header"] button')).toHaveCount(0)
  })

  test('one pill pressed at a time; pressing it again leaves it on; the filter returns to page 1', async ({ page }) => {
    await page.goto(story('grouped'))
    await expect(pill(page, 'All')).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Next page' }).click()
    await pill(page, 'Video').click()
    await expect(pill(page, 'Video')).toHaveAttribute('aria-pressed', 'true')
    await expect(pill(page, 'All')).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByText('1–6 of 6')).toBeVisible()
    await expect(page.getByRole('cell', { name: /Audio ·/ })).toHaveCount(0)
    await pill(page, 'Video').click()
    // Proving nothing changes needs a moment for a change to have shown.
    await page.waitForTimeout(300)
    await expect(pill(page, 'Video')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('1–6 of 6')).toBeVisible()
    await pill(page, 'All').click()
    await expect(page.getByText('1–6 of 11')).toBeVisible()
  })

  test('from the keyboard: one tab stop, the arrows along it, Space presses', async ({ page }) => {
    await page.goto(story('grouped'))
    await pill(page, 'All').focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(pill(page, 'Audio')).toBeFocused()
    await page.keyboard.press('Space')
    await expect(pill(page, 'Audio')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('cell', { name: /Video ·/ })).toHaveCount(0)
  })

  test("a filter with no rows: the table's empty state, with a way to take it off", async ({ page }) => {
    await page.goto(story('grouped-no-matches'))
    await expect(pill(page, 'Text')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('No text items')).toBeVisible()
    await expect(headings(page)).toHaveCount(0)
    await page.getByRole('button', { name: 'Show all types' }).click()
    await expect(pill(page, 'All')).toHaveAttribute('aria-pressed', 'true')
    await expect(headings(page).first()).toHaveText('Today2 · 1 h')
  })
})

test.describe('DataTable highlightRow (#156)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`every cell of a highlighted row wears the wash, over the stripe and the pinned backgrounds (${theme})`, async ({
      page,
    }) => {
      await page.goto(story('highlighted', theme))
      await expect(page.getByRole('cell', { name: 'Finance', exact: true })).toBeVisible()
      const highlighted = page.locator('tbody tr[data-highlighted]')
      await expect(highlighted).toHaveCount(2)
      // Finance (row 2, striped) and Work (row 3, not): the same wash on
      // every cell, pinned ones included, and nowhere else.
      const wash = await page.evaluate(() => {
        const probe = document.createElement('div')
        probe.style.backgroundColor = 'var(--table-highlight)'
        document.body.append(probe)
        const colour = getComputedStyle(probe).backgroundColor
        probe.remove()
        return colour
      })
      for (const name of ['Finance', 'Work']) {
        const cells = page.locator('tbody tr', { has: page.getByRole('cell', { name, exact: true }) }).locator('td')
        const colours = await cells.evaluateAll((tds) => tds.map((td) => getComputedStyle(td).backgroundColor))
        expect(colours, name).toEqual(colours.map(() => wash))
      }
      const plain = page.locator('tbody tr', { has: page.getByRole('cell', { name: 'Health', exact: true }) })
      await expect(plain).not.toHaveAttribute('data-highlighted')
      expect(await plain.locator('td').first().evaluate((td) => getComputedStyle(td).backgroundColor)).not.toBe(wash)
    })
  }

  test('muted text inside a highlighted row clears 4.5:1 (axe on the row in light, the tighter theme)', async ({ page }) => {
    await page.goto(story('highlighted'))
    await expect(page.getByRole('cell', { name: 'Finance', exact: true })).toBeVisible()
    const results = await new AxeBuilder({ page }).include('tbody tr[data-highlighted]').withRules(['color-contrast']).analyze()
    expect(results.passes.find((rule) => rule.id === 'color-contrast')?.nodes.length).toBeGreaterThan(0)
    expect(results.violations).toEqual([])
  })
})

// `totals` (issue #225): a footer row of sums under the columns they add
// up. Axe and the token check at rest, in both themes, are
// storybook-visual's.
test.describe('DataTable totals (#225)', () => {
  const totalsRow = (page: Page) => page.locator('tfoot [data-slot="table-totals"]')
  // The story's own table, never another one on the page.
  const totalsTable = (page: Page) => page.locator('[data-state="success"]')
  const state = (page: Page, name: string) => page.getByRole('group', { name: 'State' }).getByRole('button', { name })
  const open = async (page: Page) => {
    await page.goto(story('totals'))
    await expect(page.getByRole('cell', { name: 'Bookshelf', exact: true })).toBeVisible()
  }

  test('with rows: the label a row header in the first column, each sum under its own column', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await open(page)
    const label = totalsRow(page).getByRole('rowheader', { name: 'Total · 8 items' })
    await expect(label).toBeVisible()
    // One cell per header, so nothing shifts a column over.
    const headers = totalsTable(page).locator('thead th')
    const cells = totalsRow(page).locator('th, td')
    await expect(cells).toHaveCount(await headers.count())
    // Every row's sum, not the page's five.
    await expect(cells).toHaveText(['Total · 8 items', '', '18', '$598.24', '$492.00', ''])
    for (let index = 0; index < (await headers.count()); index++) {
      const header = (await headers.nth(index).boundingBox())!
      const cell = (await cells.nth(index).boundingBox())!
      expect(Math.abs(cell.x - header.x), `column ${index} left`).toBeLessThanOrEqual(1)
      expect(Math.abs(cell.x + cell.width - (header.x + header.width)), `column ${index} right`).toBeLessThanOrEqual(1)
    }
    // A sum's text starts where its column's values do.
    const price = page.getByRole('cell', { name: '$34.50', exact: true }).locator('span')
    const priceTotal = cells.nth(3)
    const textLeft = (element: HTMLElement) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      return range.getBoundingClientRect().left
    }
    expect(Math.abs((await priceTotal.evaluate(textLeft)) - (await price.evaluate(textLeft)))).toBeLessThanOrEqual(1)
    await expect(priceTotal).toHaveCSS('font-variant-numeric', 'tabular-nums')
  })

  test("a hidden column's sum isn't shown", async ({ page }) => {
    await open(page)
    await expect(page.getByRole('columnheader', { name: 'Weight' })).toHaveCount(0)
    await expect(totalsRow(page)).not.toContainText('kg')
  })

  test('set apart by a border thicker than a row divider', async ({ page }) => {
    await open(page)
    const footer = totalsTable(page).locator('tfoot')
    const divider = await totalsTable(page).locator('tbody tr').first().evaluate((row) => parseFloat(getComputedStyle(row).borderBottomWidth))
    const border = await footer.evaluate((element) => parseFloat(getComputedStyle(element).borderTopWidth))
    expect(border).toBeGreaterThan(divider)
  })

  for (const each of ['loading', 'empty', 'error'] as const) {
    test(`${each}: no totals row`, async ({ page }) => {
      await open(page)
      await expect(totalsRow(page)).toBeVisible()
      await state(page, each).click()
      await expect(page.locator(`[data-state="${each}"]`).first()).toBeVisible()
      await expect(page.locator('tfoot')).toHaveCount(0)
      await expect(page.getByText('Total · 8 items')).toHaveCount(0)
    })
  }

  test('on a phone: the label stays pinned with the first column, the sums scroll with theirs', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    await open(page)
    const container = page.locator('[data-slot="table-container"]', { has: totalsRow(page) })
    expect(await container.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
    const label = totalsRow(page).getByRole('rowheader')
    const priceHeader = totalsTable(page).getByRole('columnheader', { name: 'Price', exact: true })
    const priceTotal = totalsRow(page).locator('td').nth(2)
    const before = { label: (await label.boundingBox())!.x, total: (await priceTotal.boundingBox())!.x }
    await container.evaluate((element) => {
      element.scrollLeft = 100
    })
    await expect.poll(async () => (await priceTotal.boundingBox())!.x).toBeLessThan(before.total - 80)
    expect(Math.abs((await label.boundingBox())!.x - before.label)).toBeLessThanOrEqual(1)
    expect(Math.abs((await priceTotal.boundingBox())!.x - (await priceHeader.boundingBox())!.x)).toBeLessThanOrEqual(1)
    // Opaque, as a pinned body cell is, so the sums don't show through.
    const pageBackground = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.style.backgroundColor = 'var(--background)'
      document.body.append(probe)
      const colour = getComputedStyle(probe).backgroundColor
      probe.remove()
      return colour
    })
    await expect(label).toHaveCSS('background-color', pageBackground)
  })
})

// The testing helper that waits for a page's data before reading or
// scanning it, on a page with two tables, the second loading after the
// first has its rows. A plain `[data-state="success"]` matches both, which
// strict mode refuses; waiting on the first alone would scan a skeleton.
test.describe('several tables on one page (expectDataViewsLoaded)', () => {
  test('waits until every table has loaded, without a strict-mode violation', async ({ page }) => {
    await page.goto(story('several-tables'))
    await expectDataViewsLoaded(page)
    // Both tables' rows are there the moment it returns: nothing waits here.
    expect(await page.locator('[data-state="success"]').count()).toBe(2)
    expect(await page.locator('[data-state="loading"]').count()).toBe(0)
    expect(await page.getByRole('region', { name: 'Saving' }).getByRole('cell', { name: 'Health', exact: true }).count()).toBe(1)
  })

  test('the screen-up form waits for the skeletons too', async ({ page }) => {
    await page.goto(story('several-tables'))
    await expectDataViewsLoaded(page, { success: false })
    expect(await page.locator('[data-state="loading"]').count()).toBe(0)
    expect(await page.locator('[data-state="success"]').count()).toBe(2)
  })
})
