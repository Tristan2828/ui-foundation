import { expect, test } from '@playwright/test'

// EqualItems (record standard R10, app/EqualItems): what markup tests
// can't say. Featured's toggles work from the keyboard, several open at
// once, and every part has its accessible name; cards and panels sit side
// by side on a laptop and stack on a phone, and no look scrolls the page
// sideways. Axe, the token colours and the glyph check, in both themes and
// each palette, are e2e/fixtures-visual.spec.ts's.
const story = (id: string) => `http://localhost:6180/story.html?id=app-equalitems--${id}`

const noPageScroll = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

test.describe('featured', () => {
  test('the toggles open and close from the keyboard, several at once, in place', async ({ page }) => {
    await page.goto(story('featured'))
    const phases = page.getByRole('group', { name: 'Phases' })
    // The current phase in full, its fields read with their labels.
    const featured = phases.getByRole('region', { name: 'Phase 2' })
    await expect(featured.getByRole('heading', { name: 'Phase 2' })).toBeVisible()
    await expect(featured.getByRole('definition').filter({ hasText: 'Hills and tempo' })).toBeVisible()

    const first = phases.getByRole('button', { name: 'Phase 1 Done' })
    const third = phases.getByRole('button', { name: 'Phase 3 Planned' })
    await expect(first).toHaveAttribute('aria-expanded', 'false')
    await expect(phases.getByText('Easy base miles')).toHaveCount(0)

    await first.focus()
    await page.keyboard.press('Enter')
    await expect(first).toHaveAttribute('aria-expanded', 'true')
    await expect(phases.getByText('Easy base miles')).toBeVisible()
    const url = page.url()

    await page.keyboard.press('Tab')
    await expect(third).toBeFocused()
    await page.keyboard.press('Space')
    await expect(third).toHaveAttribute('aria-expanded', 'true')
    await expect(phases.getByText('Race pace')).toBeVisible()
    // Both stay open: opening one never closes another.
    await expect(first).toHaveAttribute('aria-expanded', 'true')

    await page.keyboard.press('Space')
    await expect(third).toHaveAttribute('aria-expanded', 'false')
    await expect(phases.getByText('Race pace')).toHaveCount(0)
    // In place, never navigation.
    expect(page.url()).toBe(url)

    // A toggle is a button inside its own heading, at the items' level.
    await expect(phases.getByRole('heading', { level: 3, name: 'Phase 1 Done' })).toBeVisible()
  })

  test('defaultOpenIds opens one when it first shows', async ({ page }) => {
    await page.goto(story('featured'))
    const options = page.getByRole('group', { name: 'Options' })
    await expect(options.getByRole('button', { name: 'Pro Over budget' })).toHaveAttribute('aria-expanded', 'true')
    await expect(options.getByRole('button', { name: 'Basic Free' })).toHaveAttribute('aria-expanded', 'false')
  })
})

