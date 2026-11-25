import { expect, test, type Locator, type Page } from '@playwright/test'

// The facts rail with long values (Facts rail, long values), at every Text
// Size: the rail grows with the text (300px, 375px at Large, 420px at Extra
// Large), the page by the same amount, and nothing in it is ever cut. A
// value too long for its line wraps (a badge inside its badge, unbroken
// text anywhere), in the rail, in Details where it folds and in a record
// dialog. The record's title takes its row up to the header's buttons.
// Axe in both themes, and at both large densities, is fixtures-visual.spec.ts's.
const story = (id: string, density: string) => `http://localhost:6180/story.html?id=${id}&theme=light&density=${density}`

const DENSITIES = [
  { density: 'default', rail: 300 },
  { density: 'large', rail: 375 },
  { density: 'extra-large', rail: 420 },
] as const

// What in `root` is cut: an element whose content is wider than its box
// (scrollWidth > clientWidth), one drawn with an ellipsis, and one whose box
// runs past `root`'s own. Screen-reader-only text is a 1px box by design.
const cutIn = (root: Locator) =>
  root.evaluate((box) => {
    const edge = box.getBoundingClientRect()
    const cut: string[] = []
    for (const el of box.querySelectorAll<HTMLElement>('*')) {
      if (el.closest('.sr-only')) continue
      const style = getComputedStyle(el)
      if (style.display === 'none') continue
      const name = `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 40)}"`
      // An edited row's hover bleeds into the card's padding (-mx-2), by
      // design: what holds such rows is measured by the rows' own values.
      const row = '[class~="group/edit-row"]'
      const holdsEditRows = el.querySelector(`:scope > ${row}, :scope > * > ${row}`)
      if (!holdsEditRows && el.scrollWidth > el.clientWidth + 1 && style.display !== 'inline') cut.push(`${name} ${el.scrollWidth}>${el.clientWidth}`)
      if (style.textOverflow === 'ellipsis' && style.overflow !== 'visible' && el.scrollWidth > el.clientWidth) cut.push(`${name} ellipsis`)
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && (rect.right > edge.right + 1 || rect.left < edge.left - 1)) cut.push(`${name} past the edge`)
    }
    return cut
  })

const rail = (page: Page) => page.locator('[data-slot=entity-view-facts-rail]')

// The h1's lines: its height over its line height.
const titleLines = (page: Page) =>
  page.getByRole('heading', { level: 1 }).evaluate((h1) => Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight)))

for (const { density, rail: width } of DENSITIES) {
  test.describe(`at ${density}`, () => {
    test(`the rail is ${width}px, the page grows with it, and nothing in it is cut (1920)`, async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.goto(story('app-entityview--facts-rail-long', density))
      await expect(rail(page)).toBeVisible()
      expect((await rail(page).boundingBox())!.width).toBeCloseTo(width, 0)
      // The page's cap: the column's max-w-4xl, the gap and the rail.
      const view = await page.locator('[data-facts-rail]').evaluate((el) => ({
        width: el.getBoundingClientRect().width,
        // --spacing is in rem: 0.25rem, 0.3125rem, 0.35rem.
        spacing: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--spacing')) * 16,
      }))
      expect(view.width).toBeCloseTo(896 + view.spacing * 6 + width, 0)
      expect(await cutIn(rail(page))).toEqual([])
      // Every value wrapped is still all there: the long ones on more than one line.
      const where = rail(page).getByText('Under the kitchen sink, left side')
      await expect(where).toBeVisible()
      const badge = rail(page).getByText('The second payment on the car has cleared')
      await expect(badge).toBeVisible()
      // "Quick win" whole on one line, the badge no longer cut with room beside it.
      const quick = rail(page).getByText('Quick win', { exact: true })
      expect(await quick.evaluate((el) => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().height < 2 * parseFloat(getComputedStyle(el).lineHeight))).toBe(true)
      // The title on one line, up to the header's buttons.
      expect(await titleLines(page)).toBe(1)
    })

    test('folded into Details on a phone, nothing is cut either', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(story('app-entityview--facts-rail-long', density))
      await page.getByRole('tab', { name: 'Details' }).click()
      const details = page.getByRole('tabpanel', { name: 'Details' })
      await expect(details.getByText('Somewhat interested')).toBeVisible()
      await expect(rail(page)).toHaveCount(0)
      expect(await cutIn(details)).toEqual([])
    })

    test('in a record dialog: beside the body where it has room, in Details where not; nothing cut', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.goto(story('app-entityview--facts-rail-long-in-a-dialog', density))
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('heading', { name: 'Fix the leaking tap' })).toBeVisible()
      expect(await titleLines(page)).toBe(1)
      // Measured once the dialog has its width: the rail, or a Details tab.
      const details = dialog.getByRole('tab', { name: 'Details' })
      await expect(rail(page).or(details)).toBeVisible()
      if (await rail(page).isVisible()) {
        expect((await rail(page).boundingBox())!.width).toBeCloseTo(width, 0)
        expect(await cutIn(rail(page))).toEqual([])
      } else {
        await details.click()
        const panel = dialog.getByRole('tabpanel', { name: 'Details' })
        await expect(panel.getByText('Somewhat interested')).toBeVisible()
        expect(await cutIn(panel)).toEqual([])
      }
      expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0)
    })
  })
}

// The room the rail asks for grows with it: at Large a page 1,000px wide
// (under its 1,041px) folds the rail into Details, where Regular's 960px
// keeps it beside the body.
test('the room the rail needs grows with the Text Size', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 900 })
  await page.goto(story('app-entityview--facts-rail-long', 'default'))
  await expect(rail(page)).toBeVisible()
  await page.goto(story('app-entityview--facts-rail-long', 'large'))
  await expect(page.getByRole('tab', { name: 'Details' })).toBeVisible()
  await expect(rail(page)).toHaveCount(0)
  // A change of Text Size measures again, with no resize.
  await page.evaluate(() => document.documentElement.setAttribute('data-density', 'default'))
  await expect(rail(page)).toBeVisible()
})

test("the Emoji fact is Noto's picture named by the emoji, edited in place", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(story('app-entityview--facts-rail-long', 'default'))
  const emoji = rail(page).getByRole('img', { name: '🔧' })
  await expect(emoji).toBeVisible()
  expect((await emoji.boundingBox())!.width).toBeCloseTo(20, 0)
  await rail(page).getByRole('button', { name: 'Edit Emoji' }).click()
  const box = rail(page).getByRole('textbox', { name: 'Emoji' })
  await box.fill('🚰')
  await box.press('Enter')
  await expect(rail(page).getByRole('img', { name: '🚰' })).toBeVisible()
})
