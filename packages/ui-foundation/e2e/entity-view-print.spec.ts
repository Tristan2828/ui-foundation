import { expect, test, type Page } from '@playwright/test'

// EntityView's Print notes (app/EntityView "Print Notes"), in a real
// browser with print media emulated: the button mounts the printed copy
// and opens the print dialog (stubbed here, counting calls); on paper the
// copy is all there is (no rail, no shell, no buttons), folded text is
// whole, tables are ruled with room in their cells, numbered questions
// have space under them, and a dark screen still prints light, in a
// palette too. The copy
// goes when the dialog closes (afterprint).
const STORY = 'http://localhost:6180/story.html?id=app-entityview--print-notes'

async function open(page: Page, theme: 'light' | 'dark' = 'light', palette?: string) {
  await page.addInitScript(() => {
    const w = window as unknown as { printCalls: number }
    w.printCalls = 0
    window.print = () => {
      w.printCalls += 1
    }
  })
  await page.goto(`${STORY}&theme=${theme}${palette ? `&palette=${palette}` : ''}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Check-up' })).toBeVisible()
}

const copy = (page: Page) => page.locator('[data-print-notes]')
const printCalls = (page: Page) => page.evaluate(() => (window as unknown as { printCalls: number }).printCalls)

test('the button prints a copy of the marked sections, gone after the dialog closes', async ({ page }) => {
  await open(page)
  await expect(copy(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Print Notes' }).click()
  await expect(copy(page)).toHaveCount(1)
  expect(await printCalls(page)).toBe(1)
  // On screen it never shows.
  await expect(copy(page)).toBeHidden()

  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await expect(copy(page)).toHaveCount(0)
})

test('on paper: the marked sections alone, under the title', async ({ page }) => {
  await open(page)
  // Folded on screen: printed whole all the same.
  await page.getByRole('button', { name: 'Questions', exact: true }).click()
  await expect(page.getByText('In priority order.')).toBeHidden()

  await page.getByRole('button', { name: 'Print Notes' }).click()
  await page.emulateMedia({ media: 'print' })

  await expect(copy(page)).toBeVisible()
  await expect(page.locator('#root')).toBeHidden()
  const printed = copy(page)
  await expect(printed.getByRole('heading', { level: 1, name: 'Check-up' })).toBeVisible()
  await expect(printed.getByText('Mar 9, 2026 · Visit')).toBeVisible()
  await expect(printed.getByRole('heading', { level: 2 })).toHaveText(['Prep', 'Questions'])
  await expect(printed.getByText('In priority order.')).toBeVisible()
  await expect(printed.getByText('Climbing the stairs')).toBeVisible()
  // Not the rail, not an unmarked section, no buttons.
  await expect(printed.getByText('The clinic')).toHaveCount(0)
  await expect(printed.getByText('No files yet')).toHaveCount(0)
  await expect(printed.getByRole('button')).toHaveCount(0)
})

test('on paper: tables are ruled with room to write, questions have space under them', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Print Notes' }).click()
  await page.emulateMedia({ media: 'print' })
  const printed = copy(page)

  const cell = printed.locator('td').nth(1)
  const look = await cell.evaluate((el) => {
    const style = getComputedStyle(el)
    return { border: style.borderTopWidth, height: el.getBoundingClientRect().height }
  })
  expect(look.border).toBe('1px')
  expect(look.height).toBeGreaterThanOrEqual(40)
  // Nothing cut off at a scroll box's edge.
  const container = printed.locator('[data-slot="table-container"]')
  expect(await container.evaluate((el) => getComputedStyle(el).overflowX)).toBe('visible')

  const question = printed.locator('[data-answer-space] ol > li').first()
  expect(await question.evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom))).toBeGreaterThanOrEqual(80)
  // A section without answerSpace keeps its lists tight.
  const prepItem = printed.locator('section:not([data-answer-space]) li').first()
  expect(await prepItem.evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom))).toBe(0)
})

for (const palette of [undefined, 'indigo-cyan', 'violet']) {
test(`a dark screen prints light${palette ? ` (palette ${palette})` : ''}`, async ({ page }) => {
  await open(page, 'dark', palette)
  if (palette) await expect(page.locator('html')).toHaveAttribute('data-palette', palette)
  const before = await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor)
  await page.getByRole('button', { name: 'Print Notes' }).click()
  await page.emulateMedia({ media: 'print' })
  const paper = await copy(page).evaluate((el) => {
    const probe = document.createElement('div')
    probe.style.backgroundColor = 'var(--white)'
    el.append(probe)
    const white = getComputedStyle(probe).backgroundColor
    probe.remove()
    return { background: getComputedStyle(el).backgroundColor, white }
  })
  expect(paper.background).not.toBe(before)
  expect(paper.background).toBe(paper.white)
  // Its text is the light theme's too, not the palette's.
  const ink = await copy(page).evaluate((el) => {
    const probe = document.createElement('div')
    probe.style.color = 'var(--black)'
    el.append(probe)
    const black = getComputedStyle(probe).color
    probe.remove()
    return { color: getComputedStyle(el).color, black }
  })
  expect(ink.color).toBe(ink.black)
})
}

// Palm LCD, the light palette: the screen is its green, and paper is still
// white with the light theme's black text, not the LCD's.
test('the light palette prints white, not its green', async ({ page }) => {
  await open(page, 'light', 'palm-lcd')
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'palm-lcd')
  expect(await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(201, 209, 178)')
  await page.getByRole('button', { name: 'Print Notes' }).click()
  await page.emulateMedia({ media: 'print' })
  const paper = await copy(page).evaluate((el) => {
    const probe = document.createElement('div')
    probe.style.backgroundColor = 'var(--white)'
    probe.style.color = 'var(--black)'
    el.append(probe)
    const { backgroundColor: white, color: black } = getComputedStyle(probe)
    probe.remove()
    return { background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color, white, black }
  })
  expect(paper.background).toBe(paper.white)
  expect(paper.color).toBe(paper.black)
})
