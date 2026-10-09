import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// DataTable's opt-ins for a small entity (app/DataTable stories), in a
// real browser: `width="content"` (issue #104) and editing in its rows
// with InlineCreate (issue #105). Axe and the token check on the stories
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
