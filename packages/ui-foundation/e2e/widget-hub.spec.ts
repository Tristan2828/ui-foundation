import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// A hub's folded summaries, accordion and Customize sheet (#263):
// WidgetCard's `summary` in each state on Folded summary, WidgetCardGroup
// holding one card open on Accordion (and only on a phone with
// `accordion="mobile"`, on WidgetLayoutSheet's Default), and the sheet
// ordering and hiding cards from the keyboard, the focus staying on the
// button pressed, remembered after a reload and undone by Reset. Axe runs
// on each in both themes; the token and glyph checks at rest are
// e2e/fixtures-visual.spec.ts's.
const story = (id: string, theme = 'light') =>
  `http://localhost:6180/story.html?id=${id}&theme=${theme}`

const card = (page: Page, title: string) => page.getByRole('region', { name: title })
const chevron = (page: Page, title: string) => card(page, title).getByRole('button', { name: title, exact: true })
const axe = (page: Page) => new AxeBuilder({ page }).disableRules(['landmark-one-main', 'region']).analyze()

test.describe('folded summary', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(story('app-widgetcard--folded-summary'))
    await expect(card(page, 'Ready to start (success)')).toBeVisible()
  })

  test('a folded card shows its value by state, describes its chevron with it, and drops it when opened', async ({
    page,
  }) => {
    const summary = (state: string) => card(page, `Ready to start (${state})`).locator('[data-slot="widget-card-summary"]')
    await expect(summary('success')).toHaveText('3 ready')
    await expect(chevron(page, 'Ready to start (success)')).toHaveAccessibleDescription('3 ready')
    await expect(summary('loading').locator('[data-slot="skeleton"]')).toBeVisible()
    await expect(summary('error')).toHaveText("—Couldn't load")
    await expect(summary('empty')).toHaveText('None')

    // Opened, the error is the card's own, inside it, and the summary goes.
    await chevron(page, 'Ready to start (error)').click()
    await expect(summary('error')).toHaveCount(0)
    await expect(card(page, 'Ready to start (error)').getByRole('button', { name: 'Try again' })).toBeVisible()
    await chevron(page, 'Ready to start (success)').click()
    await expect(summary('success')).toHaveCount(0)
    await expect(page.getByText('Fix the gate latch').first()).toBeVisible()
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`zero axe violations (${theme})`, async ({ page }) => {
      await page.goto(story('app-widgetcard--folded-summary', theme))
      await expect(card(page, 'Ready to start (success)')).toBeVisible()
      expect((await axe(page)).violations).toEqual([])
    })
  }
})

test.describe('accordion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(story('app-widgetcard--accordion'))
    await expect(page.getByText('Fix the gate latch')).toBeVisible()
  })

  test('opening one card folds the open one; the chevron toggles from the keyboard', async ({ page }) => {
    await expect(chevron(page, 'Ready to start')).toHaveAttribute('aria-expanded', 'true')
    await expect(chevron(page, 'Waiting on')).toHaveAttribute('aria-expanded', 'false')

    await chevron(page, 'Waiting on').focus()
    await page.keyboard.press('Enter')
    await expect(chevron(page, 'Waiting on')).toHaveAttribute('aria-expanded', 'true')
    await expect(chevron(page, 'Ready to start')).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByText('Parts arrive')).toBeVisible()
    await expect(page.getByText('Fix the gate latch')).toBeHidden()

    // Again: it folds, and nothing is open.
    await page.keyboard.press('Space')
    await expect(chevron(page, 'Waiting on')).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByText('Parts arrive')).toBeHidden()
  })

  test("a click on the header's title toggles the card; one on its link doesn't", async ({ page }) => {
    await card(page, 'Saved links').getByRole('heading', { name: 'Saved links' }).click()
    await expect(chevron(page, 'Saved links')).toHaveAttribute('aria-expanded', 'true')
    await expect(chevron(page, 'Ready to start')).toHaveAttribute('aria-expanded', 'false')

    // The link to an outside address opens its own tab and leaves the card alone.
    const popup = page.waitForEvent('popup')
    await card(page, 'Saved links').getByRole('link', { name: /Open saved/ }).click()
    await (await popup).close()
    await expect(chevron(page, 'Saved links')).toHaveAttribute('aria-expanded', 'true')
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`zero axe violations, open and folded (${theme})`, async ({ page }) => {
      await page.goto(story('app-widgetcard--accordion', theme))
      await expect(page.getByText('Fix the gate latch')).toBeVisible()
      expect((await axe(page)).violations).toEqual([])
      await chevron(page, 'Ready to start').click()
      await expect(page.getByText('Fix the gate latch')).toBeHidden()
      expect((await axe(page)).violations).toEqual([])
    })
  }
})

test.describe('accordion="mobile"', () => {
  test('folds on a phone, and leaves a desktop hub open', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(story('app-widgetlayoutsheet--default'))
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await expect(chevron(page, 'Waiting on')).toHaveAttribute('aria-expanded', 'false')
    await expect(chevron(page, 'Ready to start')).toHaveAttribute('aria-expanded', 'true')

    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(card(page, 'Waiting on').getByRole('button', { name: 'Waiting on', exact: true })).toHaveCount(0)
    await expect(page.getByText('Parts arrive')).toBeVisible()
  })
})

test.describe('Customize sheet', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(story('app-widgetlayoutsheet--default'))
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await expect(page.getByText('Fix the gate latch')).toBeVisible()
  })

  const regionTitles = (page: Page) =>
    page.locator('[data-slot="widget-card"] h2').allTextContents()

  test('Up and Down move a card, the focus staying on the button pressed, and Show hides one', async ({ page }) => {
    await page.getByRole('button', { name: 'Customize' }).click()
    const sheet = page.getByRole('dialog', { name: 'Customize this page' })
    await expect(sheet).toBeVisible()

    const down = sheet.getByRole('button', { name: 'Move Ready to start down' })
    await down.focus()
    await page.keyboard.press('Enter')
    await expect(down).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(down).toBeFocused()
    await page.keyboard.press('Enter')
    // At the end it's aria-disabled, and the focus is still on it.
    await expect(down).toHaveAttribute('aria-disabled', 'true')
    await expect(down).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(sheet.locator('[data-widget-id]').last()).toHaveAttribute('data-widget-id', 'ready')

    const up = sheet.getByRole('button', { name: 'Move Garden up' })
    await up.focus()
    await page.keyboard.press('Enter')
    await expect(up).toBeFocused()
    await expect(sheet.locator('[aria-live="polite"]')).toHaveText('Garden, 2 of 4')

    await sheet.getByRole('switch', { name: 'Show Waiting on' }).press('Space')
    await expect(sheet.getByRole('switch', { name: 'Show Waiting on' })).not.toBeChecked()
    expect(await regionTitles(page)).toEqual(['Garden', 'Saved links', 'Ready to start'])

    // Kept on this device; Reset undoes it.
    await page.reload()
    await expect(page.getByText('Fix the gate latch')).toBeVisible()
    expect(await regionTitles(page)).toEqual(['Garden', 'Saved links', 'Ready to start'])
    await page.getByRole('button', { name: 'Customize' }).click()
    await page.getByRole('button', { name: 'Reset' }).click()
    expect(await regionTitles(page)).toEqual(['Ready to start', 'Waiting on', 'Saved links', 'Garden'])
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`zero axe violations, open (${theme})`, async ({ page }) => {
      await page.goto(story('app-widgetlayoutsheet--open', theme))
      await expect(page.getByRole('dialog', { name: 'Customize this page' })).toBeVisible()
      expect((await axe(page)).violations).toEqual([])
    })
  }
})
