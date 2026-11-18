import AxeBuilder from './axe'
import { expect, test, type Locator, type Page } from '@playwright/test'

// A form's save that doesn't overwrite (useFormVersion,
// src/components/app/form-conflict.fixtures.tsx): an edit form left open
// while another writer saves is refused (a 409), nothing is written, and
// the bar says "Changed elsewhere" with what was typed still in the
// fields. Keep Mine saves it over theirs; Show Saved shows theirs. The
// same in a FormDialog. At a laptop's and a phone's width, axe in both
// themes on the conflict.
const STORY = (id: 'edit-form' | 'edit-dialog', theme: 'light' | 'dark' = 'light') =>
  `http://localhost:6180/story.html?id=app-form-conflict--${id}&theme=${theme}`

const WIDTHS = [
  { name: 'laptop', viewport: { width: 1280, height: 900 } },
  { name: 'phone', viewport: { width: 375, height: 812 } },
] as const

const MINE = 'The Long Walk, signed'
const THEIRS_TITLE = 'The Long Walk (2nd ed.)'

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
  expect(results.violations).toEqual([])
}

const notice = (scope: Page | Locator) => scope.locator('[data-slot=notice][data-tone=warning]')

// Opens the form, types a title, has another writer save, then saves: refused.
async function conflict(page: Page, id: 'edit-form' | 'edit-dialog', theme: 'light' | 'dark' = 'light') {
  await page.goto(STORY(id, theme))
  const scope = id === 'edit-dialog' ? page.getByRole('dialog', { name: 'Edit Book' }) : page.locator('body')
  const title = scope.getByLabel('Title')
  await expect(title).toHaveValue('The Long Walk')
  await title.fill(MINE)
  await scope.getByRole('button', { name: 'Save Elsewhere' }).click()
  await scope.getByRole('button', { name: 'Save Changes' }).click()
  await expect(notice(scope)).toContainText('Changed elsewhere')
  await expect(notice(scope)).toContainText('nothing was saved')
  return scope
}

for (const { name, viewport } of WIDTHS) {
  test.describe(`a form refused because the record changed elsewhere (${name})`, () => {
    test.use({ viewport })

    test("the save is refused, nothing is written, and what's typed stays", async ({ page }) => {
      const scope = await conflict(page, 'edit-form')
      await expect(page.getByTestId('stored')).toContainText(THEIRS_TITLE)
      await expect(scope.getByLabel('Title')).toHaveValue(MINE)
      // The Notice sits in the bar, above the buttons, on screen with them.
      const bar = page.locator('[data-slot=entity-form-bar]')
      await expect(bar.locator('[data-slot=notice]')).toBeVisible()
      const saveBox = (await bar.getByRole('button', { name: 'Save Changes' }).boundingBox())!
      const noticeBox = (await notice(bar).boundingBox())!
      expect(noticeBox.y + noticeBox.height).toBeLessThanOrEqual(saveBox.y + 1)
      expect(noticeBox.x + noticeBox.width).toBeLessThanOrEqual(viewport.width)
      // No Try Again: trying the same save again would be refused again.
      await expect(bar.getByRole('button', { name: 'Try Again' })).toHaveCount(0)
      await expect(bar.getByRole('button', { name: 'Keep Mine' })).toBeEnabled()
      await expect(bar.getByRole('button', { name: 'Show Saved' })).toBeEnabled()
    })

    test('Keep Mine saves the form as it is over theirs', async ({ page }) => {
      const scope = await conflict(page, 'edit-form')
      await scope.getByRole('button', { name: 'Keep Mine' }).click()
      // The whole form: their notes go back to the form's too, as the Notice says.
      await expect(page.getByTestId('landed')).toHaveText(`Saved ${MINE} / Started in the spring.`)
    })

    test("Show Saved shows theirs, and a save after it doesn't conflict", async ({ page }) => {
      const scope = await conflict(page, 'edit-form')
      await scope.getByRole('button', { name: 'Show Saved' }).click()
      await expect(scope.getByLabel('Title')).toHaveValue(THEIRS_TITLE)
      await expect(scope.getByLabel('Notes')).toHaveValue('Edited on the phone.')
      await expect(notice(scope)).toHaveCount(0)
      await scope.getByLabel('Notes').fill('Read it twice.')
      await scope.getByRole('button', { name: 'Save Changes' }).click()
      await expect(page.getByTestId('landed')).toHaveText(`Saved ${THEIRS_TITLE} / Read it twice.`)
    })

    test('in a FormDialog: the same Notice above its buttons, Keep Mine saves', async ({ page }) => {
      const dialog = await conflict(page, 'edit-dialog')
      await expect(dialog.getByLabel('Title')).toHaveValue(MINE)
      await expect(dialog.locator('[data-slot=form-dialog-bar] [data-slot=notice]')).toBeVisible()
      await dialog.getByRole('button', { name: 'Keep Mine' }).click()
      await expect(notice(dialog)).toHaveCount(0)
      await expect(dialog.getByTestId('stored')).toContainText(`Saved: ${MINE} / Started in the spring.`)
    })

    for (const theme of ['light', 'dark'] as const) {
      test(`the conflict is accessible (${theme})`, async ({ page }) => {
        await conflict(page, 'edit-form', theme)
        await axe(page)
      })
    }
  })
}