// The stepper (4.127, app/EqualItems "Stepper"): numbered steps picking
// the one panel shown, a tablist from the keyboard, opening on the current
// step; the app can keep the shown step; on a phone the row scrolls
// sideways in its own box with the shown step in view.
test.describe('stepper', () => {
  test('opens on the current step; arrow keys, Home and End pick another, in place', async ({ page }) => {
    await page.goto(story('stepper'))
    const steps = page.getByRole('tablist', { name: 'Phases', exact: true })
    await expect(steps.getByRole('tab')).toHaveCount(4)
    const tab = (name: RegExp) => steps.getByRole('tab', { name })
    const panel = page.getByRole('tabpanel')
    // The current step, ringed, says so, and its panel is the one shown.
    // (Chrome reads a space before each hidden ", done".)
    await expect(tab(/^Step 3: Phase 3: Peak Current$/)).toHaveAttribute('aria-selected', 'true')
    await expect(tab(/^Step 3/)).toHaveAttribute('aria-current', 'step')
    await expect(tab(/^Step 1: Phase 1: Foundation ?, done$/)).toHaveAttribute('aria-selected', 'false')
    await expect(page.locator('[data-slot="equal-items-stepper"]').first().getByRole('tabpanel')).toHaveCount(1)
    await expect(panel.first().getByRole('heading', { level: 3, name: 'Phase 3: Peak' })).toBeVisible()
    await expect(panel.first().getByText('Two harder days a week')).toBeVisible()
    const url = page.url()

    await tab(/^Step 3/).focus()
    await page.keyboard.press('ArrowLeft')
    await expect(tab(/^Step 2/)).toBeFocused()
    await expect(tab(/^Step 2/)).toHaveAttribute('aria-selected', 'true')
    await expect(panel.first().getByRole('heading', { name: 'Phase 2: Build' })).toBeVisible()
    await expect(panel.first().getByText('Three easy weeks in a row')).toBeVisible()
    await expect(page.getByText('Two harder days a week')).toHaveCount(0)

    await page.keyboard.press('End')
    await expect(tab(/^Step 4: Phase 4: Taper$/)).toHaveAttribute('aria-selected', 'true')
    // An empty value is the record's dash, read as Not set.
    await expect(panel.first().getByText('Not set')).toHaveCount(1)
    await page.keyboard.press('Home')
    await expect(tab(/^Step 1/)).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowRight')
    await expect(tab(/^Step 2/)).toHaveAttribute('aria-selected', 'true')
    // Tab goes on into the panel, not along the steps.
    await page.keyboard.press('Tab')
    await expect(panel.first()).toBeFocused()
    // In place, never navigation.
    expect(page.url()).toBe(url)
  })

  test('the app can keep the shown step, and a step can ask for a look', async ({ page }) => {
    await page.goto(story('stepper'))
    const steps = page.getByRole('tablist', { name: 'Phases, kept by the app' })
    const shown = page.getByTestId('shown-step')
    await expect(steps.getByRole('tab', { name: /^Step 4/ })).toHaveAttribute('aria-selected', 'true')
    await expect(shown).toHaveText('Shown: taper')
    const flagged = steps.getByRole('tab', { name: /^Step 2: Phase 2: Build ?, done ?, needs an answer$/ })
    await expect(flagged.locator('[data-slot="equal-item-step-attention"]')).toBeVisible()
    await flagged.click()
    await expect(shown).toHaveText('Shown: build')
    await expect(flagged).toHaveAttribute('aria-selected', 'true')
  })

  test('on a laptop, the steps share one row above the panel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('stepper'))
    const steps = page.getByRole('tablist', { name: 'Phases', exact: true })
    const tops = await steps.getByRole('tab').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)))
    expect(new Set(tops).size).toBe(1)
    const list = (await steps.boundingBox())!
    expect(await steps.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    const panel = (await page.getByRole('tabpanel').first().boundingBox())!
    expect(panel.y).toBeGreaterThan(list.y + list.height - 1)
  })

  test('on a phone, the row scrolls sideways in its own box, the shown step in view', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(story('seven-items'))
    const steps = page.getByRole('tablist', { name: 'Seven items, stepper' })
    await expect(steps).toBeVisible()
    expect(await steps.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
    expect(await noPageScroll(page)).toBe(true)
    const inView = (name: RegExp) =>
      steps.evaluate((list, source) => {
        const re = new RegExp(source)
        const tab = [...list.querySelectorAll('[role="tab"]')].find((el) => re.test(el.textContent ?? ''))!
        const a = list.getBoundingClientRect()
        const b = tab.getBoundingClientRect()
        return b.left >= a.left - 1 && b.right <= a.right + 1
      }, name.source)
    // Week 4, the current one, is shown first and scrolled into view.
    await expect(steps.getByRole('tab', { name: /Week 4/ })).toHaveAttribute('aria-selected', 'true')
    expect(await inView(/Week 4/)).toBe(true)
    await steps.getByRole('tab', { name: /Week 4/ }).focus()
    await page.keyboard.press('End')
    await expect(steps.getByRole('tab', { name: /Week 7/ })).toHaveAttribute('aria-selected', 'true')
    await expect.poll(() => inView(/Week 7/)).toBe(true)
    // Every step is at least a finger's height.
    const heights = await steps.getByRole('tab').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(44)
  })
})

test.describe('names', () => {
  test('cards and panels are named lists of headed items; the table has its caption and row headers', async ({ page }) => {
    await page.goto(story('cards'))
    const cards = page.getByRole('list', { name: 'Phases' })
    await expect(cards.getByRole('listitem')).toHaveCount(3)
    await expect(cards.getByRole('heading', { level: 3 })).toHaveText(['Phase 1', 'Phase 2', 'Phase 3'])

    await page.goto(story('table-look'))
    const table = page.getByRole('table', { name: 'Options' })
    await expect(table.getByRole('columnheader')).toHaveText(['Name', 'Status', 'Price', 'Seats', 'Storage', 'Support'])
    await expect(table.getByRole('rowheader')).toHaveText(['Basic', 'Plus', 'Pro'])
    // A missing value is the record's dash, read as Not set.
    await expect(table.getByRole('row', { name: /Basic/ }).getByText('Not set')).toHaveCount(1)
  })
})

