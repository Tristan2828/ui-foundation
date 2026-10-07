import { expect, test, type Page } from '@playwright/test'

// Forces the widgets list's *first* request via `page.addInitScript` —
// registering the override this way, before any of the page's own scripts
// run, means it applies before the app's first fetch, not a race against it.
// See src/mocks/e2e-hooks.ts.
async function forceWidgetsListOverride(
  page: Page,
  override: { status?: number; body?: unknown; delayMs?: number },
) {
  await page.addInitScript((o) => {
    window.__E2E_MSW_OVERRIDE__ = { method: 'get', path: '*/api/widgets', ...o }
  }, override)
}

// For an override registered *after* the page has already loaded (e.g. on a
// mutation triggered by a later click): window.__msw is only set once
// src/main.tsx's enableMocking() finishes, which page.goto's load event
// does not wait for.
async function waitForMswReady(page: Page) {
  await page.waitForFunction(() => window.__msw !== undefined)
}

test.describe('widgets table', () => {
  test('loading: a delayed response shows the skeleton first', async ({ page }) => {
    await forceWidgetsListOverride(page, { delayMs: 1000, body: { items: [], total: 0 } })
    await page.goto('/widgets')
    await expect(page.locator('[data-state="loading"]')).toBeVisible()
    await expect(page.getByText('No widgets yet')).toBeVisible()
  })

  test('empty: a page with no rows shows the empty state', async ({ page }) => {
    await forceWidgetsListOverride(page, { body: { items: [], total: 0 } })
    await page.goto('/widgets')
    await expect(page.getByText('No widgets yet')).toBeVisible()
    // Base UI's Button forces role="button" via ARIA even when it renders
    // as a react-router <Link> (nativeButton={false}) — it's not role=link.
    await expect(page.getByRole('button', { name: 'Create widget' })).toBeVisible()
  })

  test('error: a 500 response shows the error state', async ({ page }) => {
    await forceWidgetsListOverride(page, { status: 500, body: { detail: 'Internal error' } })
    await page.goto('/widgets')
    await expect(page.getByText('Something went wrong')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  test('sort and filters live in the URL and survive the round trip to a view', async ({ page }) => {
    await page.goto('/widgets')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Name' }).click()
    await expect(page.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'ascending')
    await page.getByLabel('Search widgets').fill('mouse')
    await expect(page).toHaveURL(/[?&]search=mouse/)
    await expect(page).toHaveURL(/[?&]sort=name%3Aasc|[?&]sort=name:asc/)
    await expect(page.getByRole('cell', { name: 'Standing Desk', exact: true })).toHaveCount(0)

    await page.getByRole('link', { name: 'Wireless Mouse' }).click()
    await expect(page).toHaveURL('/widgets/1')
    await page.goBack()

    await expect(page.getByLabel('Search widgets')).toHaveValue('mouse')
    await expect(page.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'ascending')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Standing Desk', exact: true })).toHaveCount(0)
  })

  test('a saved view sets its filters and shows its own columns until a filter changes', async ({ page }) => {
    await page.goto('/widgets')
    const views = page.getByRole('group', { name: 'Saved views' })
    const restock = views.getByRole('button', { name: 'Restock' })
    const restockColumns = ['Name', 'Category', 'Assignee', 'Price', 'In Stock']
    // No filters is the All widgets view, and it shows every column.
    await expect(views.getByRole('button', { name: 'All widgets' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('columnheader', { name: 'Tags' })).toBeVisible()

    await restock.click()
    await expect(restock).toHaveAttribute('aria-pressed', 'true')
    await expect(page).toHaveURL(/[?&]inStock=false/)
    await expect(page.getByRole('cell', { name: 'Fountain Pen', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toHaveCount(0)
    await expect(page.getByRole('columnheader')).toHaveText(restockColumns)

    // The view is its filters, so a refresh (or a shared link) keeps it, and
    // a sort doesn't leave it.
    await page.reload()
    await page.getByRole('button', { name: 'Price' }).click()
    await expect(page).toHaveURL(/[?&]sort=price/)
    await expect(restock).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('columnheader')).toHaveText(restockColumns)

    // Any other filter leaves the view: no view is pressed and every column
    // is back, because the view's columns were chosen for its records only.
    await page.getByLabel('Search widgets').fill('pen')
    await expect(restock).toHaveAttribute('aria-pressed', 'false')
    await expect(views.getByRole('button', { name: 'All widgets' })).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('columnheader', { name: 'Tags' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Fountain Pen', exact: true })).toBeVisible()

    // All widgets clears every filter and the sort.
    await views.getByRole('button', { name: 'All widgets' }).click()
    await expect(page).toHaveURL('/widgets')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
  })

  test('an unset filter shows its label, not the sentinel value', async ({ page }) => {
    // Regression: the Status trigger read the literal "all". Base UI's
    // <SelectValue> renders the raw value, and STATUS_FILTER_ALL is a real
    // value, so `placeholder` never applied. Every entity's toolbar is
    // copied from widgets-table.tsx (docs/foundation/add-an-entity.md), so this
    // shipped to every consuming app.
    //
    // Note what this asserts that the filter tests above do not: the
    // *unset* state. Asserting only after a value is picked passes either
    // way, because WIDGET_STATUSES' values are their own labels.
    await page.goto('/widgets')
    await expect(page.getByLabel('Filter by status')).toContainText('All statuses')
    await expect(page.getByLabel('Filter by status')).not.toHaveText(/^all/)

    // A picked value still shows itself, and clearing returns to the
    // label rather than falling back to the sentinel.
    await page.getByLabel('Filter by status').click()
    // Options and the trigger show the label; the URL carries the wire value.
    await page.getByRole('option', { name: 'Active', exact: true }).click()
    await expect(page.getByLabel('Filter by status')).toContainText('Active')
    await expect(page).toHaveURL(/[?&]status=active(&|$)/)

    await page.getByLabel('Filter by status').click()
    await page.getByRole('option', { name: 'All statuses' }).click()
    await expect(page.getByLabel('Filter by status')).toContainText('All statuses')
  })

  test('search sends one request once typing pauses, not one per keystroke', async ({ page }) => {
    await page.goto('/widgets')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
    await waitForMswReady(page)
    await page.evaluate(() => {
      const counter = window as unknown as { __searchRequests: number }
      counter.__searchRequests = 0
      window.__msw.worker.events.on('request:start', ({ request }) => {
        const url = new URL(request.url)
        if (url.pathname === '/api/widgets' && url.searchParams.has('search')) counter.__searchRequests++
      })
    })

    await page.getByLabel('Search widgets').pressSequentially('mouse', { delay: 50 })
    await expect(page.getByRole('cell', { name: 'Standing Desk', exact: true })).toHaveCount(0)

    const requests = await page.evaluate(() => (window as unknown as { __searchRequests: number }).__searchRequests)
    expect(requests).toBe(1)
  })

  test('a page past the end (stale link, or last row deleted) falls back to the last page', async ({ page }) => {
    await page.goto('/widgets?page=2')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
    await expect(page).toHaveURL('/widgets')
    await expect(page.getByText('No widgets yet')).toHaveCount(0)
  })

  test('multi choice filter: picking tags filters to widgets with any of them, via the URL', async ({
    page,
  }) => {
    await page.goto('/widgets')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()

    await page.getByLabel('Filter by tags').click()
    // The option shows the tag's label; the URL and the wire carry its value.
    await page.getByRole('option', { name: 'Bulky', exact: true }).click()
    await page.keyboard.press('Escape')

    await expect(page).toHaveURL(/[?&]tags=bulky/)
    await expect(page.getByRole('cell', { name: 'Standing Desk', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toHaveCount(0)

    // A shared or reloaded link restores the same filter.
    await page.reload()
    await expect(page.getByRole('button', { name: 'Remove Bulky' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toHaveCount(0)
  })

  // Issue #94: chips that fit on one line keep the control one line high,
  // level with the Selects beside it; its text box no longer wraps onto an
  // empty line of its own.
  test('multi choice filter: chips that fit keep it as tall as the selects beside it', async ({ page }, testInfo) => {
    await page.goto('/widgets')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
    await page.getByLabel('Filter by tags').click()
    // Two chips that fit the 14rem control with under 4rem to spare: the
    // input's old minimum pushed it onto a second line.
    for (const name of ['Fragile', 'Featured']) await page.getByRole('option', { name, exact: true }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Remove Featured' })).toBeVisible()
    // At rest: focus elsewhere, as a toolbar is mostly seen.
    await page.getByLabel('Search widgets').focus()
    const chips = page.locator('[data-slot=combobox-chips]').filter({ has: page.getByLabel('Filter by tags') })
    const status = page.getByLabel('Filter by status')
    const [chipsBox, statusBox] = [(await chips.boundingBox())!, (await status.boundingBox())!]
    expect(chipsBox.height).toBe(statusBox.height)
    // Side by side (a phone stacks the filters), the two line up.
    if (testInfo.project.name !== 'mobile-chrome') expect(chipsBox.y).toBe(statusBox.y)
    // Focused, it still takes typing (wrapping if it must) and filters.
    await page.getByLabel('Filter by tags').fill('x')
    await expect(page.getByLabel('Filter by tags')).toHaveValue('x')
  })

  test('yes/no filter: either by default, then in or out of stock, via the URL', async ({ page }) => {
    await page.goto('/widgets')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
    // The unset state shows its label, not the 'all' sentinel.
    await expect(page.getByLabel('Filter by stock')).toContainText('Any stock')
    await expect(page.getByLabel('Filter by stock')).not.toHaveText(/^all/)

    // false is a real filter value, not "no filter".
    await page.getByLabel('Filter by stock').click()
    await page.getByRole('option', { name: 'Out of stock' }).click()
    await expect(page).toHaveURL(/[?&]inStock=false/)
    await expect(page.getByLabel('Filter by stock')).toContainText('Out of stock')
    await expect(page.getByRole('cell', { name: 'Fountain Pen', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toHaveCount(0)

    await page.getByLabel('Filter by stock').click()
    await page.getByRole('option', { name: 'In stock', exact: true }).click()
    await expect(page).toHaveURL(/[?&]inStock=true/)
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Fountain Pen', exact: true })).toHaveCount(0)

    // A reloaded link restores it.
    await page.reload()
    await expect(page.getByLabel('Filter by stock')).toContainText('In stock')
    await expect(page.getByRole('cell', { name: 'Fountain Pen', exact: true })).toHaveCount(0)

    await page.getByLabel('Filter by stock').click()
    await page.getByRole('option', { name: 'Any stock' }).click()
    await expect(page).not.toHaveURL(/inStock=/)
    await expect(page.getByRole('cell', { name: 'Fountain Pen', exact: true })).toBeVisible()
  })

  test('multi reference: the column shows names, and the filter matches any pick, via the URL', async ({ page }) => {
    await page.goto('/widgets')
    const desk = page.getByRole('row').filter({ hasText: 'Standing Desk' })
    // Names, never ids, in the cell.
    await expect(desk.getByText('Stationery', { exact: true })).toBeVisible()

    await page.getByLabel('Filter by extra categories').fill('stat')
    await page.getByRole('option', { name: 'Stationery', exact: true }).click()
    await page.keyboard.press('Escape')

    await expect(page).toHaveURL(/[?&]extraCategoryIds=3/)
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Standing Desk', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Fountain Pen', exact: true })).toHaveCount(0)

    // A reloaded link names its pick without any search typed.
    await page.reload()
    await expect(page.getByRole('button', { name: 'Remove Stationery' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Fountain Pen', exact: true })).toHaveCount(0)
  })

  test('sub-records: the column shows a done-count, not the items', async ({ page }) => {
    await page.goto('/widgets')
    const mouse = page.getByRole('row').filter({ hasText: 'Wireless Mouse' })
    await expect(mouse.getByRole('cell', { name: '1/2 done', exact: true })).toBeVisible()
    await expect(mouse.getByText('Pair the receiver')).toHaveCount(0)
  })

  test('computed field: the server-worked-out value shows, filters and sorts in its own order', async ({ page }) => {
    await page.goto('/widgets')
    const mouse = page.getByRole('row').filter({ hasText: 'Wireless Mouse' })
    await expect(mouse.getByText('In progress', { exact: true })).toBeVisible()
    const desk = page.getByRole('row').filter({ hasText: 'Standing Desk' })
    await expect(desk.getByText('No checklist', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Filter by progress')).toContainText('Any progress')

    await page.getByLabel('Filter by progress').click()
    await page.getByRole('option', { name: 'In progress' }).click()
    await expect(page).toHaveURL(/[?&]checklistState=open/)
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Standing Desk', exact: true })).toHaveCount(0)
    await page.getByLabel('Filter by progress').click()
    await page.getByRole('option', { name: 'Any progress' }).click()

    // Descending: In progress (open) before the No checklist rows, the
    // enum's order rather than the alphabet's.
    await page.getByRole('button', { name: 'Progress' }).click()
    await page.getByRole('button', { name: 'Progress' }).click()
    await expect(page.getByRole('columnheader', { name: 'Progress' })).toHaveAttribute('aria-sort', 'descending')
    await expect(page.getByRole('row').nth(1)).toContainText('Wireless Mouse')
  })

  test('yes/no row toggle: the word and the switch show the value, one switch per row', async ({ page }) => {
    await page.goto('/widgets')
    const mouse = page.getByRole('row').filter({ hasText: 'Wireless Mouse' })
    const pen = page.getByRole('row').filter({ hasText: 'Fountain Pen' })
    await expect(mouse.getByRole('switch', { name: 'In stock: Wireless Mouse' })).toBeChecked()
    await expect(mouse.getByText('Yes', { exact: true })).toBeVisible()
    await expect(pen.getByRole('switch', { name: 'In stock: Fountain Pen' })).not.toBeChecked()
    await expect(pen.getByText('No', { exact: true })).toBeVisible()
    // A switch acts at once; a checkbox would read as "select this row".
    await expect(page.getByRole('table').getByRole('checkbox')).toHaveCount(0)
    await expect(page.getByRole('table').getByRole('switch')).toHaveCount(4)
  })

  test('yes/no row toggle: flipping saves without opening the form', async ({ page }) => {
    await page.goto('/widgets')
    const pen = page.getByRole('switch', { name: 'In stock: Fountain Pen' })
    await expect(pen).not.toBeChecked()
    await pen.click()
    await expect(pen).toBeChecked()
    await expect(page).toHaveURL(/\/widgets$/)

    // Saved on the server (the mocks), not just on screen: the view agrees.
    await page.getByRole('link', { name: 'Fountain Pen' }).click()
    await expect(page).toHaveURL('/widgets/3')
    // Exact: for a moment after the URL changes, the table's own switches
    // ("In stock: <row>") can still be on screen.
    await expect(page.getByRole('switch', { name: 'In stock', exact: true })).toBeChecked()
  })

  test('yes/no row toggle: works from the keyboard', async ({ page }) => {
    await page.goto('/widgets')
    const pen = page.getByRole('switch', { name: 'In stock: Fountain Pen' })
    await pen.focus()
    await page.keyboard.press('Space')
    await expect(pen).toBeChecked()
  })

  test('yes/no row toggle: a failed save puts the switch back and says so', async ({ page }) => {
    await page.goto('/widgets')
    const pen = page.getByRole('switch', { name: 'In stock: Fountain Pen' })
    await expect(pen).not.toBeChecked()
    await waitForMswReady(page)
    await page.evaluate(() => {
      const { worker, http, HttpResponse } = window.__msw
      worker.use(http.patch('*/api/widgets/3', () => HttpResponse.json({ detail: 'Database is down' }, { status: 500 })))
    })
    await pen.click()

    await expect(page.getByText("Couldn't update Fountain Pen: Database is down")).toBeVisible()
    await expect(pen).not.toBeChecked()
  })

  test('the first column stays pinned when the table scrolls horizontally', async ({ page }) => {
    // A sticky column can render perfectly and still not stick (an
    // overflow-hidden ancestor, a stray position: relative) with nothing in
    // the DOM to show it — so this checks actual scroll behaviour, not the
    // presence of the sticky classes. A narrow viewport guarantees the
    // table overflows regardless of how wide any one column renders.
    await page.setViewportSize({ width: 800, height: 720 })
    await page.goto('/widgets')
    const nameCell = page.getByRole('cell', { name: 'Wireless Mouse', exact: true })
    await expect(nameCell).toBeVisible()

    const container = page.locator('[data-slot="table-container"]')
    const before = await nameCell.boundingBox()
    const scrollLeft = await container.evaluate((el) => {
      el.scrollLeft = el.scrollWidth
      return el.scrollLeft
    })
    const after = await nameCell.boundingBox()

    // Proves the table actually overflows here — otherwise scrollLeft stays
    // 0 and the position check below passes trivially.
    expect(scrollLeft).toBeGreaterThan(0)
    expect(before).not.toBeNull()
    expect(after).not.toBeNull()
    expect(after!.x).toBeCloseTo(before!.x, 0)
  })

  test('a narrow window scrolls the table, not the whole page', async ({ page }) => {
    // Without min-w-0 on <SidebarInset> (app-shell.tsx) the page grows to
    // the table's width: the table's own scroll container never overflows,
    // and its right edge — with any right-pinned column — sits off-screen.
    await page.setViewportSize({ width: 800, height: 720 })
    await page.goto('/widgets')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()

    const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    const tableOverflows = await page
      .locator('[data-slot="table-container"]')
      .evaluate((el) => el.scrollWidth > el.clientWidth)

    expect(pageOverflows).toBe(false)
    expect(tableOverflows).toBe(true)
  })

  test('the last column (the In Stock switch) stays pinned to the right edge, opaque, when scrolled', async ({
    page,
  }) => {
    // The mirror of the test above. At the left edge, before scrolling, a
    // right-pinned column already sits at the viewport's right edge rather
    // than off-screen — so it must also not move once scrolled fully right.
    await page.setViewportSize({ width: 800, height: 720 })
    await page.goto('/widgets')
    const toggle = page.getByRole('switch', { name: 'In stock: Wireless Mouse' })
    await expect(toggle).toBeInViewport()

    const container = page.locator('[data-slot="table-container"]')
    const before = await toggle.boundingBox()
    const scrollLeft = await container.evaluate((el) => {
      el.scrollLeft = el.scrollWidth
      return el.scrollLeft
    })
    const after = await toggle.boundingBox()

    expect(scrollLeft).toBeGreaterThan(0)
    expect(before).not.toBeNull()
    expect(after).not.toBeNull()
    expect(after!.x).toBeCloseTo(before!.x, 0)

    // Opaque on every row, striped or not, so scrolled columns can't bleed
    // through. Alpha is the "/ A" of Tailwind v4's oklch(L C H / A), or the
    // fourth value of rgba() — which is how a cell with no background at
    // all serializes: rgba(0, 0, 0, 0).
    const alphas = await page.locator('tbody tr td:last-child').evaluateAll((cells) =>
      cells.map((cell) => {
        const color = getComputedStyle(cell).backgroundColor
        const alpha = color.match(/\/\s*([\d.]+)\s*\)$/) ?? color.match(/^rgba\(.*,\s*([\d.]+)\)$/)
        return alpha ? parseFloat(alpha[1]) : 1
      }),
    )
    expect(alphas.length).toBeGreaterThan(1)
    for (const alpha of alphas) expect(alpha).toBe(1)
  })

  test('hovering highlights the pinned cell identically on striped and unstriped rows', async ({
    page,
    isMobile,
  }) => {
    // Hover is a pointer affordance; a touch device has no hover state to
    // assert. The pinned column itself is still covered on mobile by the
    // horizontal-scroll test above.
    test.skip(!!isMobile, 'no hover on a touch device')
    // The zebra stripe is `tr:nth-child(even)` at specificity (0,2,1) and
    // beats any `tr:hover` rule at (0,2,0), so a whole-row hover lights the
    // odd rows and leaves the even ones striped and unlit. The highlight
    // therefore lives on the pinned cell, which sits on an opaque
    // background regardless of the stripe and reads the same on every row.
    await page.setViewportSize({ width: 800, height: 720 })
    await page.goto('/widgets')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()

    const read = async (rowIndex: number) => {
      const row = page.locator('tbody tr').nth(rowIndex)
      const nameCell = row.locator('td').first()
      const idle = await nameCell.evaluate((el) => getComputedStyle(el).backgroundColor)
      await row.getByRole('switch').hover()
      const hovered = await nameCell.evaluate((el) => ({
        background: getComputedStyle(el).backgroundColor,
        boxShadow: getComputedStyle(el).boxShadow,
      }))
      return { idle, hovered }
    }

    const oddRow = await read(0) // unstriped
    const evenRow = await read(1) // striped

    for (const { idle, hovered } of [oddRow, evenRow]) {
      // The pinned cell reacts to the hover...
      expect(hovered.background).not.toBe(idle)
      // ...stays fully opaque, so scrolled columns can't bleed through...
      expect(hovered.background).not.toMatch(/\/\s*[\d.]+\s*\)$/)
      // ...and carries the inset left-edge marker.
      expect(hovered.boxShadow).toContain('inset')
    }

    // The regression itself: the highlight must not depend on which side of
    // the zebra stripe a row falls on.
    expect(evenRow.hovered.background).toBe(oddRow.hovered.background)
  })

  // Issue #92: the stripe used to stop at the pinned cells, which stayed
  // the page's colour on every row. On an even row they now paint the
  // stripe pre-mixed onto the page, opaque, so the row reads as one band.
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`the zebra stripe runs through the pinned columns (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme })
      await page.setViewportSize({ width: 800, height: 720 })
      await page.goto('/widgets')
      await expect(page.locator('html')).toHaveClass(colorScheme)
      await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()

      // Each cell as seen: its background over its row's, over the page's,
      // flattened to sRGB through a canvas (the browser's own compositing).
      const seen = (rowIndex: number) =>
        page.locator('tbody tr').nth(rowIndex).locator('td').evaluateAll((cells) => {
          const canvas = document.createElement('canvas')
          canvas.width = canvas.height = 1
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!
          const page = getComputedStyle(document.body).backgroundColor
          return cells.map((cell) => {
            ctx.clearRect(0, 0, 1, 1)
            for (const colour of [page, getComputedStyle(cell.parentElement!).backgroundColor, getComputedStyle(cell).backgroundColor]) {
              ctx.fillStyle = colour
              ctx.fillRect(0, 0, 1, 1)
            }
            return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3))
          })
        })
      const close = (a: number[], b: number[]) => a.every((value, index) => Math.abs(value - b[index]) <= 1)

      for (const rowIndex of [0, 1]) {
        const cells = await seen(rowIndex)
        const [first, middle, last] = [cells[0], cells[1], cells.at(-1)!]
        expect(close(first, middle), `row ${rowIndex}: pinned first ${first} vs ${middle}`).toBe(true)
        expect(close(last, middle), `row ${rowIndex}: pinned last ${last} vs ${middle}`).toBe(true)
      }
      // And the even row really is striped, apart from the odd one.
      expect(close((await seen(0))[1], (await seen(1))[1])).toBe(false)
      // Still opaque, so scrolled columns can't show through.
      const pinned = await page.locator('tbody tr').nth(1).locator('td').first().evaluate((el) => getComputedStyle(el).backgroundColor)
      expect(pinned).not.toMatch(/\/\s*[\d.]+\s*\)$|^rgba\(.*,\s*0\)$/)
    })
  }

  test('a bottom scrollbar stays reachable without scrolling past every row, and mirrors the real one', async ({
    page,
  }) => {
    // The container's own scrollbar sits directly under the last row, which
    // on a full page is off-screen until you have already scrolled past
    // every row. This second bar is stuck to the viewport bottom and stays
    // in sync with the container in both directions.
    await page.setViewportSize({ width: 800, height: 720 })
    await page.goto('/widgets')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()

    const bar = page.locator('[data-slot="bottom-scrollbar"]')
    await expect(bar).toBeVisible()
    const container = page.locator('[data-slot="table-container"]')

    const barScrollLeft = await bar.evaluate((el) => {
      el.scrollLeft = el.scrollWidth
      return el.scrollLeft
    })
    expect(barScrollLeft).toBeGreaterThan(0)
    await expect.poll(() => container.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)

    await container.evaluate((el) => {
      el.scrollLeft = 0
    })
    await expect.poll(() => bar.evaluate((el) => el.scrollLeft)).toBe(0)

    // The container's native scrollbar is hidden now that the sticky bar is
    // the visible one — it stays fully functional (this test just scrolled
    // it by script), so there is exactly one visible scrollbar.
    const scrollbarWidth = await container.evaluate((el) => getComputedStyle(el).scrollbarWidth)
    expect(scrollbarWidth).toBe('none')
  })

  test('the sparse fixture renders every empty optional field, on both screens', async ({
    page,
  }) => {
    // Guards the convention itself, not just this row. "Blank Slate" has
    // every optional field empty at once (src/mocks/data.ts); without such
    // a row nothing exercises the empty-value rendering path, which is how
    // a Select once shipped displaying a raw sentinel with verify green.
    await page.goto('/widgets')
    const row = page.getByRole('row').filter({ hasText: 'Blank Slate' })
    await expect(row).toBeVisible()

    // A null assignee, an empty tag list, no extra categories and an empty checklist all render the shared em
    // dash, never a blank cell — a blank reads as a rendering bug.
    // Matched on the <td> with exactly that text: a substring match also
    // catches the wrapping cell of a <span>-wrapped dash, so the count
    // depends on markup rather than on behaviour.
    await expect(row.locator('td').filter({ hasText: /^—$/ })).toHaveCount(4)

    // And the form shows empty controls rather than placeholder values.
    await page.goto('/widgets/4/edit')
    await expect(page.getByRole('heading', { name: 'Edit Widget' })).toBeVisible()
    await expect(page.locator('#widget-assignee')).toHaveValue('')
  })

  test('success: the default MSW data renders in the table', async ({ page }) => {
    await page.goto('/widgets')
    await expect(page.getByRole('cell', { name: 'Wireless Mouse', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Standing Desk', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Fountain Pen', exact: true })).toBeVisible()
    await expect(page.getByText('1–4 of 4')).toBeVisible()
  })
})
