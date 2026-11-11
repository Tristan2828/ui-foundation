import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { expectDataViewsLoaded } from '../src/testing'

// DataTable's opt-ins for a small entity (app/DataTable stories), in a
// real browser: `width="content"` (issue #104), editing in its rows
// with InlineCreate (issue #105), and rows grouped under headings with a
// PillFilter and no header row (issue #135). Axe and the token check on the stories
// at rest, in both themes, are e2e/fixtures-visual.spec.ts's
// COMPOSITE_STORIES; a cell open is checked here.
const story = (id: string, theme: 'light' | 'dark' = 'light') =>
  `http://localhost:6180/story.html?id=app-datatable--${id}&theme=${theme}`

// The part `width="content"` fits (the table, its states, its pagination),
// and the whole DataTable, the toolbar's width.
const table = (page: Page) => page.locator('[data-width="content"] [data-slot="data-table-body"]')
const width = async (page: Page) => (await table(page).boundingBox())!.width
const areaWidth = async (page: Page) => (await page.locator('[data-width="content"]').boundingBox())!.width

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

  // Since 4.83 at every width, not only from an 80rem table area.
  test('at 1280px too it takes the width it needs, the toolbar keeping the whole width', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(story('content-width'))
    await expect(page.getByRole('cell', { name: 'Finance', exact: true })).toBeVisible()
    expect(await width(page)).toBeLessThan((await areaWidth(page)) - 100)
  })

  test('on a phone it is never wider than the page: the table scrolls inside it', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    await page.goto(story('content-width'))
    await expect(page.getByRole('cell', { name: 'Finance', exact: true })).toBeVisible()
    expect(await width(page)).toBeLessThanOrEqual((await areaWidth(page)) + 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(393)
  })

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
// fixtures-visual's.
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
    // A right-aligned column (#237): a sum's text ends where its column's
    // values do, and so does the header's label.
    const price = page.getByRole('cell', { name: '$34.50', exact: true }).locator('span')
    const priceTotal = cells.nth(3)
    const textRight = (element: HTMLElement) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      return range.getBoundingClientRect().right
    }
    const valueRight = await price.evaluate(textRight)
    expect(Math.abs((await priceTotal.evaluate(textRight)) - valueRight)).toBeLessThanOrEqual(1)
    await expect(priceTotal).toHaveCSS('font-variant-numeric', 'tabular-nums')
    const quantityHeader = totalsTable(page).getByRole('columnheader', { name: 'Quantity', exact: true })
    const quantity = page.getByRole('cell', { name: '2', exact: true }).first().locator('span')
    expect(Math.abs((await quantityHeader.evaluate(textRight)) - (await quantity.evaluate(textRight)))).toBeLessThanOrEqual(1)
  })

  test("a right-aligned sortable column: the arrow left of the label, the label's right edge on the values'", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await open(page)
    const sort = totalsTable(page).getByRole('columnheader', { name: 'Price', exact: true }).getByRole('button')
    const arrow = (await sort.locator('svg').boundingBox())!
    const label = await sort.evaluate((button) => {
      const range = document.createRange()
      range.selectNodeContents([...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)!)
      return range.getBoundingClientRect().toJSON() as DOMRect
    })
    expect(arrow.x + arrow.width).toBeLessThanOrEqual(label.left + 1)
    const value = page.getByRole('cell', { name: '$34.50', exact: true }).locator('span')
    const valueRight = await value.evaluate((element) => element.getBoundingClientRect().right)
    expect(Math.abs(label.right - valueRight)).toBeLessThanOrEqual(1)
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

// A list's look (4.83, the list page standard): the row hover, no stripes
// unless `striped`, long text on one line (`meta.clip`), content width by
// default, and rows per page. Axe and the token check at rest in both
// themes are fixtures-visual's; the hovered row's contrast is checked here.
test.describe('DataTable list look (4.83)', () => {
  const recipeRow = (page: Page, name: string) =>
    page.locator('tbody tr', { has: page.getByRole('link', { name, exact: true }) })
  const tokenColour = (page: Page, token: string) =>
    page.evaluate((value) => {
      const probe = document.createElement('div')
      probe.style.backgroundColor = value
      document.body.append(probe)
      const colour = getComputedStyle(probe).backgroundColor
      probe.remove()
      return colour
    }, `var(${token})`)
  const backgrounds = (page: Page, name: string) =>
    recipeRow(page, name)
      .locator('td')
      .evaluateAll((tds) => tds.map((td) => getComputedStyle(td).backgroundColor))

  for (const theme of ['light', 'dark'] as const) {
    test(`hover lights every cell of the row, the pinned one too, with a bar at its start (${theme})`, async ({ page }) => {
      await page.goto(story('list-look', theme))
      await expect(recipeRow(page, 'Recipe 2')).toBeVisible()
      const hover = await tokenColour(page, '--table-hover')
      const before = await backgrounds(page, 'Recipe 2')
      expect(before).not.toContain(hover)
      await recipeRow(page, 'Recipe 2').locator('td').nth(2).hover()
      expect(await backgrounds(page, 'Recipe 2')).toEqual(before.map(() => hover))
      const bar = await recipeRow(page, 'Recipe 2')
        .locator('td')
        .first()
        .evaluate((td) => getComputedStyle(td).boxShadow)
      expect(bar).toContain('3px 0px 0px 0px')
      // Muted text in the hovered row still clears 4.5:1.
      await recipeRow(page, 'Recipe 4').locator('td').nth(2).hover()
      const results = await new AxeBuilder({ page }).include('tbody tr:hover').withRules(['color-contrast']).analyze()
      expect(results.passes.find((rule) => rule.id === 'color-contrast')?.nodes.length).toBeGreaterThan(0)
      expect(results.violations).toEqual([])
    })
  }

  test('the hand cursor on rows that open; the arrow on rows edited in place, with the same highlight', async ({ page }) => {
    await page.goto(story('list-look'))
    await expect(recipeRow(page, 'Recipe 1')).toHaveCSS('cursor', 'pointer')
    await page.goto(story('list-look-in-rows'))
    await expect(recipeRow(page, 'Recipe 1')).toHaveCSS('cursor', 'auto')
    const hover = await tokenColour(page, '--table-hover')
    await recipeRow(page, 'Recipe 1').locator('td').nth(2).hover()
    const lit = await backgrounds(page, 'Recipe 1')
    expect(lit).toEqual(lit.map(() => hover))
  })

  test('no zebra by default; `striped` tints every other row, pinned cell included', async ({ page }) => {
    await page.goto(story('list-look'))
    await expect(recipeRow(page, 'Recipe 2')).toBeVisible()
    const stripe = await tokenColour(page, '--table-stripe')
    expect(await backgrounds(page, 'Recipe 2')).not.toContain(stripe)
    expect(await recipeRow(page, 'Recipe 2').evaluate((tr) => getComputedStyle(tr).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
    await page.goto(story('list-look-striped'))
    await expect(recipeRow(page, 'Recipe 2')).toBeVisible()
    expect((await backgrounds(page, 'Recipe 2'))[0]).toBe(stripe)
    expect(await recipeRow(page, 'Recipe 2').evaluate((tr) => getComputedStyle(tr).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
    expect((await backgrounds(page, 'Recipe 1'))[0]).not.toBe(stripe)
  })

  test('a clip column stays on one line at 24rem, and its whole text shows on hover and on focus', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(story('list-look'))
    const cut = recipeRow(page, 'Recipe 1').locator('[data-slot="data-table-clip"]')
    await expect(cut).toBeVisible()
    const box = (await cut.boundingBox())!
    expect(box.width).toBeLessThanOrEqual(24 * 16 + 1)
    expect(box.height).toBeLessThan(24)
    const whole = 'Soak the oats overnight, then warm them through with a pinch of salt and top with whatever fruit is in season'
    const tooltip = page.locator('[data-slot="tooltip-content"]')
    await cut.hover()
    await expect(tooltip).toHaveText(whole)
    await page.mouse.move(0, 0)
    await expect(tooltip).toHaveCount(0)
    await cut.focus()
    await expect(tooltip).toHaveText(whole)
    // A short note isn't cut: no tab stop, so no tooltip.
    await expect(recipeRow(page, 'Recipe 2').locator('[data-slot="data-table-clip"]')).not.toHaveAttribute('tabindex')
  })

  test('content width: the table as wide as its columns, the toolbar the whole width; full opts out', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(story('list-look'))
    await expect(recipeRow(page, 'Recipe 1')).toBeVisible()
    const body = (await page.locator('[data-slot="data-table-body"]').boundingBox())!
    const whole = (await page.locator('[data-width="content"]').boundingBox())!
    expect(body.width).toBeLessThan(whole.width - 200)
    await page.goto(story('list-look-striped'))
    await expect(recipeRow(page, 'Recipe 1')).toBeVisible()
    const fullBody = (await page.locator('[data-slot="data-table-body"]').boundingBox())!
    const fullWhole = (await page.locator('[data-width="full"]').boundingBox())!
    expect(Math.abs(fullBody.width - fullWhole.width)).toBeLessThanOrEqual(1)
  })

  test('rows per page: 50 to start, a pick shows that many from page 1, and is remembered', async ({ page }) => {
    await page.goto(story('list-look'))
    await expect(page.locator('tbody tr')).toHaveCount(50)
    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(page.getByText('Page 2 of 3')).toBeVisible()
    await page.getByRole('button', { name: '50 rows per page' }).click()
    await page.getByRole('menuitemradio', { name: '25' }).click()
    await expect(page.locator('tbody tr')).toHaveCount(25)
    await expect(page.getByText('Page 1 of 5')).toBeVisible()
    await expect(page.getByRole('button', { name: '25 rows per page' })).toBeVisible()
    await page.reload()
    await expect(page.locator('tbody tr')).toHaveCount(25)
  })

  test('on a phone nothing overflows the page, the rows-per-page menu included', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(story('list-look'))
    await expect(recipeRow(page, 'Recipe 1')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    const menu = (await page.getByRole('button', { name: '50 rows per page' }).boundingBox())!
    expect(menu.x + menu.width).toBeLessThanOrEqual(375)
  })
})
