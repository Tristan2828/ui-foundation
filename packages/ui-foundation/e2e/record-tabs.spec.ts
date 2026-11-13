import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

// A record's tab bar (4.101, record standard 3B): bigger underline tabs with
// counts, a 3px primary line under the open one, and the bar sticking to the
// top of what scrolls (the page, or a record dialog's body) with the
// record's name above it once stuck, at desktop and phone width. Axe in
// both themes at rest is fixtures-visual.spec.ts's COMPOSITE_STORIES; the
// stuck bar is measured here.
const HARNESS = 'http://localhost:6180/story.html?id='

const box = async (locator: Locator) => {
  const found = await locator.boundingBox()
  expect(found).not.toBeNull()
  return found!
}

const bar = (page: Page) => page.locator('[data-slot=entity-view-tab-bar]').first()

test.describe('the look (3B)', () => {
  test('16px semibold tabs, a 3px primary line under the open one, counts beside names', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`${HARNESS}app-entityview--details-tab`)
    const tabs = page.getByRole('tablist', { name: 'Office move sections' })
    const notes = tabs.getByRole('tab', { name: 'Notes' })
    await expect(notes).toHaveAttribute('aria-selected', 'true')
    expect(await notes.evaluate((node) => getComputedStyle(node).fontSize)).toBe('16px')
    expect(await notes.evaluate((node) => getComputedStyle(node).fontWeight)).toBe('600')
    const line = await notes.evaluate((node) => {
      const after = getComputedStyle(node, '::after')
      const probe = document.createElement('div')
      probe.style.background = 'var(--primary)'
      document.body.append(probe)
      const primary = getComputedStyle(probe).backgroundColor
      probe.remove()
      return { height: after.height, color: after.backgroundColor, primary, opacity: after.opacity }
    })
    expect(line.height).toBe('3px')
    expect(line.color).toBe(line.primary)
    expect(line.opacity).toBe('1')
    // Changes holds two; a tab with none shows no count.
    await expect(tabs.getByRole('tab', { name: 'Changes 2' })).toBeVisible()
    await expect(notes.locator('[data-slot=entity-view-tab-count]')).toHaveCount(0)
    expect((await box(notes)).height).toBeGreaterThanOrEqual(44)
  })

  test('14px on a phone, the list scrolling sideways on its own', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${HARNESS}app-entityview--details-tab`)
    const notes = page.getByRole('tab', { name: 'Notes' })
    expect(await notes.evaluate((node) => getComputedStyle(node).fontSize)).toBe('14px')
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
  })
})

test.describe('the bar sticks with the record name above it', () => {
  for (const [name, viewport] of [
    ['desktop', { width: 1280, height: 600 }],
    ['phone', { width: 375, height: 600 }],
  ] as const) {
    test(`on the page (${name})`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto(`${HARNESS}app-entityview--details-tab`)
      await expect(bar(page)).not.toHaveAttribute('data-stuck')
      await expect(page.locator('[data-slot=entity-view-tab-bar-title]')).toHaveCount(0)

      await page.mouse.wheel(0, 1200)
      await expect(bar(page)).toHaveAttribute('data-stuck', '')
      await expect(page.locator('[data-slot=entity-view-tab-bar-title]')).toHaveText('Office move')
      expect(Math.abs((await box(bar(page))).y)).toBeLessThan(2)
      // The tabs still work stuck: Changes opens, the bar stays at the top.
      await page.getByRole('tab', { name: 'Changes 2' }).click()
      await expect(page.getByRole('region', { name: 'Changes' })).toBeVisible()

      await page.evaluate(() => window.scrollTo(0, 0))
      await expect(bar(page)).not.toHaveAttribute('data-stuck')
    })
  }

  test('in a record dialog, to the top of its body', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 })
    await page.goto(`${HARNESS}app-recorddialog--tabs-open`)
    const dialog = page.getByRole('dialog', { name: 'Repaint the fence' })
    await expect(dialog.getByRole('tab', { name: 'Steps 30' })).toBeVisible()
    const body = dialog.locator('[data-slot=record-dialog-body]')
    await body.evaluate((node) => node.scrollTo(0, node.scrollHeight))
    const tabBar = dialog.locator('[data-slot=entity-view-tab-bar]')
    await expect(tabBar).toHaveAttribute('data-stuck', '')
    await expect(dialog.locator('[data-slot=entity-view-tab-bar-title]')).toHaveText('Repaint the fence')
    expect(Math.abs((await box(tabBar)).y - (await box(body)).y)).toBeLessThan(2)
  })
})

test.describe('the stuck bar is accessible', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`stuck, its name and tabs pass axe (${theme})`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 600 })
      await page.goto(`${HARNESS}app-entityview--details-tab&theme=${theme}`)
      if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
      await page.mouse.wheel(0, 1200)
      await expect(bar(page)).toHaveAttribute('data-stuck', '')
      const results = await new AxeBuilder({ page })
        .include('[data-slot=entity-view-tab-bar]')
        .disableRules(['landmark-one-main', 'page-has-heading-one', 'region'])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }
})
