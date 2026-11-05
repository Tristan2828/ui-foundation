import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

// Images on a record, in a real browser: ImageField on the form layer
// (EntityForm, react-hook-form, zod) with a fake upload, in every state
// and in both themes, and images in <Markdown> kept inside the text's
// width. The stories: src/components/app/image-field.stories.tsx and
// markdown.stories.tsx.
const HARNESS_URL = 'http://localhost:6180'

function story(id: string, theme: 'light' | 'dark' = 'light') {
  return `${HARNESS_URL}/story.html?id=${id}&theme=${theme}`
}

// As e2e/fixtures-visual.spec.ts: a story preview isn't a page.
function axe(page: Page) {
  return new AxeBuilder({ page }).disableRules(['landmark-one-main', 'page-has-heading-one', 'region']).analyze()
}

// A PNG's bytes (a 1×1 pixel), padded to `size` bytes.
function png(name: string, size = 68) {
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  return { name, mimeType: 'image/png', buffer: Buffer.concat([pixel, Buffer.alloc(Math.max(0, size - pixel.length))]) }
}

function form(page: Page, name: string): Locator {
  return page.locator(`[data-form="${name}"]`)
}

// Picks a file through the field's own button, as a person would.
async function pick(page: Page, button: Locator, file: ReturnType<typeof png> | { name: string; mimeType: string; buffer: Buffer }) {
  const chooser = page.waitForEvent('filechooser')
  await button.click()
  await (await chooser).setFiles(file)
}

