import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// WidgetCard's `collapsible` (#233), on the Collapsible story: the chevron
// folds a card to its header and opens it again from the keyboard, the
// choice survives a reload, a blocked localStorage still folds for the
// page's life, and axe passes folded and open in both themes. The header's
// link to an outside address (#248) opens in a new tab. The token
// and glyph checks at rest are e2e/fixtures-visual.spec.ts's.
const STORY = 'http://localhost:6180/story.html?id=app-widgetcard--collapsible'

const card = (page: Page, title: string) => page.getByRole('region', { name: title })
const toggle = (page: Page, title: string) => card(page, title).getByRole('button', { name: title, exact: true })

// Every run starts from nothing remembered.
test.beforeEach(async ({ page }) => {
  await page.goto(STORY)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.getByText('Fix the gate latch')).toBeVisible()
})

test('the chevron names its card and controls its body; Enter folds it, Space opens it', async ({ page }) => {
  const button = toggle(page, 'Ready to start')
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  const body = page.locator(`[id="${await button.getAttribute('aria-controls')}"]`)
  await expect(body).toContainText('Fix the gate latch')

  await button.focus()
  await page.keyboard.press('Enter')
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await expect(body).toBeHidden()
  // Folded, the header's link still works.
  await expect(card(page, 'Ready to start').getByRole('link', { name: 'All' })).toBeVisible()

  await page.keyboard.press('Space')
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  await expect(body).toBeVisible()
})

test('defaultCollapsed starts a card folded, and a card folded or opened stays so after a reload', async ({ page }) => {
  await expect(toggle(page, 'Saved links')).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByText('Gate latch fitting guide')).toBeHidden()

  await toggle(page, 'Saved links').click()
  await toggle(page, 'Waiting on').click()
  await page.reload()
  await expect(toggle(page, 'Saved links')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText('Gate latch fitting guide')).toBeVisible()
  await expect(toggle(page, 'Waiting on')).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByText('Parts arrive')).toBeHidden()
})

test('with localStorage blocked, it starts at defaultCollapsed and still folds', async ({ page }) => {
  await page.addInitScript(() => {
    const refuse = () => {
      throw new DOMException('Blocked', 'SecurityError')
    }
    Object.defineProperty(window, 'localStorage', { get: refuse })
  })
  await page.reload()
  await expect(page.getByText('Fix the gate latch')).toBeVisible()
  await expect(toggle(page, 'Saved links')).toHaveAttribute('aria-expanded', 'false')
  await toggle(page, 'Ready to start').click()
  await expect(page.getByText('Fix the gate latch')).toBeHidden()
})

test('a header link to an outside address opens in a new tab, named by its label and described by the title', async ({
  page,
}) => {
  // Saved links starts folded: its header link is still there (#248).
  const link = card(page, 'Saved links').getByRole('link', { name: 'Open saved (opens in a new tab)' })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', 'https://example.com/saved')
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', 'noreferrer')
  await expect(link).toHaveAccessibleDescription('Saved links')
  // An app route stays a plain link in the same tab.
  const route = card(page, 'Ready to start').getByRole('link', { name: 'All' })
  await expect(route).not.toHaveAttribute('target')
})

for (const theme of ['light', 'dark'] as const) {
  test(`zero axe violations, open and folded (${theme})`, async ({ page }) => {
    await page.goto(`${STORY}&theme=${theme}`)
    await expect(page.getByText('Fix the gate latch')).toBeVisible()
    const axe = () => new AxeBuilder({ page }).disableRules(['landmark-one-main', 'region']).analyze()
    expect((await axe()).violations).toEqual([])
    await toggle(page, 'Ready to start').click()
    await toggle(page, 'Waiting on').click()
    await expect(page.getByText('Fix the gate latch')).toBeHidden()
    expect((await axe()).violations).toEqual([])
  })
}
