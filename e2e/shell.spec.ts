import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Every installed shadcn primitive gets one <section data-kitchen="name">
// on /kitchen-sink (see src/routes/kitchen-sink.tsx) — kept in sync by hand
// with the sections that file renders.
const KITCHEN_SECTIONS = [
  'button',
  'card',
  'input',
  'sidebar',
  'sheet',
  'tooltip',
  'separator',
  'skeleton',
  'spinner',
  'empty',
  'toast',
]

const NAV_ENTRIES = [
  { path: '/', label: 'Home', content: { role: 'button', name: 'Get started' } },
  { path: '/widgets', label: 'Widgets', content: { role: 'heading', name: 'Widgets' } },
  { path: '/kitchen-sink', label: 'Kitchen Sink', content: { role: 'heading', name: 'Kitchen Sink' } },
] as const

test.describe('app shell navigation', () => {
  for (const { path, label, content } of NAV_ENTRIES) {
    test(`visits ${label} without the error boundary rendering`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole(content.role, { name: content.name })).toBeVisible()
      await expect(page.getByText('This page hit an error')).toHaveCount(0)
    })
  }

  test('every sidebar nav entry is clickable and navigates', async ({ page }) => {
    await page.goto('/')
    for (const { label, content } of NAV_ENTRIES) {
      await page.getByRole('link', { name: label }).click()
      await expect(page.getByRole(content.role, { name: content.name })).toBeVisible()
      await expect(page.getByText('This page hit an error')).toHaveCount(0)
    }
  })
})

test.describe('kitchen sink dark mode screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kitchen-sink')
    await page.getByRole('button', { name: 'Toggle dark mode' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  for (const name of KITCHEN_SECTIONS) {
    test(`${name} section matches its dark-mode baseline`, async ({ page }) => {
      const section = page.locator(`[data-kitchen="${name}"]`)
      await expect(section).toBeVisible()
      await expect(section).toHaveScreenshot(`kitchen-${name}-dark.png`, {
        animations: 'disabled',
      })
    })
  }
})

test('kitchen sink has zero axe violations', async ({ page }) => {
  await page.goto('/kitchen-sink')
  await expect(page.getByRole('heading', { name: 'Kitchen Sink', level: 1 })).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})
