import { expect, test, type Page } from '@playwright/test'

// ImageViewer (app/ImageViewer stories), in a real browser: a modal over
// the whole viewport named by its title, stepped by its buttons, the arrow
// keys, Home and End, the wheel and a swipe; Esc and Close return focus to
// the cover that opened it; an app's action beside the caption; a spinner
// while the next image loads and a message in the frame when one can't.
// Axe in both themes and the glyphs' 3:1 are e2e/fixtures-visual.spec.ts.
const story = (id: string) => `http://localhost:6180/story.html?id=app-imageviewer--${id}`

const viewer = (page: Page) => page.getByRole('dialog', { name: 'Plates' })
const counter = (page: Page) => viewer(page).locator('[data-slot=image-viewer-counter]')
const shown = (page: Page) => viewer(page).locator('[data-slot=image-viewer-frame] img')
const previous = (page: Page) => viewer(page).getByRole('button', { name: 'Previous Image' })
const next = (page: Page) => viewer(page).getByRole('button', { name: 'Next Image' })

async function open(page: Page, id = 'default') {
  await page.goto(story(id))
  await expect(viewer(page)).toBeVisible()
}

test('covers the viewport, named by its title, the image, its counter and caption, focus inside', async ({ page }) => {
  for (const size of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size)
    await open(page)
    expect(await viewer(page).boundingBox()).toEqual({ x: 0, y: 0, ...size })
    await expect(counter(page)).toHaveText('3 of 7')
    await expect(shown(page)).toHaveAttribute('alt', 'Plate 3: a green circle over two dark green lines')
    await expect(viewer(page).locator('[data-slot=image-viewer-caption]')).toHaveText('Plate 3 · Set A')
    await expect(viewer(page).getByRole('button', { name: 'Start From Here' })).toBeVisible()
    await expect(viewer(page).getByRole('button', { name: 'Close' })).toBeFocused()
    // The image fits inside the frame, whole.
    const frame = await viewer(page).locator('[data-slot=image-viewer-frame]').boundingBox()
    const image = await shown(page).boundingBox()
    expect(image!.y).toBeGreaterThanOrEqual(frame!.y)
    expect(image!.y + image!.height).toBeLessThanOrEqual(frame!.y + frame!.height + 0.5)
  }
})

test('the step buttons and the keys move through the list, and the ends are marked unavailable', async ({ page }) => {
  await open(page)
  await next(page).click()
  await expect(counter(page)).toHaveText('4 of 7')
  await expect(viewer(page).locator('[aria-live]')).toHaveText('4 of 7: Plate 4: a violet circle over two plum lines')

  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect(counter(page)).toHaveText('2 of 7')
  await page.keyboard.press('Home')
  await expect(counter(page)).toHaveText('1 of 7')
  await expect(previous(page)).toHaveAttribute('aria-disabled', 'true')
  // At the first image, Previous and ArrowLeft do nothing, and focus stays
  // put. (Playwright won't click an aria-disabled button, so Enter does.)
  await previous(page).focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowLeft')
  await expect(counter(page)).toHaveText('1 of 7')
  await expect(previous(page)).toBeFocused()

  await page.keyboard.press('End')
  await expect(counter(page)).toHaveText('7 of 7')
  await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
  await expect(previous(page)).not.toHaveAttribute('aria-disabled')
  await page.keyboard.press('ArrowRight')
  await expect(counter(page)).toHaveText('7 of 7')
  await expect(viewer(page).locator('[data-slot=image-viewer-caption]')).toHaveText('Long ridge · Set B')
})

test('a wheel gesture moves one image, either way', async ({ page }) => {
  await open(page)
  await viewer(page).locator('[data-slot=image-viewer-frame]').hover()
  // One flick: many small deltas in a burst, as a trackpad sends.
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 30)
  await expect(counter(page)).toHaveText('4 of 7')
  await page.waitForTimeout(400)
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -30)
  await expect(counter(page)).toHaveText('3 of 7')
})

