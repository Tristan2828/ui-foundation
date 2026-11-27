import type { Page } from '@playwright/test'
import { expect, test } from '@tristan2828/ui-foundation/testing'

// A picture in a widget's description: the editor's Image tool picks it,
// the gateway shrinks it (shrinkImage) and sends it as the request body
// (POST /files, src/api/gateway/files.ts), and the text holds its content
// address. The mocks (src/mocks/files.ts) read its type from its bytes, as
// the backend does, and serve it back for the <img>.

// A picture drawn in the page: a PNG, `width` × `height`.
async function drawnPng(page: Page, width: number, height: number): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ({ width, height }) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')!
      context.fillStyle = '#3366cc'
      context.fillRect(0, 0, width, height)
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'))
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let text = ''
      for (const byte of bytes) text += String.fromCharCode(byte)
      return btoa(text)
    },
    { width, height },
  )
  return Buffer.from(base64, 'base64')
}

async function pickImage(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  const description = page.getByRole('textbox', { name: 'Description' })
  await description.locator('p').last().click()
  await page.keyboard.press('End')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('toolbar', { name: 'Editor Tools' }).getByRole('button', { name: 'Image', exact: true }).click()
  await (await chooser).setFiles(file)
  return description
}

test.describe('a picture in a widget description', () => {
  test.skip(({ isMobile }) => isMobile, "a laptop: a phone's Image button is in the row pinned to its keyboard")

  test('success: picked, shrunk, stored, saved as its address and shown on the view', async ({ page }) => {
    const patches: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'PATCH' && /\/api\/widgets\/2$/.test(request.url())) patches.push(request.postData() ?? '')
    })
    let sentType = ''
    page.on('request', (request) => {
      if (request.method() === 'POST' && /\/api\/files$/.test(request.url())) sentType = request.headers()['content-type']
    })
    await page.goto('/widgets/2/edit')
    await expect(page.getByRole('heading', { name: 'Edit Widget' })).toBeVisible()
    const png = await drawnPng(page, 3200, 2000)

    const description = await pickImage(page, { name: 'desk.png', mimeType: 'image/png', buffer: png })
    const inText = description.locator('img[src="/api/files/1/content"]')
    await expect(inText).toBeVisible()
    // Shrunk in the browser before it was sent: WebP, 2560 px on its long edge.
    expect(sentType).toBe('image/webp')
    await expect.poll(() => inText.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(2560)

    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByRole('heading', { name: 'Standing Desk' })).toBeVisible()
    expect(JSON.parse(patches.at(-1)!).description).toContain('![](/api/files/1/content)')
    const onView = page.locator('img[src="/api/files/1/content"]')
    await expect(onView).toBeVisible()
    await expect.poll(() => onView.evaluate((img: HTMLImageElement) => img.naturalHeight)).toBe(1600)
  })

  test('refused: a file that only claims to be a picture is the server’s refusal, and nothing goes in the text', async ({ page }) => {
    await page.goto('/widgets/2/edit')
    await expect(page.getByRole('heading', { name: 'Edit Widget' })).toBeVisible()
    const description = await pickImage(page, {
      name: 'cat.png',
      mimeType: 'image/png',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    })
    await expect(page.getByText('Only a JPEG, PNG or WebP image can be uploaded.')).toBeVisible()
    await expect(description.locator('img')).toHaveCount(0)
  })
})
