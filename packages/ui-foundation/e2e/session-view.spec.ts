import { expect, test, type Page } from '@playwright/test'

// SessionView and a timed screen's parts (app/SessionView's Timer story),
// in a real browser: a modal named by its title that holds focus and
// closes on Esc, the wake lock held and asked for again when the tab
// returns, real fullscreen where the browser has it, the clock's states
// reached with Playwright's fake clock (docs/foundation/timed-screens.md),
// and the reduced-motion swap. Axe in both themes is
// e2e/storybook-visual.spec.ts's COMPOSITE_STORIES.
const STORY = 'http://localhost:6006/iframe.html?id=app-sessionview--timer&viewMode=story'

const view = (page: Page) => page.getByRole('dialog', { name: 'Morning stretch' })
const timeLeft = (page: Page) => view(page).getByRole('timer', { name: 'Time left' })
const status = (page: Page) => view(page).getByRole('status')

async function open(page: Page) {
  await page.goto(STORY)
  await expect(view(page)).toBeVisible()
}

test('covers the viewport, named by its title, focus on its main control', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  const box = await view(page).boundingBox()
  expect(box).toEqual({ x: 0, y: 0, width: 390, height: 844 })
  await expect(view(page).getByRole('button', { name: 'Start' })).toBeFocused()
})

// Tab past the last control lands on Base UI's focus guard for a moment,
// which sends focus back to the first: so each step is polled.
test('focus stays inside while open, Tab wrapping to the header', async ({ page }) => {
  await open(page)
  const focused = () =>
    page.evaluate(() => {
      const active = document.activeElement
      return active?.closest('[role=dialog]') ? (active.getAttribute('aria-label') ?? active.textContent) : 'outside'
    })
  const order: (string | null)[] = []
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab')
    await expect.poll(focused).not.toBe('outside')
    order.push(await focused())
  }
  expect(order).toEqual(['Mute', 'Full screen', 'Close', 'Start'])
})

test('Esc closes it through onOpenChange, and focus goes back to what opened it', async ({ page }) => {
  await open(page)
  await page.keyboard.press('Escape')
  await expect(view(page)).toBeHidden()
  await expect(page.getByText('Session closed')).toBeVisible()

  const opener = page.getByRole('button', { name: 'Open the session' })
  await opener.click()
  await expect(view(page)).toBeVisible()
  await view(page).getByRole('button', { name: 'Close' }).click()
  await expect(view(page)).toBeHidden()
  await expect(opener).toBeFocused()
})

test.describe('keepAwake', () => {
  // A wake lock that records each request and release, and a tab whose
  // visibility the test sets: headless Chromium has no screen to keep on.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const log: string[] = []
      let visibility: DocumentVisibilityState = 'visible'
      Object.defineProperty(document, 'visibilityState', { get: () => visibility })
      Object.assign(window, {
        __wakeLog: log,
        __setVisibility(state: DocumentVisibilityState) {
          visibility = state
          document.dispatchEvent(new Event('visibilitychange'))
        },
      })
      let current: (EventTarget & { release(): Promise<void> }) | null = null
      Object.assign(window, { __dropLock: () => current?.release() })
      Object.defineProperty(navigator, 'wakeLock', {
        value: {
          request: async () => {
            log.push('request')
            const sentinel = Object.assign(new EventTarget(), {
              released: false,
              async release() {
                if (sentinel.released) return
                sentinel.released = true
                log.push('release')
                sentinel.dispatchEvent(new Event('release'))
              },
            })
            current = sentinel
            return sentinel
          },
        },
      })
    })
  })

  const log = (page: Page) => page.evaluate(() => (window as unknown as { __wakeLog: string[] }).__wakeLog)

  test('held while open, asked for again when the tab returns, released on close', async ({ page }) => {
    await open(page)
    await expect.poll(() => log(page)).toEqual(['request'])

    // Hidden: the browser drops the lock. Visible again: asked for again.
    await page.evaluate(() => {
      const w = window as unknown as { __setVisibility(s: string): void; __dropLock(): void }
      w.__setVisibility('hidden')
      w.__dropLock()
    })
    await page.evaluate(() => (window as unknown as { __setVisibility(s: string): void }).__setVisibility('visible'))
    await expect.poll(() => log(page)).toEqual(['request', 'release', 'request'])

    await page.keyboard.press('Escape')
    await expect.poll(() => log(page)).toEqual(['request', 'release', 'request', 'release'])
  })
})

test.describe('the Full screen control', () => {
  test('asks the browser for fullscreen, pressed while it holds, and leaves it on close', async ({ page }) => {
    await open(page)
    const control = view(page).getByRole('button', { name: 'Full screen' })
    await expect(control).toHaveAttribute('aria-pressed', 'false')
    await control.click()
    await expect(control).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true)

    await view(page).getByRole('button', { name: 'Close' }).click()
    await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull()
  })

  test("isn't there where the browser has no fullscreen (iOS Safari on a phone)", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(document, 'fullscreenEnabled', { get: () => false }))
    await open(page)
    await expect(view(page).getByRole('button', { name: 'Close' })).toBeVisible()
    await expect(view(page).getByRole('button', { name: 'Full screen' })).toHaveCount(0)
  })
})

// The recipe from docs/foundation/timed-screens.md: install the clock
// before goto, then fastForward (not runFor) to each state.
test('running, paused and done, reached with the fake clock', async ({ page }) => {
  await page.clock.install()
  await open(page)
  await expect(timeLeft(page)).toHaveText('1:00')
  await expect(status(page)).toHaveText('Ready')

  await view(page).getByRole('button', { name: 'Start' }).click()
  await page.clock.fastForward('00:20')
  await expect(timeLeft(page)).toHaveText('0:40')
  await expect(status(page)).toHaveText('Running')

  await view(page).getByRole('button', { name: 'Pause' }).click()
  await page.clock.fastForward('05:00')
  await expect(status(page)).toHaveText('Paused')
  await expect(timeLeft(page)).toHaveText('0:40')

  await view(page).getByRole('button', { name: 'Resume' }).click()
  await page.clock.fastForward('00:40')
  await expect(status(page)).toHaveText('Done')
  await expect(timeLeft(page)).toHaveText('0:00')
  await expect(view(page).getByRole('button', { name: 'Start again' })).toBeVisible()
})

test('closed, the clock holds; reopened, it carries on', async ({ page }) => {
  await page.clock.install()
  await open(page)
  await view(page).getByRole('button', { name: 'Start' }).click()
  await page.clock.fastForward('00:10')
  await expect(timeLeft(page)).toHaveText('0:50')

  await page.keyboard.press('Escape')
  await expect(view(page)).toBeHidden()
  await page.clock.fastForward('02:00')
  await page.getByRole('button', { name: 'Open the session' }).click()
  await expect(timeLeft(page)).toHaveText('0:50')
  await expect(status(page)).toHaveText('Running')
})

test('mute is remembered across a reload', async ({ page }) => {
  await open(page)
  const mute = view(page).getByRole('button', { name: 'Mute' })
  await expect(mute).toHaveAttribute('aria-pressed', 'false')
  await mute.click()
  await expect(mute).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(view(page).getByRole('button', { name: 'Mute' })).toHaveAttribute('aria-pressed', 'true')
})

test('reduced motion swaps the breathing circle for a still one', async ({ page }) => {
  await open(page)
  const circle = view(page).locator('[data-motion]')
  await expect(circle).toHaveAttribute('data-motion', 'full')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(circle).toHaveAttribute('data-motion', 'reduced')
})
