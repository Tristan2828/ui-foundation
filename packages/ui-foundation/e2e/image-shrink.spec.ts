import { expect, test, type Page } from '@playwright/test'

// shrinkImage (src/lib/image-file.ts) in a real browser, which vitest
// can't be: it needs createImageBitmap and a canvas. Through ImageField's
// "Shrink Before Upload" story (image-field.fixtures.tsx), whose upload
// shrinks the picked file and shows what it sent.
const STORY = 'http://localhost:6180/story.html?id=app-imagefield--shrunk-before-upload'

type Picked = { name: string; mimeType: string; buffer: Buffer }

// A picture drawn in the page, as `type`, `width` × `height`.
async function drawn(page: Page, width: number, height: number, type: string): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ({ width, height, type }) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')!
      const gradient = context.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, '#3366cc')
      gradient.addColorStop(1, '#cc6633')
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), type, 0.9))
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let text = ''
      for (const byte of bytes) text += String.fromCharCode(byte)
      return btoa(text)
    },
    { width, height, type },
  )
  return Buffer.from(base64, 'base64')
}

// An EXIF block saying "turned on its side" (orientation 6), as a phone
// camera writes, put straight after the JPEG's start marker.
function withExifOrientation(jpeg: Buffer): Buffer {
  const tiff = Buffer.from([
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big-endian TIFF, IFD at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00, // Orientation = 6
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ])
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff])
  const length = Buffer.alloc(2)
  length.writeUInt16BE(payload.length + 2)
  return Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xe1]), length, payload, jpeg.subarray(2)])
}

async function pick(page: Page, file: Picked) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Add Photo', exact: true }).click()
  await (await chooser).setFiles(file)
}

// The bytes the story stored, read back from the thumbnail's address.
async function storedBytes(page: Page): Promise<string> {
  const img = page.getByRole('img', { name: 'Current photo' })
  await expect(img).toHaveAttribute('src', /^blob:/)
  const src = (await img.getAttribute('src'))!
  return page.evaluate(async (url) => {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer())
    let text = ''
    for (const byte of bytes) text += String.fromCharCode(byte)
    return text
  }, src)
}

test.describe('shrinkImage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(STORY)
    await expect(page.getByTestId('shrink-sent')).toHaveText('nothing yet')
  })

  test('a big photo is sent at 2560 px on its long edge, as WebP, under a WebP name', async ({ page }) => {
    const png = await drawn(page, 4000, 3000, 'image/png')
    await pick(page, { name: 'garden.png', mimeType: 'image/png', buffer: png })
    await expect(page.getByTestId('shrink-sent')).toHaveText(/^garden\.webp · image\/webp · 2560 × 1920 · \d+ bytes$/)
    const sent = Number((await page.getByTestId('shrink-sent').textContent())!.match(/(\d+) bytes/)![1])
    expect(sent).toBeLessThan(png.length)
    expect((await storedBytes(page)).slice(8, 12)).toBe('WEBP')
  })

  test('a photo turned by its EXIF is sent upright, with no EXIF left in it', async ({ page }) => {
    const jpeg = withExifOrientation(await drawn(page, 60, 40, 'image/jpeg'))
    expect(jpeg.includes('Exif')).toBe(true)
    await pick(page, { name: 'IMG_0042.jpg', mimeType: 'image/jpeg', buffer: jpeg })
    // 60 × 40 on its side is 40 × 60 upright.
    await expect(page.getByTestId('shrink-sent')).toHaveText(/^IMG_0042\.webp · image\/webp · 40 × 60 · \d+ bytes$/)
    expect(await storedBytes(page)).not.toContain('Exif')
  })

  test('a small picture is never enlarged', async ({ page }) => {
    await pick(page, { name: 'icon.png', mimeType: 'image/png', buffer: await drawn(page, 300, 200, 'image/png') })
    await expect(page.getByTestId('shrink-sent')).toHaveText(/^icon\.webp · image\/webp · 300 × 200 · /)
  })

  test('a file the browser cannot read as a picture is sent as it was picked', async ({ page }) => {
    const junk = Buffer.from('not really a picture at all')
    await pick(page, { name: 'broken.png', mimeType: 'image/png', buffer: junk })
    await expect(page.getByTestId('shrink-sent')).toHaveText(
      `broken.png · image/png · not a picture · ${junk.length} bytes`,
    )
  })
})
