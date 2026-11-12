import { expect, test, type Page } from '@playwright/test'

// The dialogs and feedback standard (4.90) in a real browser: DeleteAction
// (D1), the toaster's place and lifetimes (D5), an action's error beside
// it (D6), the skeleton's delay (D7), a job's progress (D8) and the
// offline bar (D9). Axe in both themes and the icons' 3:1 are
// e2e/fixtures-visual.spec.ts's.
const story = (id: string) => `http://localhost:6180/story.html?id=${id}`

const LAPTOP = { width: 1280, height: 800 }
const PHONE = { width: 375, height: 812 }

const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]').filter({ hasText: text })

test.describe('DeleteAction', () => {
  test('a soft delete asks, says it comes back, then "Deleted <name>" with Undo, which restores it', async ({ page }) => {
    await page.setViewportSize(LAPTOP)
    await page.goto(story('app-deleteaction--soft'))
    await page.getByRole('button', { name: 'Delete' }).nth(1).click()

    const dialog = page.getByRole('dialog', { name: 'Delete Harbor Light?' })
    await expect(dialog.getByText('It goes to Deleted, and Restore brings it back.')).toBeVisible()
    // Cancel first, then the filled destructive button.
    const buttons = dialog.getByRole('button')
    await expect(buttons.filter({ hasText: /^(Cancel|Delete)$/ })).toHaveText(['Cancel', 'Delete'])
    await expect(dialog.getByRole('button', { name: 'Delete' })).toHaveAttribute('data-variant', 'destructive')

    await dialog.getByRole('button', { name: 'Delete' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText('Harbor Light', { exact: true })).toHaveCount(0)
    const deleted = toast(page, 'Deleted Harbor Light')
    await expect(deleted).toBeVisible()

    await deleted.getByRole('button', { name: 'Undo' }).click()
    await expect(toast(page, 'Restored Harbor Light')).toBeVisible()
    await expect(page.getByText('Harbor Light', { exact: true })).toBeVisible()
  })

  test('a hard delete says it can\'t be undone, and its toast has no Undo', async ({ page }) => {
    await page.goto(story('app-deleteaction--hard'))
    await page.getByRole('button', { name: 'Delete' }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete the Nov 1 balance?' })
    await expect(dialog.getByText('This can’t be undone.')).toBeVisible()
    await dialog.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('The Nov 1 balance is gone.')).toBeVisible()
    const deleted = toast(page, 'Deleted the Nov 1 balance')
    await expect(deleted).toBeVisible()
    await expect(deleted.getByRole('button', { name: 'Undo' })).toHaveCount(0)
  })

  test('verb="Retire" asks, acts and says it in its own word', async ({ page }) => {
    await page.goto(story('app-deleteaction--retire'))
    await page.getByRole('button', { name: 'Retire' }).click()
    const dialog = page.getByRole('dialog', { name: 'Retire Corner Market?' })
    await dialog.getByRole('button', { name: 'Retire' }).click()
    await expect(toast(page, 'Retired Corner Market')).toBeVisible()
  })

  test('a refused delete stays open with the reason beside the button, and Try again finishes it', async ({ page }) => {
    await page.goto(story('app-deleteaction--refused'))
    await page.getByRole('button', { name: 'Delete' }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete Harbor Light?' })
    await dialog.getByRole('button', { name: 'Delete' }).click()
    await expect(dialog.getByText('The server didn’t answer. Try again.')).toBeVisible()
    // Not a toast: the reason is in the dialog, beside what failed.
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0)

    await dialog.getByRole('button', { name: 'Try again' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(toast(page, 'Deleted Harbor Light')).toBeVisible()
  })

  test('reason: one field between the sentence and the buttons, its words reach onDelete, Try again keeps them', async ({ page }) => {
    await page.setViewportSize(LAPTOP)
    await page.goto(story('app-deleteaction--with-reason'))
    await page.getByRole('button', { name: 'Remove' }).click()
    const dialog = page.getByRole('dialog', { name: 'Remove Corner Market?' })
    // The confirm's width and its order: sentence, field, buttons.
    // Its layout width: the opening zoom scales the box, not the layout.
    expect(await dialog.evaluate((element) => (element as HTMLElement).offsetWidth)).toBe(420)
    await page.waitForTimeout(200)
    const box = dialog.getByRole('textbox', { name: 'Why remove it?' })
    await expect(dialog.getByText('Kept with its history.')).toBeVisible()
    const sentence = (await dialog.getByText('It comes off the list; its history stays.').boundingBox())!
    const field = (await box.boundingBox())!
    const button = (await dialog.getByRole('button', { name: 'Remove' }).boundingBox())!
    expect(sentence.y).toBeLessThan(field.y)
    expect(field.y + field.height).toBeLessThan(button.y)
    await expect(dialog.getByRole('button', { name: 'Remove' })).toHaveAttribute('data-variant', 'destructive')

    await box.fill('  Closed for good  ')
    await dialog.getByRole('button', { name: 'Remove' }).click()
    await expect(dialog.getByText('The server didn’t answer. Try again.')).toBeVisible()
    await expect(box).toHaveValue('  Closed for good  ')
    await dialog.getByRole('button', { name: 'Try again' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(toast(page, 'Removed Corner Market')).toBeVisible()
    await expect(page.getByTestId('reason')).toHaveText('Closed for good')
  })

  test('reason: closing with something typed asks first; with nothing typed it just closes', async ({ page }) => {
    await page.goto(story('app-deleteaction--with-reason'))
    await page.getByRole('button', { name: 'Remove' }).click()
    const dialog = page.getByRole('dialog', { name: 'Remove Corner Market?' })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)

    await page.getByRole('button', { name: 'Remove' }).click()
    await dialog.getByRole('textbox', { name: 'Why remove it?' }).fill('Moved away')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    const ask = page.getByRole('dialog', { name: 'Discard your changes?' })
    await expect(ask).toBeVisible()
    await ask.getByRole('button', { name: 'Keep editing' }).click()
    await expect(dialog.getByRole('textbox', { name: 'Why remove it?' })).toHaveValue('Moved away')

    await page.keyboard.press('Escape')
    await ask.getByRole('button', { name: 'Discard' }).click()
    await expect(dialog).toHaveCount(0)
    // Opened again, it starts empty.
    await page.getByRole('button', { name: 'Remove' }).click()
    await expect(dialog.getByRole('textbox', { name: 'Why remove it?' })).toHaveValue('')
  })

  test('reason: on a phone the field sits in the bottom sheet above the full-width buttons', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.goto(story('app-deleteaction--open-with-reason'))
    const dialog = page.getByRole('dialog', { name: 'Remove Corner Market?' })
    const field = (await dialog.getByRole('textbox', { name: 'Why remove it?' }).boundingBox())!
    const remove = (await dialog.getByRole('button', { name: 'Remove' }).boundingBox())!
    expect(field.y + field.height).toBeLessThan(remove.y)
    expect(remove.width).toBeGreaterThan(300)
  })
})

test.describe('the toaster', () => {
  test('is at the top centre on a laptop', async ({ page }) => {
    await page.setViewportSize(LAPTOP)
    await page.goto(story('ui-toast--all-tones'))
    const toaster = page.locator('[data-sonner-toaster]')
    await expect(toaster).toHaveAttribute('data-y-position', 'top')
    await expect(toaster).toHaveAttribute('data-x-position', 'center')
  })

  test('is at the bottom on a phone, above whatever sets --toast-bottom-offset', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.goto(story('ui-toast--all-tones'))
    const toaster = page.locator('[data-sonner-toaster]')
    await expect(toaster).toHaveAttribute('data-y-position', 'bottom')
    const first = page.locator('[data-sonner-toast]').first()
    await expect(first).toBeVisible()
    await page.waitForTimeout(500)
    const gapBefore = PHONE.height - (await first.boundingBox())!.y - (await first.boundingBox())!.height
    expect(gapBefore).toBeLessThan(40)

    // A stuck bar of 80px (EntityForm sets this on <html>): the toasts rise above it.
    await page.evaluate(() => document.documentElement.style.setProperty('--toast-bottom-offset', '80px'))
    await page.waitForTimeout(500)
    const box = (await first.boundingBox())!
    expect(PHONE.height - box.y - box.height).toBeGreaterThanOrEqual(80 + 16 - 1)
  })

  test('the icons are in their tones: success, error, info and warning differ', async ({ page }) => {
    await page.goto(story('ui-toast--all-tones'))
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(5)
    const colour = (type: string) =>
      page.locator(`[data-sonner-toast][data-type="${type}"] [data-icon] svg`).first().evaluate((svg) => getComputedStyle(svg).color)
    const colours = await Promise.all(['success', 'error', 'info', 'warning'].map(colour))
    expect(new Set(colours).size).toBe(4)
    const text = await page.locator('[data-sonner-toast][data-type="success"]').first().evaluate((el) => getComputedStyle(el).color)
    expect(colours).not.toContain(text)
  })

  test('an action that fails after its page was left is a toast that stays until it is closed', async ({ page }) => {
    await page.goto(story('app-feedback--left-the-page'))
    await page.getByRole('button', { name: 'Mark as read and leave' }).click()
    await expect(page.getByText('Another page.')).toBeVisible()
    const failed = toast(page, 'Couldn’t mark Harbor Light as read: the server didn’t answer.')
    await expect(failed).toBeVisible()
    // Past a toast's 4 seconds.
    await page.waitForTimeout(5_000)
    await expect(failed).toBeVisible()
    await failed.getByRole('button', { name: 'Close toast' }).click()
    await expect(failed).toHaveCount(0)
  })

  test('a job that finishes after its page was left says so in a toast that goes after 4 seconds', async ({ page }) => {
    await page.goto(story('app-feedback--left-the-page'))
    await page.getByRole('button', { name: 'Check prices and leave' }).click()
    await expect(page.getByText('Another page.')).toBeVisible()
    const done = toast(page, 'Checked 12 · 2 deals')
    await expect(done).toBeVisible()
    await expect(done).toHaveCount(0, { timeout: 8_000 })
  })
})

test.describe('an action beside its button', () => {
  test('a failure is a Notice next to it with Try again, never a toast', async ({ page }) => {
    await page.goto(story('app-feedback--action-failed'))
    await page.getByRole('button', { name: 'Mark as read' }).click()
    const notice = page.locator('[data-slot=action-error] [data-slot=notice]')
    await expect(notice).toContainText('Couldn’t mark Harbor Light as read')
    await expect(notice).toHaveAttribute('data-tone', 'destructive')
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0)
    await notice.getByRole('button', { name: 'Try again' }).click()
    await expect(notice).toBeVisible()
  })

  test('a job counts up beside its button, then its result stays; no toast while on screen', async ({ page }) => {
    await page.goto(story('app-feedback--job'))
    await page.getByRole('button', { name: 'Check prices' }).click()
    const status = page.locator('[data-slot=job-status]')
    await expect(status).toContainText(/Checking \d+ of 12…/)
    await expect(status).toHaveText('Checked 12 · 2 deals')
    await expect(status).toHaveAttribute('data-state', 'done')
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0)
  })
})

