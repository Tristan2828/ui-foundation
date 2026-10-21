import { expect, test, type Locator, type Page } from '@playwright/test'

// A list item's row edited in place (app/EditableList ItemRows, #187): the
// form's row, a done box then the text box, sits side by side while the
// item is edited and while one is added, as in the form's ListEditor. A
// row the app already wrapped in its own flex row still fills the width.
const story = 'http://localhost:6006/iframe.html?id=app-editablelist--item-rows&viewMode=story'

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
