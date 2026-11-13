import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// <EditableValue layout="inline"> in a summary line (app/EditableValue
// stories, 4.102): at rest its pencil takes no room, so the "·" after a
// value sits a space after it, not a pencil's width, yet the pencil is
// still a whole 24px target (a test or a person can click it); hover or
// focus makes its room; Tab still reaches it and Enter opens the value.
// Axe in both themes with a pencil focused.
const story = (theme: 'light' | 'dark' = 'light') =>
  `http://localhost:6180/story.html?id=app-editablevalue--inline-in-a-line&theme=${theme}`

async function open(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.goto(story(theme))
  await expect(page.getByTestId('summary-line')).toBeVisible()
}

// From the end of a value's own text to the first "·" after it, in pixels.
const gapAfter = (page: Page, value: string) =>
  page.getByTestId('summary-line').evaluate((line, value) => {
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT)
    const texts: Text[] = []
    while (walker.nextNode()) texts.push(walker.currentNode as Text)
    const own = texts.find((text) => text.data === value)!
    const sep = texts.find((text) => own.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING && text.data.includes('·'))!
    const range = document.createRange()
    range.selectNodeContents(own)
    const end = range.getBoundingClientRect().right
    const at = sep.data.indexOf('·')
    range.setStart(sep, at)
    range.setEnd(sep, at + 1)
    return range.getBoundingClientRect().left - end
  }, value)

// Where a value's own text ends, in pixels from the left.
const textEnd = (page: Page, value: string) =>
  page.getByTestId('summary-line').evaluate((line, value) => {
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      if ((walker.currentNode as Text).data !== value) continue
      const range = document.createRange()
      range.selectNodeContents(walker.currentNode)
      return range.getBoundingClientRect().right
    }
    throw new Error(`no ${value}`)
  }, value)

const pencil = (page: Page, name: string) => page.getByRole('button', { name: `Edit ${name}` })

test('at rest the pencils take no room: each "·" sits a space after its value', async ({ page }) => {
  await open(page)
  for (const value of ['Harbor Office', 'Tuesdays']) {
    // A space and a little more, never a pencil's 24px.
    expect(await gapAfter(page, value)).toBeLessThan(10)
  }
  // Still a real target: its whole 24px box, hidden, out of the flow just
  // past the value, not over it (a click on the value is the value's).
  await expect(pencil(page, 'Place')).toBeVisible()
  const atRest = (await pencil(page, 'Place').boundingBox())!
  expect(atRest.width).toBe(24)
  expect(atRest.x).toBeGreaterThanOrEqual((await textEnd(page, 'Harbor Office')) + 3)
  await expect(pencil(page, 'Place')).toHaveCSS('opacity', '0')
})

test('hover makes room for the pencil beside its value, and only that one', async ({ page }) => {
  await open(page)
  const atRest = (await pencil(page, 'Place').boundingBox())!
  await page.getByText('Harbor Office', { exact: true }).hover()
  // Eased open: the "·" moves over by the pencil's room; the pencil stays put.
  await expect.poll(() => gapAfter(page, 'Harbor Office')).toBeGreaterThanOrEqual(28)
  await expect(pencil(page, 'Place')).toHaveCSS('opacity', '1')
  const shown = (await pencil(page, 'Place').boundingBox())!
  const end = await textEnd(page, 'Harbor Office')
  expect(shown.x).toBeGreaterThanOrEqual(end + 3)
  expect(shown.x + shown.width).toBeLessThanOrEqual(end + 28.5)
  expect(shown.x).toBe(atRest.x)
  expect(await gapAfter(page, 'Tuesdays')).toBeLessThan(10)
  await expect(pencil(page, 'Days')).toHaveCSS('opacity', '0')
  // A click on the value opens it, as before.
  await page.getByText('Harbor Office', { exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Place' })).toBeFocused()
})

test('Tab still reaches each pencil, which makes its room while focused; Enter edits', async ({ page }) => {
  await open(page)
  await pencil(page, 'Place').focus()
  await page.keyboard.press('Tab')
  await expect(pencil(page, 'Days')).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(pencil(page, 'Place')).toBeFocused()
  await expect.poll(() => gapAfter(page, 'Harbor Office')).toBeGreaterThanOrEqual(28)
  await expect(pencil(page, 'Place')).toHaveCSS('opacity', '1')
  await page.keyboard.press('Enter')
  const box = page.getByRole('textbox', { name: 'Place' })
  await expect(box).toBeFocused()
  await box.fill('Harbor Office, North')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Harbor Office, North', { exact: true })).toBeVisible()
  await expect(pencil(page, 'Place')).toBeFocused()
})

for (const theme of ['light', 'dark'] as const) {
  test(`a summary line with a pencil focused has no axe violations (${theme})`, async ({ page }) => {
    await open(page, theme)
    if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
    await pencil(page, 'Place').focus()
    await page.keyboard.press('Tab')
    await expect(pencil(page, 'Days')).toBeFocused()
    const results = await new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
    expect(results.violations).toEqual([])
  })
}
