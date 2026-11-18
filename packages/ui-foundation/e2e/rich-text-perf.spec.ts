import { expect, test, type Page } from '@playwright/test'

// Typing in a long note (F6 of the 2026-11-17 review): about 5,000 words
// with 13 tables, typed into under 4× CPU throttling (Chrome's DevTools
// Protocol), the speed of a mid-range phone. Before the fix each key ran
// the whole merge back to Markdown and re-rendered every table's grips:
// 0.9 s a key. Now the merge waits for a pause, so no key's work is a
// long task over 50 ms. The control shows the measure catches per-key
// work: the same typing with 80 ms of work added to each key fails it.
const LONG_NOTE = 'http://localhost:6180/story.html?id=app-richtexteditor--long-note'
const BUDGET_MS = 50
const KEYS = 'steady words'

function editor(page: Page) {
  return page.getByRole('textbox', { name: 'long note', exact: true })
}

// Long tasks (over 50 ms, the browser's own threshold) from here on.
async function watchLongTasks(page: Page) {
  await page.evaluate(() => {
    const seen: number[] = []
    ;(window as unknown as { longTasks: number[] }).longTasks = seen
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) seen.push(entry.duration)
    }).observe({ type: 'longtask' })
  })
}

const longTasks = (page: Page) => page.evaluate(() => (window as unknown as { longTasks: number[] }).longTasks)

// Types into the middle of the note, one key every 60 ms (a fast typist),
// throttled; the long tasks seen while typing, before the pause after it.
async function typeThrottled(page: Page) {
  await page.goto(LONG_NOTE)
  await expect(editor(page)).toBeVisible()
  const middle = editor(page).getByRole('heading', { name: 'Part 7' }).locator('xpath=following-sibling::p[1]')
  await middle.click()
  await expect(editor(page)).toBeFocused()
  await page.keyboard.press('End')
  // Opening the note isn't measured, nor the first letter and first space
  // after it: each pays once for compiling its path (the first letter's
  // layout too, about 45 ms throttled; the first space, its link and
  // input-rule checks, up to about 50). After a pause or a caret move the
  // first key is about 25 ms. Their merge has run before typing starts.
  await page.keyboard.type('a b', { delay: 60 })
  await page.waitForTimeout(1500)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await watchLongTasks(page)
  await page.keyboard.type(KEYS, { delay: 60 })
  // Within the pause (300 ms), so the merge it waits for isn't counted.
  await page.waitForTimeout(100)
  const tasks = await longTasks(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  return tasks
}

test.describe('rich text: typing in a long note', () => {
  // One at a time: two throttled pages at once share the machine's CPU.
  test.describe.configure({ mode: 'serial' })
  test.skip(({ browserName }) => browserName !== 'chromium', 'CPU throttling and long tasks are Chromium’s')

  test(`no key is a long task over ${BUDGET_MS} ms, throttled 4×`, async ({ page }) => {
    const tasks = await typeThrottled(page)
    expect(tasks.filter((duration) => duration > BUDGET_MS), `long tasks: ${tasks.map(Math.round).join(', ')} ms`).toEqual([])
    // The typing is all there, and saved once typing stops.
    await expect(page.getByTestId('saved-long note')).toContainText(KEYS)
  })

  test('control: 80 ms of work on each key fails the budget', async ({ page }) => {
    await page.addInitScript(() => {
      window.addEventListener(
        'keydown',
        () => {
          // Busy for 80 ms of the clock, however fast the CPU runs.
          const until = performance.now() + 80
          while (performance.now() < until) {
            // busy
          }
        },
        true,
      )
    })
    const tasks = await typeThrottled(page)
    expect(tasks.filter((duration) => duration > BUDGET_MS).length).toBeGreaterThanOrEqual(KEYS.length / 2)
  })

  test('the typing is reported at once on leaving the text, before the pause', async ({ page }) => {
    await page.goto(LONG_NOTE)
    await expect(editor(page)).toBeVisible()
    await editor(page).getByRole('heading', { name: 'Part 3' }).click()
    await expect(editor(page)).toBeFocused()
    await page.keyboard.press('End')
    await page.keyboard.type(' quick')
    // Blurred in the same task as the check: the merge ran in the blur.
    const reported = await page.evaluate(() => {
      const text = document.querySelector<HTMLElement>('[contenteditable="true"]')!
      const saved = document.querySelector('[data-testid="saved-long note"]')!
      const before = saved.textContent!.includes('Part 3 quick')
      text.blur()
      return new Promise<{ before: boolean; after: boolean }>((resolve) =>
        // A frame later: React has drawn what onChange set, well inside the pause.
        requestAnimationFrame(() => resolve({ before, after: saved.textContent!.includes('Part 3 quick') })),
      )
    })
    expect(reported).toEqual({ before: false, after: true })
  })
})