test('a sideways swipe on a touch screen steps; a downward drag does not', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  const frame = viewer(page).locator('[data-slot=image-viewer-frame]')
  const swipe = async (from: [number, number], to: [number, number]) => {
    const common = { pointerType: 'touch', pointerId: 7, isPrimary: true, bubbles: true }
    await frame.dispatchEvent('pointerdown', { ...common, clientX: from[0], clientY: from[1] })
    await frame.dispatchEvent('pointerup', { ...common, clientX: to[0], clientY: to[1] })
  }
  await swipe([300, 400], [100, 410])
  await expect(counter(page)).toHaveText('4 of 7')
  await swipe([100, 400], [300, 390])
  await expect(counter(page)).toHaveText('3 of 7')
  await swipe([200, 300], [220, 600])
  await expect(counter(page)).toHaveText('3 of 7')
})

// Tab past the last control lands on Base UI's focus guard for a moment,
// which sends focus back to the first: so each step is polled.
test('focus stays inside while open, Tab wrapping to Close', async ({ page }) => {
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
  expect(order).toEqual(['Previous Image', 'Next Image', 'Start From Here', 'Close'])
})

test('Esc and Close leave, and focus goes back to the cover that opened it', async ({ page }) => {
  await open(page)
  await page.keyboard.press('Escape')
  await expect(viewer(page)).toBeHidden()

  const cover = page.getByRole('button', { name: 'Open Plate 5' })
  await cover.click()
  await expect(viewer(page)).toBeVisible()
  await expect(counter(page)).toHaveText('5 of 7')
  await page.keyboard.press('Escape')
  await expect(viewer(page)).toBeHidden()
  await expect(cover).toBeFocused()

  await page.getByRole('button', { name: 'Open Plate 2' }).click()
  await viewer(page).getByRole('button', { name: 'Close' }).click()
  await expect(viewer(page)).toBeHidden()
  await expect(page.getByRole('button', { name: 'Open Plate 2' })).toBeFocused()
})

test("an app's action gets the image shown", async ({ page }) => {
  await open(page)
  await next(page).click()
  await viewer(page).getByRole('button', { name: 'Start From Here' }).click()
  await expect(viewer(page)).toBeHidden()
  await expect(page.getByTestId('picked')).toHaveText('Started from: Plate 4')
})

test('a spinner shows while the next image loads, then the image', async ({ page }) => {
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/viewer/cover-5.svg', async (route) => {
    await held
    await route.continue()
  })
  await open(page)
  await next(page).click()
  await expect(counter(page)).toHaveText('4 of 7')
  await next(page).click()
  await expect(counter(page)).toHaveText('5 of 7')
  const loading = viewer(page).getByRole('status', { name: 'Loading Image' })
  await expect(loading).toBeVisible()
  await expect(shown(page)).toHaveCSS('opacity', '0')
  release()
  await expect(loading).toBeHidden()
  await expect(shown(page)).toHaveCSS('opacity', '1')
})

test('an image that cannot be loaded shows a message in the frame, and Try Again loads it', async ({ page }) => {
  let tries = 0
  await page.route('**/viewer/missing.svg', async (route) => {
    tries += 1
    if (tries === 1) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="#ddd"/></svg>',
    })
  })
  await open(page, 'failed')
  const alert = viewer(page).getByRole('alert')
  await expect(alert).toContainText('This image couldn’t be loaded.')
  await expect(alert).toContainText('Plate 2: an orange circle over two brown lines')
  // The viewer still works round it.
  await expect(counter(page)).toHaveText('2 of 3')
  await alert.getByRole('button', { name: 'Try Again' }).click()
  await expect(alert).toBeHidden()
  await expect(shown(page)).toHaveAttribute('alt', 'Plate 2: an orange circle over two brown lines')
  await expect(shown(page)).toHaveCSS('opacity', '1')
})

test('one image: no counter and no steps', async ({ page }) => {
  await page.goto(story('one-image'))
  await expect(viewer(page)).toBeVisible()
  await expect(counter(page)).toHaveCount(0)
  await expect(previous(page)).toHaveCount(0)
  await expect(next(page)).toHaveCount(0)
  await expect(viewer(page).locator('[aria-live]')).toHaveText('Green hills under a pale sky and a yellow sun')
  await page.keyboard.press('ArrowRight')
  await expect(shown(page)).toHaveAttribute('alt', 'Green hills under a pale sky and a yellow sun')
})
