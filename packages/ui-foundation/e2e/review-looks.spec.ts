import { expect, test, type Locator, type Page } from '@playwright/test'

// The first module's review fixes (4.105), in a real browser: the open
// tab's name in the theme colour, a picked choice in it too, a status
// choice's icons in their kinds' colours, the column header row's fill,
// the ⋯ menu on one line, and no strip in a small card dialog. Axe and
// the glyph check in both themes and every palette are
// fixtures-visual.spec.ts's (the stories named there).
const HARNESS = 'http://localhost:6180/story.html?id='
const THEMES = [
  { name: 'light', query: 'theme=light' },
  { name: 'dark', query: 'theme=dark' },
  { name: 'graphite-periwinkle', query: 'theme=dark&palette=graphite-periwinkle' },
  { name: 'palm-lcd', query: 'theme=light&palette=palm-lcd' },
] as const

// A token's colour, as the browser resolves it, for comparing with a computed style.
const tokenColour = (page: Page, token: string, property: 'color' | 'backgroundColor' = 'color') =>
  page.evaluate(
    ({ token, property }) => {
      const probe = document.createElement('div')
      probe.style[property] = `var(${token})`
      document.body.append(probe)
      const colour = getComputedStyle(probe)[property]
      probe.remove()
      return colour
    },
    { token, property },
  )

const style = (locator: Locator, property: 'color' | 'backgroundColor' | 'borderTopColor' | 'fontWeight') =>
  locator.evaluate((node, property) => getComputedStyle(node)[property], property)

test.describe('the open tab stands out (3B)', () => {
  for (const { name, query } of THEMES) {
    test(`its name in the theme colour and a primary line, the others muted (${name})`, async ({ page }) => {
      await page.goto(`${HARNESS}app-entityview--details-tab&${query}`)
      const tabs = page.getByRole('tablist', { name: 'Office move sections' })
      const open = tabs.getByRole('tab', { name: 'Notes' })
      const other = tabs.getByRole('tab', { name: 'Details' })
      await expect(open).toHaveAttribute('aria-selected', 'true')
      expect(await style(open, 'color')).toBe(await tokenColour(page, '--primary-text'))
      expect(await style(other, 'color')).toBe(await tokenColour(page, '--muted-foreground'))
      expect(await open.evaluate((node) => getComputedStyle(node, '::after').backgroundColor)).toBe(
        await tokenColour(page, '--primary', 'backgroundColor'),
      )
    })
  }

  test('under graphite-periwinkle the open name is the accent, not the text colour', async ({ page }) => {
    await page.goto(`${HARNESS}app-entityview--details-tab&theme=dark&palette=graphite-periwinkle`)
    const open = page.getByRole('tab', { name: 'Notes' })
    expect(await style(open, 'color')).not.toBe(await tokenColour(page, '--foreground'))
  })
})

test.describe('a picked choice in the theme colour', () => {
  for (const { name, query } of THEMES) {
    test(`a primary border and its word in --primary-text, the rest muted (${name})`, async ({ page }) => {
      await page.goto(`${HARNESS}app-formcontrols--status-choices&${query}`)
      const group = page.getByTestId('status-choices-page').getByRole('group', { name: 'Outcome' })
      const picked = group.getByRole('button', { name: 'Booked' })
      const other = group.getByRole('button', { name: 'Done' })
      await expect(picked).toHaveAttribute('aria-pressed', 'true')
      expect(await style(picked, 'borderTopColor')).toBe(await tokenColour(page, '--primary'))
      expect(await style(picked, 'color')).toBe(await tokenColour(page, '--primary-text'))
      expect(await style(other, 'color')).toBe(await tokenColour(page, '--muted-foreground'))
      // The fill is tinted, so the pick differs from the rest by more than its border.
      expect(await style(picked, 'backgroundColor')).not.toBe(await style(other, 'backgroundColor'))

      await other.click()
      await expect(other).toHaveAttribute('aria-pressed', 'true')
      // Colours ease in (the toggle's transition), so wait for it to settle.
      const primaryText = await tokenColour(page, '--primary-text')
      await expect.poll(() => style(other, 'color')).toBe(primaryText)
    })
  }
})

test("a status choice's icons take their kinds' colours, as StatusMark's do", async ({ page }) => {
  await page.goto(`${HARNESS}app-formcontrols--status-choices&theme=dark&palette=graphite-periwinkle`)
  const group = page.getByTestId('status-choices-page').getByRole('group', { name: 'Urgency' })
  const tones: Record<string, string> = { attention: '--destructive-text', paused: '--warning-text', active: '--success-text' }
  for (const [label, kind] of [['Now', 'attention'], ['Soon', 'paused'], ['Going', 'active']] as const) {
    const icon = group.getByRole('button', { name: label }).locator('[data-slot=choice-buttons-icon]')
    await expect(icon).toHaveAttribute('data-kind', kind)
    expect(await style(icon, 'color')).toBe(await tokenColour(page, tones[kind]!))
  }
  // A plain icon, with no kind, keeps the button's colour.
  const delivery = page.getByTestId('status-choices-page').getByRole('group', { name: 'Delivery' })
  const plain = delivery.getByRole('button', { name: 'Pick Up' })
  expect(await style(plain.locator('svg'), 'color')).toBe(await style(plain, 'color'))
})

test.describe('the column header row reads apart from the rows', () => {
  for (const story of ['list-tools', 'framed'] as const) {
    test(`the muted fill on every header cell (${story})`, async ({ page }) => {
      await page.goto(`${HARNESS}app-datatable-tools--${story}&theme=light`)
      const muted = await tokenColour(page, '--muted', 'backgroundColor')
      const heads = page.locator('thead th')
      await expect(heads.first()).toBeVisible()
      for (const head of await heads.all()) expect(await style(head, 'backgroundColor')).toBe(muted)
      const cell = page.locator('tbody tr').first().locator('td').first()
      expect(await style(cell, 'backgroundColor')).not.toBe(muted)
    })
  }
})

test('the ⋯ menu keeps each item on one line', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`${HARNESS}app-datatable-tools--framed&theme=light`)
  await page.getByRole('button', { name: 'More for Houseplants' }).click()
  const item = page.getByRole('menuitemcheckbox', { name: 'Show Deleted' })
  await expect(item).toBeVisible()
  // The words are one text node; on one line it has one box.
  const lines = await item.evaluate((node) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
    let text: Node | null
    while ((text = walker.nextNode())) {
      if (text.textContent?.includes('Show Deleted')) {
        const range = document.createRange()
        range.selectNodeContents(text)
        return range.getClientRects().length
      }
    }
    return 0
  })
  expect(lines).toBe(1)
  expect(await item.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe('nowrap')
})

test("a small card dialog leaves the record's strip out", async ({ page }) => {
  await page.goto(`${HARNESS}app-recorddialog--card&theme=light`)
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Display Order')).toBeVisible()
  await expect(dialog.locator('[data-slot=entity-view-strip]')).toHaveCount(0)
  await expect(dialog.locator('[data-slot=key-stats]')).toHaveCount(0)
})
