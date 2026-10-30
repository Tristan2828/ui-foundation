import { expect, test, type Page } from '@playwright/test'

// SpinWheel (app/SpinWheel): a spin picks the item its `random` lands on,
// stops with the pointer inside that slice, and says so; reduced motion
// gives the result at once; an empty wheel can't spin. Axe and the token
// check are e2e/storybook-visual.spec.ts's.
const story = (name: string) => `http://localhost:6006/iframe.html?id=app-spinwheel--${name}&viewMode=story`

// The slice under the pointer's tip, read from the page as drawn.
async function sliceUnderPointer(page: Page): Promise<string | null> {
  return page.locator('[data-slot=spin-wheel] svg').evaluate((svg) => {
    const box = svg.getBoundingClientRect()
    // The tip is at y = -88 of a 208-unit viewBox from -104: just inside the rim.
    const x = box.left + box.width / 2
    const y = box.top + ((-84 + 104) / 208) * box.height
    const hit = document.elementFromPoint(x, y)
    return hit?.closest('[data-slot=spin-wheel-slice]')?.querySelector('title')?.textContent ?? null
  })
}

test('with reduced motion, Spin picks at once, announces it, and the pointer is on the pick', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(story('fixed'))
  await page.getByRole('button', { name: 'Spin' }).click()
  await expect(page.getByRole('status')).toHaveText('Picked Clear the garage')
  await expect(page.getByTestId('picked')).toHaveText('Next up: Clear the garage')
  await expect(page.locator('[data-picked=true] title')).toHaveText('Clear the garage')
  await expect(page.getByRole('button', { name: 'Spin' })).toBeEnabled()
  expect(await sliceUnderPointer(page)).toBe('Clear the garage')
})

test('a spin turns with the button disabled, stops on the pick, and spins again from there', async ({ page }) => {
  await page.goto(story('fixed'))
  const button = page.getByRole('button', { name: 'Spin' })
  await button.click()
  await expect(button).toBeDisabled()
  await expect(page.locator('[data-slot=spin-wheel] svg')).toHaveAttribute('data-state', 'spinning')
  // Nothing is drawn picked while it turns.
  await expect(page.locator('[data-picked=true]')).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveText('Picked Clear the garage', { timeout: 5_000 })
  await expect(button).toBeEnabled()
  await expect(page.locator('[data-picked=true] title')).toHaveText('Clear the garage')
  // Let the transition settle before reading the pointer.
  await page.waitForTimeout(200)
  expect(await sliceUnderPointer(page)).toBe('Clear the garage')

  const turned = await page.locator('[data-slot=spin-wheel-rotor]').evaluate((g) => (g as SVGGElement).style.transform)
  await button.click()
  await expect(button).toBeDisabled()
  const again = await page.locator('[data-slot=spin-wheel-rotor]').evaluate((g) => (g as SVGGElement).style.transform)
  // Further on, by whole turns: it starts from where it stopped.
  const degrees = (value: string) => Number(value.match(/rotate\(([-\d.]+)deg\)/)?.[1])
  expect(degrees(again)).toBeGreaterThan(degrees(turned))
  await expect(button).toBeEnabled({ timeout: 5_000 })
  await page.waitForTimeout(200)
  expect(await sliceUnderPointer(page)).toBe('Clear the garage')
})

test('weighted and emphasised slices: a big slice is drawn bigger, a flagged one tinted', async ({ page }) => {
  await page.goto(story('weighted'))
  const area = (title: string) =>
    page
      .locator('[data-slot=spin-wheel-slice]', { has: page.locator(`title:text-is("${title}")`) })
      .locator('path')
      .evaluate((path) => {
        const box = (path as SVGPathElement).getBBox()
        return box.width * box.height
      })
  expect(await area('Repaint the fence')).toBeGreaterThan(await area('Fix the gate latch'))
  await page.goto(story('emphasis'))
  await expect(page.locator('[data-emphasis=true]')).toHaveCount(2)
})

test('an empty wheel shows its message and cannot spin', async ({ page }) => {
  await page.goto(story('empty'))
  await expect(page.getByText('Nothing to pick from: add a few things to do first.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Spin' })).toBeDisabled()
})

test('the wheel is square, at most 28rem, and fits a phone', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(story('default'))
  const svg = page.locator('[data-slot=spin-wheel] svg')
  const wide = await svg.boundingBox()
  expect(wide!.width).toBeLessThanOrEqual(448.5)
  expect(Math.abs(wide!.width - wide!.height)).toBeLessThan(1)
  await page.setViewportSize({ width: 360, height: 800 })
  const narrow = await svg.boundingBox()
  expect(narrow!.width).toBeLessThanOrEqual(360)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
