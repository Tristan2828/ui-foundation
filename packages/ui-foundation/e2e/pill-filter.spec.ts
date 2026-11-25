import { expect, test } from '@playwright/test'

// PillFilter's `lead` (app/PillFilter stories): drawn before the label,
// decorative, the pill's name still its label.
const story = (id: string) => `http://localhost:6180/story.html?id=app-pillfilter--${id}`

test('a lead sits before the label, and the pill is still named by its label', async ({ page }) => {
  await page.goto(story('with-leads'))
  const group = page.getByRole('group', { name: 'Topic' })
  const science = group.getByRole('button', { name: 'Science', exact: true })
  await expect(science).toHaveAccessibleName('Science')
  const lead = science.locator('[data-slot=pill-lead]')
  await expect(lead).toHaveAttribute('aria-hidden', 'true')
  await expect(lead.locator('img')).toHaveAttribute('src', '/assets/emoji-18.0/1f52c.svg')
  const [leadBox, pillBox] = await Promise.all([lead.boundingBox(), science.boundingBox()])
  const textLeft = await science.evaluate((pill) => {
    const range = document.createRange()
    const text = [...pill.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
    if (!text) return NaN
    range.selectNodeContents(text)
    return range.getBoundingClientRect().left
  })
  expect(leadBox && pillBox && leadBox.x > pillBox.x).toBe(true)
  expect(leadBox && leadBox.x + leadBox.width <= textLeft).toBe(true)
  // A pill without one has none.
  await expect(group.getByRole('button', { name: 'Local' }).locator('[data-slot=pill-lead]')).toHaveCount(0)
  await science.click()
  await expect(science).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('topic-value')).toHaveText('science')
})
