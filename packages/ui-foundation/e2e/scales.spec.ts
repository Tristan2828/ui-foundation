import { expect, test } from '@playwright/test'

// ProgressRing, StepBar and RatingStar (patterns/Scales): each is one
// image to a screen reader, named in words. Axe, the token check and the
// glyph check are e2e/fixtures-visual.spec.ts's.
const STORY = 'http://localhost:6180/story.html?id=patterns-scales--default'

test('each glyph is named in words, and zero of zero reads as not started', async ({ page }) => {
  await page.goto(STORY)
  const onPage = page.getByRole('table', { name: 'On the page' })
  for (const name of ['6 of 6 done', '4 of 6 done', '1 of 3 done', '0 of 4 done', 'Not started']) {
    await expect(onPage.getByRole('img', { name, exact: true })).toBeVisible()
  }
  for (const name of ['Best, 5 of 5', 'High, 4 of 5', 'Fair, 3 of 5', 'Low, 2 of 5', 'Worst, 1 of 5']) {
    await expect(onPage.getByRole('img', { name, exact: true })).toBeVisible()
  }
  for (const name of ['Yes', 'No', 'Partly']) {
    await expect(onPage.getByRole('img', { name, exact: true }).first()).toBeVisible()
  }
})

test('the ring turns success once complete, shows the count, and draws no arc at zero', async ({ page }) => {
  await page.goto(STORY)
  const onPage = page.getByRole('table', { name: 'On the page' })
  const complete = onPage.getByRole('img', { name: '6 of 6 done' })
  await expect(complete).toHaveAttribute('data-complete', 'true')
  await expect(complete).toContainText('6/6')
  await expect(onPage.getByRole('img', { name: '4 of 6 done' })).not.toHaveAttribute('data-complete')
  await expect(onPage.getByRole('img', { name: '0 of 4 done' }).locator('circle')).toHaveCount(1)
  await expect(onPage.getByRole('img', { name: '4 of 6 done' }).locator('circle')).toHaveCount(2)
})

test('the star is a shape per value: the half is clipped to the left half over the outline', async ({ page }) => {
  await page.goto(STORY)
  const onPage = page.getByRole('table', { name: 'On the page' })
  await expect(onPage.getByRole('img', { name: 'Yes' }).locator('path')).toHaveCount(2)
  await expect(onPage.getByRole('img', { name: 'No' }).first().locator('path')).toHaveCount(1)
  const half = onPage.getByRole('img', { name: 'Partly' }).first()
  await expect(half.locator('path')).toHaveCount(2)
  await expect(half.locator('clipPath rect')).toHaveAttribute('width', '12')
})
