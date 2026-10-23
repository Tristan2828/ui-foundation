// The rules an image passes before it's uploaded (src/lib/image-file.ts),
// shared by ImageField and the rich-text editor, and the words a refusal
// or a failed upload shows.
import { describe, expect, it } from 'vitest'
import { acceptAttribute, formatBytes, imageRefusal, uploadFailure } from '../src/lib/image-file'

const MB = 1024 * 1024

describe('imageRefusal', () => {
  it('accepts JPEG, PNG and WebP by default, of any size', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) expect(imageRefusal({ type, size: 40 * MB })).toBeNull()
  })

  it('names the type refused and the types wanted', () => {
    expect(imageRefusal({ type: 'image/gif', size: 1 })).toBe('That file is a GIF. Choose a JPEG, PNG or WebP image.')
    expect(imageRefusal({ type: 'image/svg+xml', size: 1 })).toBe('That file is an SVG. Choose a JPEG, PNG or WebP image.')
    expect(imageRefusal({ type: 'application/pdf', size: 1 })).toBe('That file is a PDF. Choose a JPEG, PNG or WebP image.')
    expect(imageRefusal({ type: '', size: 1 })).toBe("That file isn't an image. Choose a JPEG, PNG or WebP image.")
    expect(imageRefusal({ type: 'image/x-icon', size: 1 })).toBe('That file is an ICON. Choose a JPEG, PNG or WebP image.')
  })

  it('takes the types a field accepts, `image/*` included', () => {
    expect(imageRefusal({ type: 'image/gif', size: 1 }, { accept: ['image/gif'] })).toBeNull()
    expect(imageRefusal({ type: 'image/png', size: 1 }, { accept: ['image/jpeg'] })).toBe('That file is a PNG. Choose a JPEG image.')
    expect(imageRefusal({ type: 'image/avif', size: 1 }, { accept: ['image/*'] })).toBeNull()
    expect(imageRefusal({ type: 'text/plain', size: 1 }, { accept: ['image/*'] })).toBe("That file isn't an image. Choose an image.")
  })

  it('refuses a file over the size limit, with both sizes in words', () => {
    expect(imageRefusal({ type: 'image/jpeg', size: 12.4 * MB }, { maxSize: 5 * MB })).toBe('That image is 12 MB. The limit is 5 MB.')
    expect(imageRefusal({ type: 'image/jpeg', size: 5 * MB }, { maxSize: 5 * MB })).toBeNull()
  })

  it('a wrong type is the reason given before the size', () => {
    expect(imageRefusal({ type: 'image/gif', size: 9 * MB }, { maxSize: MB })).toMatch(/^That file is a GIF/)
  })
})

describe('formatBytes', () => {
  it('reads as a person would say it', () => {
    expect(formatBytes(900)).toBe('900 bytes')
    expect(formatBytes(820 * 1024)).toBe('820 KB')
    expect(formatBytes(4.24 * MB)).toBe('4.2 MB')
    expect(formatBytes(12.6 * MB)).toBe('13 MB')
  })
})

describe('uploadFailure', () => {
  it("is the rejection's own message, an AppError's or an Error's", () => {
    expect(uploadFailure({ kind: 'validation', message: 'Files are limited to 10 MB.' })).toBe('Files are limited to 10 MB.')
    expect(uploadFailure(new Error('Network down'))).toBe('Network down')
  })

  it('falls back to a sentence naming what failed', () => {
    expect(uploadFailure(undefined)).toBe("The image couldn't be uploaded. Try again.")
    expect(uploadFailure({ message: '  ' }, 'photo')).toBe("The photo couldn't be uploaded. Try again.")
  })
})

describe('acceptAttribute', () => {
  it("is the file input's accept list", () => {
    expect(acceptAttribute()).toBe('image/jpeg,image/png,image/webp')
    expect(acceptAttribute(['image/*'])).toBe('image/*')
  })
})
