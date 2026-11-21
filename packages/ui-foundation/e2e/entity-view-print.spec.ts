import { expect, test, type Page } from '@playwright/test'

// EntityView's Print notes (app/EntityView "Print Notes"), in a real browser with print media emulated:
// the printed copy is all there is on paper, and it goes when the dialog closes (afterprint) or, on a phone, on the next input.
const STORY = 'http://localhost:6180/story.html?id=app-entityview--print-notes'

// How the browser's window.print() behaves: `blocking` waits for the dialog
// like a desktop browser (the page's clock jumps ahead, rather than the test
// really waiting), `phone` returns at once and fires afterprint inside the
// call, before any preview exists.
type PrintMode = 'blocking' | 'phone'

async function open(page: Page, theme: 'light' | 'dark' = 'light', palette?: string, mode: PrintMode = 'blocking') {
  await page.addInitScript((printMode) => {
    const w = window as unknown as { printCalls: number }
    w.printCalls = 0
    const now = performance.now.bind(performance)
    let skew = 0
    performance.now = () => now() + skew
    window.print = () => {
      w.printCalls += 1
      if (printMode === 'phone') window.dispatchEvent(new Event('afterprint'))
      else skew += 5000
    }
  }, mode)
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

test('a blocking print that finishes inside the call takes the copy away at once', async ({ page }) => {
  await open(page)
  await page.evaluate(() => {
    const blocking = window.print
    window.print = () => {
      blocking()
      window.dispatchEvent(new Event('afterprint'))
    }
  })
  await page.getByRole('button', { name: 'Print Notes' }).click()
  await expect(copy(page)).toHaveCount(0)
  expect(await printCalls(page)).toBe(1)
})

test('on a phone, print() returns at once and afterprint fires early: the copy stays until the next touch', async ({ page }) => {
  await open(page, 'light', undefined, 'phone')
  await page.getByRole('button', { name: 'Print Notes' }).click()
  expect(await printCalls(page)).toBe(1)
  // afterprint has already fired, inside print(), and again now.
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await expect(copy(page)).toHaveCount(1)
  await expect(copy(page)).toBeHidden()

  await page.evaluate(() => window.dispatchEvent(new Event('pointerdown')))
  await expect(copy(page)).toHaveCount(0)
})

test('on a phone, a key press also takes the copy away', async ({ page }) => {
  await open(page, 'light', undefined, 'phone')
  await page.getByRole('button', { name: 'Print Notes' }).click()
  await expect(copy(page)).toHaveCount(1)
  await page.keyboard.press('Shift')
  await expect(copy(page)).toHaveCount(0)
})

test('on a phone, pressing the button while the copy is up prints it again', async ({ page }) => {
  await open(page, 'light', undefined, 'phone')
  const button = page.getByRole('button', { name: 'Print Notes' })
  await button.click()
  await expect(copy(page)).toHaveCount(1)
  // A press with no pointerdown before it (a script's, say) finds the copy
  // still up and prints it again. (A real press's pointerdown takes it away
  // first, and the press prints a fresh one: the same count.)
  await button.evaluate((el) => (el as HTMLButtonElement).click())
  await expect(copy(page)).toHaveCount(1)
  expect(await printCalls(page)).toBe(2)
  await button.click()
  await expect(copy(page)).toHaveCount(1)
  expect(await printCalls(page)).toBe(3)
})

test('on a phone, the copy is still there when the page is printed (paper shows the notes)', async ({ page }) => {
  await open(page, 'light', undefined, 'phone')
  await page.getByRole('button', { name: 'Print Notes' }).click()
  await page.emulateMedia({ media: 'print' })
  await expect(copy(page)).toBeVisible()
  await expect(page.locator('#root')).toBeHidden()
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
