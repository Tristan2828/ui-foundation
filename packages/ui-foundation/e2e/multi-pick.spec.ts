import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// MultiPick, a small set's picker (app/MultiPick stories), in a real
// browser: edited in place, every option is there on opening, each click
// saves that one pick (500ms in the story), a refusal ("Archived") puts
// that one back with its reason, the keyboard moves along the chips and
// toggles them, and Esc or a click outside only closes. Axe in both
// themes with the picker open and a refusal showing.
const story = (id: string, theme: 'light' | 'dark' = 'light') =>
  `http://localhost:6180/story.html?id=app-multipick--${id}&theme=${theme}`

const LABELS = ['Finance', 'Design', 'Support', 'Facilities', 'Legal', 'Hiring', 'Security', 'Archived', 'Travel', 'Training']

async function openInPlace(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.goto(story('in-place', theme))
  await expect(page.getByRole('heading', { level: 1, name: 'Office move' })).toBeVisible()
}

const chips = (page: Page) => page.getByRole('group', { name: 'Labels' })
const chip = (page: Page, name: string) => chips(page).getByRole('button', { name, exact: true })
const saves = (page: Page) => page.getByTestId('saves')
const saved = (page: Page) => page.getByTestId('saved')

test.describe('MultiPick edited in place', () => {
  test('every option shows on opening, with no typing; the box filters them', async ({ page }) => {
    await openInPlace(page)
    await page.getByRole('button', { name: 'Edit Labels' }).click()
    await expect(page.getByRole('searchbox', { name: 'Filter Labels' })).toBeFocused()
    await expect(chips(page).getByRole('button')).toHaveText(LABELS)
    await expect(chip(page, 'Finance')).toHaveAttribute('aria-pressed', 'true')
    await expect(chip(page, 'Support')).toHaveAttribute('aria-pressed', 'true')
    await expect(chip(page, 'Design')).toHaveAttribute('aria-pressed', 'false')

    await page.keyboard.type('fin')
    await expect(chips(page).getByRole('button')).toHaveText(['Finance'])
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type('zzz')
    await expect(page.getByText('No matches.')).toBeVisible()
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.press('Backspace')
    await expect(chips(page).getByRole('button')).toHaveCount(LABELS.length)
  })

  test('one click saves one pick, with a spinner beside it; leaving only closes', async ({ page }) => {
    await openInPlace(page)
    await page.getByRole('button', { name: 'Edit Labels' }).click()

    await chip(page, 'Design').click()
    // Shown at once, saving: nothing else was needed to save it.
    await expect(chip(page, 'Design')).toHaveAttribute('aria-pressed', 'true')
    await expect(chip(page, 'Design')).toHaveAttribute('aria-busy', 'true')
    await expect(chip(page, 'Design').locator('[data-slot="spinner"]')).toBeVisible()
    await expect(saves(page)).toHaveText('1')
    await expect(saved(page)).toHaveText('Finance, Design, Support')
    await expect(chip(page, 'Design')).not.toHaveAttribute('aria-busy', 'true')
    await expect(chip(page, 'Design')).toHaveAttribute('aria-pressed', 'true')
    // Still open: the next pick is one click away.
    await expect(chips(page)).toBeVisible()

    // Two quick picks, one removal: each its own save, none lost.
    await chip(page, 'Legal').click()
    await chip(page, 'Hiring').click()
    await chip(page, 'Finance').click()
    await expect(saves(page)).toHaveText('4')
    await expect(saved(page)).toHaveText('Design, Support, Legal, Hiring')

    // A click outside closes it, and sends nothing more.
    await page.getByRole('heading', { level: 1, name: 'Office move' }).click()
    await expect(chips(page)).toHaveCount(0)
    await expect(page.getByTestId('saved-labels')).toHaveText('DesignSupportLegalHiring')
    await page.waitForTimeout(700)
    await expect(saves(page)).toHaveText('4')
  })

  test('a refused pick goes back on its own, with the reason; the others still save', async ({ page }) => {
    await openInPlace(page)
    await page.getByRole('button', { name: 'Edit Labels' }).click()

    // Alone: nothing else saved moves the value, so the refusal itself puts it back.
    await chip(page, 'Archived').click()
    await expect(chip(page, 'Archived')).toHaveAttribute('aria-pressed', 'true')
    const reason = "Couldn't add Archived: Archived is set by the archive job, not by hand."
    await expect(page.getByText(reason)).toBeVisible()
    await expect(chip(page, 'Archived')).toHaveAttribute('aria-pressed', 'false')
    await expect(chip(page, 'Archived')).toHaveAccessibleDescription(reason)
    await expect(saves(page)).toHaveText('1')
    await expect(saved(page)).toHaveText('Finance, Support')

    // Beside a pick that saves: only the refused one goes back. Picking it
    // again clears its reason until the new answer.
    await chip(page, 'Archived').click()
    await expect(page.getByText(reason)).toHaveCount(0)
    await chip(page, 'Legal').click()
    await expect(page.getByText(reason)).toBeVisible()
    await expect(chip(page, 'Archived')).toHaveAttribute('aria-pressed', 'false')
    await expect(chip(page, 'Legal')).toHaveAttribute('aria-pressed', 'true')
    await expect(saves(page)).toHaveText('3')
    await expect(saved(page)).toHaveText('Finance, Support, Legal')
  })

  test('the keyboard: Down into the chips, arrows along them, Space toggles, Up back, Esc closes', async ({ page }) => {
    await openInPlace(page)
    await page.getByRole('button', { name: 'Edit Labels' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('searchbox', { name: 'Filter Labels' })).toBeFocused()

    await page.keyboard.press('ArrowDown')
    await expect(chip(page, 'Finance')).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(chip(page, 'Design')).toBeFocused()
    await page.keyboard.press('Space')
    await expect(chip(page, 'Design')).toHaveAttribute('aria-pressed', 'true')
    await expect(saves(page)).toHaveText('1')
    await expect(saved(page)).toHaveText('Finance, Design, Support')

    await page.keyboard.press('End')
    await expect(chip(page, 'Training')).toBeFocused()
    await page.keyboard.press('Home')
    await expect(chip(page, 'Finance')).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(chip(page, 'Training')).toBeFocused()

    await page.keyboard.press('ArrowUp')
    await expect(page.getByRole('searchbox', { name: 'Filter Labels' })).toBeFocused()

    // Esc only closes: the pick already saved stays, nothing more is sent.
    await page.keyboard.press('Escape')
    await expect(chips(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Edit Labels' })).toBeFocused()
    await expect(page.getByTestId('saved-labels')).toHaveText('FinanceDesignSupport')
    await page.waitForTimeout(700)
    await expect(saves(page)).toHaveText('1')
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`open, saving and refused, it has no axe violations (${theme})`, async ({ page }) => {
      await openInPlace(page, theme)
      if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
      await page.getByRole('button', { name: 'Edit Labels' }).click()
      await chip(page, 'Archived').click()
      await expect(page.getByText(/^Couldn't add Archived/)).toBeVisible()
      await chip(page, 'Design').click()
      await expect(chip(page, 'Design')).toHaveAttribute('aria-busy', 'true')
      const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
      expect(results.violations).toEqual([])
    })
  }
})

test('MultiPick on a form: a click changes the value, Space too', async ({ page }) => {
  await page.goto(story('on-a-form'))
  await chip(page, 'Finance').click()
  await expect(page.getByTestId('form-value')).toHaveText('Value: Finance, Design')
  await chip(page, 'Design').focus()
  await page.keyboard.press('Space')
  await expect(page.getByTestId('form-value')).toHaveText('Value: Finance')
})
