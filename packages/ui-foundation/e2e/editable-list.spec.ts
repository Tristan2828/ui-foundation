import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

// A list item's row edited in place (app/EditableList ItemRows, #187): the
// form's row, a done box then the text box, sits side by side while the
// item is edited and while one is added, as in the form's ListEditor. A
// row the app already wrapped in its own flex row still fills the width.
const story = 'http://localhost:6180/story.html?id=app-editablelist--item-rows'

async function open(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(story)
  await expect(page.getByRole('heading', { level: 1, name: 'Office move' })).toBeVisible()
}

// The box left of the text box, on the same line, and the text box
// reaching the field's right edge.
async function expectBeside(checkbox: Locator, input: Locator) {
  const box = (await checkbox.boundingBox())!
  const text = (await input.boundingBox())!
  const field = (await input.locator('xpath=ancestor::*[@data-slot="editable-value"][1]').boundingBox())!
  expect(box.x + box.width).toBeLessThanOrEqual(text.x)
  expect(box.y).toBeLessThan(text.y + text.height)
  expect(box.y + box.height).toBeGreaterThan(text.y)
  expect(field.x + field.width - (text.x + text.width)).toBeLessThanOrEqual(1)
}

for (const { section, name } of [
  { section: 'Checklist', name: 'Item' },
  { section: 'Steps', name: 'Step' },
]) {
  test(`${section}: the done box sits beside the text box while editing and while adding`, async ({ page }) => {
    await open(page)
    const region = page.getByRole('region', { name: section, exact: true })

    await region.getByRole('button', { name: `Edit ${name} 1` }).click()
    const editing = page.getByRole('textbox', { name: `${name} 1 text` })
    await expect(editing).toBeFocused()
    await expectBeside(page.getByRole('checkbox', { name: `${name} 1 done` }), editing)
    await page.keyboard.press('Escape')

    await region.getByRole('button', { name: `Add ${name}` }).click()
    const count = await region.getByRole('listitem').count()
    const adding = page.getByRole('textbox', { name: `${name} ${count + 1} text` })
    await expect(adding).toBeFocused()
    await expectBeside(page.getByRole('checkbox', { name: `${name} ${count + 1} done` }), adding)
  })
}

// A list added by upload (app/EditableList AddedByUpload, #256): the
// list's own `add` puts the uploaded file at the end through `save`, and
// it then edits, moves and removes like any item; a refused upload says
// why under the list. A muted value on the hover and focus tint reads as
// foreground (#257): axe with the caret on a pencil, in both themes.
const uploads = 'http://localhost:6180/story.html?id=app-editablelist--added-by-upload'

async function openUploads(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${uploads}&theme=${theme}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Office move' })).toBeVisible()
  return page.getByRole('region', { name: 'Files', exact: true })
}

test('Files: an upload adds at the end, then edits, moves and removes like any item', async ({ page }) => {
  const files = await openUploads(page)
  const add = files.getByRole('button', { name: 'Add files' })
  await add.click()
  await expect(files.getByText('photo-1.jpg')).toBeVisible()
  await expect(files.getByRole('listitem')).toHaveCount(2)
  await expect(add).toBeFocused()

  await files.getByRole('button', { name: 'Edit photo-1.jpg' }).click()
  const caption = page.getByRole('textbox', { name: 'Caption for photo-1.jpg' })
  await expect(caption).toBeFocused()
  await caption.fill('The hallway')
  await page.keyboard.press('Enter')
  await expect(files.getByText('The hallway')).toBeVisible()

  await files.getByRole('button', { name: 'Move photo-1.jpg up' }).click()
  await expect(files.getByRole('listitem').first()).toContainText('The hallway')

  await files.getByRole('button', { name: 'Remove floor-plan.pdf' }).click()
  await expect(files.getByRole('listitem')).toHaveCount(1)
  await expect(files.getByText('floor-plan.pdf')).toBeHidden()
})

test('Files: the add stops at its limit, and a refused upload says why under the list', async ({ page }) => {
  const files = await openUploads(page)
  const add = files.getByRole('button', { name: 'Add files' })
  await add.click()
  await expect(files.getByRole('listitem')).toHaveCount(2)
  await add.click()
  await expect(files.getByRole('listitem')).toHaveCount(3)
  await expect(add).toBeDisabled()

  await files.getByRole('button', { name: 'Refuse an upload' }).click()
  await expect(files.getByText('That file is too large (at most 10 MB).')).toBeVisible()
})

for (const theme of ['light', 'dark'] as const) {
  test(`muted values on the hover and focus tint pass axe (${theme})`, async ({ page }) => {
    await openUploads(page, theme)
    const axe = () => new AxeBuilder({ page }).disableRules(['landmark-one-main', 'region']).analyze()
    // The view's own "Not set", then a file's "No caption", each with the caret on its pencil.
    for (const pencil of ['Edit Owner', 'Edit floor-plan.pdf']) {
      const button = page.getByRole('button', { name: pencil })
      await button.focus()
      await expect(button).toBeFocused()
      expect((await axe()).violations).toEqual([])
      await button.hover()
      expect((await axe()).violations).toEqual([])
    }
  })
}
