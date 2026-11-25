import { expect, test, type Page } from '@playwright/test'

// The large densities on whole screens, set on <html> as an app sets them:
// the shell, a list, a record page and a dialog neither scroll sideways nor
// cut a control off at a laptop's and a TV's width, and what is portaled to
// <body> (a dialog, a menu) grows with the page. Axe and the token check in
// both themes, and each primitive's size, are fixtures-visual.spec.ts's.
const story = (id: string, density: string) =>
  `http://localhost:6180/story.html?id=${id}&theme=light&density=${density}`

const SCREENS = [
  { name: 'the shell', id: 'app-appshell--standard', ready: (page: Page) => page.locator('[data-slot=sidebar-container]') },
  { name: 'a list', id: 'app-datatable-tools--framed', ready: (page: Page) => page.getByRole('table').first() },
  { name: 'a record page', id: 'app-entityview--facts-rail', ready: (page: Page) => page.locator('[data-state="success"][data-layout]').first() },
  { name: 'a record in a dialog', id: 'app-recorddialog--open', ready: (page: Page) => page.getByRole('dialog') },
]

// Buttons, fields and links whose box runs past the window's or the
// dialog's right edge.
const cutOff = (page: Page) =>
  page.evaluate(() => {
    const spill: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>('button, input, a[href], [role=combobox], [role=tab]')) {
      const box = el.getBoundingClientRect()
      if (box.width <= 1 || box.height <= 1) continue
      if (el.closest('[data-slot=table-container]')) continue
      const edge = el.closest('[role=dialog]')?.getBoundingClientRect().right ?? window.innerWidth
      if (box.right > edge + 1 || box.left < -1) spill.push(`${el.tagName} ${el.textContent?.trim().slice(0, 40)}`)
    }
    return spill
  })

for (const density of ['large', 'extra-large']) {
  for (const width of [1280, 1920]) {
    test.describe(`${density} at ${width}`, () => {
      test.use({ viewport: { width, height: width === 1280 ? 800 : 1080 } })

      for (const { name, id, ready } of SCREENS) {
        test(`${name} doesn't overflow`, async ({ page }) => {
          await page.goto(story(id, density))
          await expect(page.locator('html')).toHaveAttribute('data-density', density)
          await expect(ready(page)).toBeVisible()
          const spill = await page.evaluate(() => {
            const root = document.documentElement
            const dialog = document.querySelector('[role=dialog]')
            return {
              page: root.scrollWidth - root.clientWidth,
              dialog: dialog ? dialog.scrollWidth - dialog.clientWidth : 0,
            }
          })
          expect(spill).toEqual({ page: 0, dialog: 0 })
          expect(await cutOff(page)).toEqual([])
        })
      }

      // The desktop layout stays: a breakpoint is the window's width, which
      // the density doesn't move.
      test('keeps the desktop sidebar', async ({ page }) => {
        await page.goto(story('app-appshell--standard', density))
        const sidebar = page.locator('[data-slot=sidebar-container]')
        await expect(sidebar).toBeVisible()
        const got = await sidebar.evaluate((el) => el.getBoundingClientRect().width)
        expect(got).toBeCloseTo(density === 'large' ? 320 : 358.4, 0)
      })
    })
  }
}

// The rail grows with the text by the density's own scale (300px × 1.25 at
// large, × 1.4 at extra-large), so a short value keeps its line beside its
// label.
for (const [density, railWidth] of [['default', 300], ['large', 375], ['extra-large', 420]] as const) {
  test(`the facts rail keeps each label beside its value (${density})`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(story('app-entityview--facts-rail', density))
    const rail = page.locator('[data-slot=entity-view-facts-rail]')
    await expect(rail).toBeVisible()
    expect((await rail.boundingBox())!.width).toBeCloseTo(railWidth, 0)
    const rows = await rail.locator('dl > div').evaluateAll((all) =>
      all.map((row) => {
        const [label, value] = [row.querySelector('dt')!, row.querySelector('dd')!].map((el) => el.getBoundingClientRect())
        return { beside: value!.left >= label!.right, fits: value!.right <= row.closest('[data-slot=card]')!.getBoundingClientRect().right }
      }),
    )
    expect(rows.length).toBeGreaterThan(3)
    expect(rows.every((row) => row.beside && row.fits)).toBe(true)
    // The tab bar stops short of the rail, as it does at the default.
    const bar = (await page.getByRole('tablist').boundingBox())!
    expect(bar.x + bar.width).toBeLessThanOrEqual((await rail.boundingBox())!.x)
  })
}

test('popups follow extra-large: a dialog on <body> takes its text and its control height', async ({ page }) => {
  await page.goto(story('app-formdialog--default', 'extra-large'))
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const input = dialog.getByRole('textbox').first()
  const got = await input.evaluate((el) => ({
    // The dialog isn't inside the fixture: it's portaled.
    portaled: !document.getElementById('root')!.contains(el),
    // The computed height: the box is scaled while the dialog opens.
    height: parseFloat(getComputedStyle(el).height),
    text: parseFloat(getComputedStyle(el).fontSize),
  }))
  expect(got.portaled).toBe(true)
  // A form's field is 8 steps of spacing.
  expect(got.height).toBeCloseTo(44.8, 1)
  expect(got.text).toBe(20)
})