test.describe('widths', () => {
  test('on a laptop, cards and panels sit side by side', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    for (const id of ['cards', 'panels']) {
      await page.goto(story(id))
      const tops = await page
        .getByRole('list', { name: 'Phases' })
        .locator('[data-slot="equal-item"]')
        .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)))
      expect(new Set(tops).size, id).toBe(1)
    }
  })

  test('on a phone, cards and panels stack, and no look scrolls the page sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    for (const id of ['cards', 'panels']) {
      await page.goto(story(id))
      const lefts = await page
        .getByRole('list', { name: 'Phases' })
        .locator('[data-slot="equal-item"]')
        .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)))
      expect(lefts, id).toHaveLength(3)
      expect(new Set(lefts).size, id).toBe(1)
    }
    for (const id of ['cards', 'table-look', 'featured', 'panels', 'stepper', 'long-titles', 'seven-items']) {
      await page.goto(story(id))
      await expect(page.locator('[data-slot="equal-items"]').first()).toBeVisible()
      expect(await noPageScroll(page), id).toBe(true)
    }
  })
})

// An item's own content and actions (app/EqualItems "Content and
// actions"): the open editor takes the item's full width, never the
// label/value grid's value column, and Edit, Save and Remove work.
test.describe('content and actions', () => {
  const sets = ['cards', 'table', 'featured', 'panels'] as const
  // The look's own container: a list, a table or a group.
  const set = (page: import('@playwright/test').Page, look: (typeof sets)[number]) =>
    page.locator('[data-slot="equal-items"]').nth(sets.indexOf(look))

  for (const width of [1280, 375]) {
    test(`${width}px: the editor takes the item's full width in every look`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(story('content-and-actions'))
      for (const look of sets) {
        const outer = (await set(page, look).boundingBox())!
        const editor = (await set(page, look).locator('[data-slot="equal-item-content"] form').boundingBox())!
        // Inside the item's padding (and the table cell's, or a toggle's
        // indent), so within 5rem of the set's own width.
        expect(editor.width, look).toBeGreaterThan(outer.width - 80)
        expect(editor.x + editor.width, look).toBeLessThanOrEqual(outer.x + outer.width + 1)
      }
      expect(await noPageScroll(page)).toBe(true)
    })
  }

  test('1280px: the open editor is wide, the others sit side by side under it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(story('content-and-actions'))
    for (const look of ['cards', 'panels'] as const) {
      const items = set(page, look).locator('[data-slot="equal-item"]')
      const boxes = await items.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect))
      const list = (await set(page, look).boundingBox())!
      expect(boxes[1]!.width, look).toBeGreaterThan(list.width - 2)
      expect(Math.round(boxes[0]!.top), look).toBeLessThan(Math.round(boxes[1]!.top))
    }
  })

  test("the actions are the item's own, beside a featured toggle, never inside it", async ({ page }) => {
    await page.goto(story('content-and-actions'))
    const table = page.getByRole('table', { name: 'Stores, table' })
    await expect(table.getByRole('columnheader', { name: 'Actions' })).toHaveCount(1)
    await expect(table.getByRole('row', { name: /Corner Hardware/ }).getByRole('button', { name: 'Edit Corner Hardware' })).toBeVisible()

    const featured = set(page, 'featured')
    const toggle = featured.getByRole('button', { name: 'Corner Hardware', exact: true })
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(toggle.getByRole('button')).toHaveCount(0)
    await expect(featured.getByRole('button', { name: 'Remove Corner Hardware' })).toBeVisible()
  })

  test('Edit opens the editor in the item, Save shows the new value, Remove takes it out', async ({ page }) => {
    await page.goto(story('content-and-actions'))
    const cards = page.getByRole('list', { name: 'Stores, cards' })
    await cards.getByRole('button', { name: 'Edit Corner Hardware' }).click()
    const form = cards.getByRole('listitem').filter({ hasText: 'Corner Hardware' }).locator('form')
    await form.getByLabel('Price').fill('$39.00')
    await form.getByRole('button', { name: 'Save' }).click()
    await expect(form).toHaveCount(0)
    await expect(cards.getByRole('listitem').filter({ hasText: 'Corner Hardware' }).getByText('$39.00')).toBeVisible()

    await cards.getByRole('button', { name: 'Remove Example Supply' }).click()
    await expect(cards.getByRole('heading', { level: 3 })).toHaveText(['Corner Hardware', 'Northwind Lumber'])
  })
})