test.describe('the skeleton', () => {
  test('a fast load never shows it; a slow one shows it after 300ms', async ({ page }) => {
    await page.goto(story('app-feedback--skeleton-delay'))
    // Record every skeleton that ever became visible.
    await page.evaluate(() => {
      const w = window as unknown as { shownSkeletons: number }
      w.shownSkeletons = 0
      new MutationObserver((records) => {
        for (const record of records) {
          if (record.target instanceof Element && record.target.matches('[data-slot=skeleton][data-shown]')) w.shownSkeletons++
          for (const node of record.addedNodes) if (node instanceof Element && node.matches('[data-slot=skeleton][data-shown]')) w.shownSkeletons++
        }
      }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-shown'] })
    })
    await page.getByRole('button', { name: 'Load fast' }).click()
    await expect(page.getByText('The Long Walk')).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { shownSkeletons: number }).shownSkeletons)).toBe(0)

    await page.getByRole('button', { name: 'Load slowly' }).click()
    const skeleton = page.locator('[data-slot=skeleton]').first()
    // There, holding its room, but not shown yet.
    await expect(skeleton).toBeAttached()
    await expect(skeleton).toBeVisible()
    await expect(skeleton).toHaveAttribute('data-shown', 'true')
    await expect(page.getByText('The Long Walk')).toBeVisible()
  })
})

test.describe('OfflineNotice', () => {
  test('shows while the browser is offline, and goes when it\'s back', async ({ page }) => {
    await page.goto(story('app-feedback--offline'))
    const bar = page.getByText('You’re offline. Changes won’t save until you’re back.')
    await expect(bar).toHaveCount(0)
    await page.getByRole('button', { name: 'Lose the connection' }).click()
    await expect(bar).toBeVisible()
    await expect(page.locator('[data-slot=offline-notice]')).toHaveAttribute('role', 'status')
    await page.getByRole('button', { name: 'Get it back' }).click()
    await expect(bar).toHaveCount(0)
  })

  test('shows when the page loads offline', async ({ page, context }) => {
    await page.goto(story('app-feedback--offline'))
    await context.setOffline(true)
    await expect(page.getByText('You’re offline. Changes won’t save until you’re back.')).toBeVisible()
    await context.setOffline(false)
    await expect(page.getByText('You’re offline. Changes won’t save until you’re back.')).toHaveCount(0)
  })
})