test.describe('ImageField', () => {
  test('an empty field uploads a picked photo: busy, then the thumbnail, and the form saves its id', async ({ page }) => {
    await page.goto(story('app-imagefield--default'))
    const plant = form(page, 'new-plant')
    const add = plant.getByRole('button', { name: 'Add photo', exact: true })
    await expect(add).toBeVisible()
    await expect(plant.getByRole('group', { name: 'Photo' })).toBeVisible()

    await pick(page, add, png('fern.png'))
    // Busy: the button says so and waits, keeping focus; the value hasn't changed.
    const busy = plant.getByRole('button', { name: 'Uploading photo…' })
    await expect(busy).toBeDisabled()
    await expect(busy).toBeFocused()
    await expect(plant.getByRole('group', { name: 'Photo' })).toHaveAttribute('aria-busy', 'true')
    await expect(plant.getByTestId('new-plant-busy')).toHaveText('yes')
    await expect(plant.getByRole('status').filter({ hasText: 'Uploading photo…' })).toBeAttached()

    const replace = plant.getByRole('button', { name: 'Replace photo' })
    await expect(replace).toBeEnabled()
    await expect(replace).toBeFocused()
    await expect(plant.getByRole('img', { name: 'Current photo' })).toHaveAttribute('src', /^blob:/)
    await expect(plant.getByTestId('new-plant-busy')).toHaveText('no')
    await expect(plant.getByRole('status').filter({ hasText: 'Photo added.' })).toBeAttached()

    await plant.getByRole('button', { name: 'Save' }).click()
    await expect(plant.getByTestId('new-plant-saved')).toHaveText(/"photoId":"file-\d+"/)
  })

  test("a saved photo shows, and Remove empties the field, focus staying on its button", async ({ page }) => {
    await page.goto(story('app-imagefield--default'))
    const plant = form(page, 'edit-plant')
    await expect(plant.getByRole('img', { name: 'Current photo' })).toHaveAttribute('src', '/sample-photo.svg')
    await plant.getByRole('button', { name: 'Remove photo' }).click()
    const add = plant.getByRole('button', { name: 'Add photo', exact: true })
    await expect(add).toBeFocused()
    await expect(plant.getByRole('img', { name: 'Current photo' })).toHaveCount(0)
    await plant.getByRole('button', { name: 'Save' }).click()
    await expect(plant.getByTestId('edit-plant-saved')).toHaveText('{"name":"Monstera","photoId":null}')
  })

  test('the keyboard reaches Replace then Remove, and Enter opens the picker', async ({ page }) => {
    await page.goto(story('app-imagefield--default'))
    const plant = form(page, 'edit-plant')
    await plant.getByLabel('Name').focus()
    await page.keyboard.press('Tab')
    await expect(plant.getByRole('button', { name: 'Replace photo' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(plant.getByRole('button', { name: 'Remove photo' })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    const chooser = page.waitForEvent('filechooser')
    await page.keyboard.press('Enter')
    expect((await chooser).isMultiple()).toBe(false)
  })

  test("a failed upload says why under the field and keeps the value", async ({ page }) => {
    await page.goto(story('app-imagefield--refusals'))
    const plant = form(page, 'upload-fails')
    const add = plant.getByRole('button', { name: 'Add photo', exact: true })
    await pick(page, add, png('cactus.png'))
    const reason = plant.getByRole('alert').filter({ hasText: 'Storage is full. Free some space and try again.' })
    await expect(reason).toBeVisible()
    // Named by the button, so a screen reader hears it there too.
    const errorId = await reason.getAttribute('id')
    await expect(add).toHaveAttribute('aria-describedby', new RegExp(`\\b${errorId}\\b`))
    await expect(add).toBeEnabled()
    await plant.getByRole('button', { name: 'Save' }).click()
    await expect(plant.getByTestId('upload-fails-saved')).toHaveText('{"name":"Cactus","photoId":null}')
  })

  test('a file over the size limit, or of another type, is refused before it is sent', async ({ page }) => {
    await page.goto(story('app-imagefield--refusals'))
    const plant = form(page, 'size-limit')
    const add = plant.getByRole('button', { name: 'Add photo', exact: true })

    await pick(page, add, png('huge.png', 3 * 1024 * 1024))
    await expect(plant.getByRole('alert')).toHaveText('That image is 3 MB. The limit is 1 MB.')
    // Never sent: not busy for a moment.
    await expect(plant.getByTestId('size-limit-busy')).toHaveText('no')
    await expect(add).toBeEnabled()

    await pick(page, add, { name: 'notes.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') })
    await expect(plant.getByRole('alert')).toHaveText('That file is a GIF. Choose a JPEG, PNG or WebP image.')

    // A file it takes clears the reason.
    await pick(page, add, png('small.png'))
    await expect(plant.getByRole('alert')).toHaveCount(0)
    await expect(plant.getByRole('button', { name: 'Replace photo' })).toBeVisible()
  })

  test("the picker offers only the field's types", async ({ page }) => {
    await page.goto(story('app-imagefield--default'))
    await expect(form(page, 'new-plant').locator('input[type=file]')).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')
  })

  // Every state, in both themes: the looks at rest, then busy and refused.
  for (const theme of ['light', 'dark'] as const) {
    test(`every state is accessible (${theme})`, async ({ page }) => {
      await page.goto(story('app-imagefield--all-looks', theme))
      if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
      await expect(page.getByText('Add a photo of the plant.')).toBeVisible()
      expect((await axe(page)).violations).toEqual([])

      await page.goto(story('app-imagefield--refusals', theme))
      const fails = form(page, 'upload-fails')
      await pick(page, fails.getByRole('button', { name: 'Add photo', exact: true }), png('a.png'))
      await expect(fails.getByRole('button', { name: 'Uploading photo…' })).toBeVisible()
      expect((await axe(page)).violations).toEqual([])
      await expect(fails.getByRole('alert')).toBeVisible()
      expect((await axe(page)).violations).toEqual([])
    })
  }
})

test.describe('images in <Markdown>', () => {
  test('stay inside the text, load lazily, and keep their alt text', async ({ page }) => {
    await page.goto(story('app-markdown--images'))
    const text = page.locator('[data-slot=markdown]')
    const wide = text.getByRole('img', { name: 'The yard in October' })
    await expect(wide).toBeVisible()
    await expect(wide).toHaveAttribute('loading', 'lazy')
    const column = (await text.boundingBox())!
    const image = (await wide.boundingBox())!
    expect(image.width).toBeLessThanOrEqual(column.width)
    expect(image.width).toBeGreaterThan(column.width - 30)
    // Scaled, not cropped: the shape is kept (2400×600).
    expect(image.width / image.height).toBeCloseTo(4, 1)
    await expect(text.getByRole('img', { name: 'of the bed' })).toBeVisible()
    // No alt text: decorative, out of the accessibility tree, alt="" kept.
    await expect(text.locator('img[alt=""]')).toHaveCount(1)
  })
})
