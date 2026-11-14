import { expect, test, type Locator, type Page } from '@playwright/test'

// The form standard's controls (4.88, F10 to F18), on app/FormControls:
// a choice as buttons, a typed date, Create from a reference picker (single
// and multi), a long multi-pick, and the same fields edited in place on a
// record's rows (the row hover, "✓ Saved", a phone's chevron).
const story = (id: string) => `http://localhost:6180/story.html?id=app-formcontrols--${id}`

test.use({ locale: 'en-US', timezoneId: 'America/Chicago' })

test.describe('on a form', () => {
  test('a choice of three is a row of buttons: one click picks, pressing it again clears an optional one', async ({ page }) => {
    await page.goto(story('form'))
    const format = page.getByRole('group', { name: 'Format' })
    await expect(format.getByRole('button')).toHaveText(['Print', 'Ebook', 'Audio'])
    await expect(format.getByRole('button', { name: 'Print' })).toHaveAttribute('aria-pressed', 'true')
    await format.getByRole('button', { name: 'Ebook' }).click()
    await expect(page.getByTestId('format-value')).toHaveText('ebook')
    await expect(format.getByRole('button', { name: 'Ebook' })).toHaveAttribute('aria-pressed', 'true')
    await expect(format.getByRole('button', { name: 'Print' })).toHaveAttribute('aria-pressed', 'false')
    await format.getByRole('button', { name: 'Ebook' }).click()
    await expect(page.getByTestId('format-value')).toHaveText('empty')
    // The arrow keys move along the buttons; Space picks.
    await format.getByRole('button', { name: 'Print' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(format.getByRole('button', { name: 'Ebook' })).toBeFocused()
    await page.keyboard.press('Space')
    await expect(page.getByTestId('format-value')).toHaveText('ebook')
  })

  test('a date is typed: 3/20, Mar 21, today, and the box reads it back as shown', async ({ page }) => {
    await page.goto(story('form'))
    const finished = page.getByRole('textbox', { name: 'Finished On' })
    await expect(finished).toHaveAttribute('placeholder', '3/14 or Mar 14')
    await finished.fill('3/20')
    await expect(page.getByTestId('finished-value')).toHaveText('2026-03-20')
    await finished.press('Tab')
    await expect(finished).toHaveValue('Mar 20, 2026')
    await finished.fill('Mar 21')
    await finished.press('Enter')
    await expect(page.getByTestId('finished-value')).toHaveText('2026-03-21')
    await expect(finished).toHaveValue('Mar 21, 2026')
    await finished.fill('today')
    await finished.press('Tab')
    await expect(page.getByTestId('finished-value')).toHaveText(/^\d{4}-\d{2}-\d{2}$/)
    await finished.fill('')
    await expect(page.getByTestId('finished-value')).toHaveText('empty')
  })

  test('an unreadable date says what to type, and gives empty, not the day it had', async ({ page }) => {
    await page.goto(story('form'))
    const started = page.getByRole('textbox', { name: 'Started On' })
    await expect(started).toHaveValue('Mar 14, 2026')
    await started.fill('soon')
    await expect(page.getByTestId('started-value')).toHaveText('empty')
    // Not while typing: once the box is left.
    await expect(page.getByText('Try a date like 3/14 or Mar 14')).toHaveCount(0)
    await started.press('Tab')
    await expect(page.getByText('Try a date like 3/14 or Mar 14')).toBeVisible()
    await expect(started).toHaveAttribute('aria-invalid', 'true')
    await expect(started).toHaveAccessibleDescription('Try a date like 3/14 or Mar 14')
    await expect(started).toHaveValue('soon')
    await started.fill('3/15')
    await expect(page.getByText('Try a date like 3/14 or Mar 14')).toHaveCount(0)
    await expect(page.getByTestId('started-value')).toHaveText('2026-03-15')
  })

  test('the calendar is on the box\'s button, and a pick goes back to the box', async ({ page }) => {
    await page.goto(story('form'))
    const started = page.getByRole('textbox', { name: 'Started On' })
    const field = page.locator('[data-slot="date-field"]').filter({ has: started })
    await field.getByRole('button', { name: 'Open Calendar' }).click()
    const calendar = page.locator('[data-slot="date-field-calendar"]')
    await expect(calendar.getByRole('button', { name: /March 14th, 2026/ })).toBeFocused()
    await calendar.getByRole('button', { name: /March 18th, 2026/ }).click()
    await expect(calendar).toHaveCount(0)
    await expect(page.getByTestId('started-value')).toHaveText('2026-03-18')
    await expect(started).toHaveValue('Mar 18, 2026')
    await expect(started).toBeFocused()
  })

  test('Create "name" ends a reference\'s list, opens the create form with it, and picks what it saves', async ({ page }) => {
    await page.goto(story('form'))
    const series = page.getByRole('combobox', { name: 'Series' })
    await series.fill('Tin')
    await expect(page.getByRole('option', { name: 'The Tin Compass' })).toBeVisible()
    // A name a record has: no Create.
    await series.fill('the tin compass')
    await expect(page.getByRole('option', { name: 'The Tin Compass' })).toBeVisible()
    await expect(page.getByRole('option', { name: /^Create/ })).toHaveCount(0)
    await series.fill('Glass Moon')
    const create = page.getByRole('option', { name: 'Create "Glass Moon"' })
    await expect(create).toBeVisible()
    await create.click()
    const dialog = page.getByRole('dialog', { name: 'New series' })
    await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Glass Moon')
    await dialog.getByRole('button', { name: 'Add series' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByTestId('series-value')).toHaveText('Glass Moon')
  })

  test('a cancelled create form picks nothing', async ({ page }) => {
    await page.goto(story('form'))
    const series = page.getByRole('combobox', { name: 'Series' })
    await series.fill('Paper Kite')
    await page.getByRole('option', { name: 'Create "Paper Kite"' }).click()
    const dialog = page.getByRole('dialog', { name: 'New series' })
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByTestId('series-value')).toHaveText('empty')
  })

  test('several records: Create adds the new one to the picks', async ({ page }) => {
    await page.goto(story('form'))
    const authors = page.getByRole('combobox', { name: 'Authors' })
    await authors.fill('D. Draft')
    await page.getByRole('option', { name: 'Create "D. Draft"' }).click()
    const dialog = page.getByRole('dialog', { name: 'New author' })
    await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('D. Draft')
    await dialog.getByRole('button', { name: 'Add author' }).click()
    await expect(page.getByTestId('authors-value')).toHaveText('A. Example, D. Draft')
    await expect(page.getByRole('button', { name: 'Remove D. Draft' })).toBeVisible()
  })

  test('a long set shows the first 30 and the picked ones, then Show all; a filter searches them all', async ({ page }) => {
    await page.goto(story('form'))
    const shelves = page.getByRole('group', { name: 'Shelves' })
    // 30, and Woodlands (the 38th), picked.
    await expect(shelves.getByRole('button')).toHaveCount(31)
    await expect(shelves.getByRole('button', { name: 'Woodlands' })).toHaveAttribute('aria-pressed', 'true')
    await expect(shelves.getByRole('button', { name: 'Zeppelins' })).toHaveCount(0)
    await page.getByRole('searchbox', { name: 'Filter Shelves' }).fill('zep')
    await expect(shelves.getByRole('button')).toHaveText(['Zeppelins'])
    await page.getByRole('searchbox', { name: 'Filter Shelves' }).fill('')
    await page.getByRole('button', { name: 'Show All 40 Shelves' }).click()
    await expect(shelves.getByRole('button')).toHaveCount(40)
    await expect(page.getByRole('button', { name: /^Show All/ })).toHaveCount(0)
    await shelves.getByRole('button', { name: 'Zeppelins' }).click()
    await expect(page.getByTestId('shelves-value')).toHaveText('38,40')
  })

  test('on a phone: the chips wrap, nothing runs off, and two dates still share a row', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto(story('form'))
    await page.getByRole('button', { name: 'Show All 40 Shelves' }).click()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBe(0)
    const started = await page.getByRole('textbox', { name: 'Started On' }).boundingBox()
    const finished = await page.getByRole('textbox', { name: 'Finished On' }).boundingBox()
    expect(started && finished && Math.abs(started.y - finished.y)).toBeLessThan(2)
    // The filter box stays above the chips.
    const filter = await page.getByRole('searchbox', { name: 'Filter Shelves' }).boundingBox()
    const chips = await page.getByRole('group', { name: 'Shelves' }).boundingBox()
    expect(filter!.y + filter!.height).toBeLessThanOrEqual(chips!.y)
  })
})

// A field row of the record's Details card.
const row = (page: Page, label: string) =>
  page.getByRole('region', { name: 'Details' }).locator('dl > div').filter({ has: page.locator('dt', { hasText: label }) })

test.describe('edited in place', () => {
  test('the whole row is the target: its hover is the list row\'s, and a click on its label opens it', async ({ page }) => {
    await page.goto(story('edit-in-place'))
    const author = row(page, 'Author')
    const pencil = author.getByRole('button', { name: 'Edit Author' })
    await expect(pencil).toHaveCSS('opacity', '0')
    await author.locator('dt').hover()
    await expect(pencil).toHaveCSS('opacity', '1')
    const tint = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.style.background = 'var(--table-hover)'
      document.body.append(probe)
      const color = getComputedStyle(probe).backgroundColor
      probe.remove()
      return color
    })
    // Once its colour transition ends: the table's tint, and the 3px bar at its start.
    await expect.poll(() => author.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(tint)
    const shadow = await author.evaluate((element) => getComputedStyle(element).boxShadow)
    expect(shadow).toContain('inset')
    expect(shadow).toContain('3px 0px 0px 0px')
    await author.locator('dt').click()
    await expect(page.getByRole('textbox', { name: 'Author' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(pencil).toBeFocused()
  })

  test('a save that lands says Saved for a moment, then goes', async ({ page }) => {
    await page.goto(story('edit-in-place'))
    const format = row(page, 'Format')
    await expect(format).toContainText('Ebook')
    await format.getByRole('button', { name: 'Edit Format' }).click()
    const buttons = page.getByRole('group', { name: 'Format' })
    await buttons.getByRole('button', { name: 'Audio' }).click()
    await expect(format.getByText('Saving…')).toBeVisible()
    const saved = format.getByRole('status').filter({ hasText: 'Saved' })
    await expect(saved).toBeVisible()
    await expect(format).toContainText('Audio')
    await expect(saved).toHaveCount(0, { timeout: 4000 })
  })

  test('a refused save says why and no Saved', async ({ page }) => {
    await page.goto(story('edit-in-place'))
    const author = row(page, 'Author')
    await author.getByRole('button', { name: 'Edit Author' }).click()
    await page.getByRole('textbox', { name: 'Author' }).fill('Fail')
    await page.keyboard.press('Enter')
    await expect(author.getByText("Couldn't save: the server didn't answer.")).toBeVisible()
    await expect(author.getByText('Saved', { exact: true })).toHaveCount(0)
  })

  test('a date is typed in place: Enter saves it; an unreadable one is refused and not sent', async ({ page }) => {
    await page.goto(story('edit-in-place'))
    const started = row(page, 'Started On')
    await expect(started).toContainText('Mar 14, 2026')
    await started.getByRole('button', { name: 'Edit Started On' }).click()
    const box = page.getByRole('textbox', { name: 'Started On' })
    await expect(box).toBeFocused()
    await box.fill('soon')
    await box.press('Enter')
    await expect(started.getByText('Try a date like 3/14 or Mar 14').first()).toBeVisible()
    await expect(started.getByText('Saving…')).toHaveCount(0)
    await box.fill('4/1')
    await box.press('Enter')
    await expect(started).toContainText('Apr 1, 2026')
    await expect(started.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
  })

  test('a day picked in place from the calendar saves at once', async ({ page }) => {
    await page.goto(story('edit-in-place'))
    const started = row(page, 'Started On')
    await started.getByRole('button', { name: 'Edit Started On' }).click()
    await started.getByRole('button', { name: 'Open Calendar' }).click()
    await page.locator('[data-slot="date-field-calendar"]').getByRole('button', { name: /March 9th, 2026/ }).click()
    await expect(started).toContainText('Mar 9, 2026')
  })

  test('Create from a reference in place: the field waits for the create form, then saves the new record', async ({ page }) => {
    await page.goto(story('edit-in-place'))
    const series = row(page, 'Series')
    await expect(series).toContainText('The Tin Compass')
    await series.getByRole('button', { name: 'Edit Series' }).click()
    const box = page.getByRole('combobox', { name: 'Series' })
    await box.fill('New Shore')
    await page.getByRole('option', { name: 'Create "New Shore"' }).click()
    const dialog = page.getByRole('dialog', { name: 'New series' })
    await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('New Shore')
    await dialog.getByRole('button', { name: 'Add series' }).click()
    await expect(series).toContainText('New Shore')
    await expect(series.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
  })

  test('on a phone: no pencil, a chevron, and the row is 44px at least', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto(story('edit-in-place'))
    const author = row(page, 'Author')
    const edit = author.getByRole('button', { name: 'Edit Author' })
    await expect(edit).toHaveCSS('opacity', '1')
    await expect(edit.locator('svg.lucide-pencil')).toBeHidden()
    await expect(edit.locator('svg.lucide-chevron-right')).toBeVisible()
    const box = await author.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    // The control still opens in the row.
    await author.locator('dt').click()
    await expect(author.getByRole('textbox', { name: 'Author' })).toBeFocused()
  })
})

test.describe('a choice in a narrow box', () => {
  // Every button inside the box with its whole border, the group not
  // scrolling, the first line still joined and the rest wrapped below it:
  // never cut off (4.97, app/FormControls Narrow).
  async function fitsIn(box: Locator, group: Locator) {
    await expect(group.getByRole('button')).toHaveCount(4)
    const edge = (await box.boundingBox())!
    const tops: number[] = []
    for (const button of await group.getByRole('button').all()) {
      const at = (await button.boundingBox())!
      expect(at.x).toBeGreaterThanOrEqual(edge.x)
      expect(at.x + at.width).toBeLessThanOrEqual(edge.x + edge.width + 0.5)
      tops.push(Math.round(at.y))
      // Each keeps its whole border, so one that wraps starts with an edge.
      expect(await button.evaluate((node) => getComputedStyle(node).borderLeftWidth)).toBe('1px')
    }
    expect(await group.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(0)
    expect(tops[1]).toBe(tops[0])
    expect(Math.max(...tops)).toBeGreaterThan(tops[0]!)
  }

  test.use({ viewport: { width: 1280, height: 900 } })

  test('on a form 280px wide, the buttons wrap inside it', async ({ page }) => {
    await page.goto(story('narrow'))
    const box = page.getByTestId('narrow-form')
    await fitsIn(box, box.getByRole('group', { name: 'Binding' }))
  })

  test('edited in place on a record 280px wide, the value column keeps its width and the buttons wrap', async ({ page }) => {
    await page.goto(story('narrow'))
    const box = page.getByTestId('narrow-record')
    await box.getByRole('button', { name: 'Edit Binding' }).click()
    await fitsIn(box, box.getByRole('group', { name: 'Binding' }))
  })

  // Since 4.98 (9C) a choice shares its row only with another choice: in
  // the dialog Binding has half the row beside Condition, too narrow for
  // its four buttons, and the two dates take the next row together.
  test('in a dialog, sharing a row with another choice, the buttons wrap inside their field', async ({ page }) => {
    await page.goto(story('narrow'))
    await page.getByRole('button', { name: 'Edit Book' }).click()
    const dialog = page.getByRole('dialog', { name: 'Edit Book' })
    // Measured once it has grown in, not while it animates.
    await dialog.evaluate((node) => Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished)))
    const group = dialog.getByRole('group', { name: 'Binding' })
    const condition = (await dialog.getByRole('group', { name: 'Condition' }).boundingBox())!
    expect(Math.abs(condition.y - (await group.boundingBox())!.y)).toBeLessThan(2)
    await fitsIn(group.locator('xpath=ancestor::*[@data-slot="field"][1]'), group)
    const started = (await dialog.getByRole('textbox', { name: 'Started On' }).boundingBox())!
    const finished = (await dialog.getByRole('textbox', { name: 'Finished On' }).boundingBox())!
    expect(Math.abs(started.y - finished.y)).toBeLessThan(2)
    expect(started.y).toBeGreaterThan(condition.y + condition.height)
  })
})

// A list's filter with a summary stays one line (4.109): with picks,
// "Shelf: <first> +1" truncates and the text box takes no room until
// focused, so in a 192px box it's as tall as the Input beside it.
test.describe('a narrow MultiChoice filter with a summary', () => {
  test('stays the height of the Input beside it, its summary cut off with an ellipsis', async ({ page }) => {
    await page.goto(story('narrow-filters'))
    const row = page.getByTestId('narrow-filters')
    const input = row.getByRole('textbox', { name: 'Search by title' })
    const filter = row.locator('[data-slot=combobox-chips]')
    const summary = filter.locator('[data-slot=multi-choice-summary]')
    await expect(summary).toContainText('Shelf: Hallway bookcase by the stairs')
    await expect(summary).toContainText('+1')
    const heightOf = async (locator: Locator) => (await locator.boundingBox())!.height
    expect((await filter.boundingBox())!.width).toBe(192)
    expect(await heightOf(filter)).toBe(await heightOf(input))
    // The summary is cut off, not wrapped: wider than the room it has.
    expect(await summary.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true)
    expect(await summary.evaluate((node) => getComputedStyle(node).textOverflow)).toBe('ellipsis')
    // Focused, the text box takes its room and the control keeps its height.
    await row.getByRole('combobox', { name: 'Filter by shelf' }).focus()
    expect(await heightOf(filter)).toBe(await heightOf(input))
  })
})

// A status of five or more as OptionSelect (4.109): each option's kind icon
// in its colour on the trigger and in the list, as ChoiceButtons draws it.
test.describe('a status select draws its kinds', () => {
  const tokenColour = (page: Page, token: string) =>
    page.evaluate((token) => {
      const probe = document.createElement('div')
      probe.style.color = `var(${token})`
      document.body.append(probe)
      const colour = getComputedStyle(probe).color
      probe.remove()
      return colour
    }, token)
  const colourOf = (locator: Locator) => locator.evaluate((node) => getComputedStyle(node).color)

  test("the picked one's icon on the trigger, and every option's in the list, in their kinds' colours", async ({ page }) => {
    await page.goto(story('status-selects'))
    const trigger = page.getByTestId('status-selects-page').getByRole('combobox', { name: 'Stage' })
    const icon = trigger.locator('[data-slot=option-select-icon]')
    await expect(icon).toHaveAttribute('data-kind', 'attention')
    expect(await colourOf(icon)).toBe(await tokenColour(page, '--destructive-text'))

    await trigger.click()
    const list = page.getByRole('listbox')
    const tones: Record<string, string> = {
      Idea: '--info-text',
      Drafting: '--success-text',
      Shelved: '--warning-text',
      Sent: '--muted-foreground',
    }
    for (const [label, token] of Object.entries(tones)) {
      const item = list.getByRole('option', { name: label })
      await expect(item.locator('[data-slot=option-select-icon]')).toBeVisible()
      expect(await colourOf(item.locator('[data-slot=option-select-icon]'))).toBe(await tokenColour(page, token))
    }
    // "Not set" has no icon.
    await expect(list.getByRole('option', { name: 'Not set' }).locator('svg[data-slot=option-select-icon]')).toHaveCount(0)
    await list.getByRole('option', { name: 'Sent' }).click()
    await expect(icon).toHaveAttribute('data-kind', 'done')
  })

  test('a plain icon, with no kind, keeps the words’ colour', async ({ page }) => {
    await page.goto(story('status-selects'))
    const trigger = page.getByTestId('status-selects-page').getByRole('combobox', { name: 'Pick Up' })
    const icon = trigger.locator('[data-slot=option-select-icon]')
    await expect(icon).toBeVisible()
    await expect(icon).not.toHaveAttribute('data-kind', /.+/)
    expect(await colourOf(icon)).toBe(await colourOf(trigger.locator('[data-slot=select-value]')))
  })
})
