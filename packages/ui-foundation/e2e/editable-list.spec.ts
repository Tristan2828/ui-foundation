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

  await files.getByRole('button', { name: 'Refuse an Upload' }).click()
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

// A list grouped by one of its items' fields, and the same list filtered
// (app/EditableList GroupedAndFiltered): a move swaps an item with the
// next one shown, a group's Add puts the new item in that group, and
// Duplicate copies an item right after it. Both sections are the same
// saved list, so each shows the other's changes.
const grouped = 'http://localhost:6180/story.html?id=app-editablelist--grouped-and-filtered'

async function openGrouped(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${grouped}&theme=${theme}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Spring clean' })).toBeVisible()
}

const texts = (list: Locator) => list.getByRole('listitem').allInnerTexts()

test('grouped: each group lists its own items, and a move stays inside the group', async ({ page }) => {
  await openGrouped(page)
  const kitchen = page.getByRole('list', { name: 'By room: Kitchen' })
  const garage = page.getByRole('list', { name: 'By room: Garage' })
  await expect(kitchen.getByRole('listitem')).toHaveCount(3)
  await expect(garage.getByRole('listitem')).toHaveCount(2)
  // Hallway is named in the order, so it shows with no items and its Add.
  await expect(page.getByRole('group', { name: 'Hallway' })).toContainText('No tasks')

  // Task 3 (Fix the tap) is Kitchen's second: up swaps it with Kitchen's
  // first, past Garage's Sweep out between them in the list.
  await kitchen.getByRole('button', { name: 'Move task 3 up' }).click()
  await expect(kitchen.getByRole('listitem').first()).toContainText('Fix the tap')
  await expect(page.getByRole('button', { name: 'Move task 1 down' })).toBeFocused()
  expect(await texts(page.getByRole('list', { name: 'Every task' }))).toEqual([
    'Fix the tap (Kitchen)',
    'Sweep out (Garage)',
    'Paint the skirting (Kitchen)',
    'Hang the shelves (Garage)',
    'Clear the worktop (Kitchen)',
  ])
  // The first of a group can't go up, though another group's item is above it in the list.
  await expect(garage.getByRole('button', { name: 'Move task 2 up' })).toBeDisabled()
})

test("grouped: a group's Add puts the new item in that group; Duplicate copies right after", async ({ page }) => {
  await openGrouped(page)
  await page.getByRole('button', { name: 'Add task to Hallway' }).click()
  const adding = page.getByRole('textbox', { name: 'Task 6 text' })
  await expect(adding).toBeFocused()
  await adding.fill('Mop the floor')
  await page.keyboard.press('Enter')
  const hallway = page.getByRole('list', { name: 'By room: Hallway' })
  await expect(hallway.getByRole('listitem')).toHaveText(['Mop the floor'])
  await page.keyboard.press('Escape')

  const garage = page.getByRole('list', { name: 'By room: Garage' })
  await garage.getByRole('button', { name: 'Duplicate task 4' }).click()
  await expect(garage.getByRole('listitem')).toHaveCount(3)
  expect(await texts(garage)).toEqual(['Sweep out', 'Hang the shelves', 'Hang the shelves'])
  await expect(page.getByRole('button', { name: 'Duplicate task 4' })).toBeFocused()
})

test('filtered: hidden items stay in the list; a move passes over them', async ({ page }) => {
  await openGrouped(page)
  const every = page.getByRole('list', { name: 'Every task' })
  await page.getByRole('button', { name: 'Hide Done' }).click()
  expect(await texts(every)).toEqual(['Paint the skirting (Kitchen)', 'Fix the tap (Kitchen)', 'Hang the shelves (Garage)'])
  // Fix the tap (entry 3) up swaps with Paint the skirting (entry 1),
  // over Sweep out (hidden) between them, which keeps its place.
  await every.getByRole('button', { name: 'Move entry 3 up' }).click()
  await expect(every.getByRole('listitem').first()).toContainText('Fix the tap')
  await page.getByRole('button', { name: 'Hide Done' }).click()
  expect(await texts(every)).toEqual([
    'Fix the tap (Kitchen)',
    'Sweep out (Garage)',
    'Paint the skirting (Kitchen)',
    'Hang the shelves (Garage)',
    'Clear the worktop (Kitchen)',
  ])
})

// The form's own react-hook-form row in place (app/EditableList FormRows):
// it registers its fields on the form it's handed, the schema's refusal
// and the server's 422 at steps.<n>.text show on the text box, and not
// again under the row.
const formRows = 'http://localhost:6180/story.html?id=app-editablelist--form-rows'

async function openFormRows(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${formRows}&theme=${theme}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Shed roof' })).toBeVisible()
  return page.getByRole('region', { name: 'Steps', exact: true })
}

test("form rows: the row is the form's, its refusals on its own field", async ({ page }) => {
  const steps = await openFormRows(page)
  await steps.getByRole('button', { name: 'Edit step 1' }).click()
  const text = page.getByRole('textbox', { name: 'Step 1 text' })
  await expect(text).toBeFocused()
  await expect(text).toHaveValue('Strip the old felt')

  await text.fill('')
  await page.keyboard.press('Enter')
  const field = text.locator('xpath=ancestor::*[@data-slot="field"][1]')
  await expect(field).toContainText('A step needs its words')
  await expect(steps.getByText('A step needs its words')).toHaveCount(1)
  await expect(text).toHaveAttribute('aria-invalid', 'true')

  await text.fill('Strip it!')
  await page.keyboard.press('Enter')
  await expect(field).toContainText('No exclamation marks in a step')
  await expect(steps.getByText('No exclamation marks in a step')).toHaveCount(1)
  await expect(text).toHaveValue('Strip it!')

  await text.fill('Strip it')
  await page.getByRole('textbox', { name: 'Step 1 minutes' }).fill('40')
  await page.keyboard.press('Enter')
  await expect(steps.getByRole('listitem').first()).toContainText('Strip it · 40 min')
})

test('form rows: Add uses the same row, its draft saved at the end', async ({ page }) => {
  const steps = await openFormRows(page)
  await steps.getByRole('button', { name: 'Add Step' }).click()
  const text = page.getByRole('textbox', { name: 'Step 3 text' })
  await expect(text).toBeFocused()
  await text.fill('Nail the edges')
  await page.keyboard.press('Enter')
  await expect(steps.getByRole('listitem').nth(2)).toContainText('Nail the edges · 10 min')
})

for (const theme of ['light', 'dark'] as const) {
  test(`grouped headings and a refused form row pass axe (${theme})`, async ({ page }) => {
    const axe = () => new AxeBuilder({ page }).disableRules(['landmark-one-main', 'region']).analyze()
    await openGrouped(page, theme)
    expect((await axe()).violations).toEqual([])
    const steps = await openFormRows(page, theme)
    await steps.getByRole('button', { name: 'Edit step 1' }).click()
    await page.getByRole('textbox', { name: 'Step 1 text' }).fill('')
    await page.keyboard.press('Enter')
    await expect(steps.getByText('A step needs its words')).toBeVisible()
    expect((await axe()).violations).toEqual([])
  })
}
