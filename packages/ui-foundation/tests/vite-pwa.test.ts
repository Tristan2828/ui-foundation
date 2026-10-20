// pwa() from `@tristan2828/ui-foundation/vite` (issue #167): the manifest,
// the icons (each PNG decoded here, CRCs and all), the service worker, the
// tags in index.html, and the dev server serving the same files.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import { pwa } from '../vite/index.js'
import { letterSvg, oklchToHex, pwaFiles, solidPng, themeToken } from '../vite/pwa.js'

type Built = ReturnType<typeof pwaFiles>
const text = (built: Built, file: string) => String(built.files.get(file)?.source)
const manifest = (built: Built) => JSON.parse(text(built, 'manifest.webmanifest')) as Record<string, unknown>

/** Reads a PNG back: checks every chunk's CRC, returns its size and first pixel. */
function readPng(png: Buffer) {
  expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  let offset = 8
  const chunks: Record<string, Buffer> = {}
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    const data = png.subarray(offset + 8, offset + 8 + length)
    expect(png.readUInt32BE(offset + 8 + length)).toBe(zlib.crc32(png.subarray(offset + 4, offset + 8 + length)))
    chunks[type] = data
    offset += 12 + length
  }
  const width = chunks.IHDR.readUInt32BE(0)
  const height = chunks.IHDR.readUInt32BE(4)
  const pixels = zlib.inflateSync(chunks.IDAT)
  expect(pixels.length).toBe(height * (1 + width * 3))
  const hex = `#${[...pixels.subarray(1, 4)].map((b) => b.toString(16).padStart(2, '0')).join('')}`
  return { width, height, hex, end: 'IEND' in chunks }
}

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('colours', () => {
  it('follows the theme tokens to oklch, and converts them to hex', () => {
    const css = fs.readFileSync(path.join(import.meta.dirname, '../styles/theme.css'), 'utf8')
    expect(themeToken(css, 'primary')).toBe('oklch(0.205 0 0)')
    expect(oklchToHex('oklch(0.205 0 0)')).toBe('#171717')
    expect(oklchToHex('oklch(1 0 0)')).toBe('#ffffff')
    expect(oklchToHex('oklch(62.8% 0.2577 29.23)')).toBe('#ff0000')
    expect(() => oklchToHex('rgb(0 0 0)')).toThrow(/#rrggbb/)
  })
})

describe('icons', () => {
  it('draws a valid PNG of one colour at the size asked', () => {
    expect(readPng(solidPng(180, '#1a2b3c'))).toEqual({ width: 180, height: 180, hex: '#1a2b3c', end: true })
  })

  it('puts the name’s first letter, escaped, on the theme colour', () => {
    expect(letterSvg('routines', '#171717', '#fafafa')).toContain('fill="#fafafa">R</text>')
    expect(letterSvg('<b>', '#171717', '#fafafa')).toContain('>&lt;</text>')
  })
})

describe('pwaFiles', () => {
  it('writes an installable manifest in the theme’s colours, with every icon it names', () => {
    const built = pwaFiles({ name: 'Morning Routines', shortName: 'Routines' })
    const json = manifest(built)
    expect(json).toMatchObject({
      name: 'Morning Routines',
      short_name: 'Routines',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#171717',
      background_color: '#ffffff',
    })
    for (const icon of json.icons as { src: string }[]) expect(built.files.has(icon.src.slice(1))).toBe(true)
    expect(readPng(built.files.get('icons/icon-512.png')!.source as Buffer)).toMatchObject({ width: 512, hex: '#171717' })
    expect(readPng(built.files.get('icons/apple-touch-icon.png')!.source as Buffer).width).toBe(180)
  })

  it('serves the worker with the icon’s address, and no fetch handler', () => {
    const worker = text(pwaFiles({ name: 'App' }, '/app/'), 'push-sw.js')
    expect(worker).toContain("const ICON = '/app/icons/icon-192.png'")
    expect(worker).toContain("addEventListener('push'")
    expect(worker).not.toContain("addEventListener('fetch'")
  })

  it('names every file under the base, and tags index.html with the manifest and icons', () => {
    const built = pwaFiles({ name: 'App', themeColor: '#336699' }, '/app/')
    expect(manifest(built)).toMatchObject({ start_url: '/app/', scope: '/app/', theme_color: '#336699' })
    expect(built.tags.map((tag) => tag.attrs)).toEqual([
      { rel: 'manifest', href: '/app/manifest.webmanifest' },
      { name: 'theme-color', content: '#336699' },
      { rel: 'apple-touch-icon', href: '/app/icons/apple-touch-icon.png' },
    ])
  })

  it('uses the app’s own PNG everywhere when given one', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pwa-'))
    dirs.push(root)
    fs.writeFileSync(path.join(root, 'logo.png'), solidPng(512, '#ff0000'))
    const built = pwaFiles({ name: 'App', icon: 'logo.png' }, '/', root)
    expect([...built.files.keys()].filter((file) => file.startsWith('icons/'))).toEqual(['icons/icon.png'])
    expect(manifest(built).icons).toEqual([{ src: '/icons/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' }])
    expect(text(built, 'push-sw.js')).toContain("const ICON = '/icons/icon.png'")
    expect(() => pwaFiles({ name: 'App', icon: 'missing.png' }, '/', root)).toThrow(/PNG/)
  })

  it('refuses a missing name or a colour a manifest can’t carry', () => {
    expect(() => pwa({ name: ' ' })).toThrow(/name/)
    expect(() => pwaFiles({ name: 'App', themeColor: 'blue' })).toThrow(/#rrggbb/)
  })
})

describe('the plugin', () => {
  type Middleware = (req: { url: string }, res: FakeResponse, next: () => void) => void
  type FakeResponse = { headers: Record<string, string>; body?: unknown; setHeader: (k: string, v: string) => void; end: (b: unknown) => void }

  it('serves the same files in development, under the base, and passes everything else on', () => {
    const plugin = pwa({ name: 'App' }) as unknown as {
      configResolved: (config: { base: string; root: string }) => void
      configureServer: (server: { config: { base: string }; middlewares: { use: (fn: Middleware) => void } }) => void
    }
    plugin.configResolved({ base: '/', root: process.cwd() })
    let middleware: Middleware | undefined
    plugin.configureServer({ config: { base: '/' }, middlewares: { use: (fn) => (middleware = fn) } })
    const response = (): FakeResponse => {
      const res: FakeResponse = {
        headers: {},
        setHeader: (key, value) => (res.headers[key] = value),
        end: (body) => (res.body = body),
      }
      return res
    }
    const manifestResponse = response()
    middleware!({ url: '/manifest.webmanifest?v=1' }, manifestResponse, () => {
      throw new Error('should have been served')
    })
    expect(manifestResponse.headers['Content-Type']).toBe('application/manifest+json')
    let passedOn = false
    middleware!({ url: '/src/main.tsx' }, response(), () => (passedOn = true))
    expect(passedOn).toBe(true)
  })

  it('emits every file in the build', () => {
    const plugin = pwa({ name: 'App' }) as unknown as {
      configResolved: (config: { base: string; root: string }) => void
      generateBundle: (this: { emitFile: (file: { fileName: string }) => void }) => void
    }
    plugin.configResolved({ base: '/', root: process.cwd() })
    const emitted: string[] = []
    plugin.generateBundle.call({ emitFile: (file) => emitted.push(file.fileName) })
    expect(emitted.sort()).toEqual([
      'icons/apple-touch-icon.png',
      'icons/icon-192.png',
      'icons/icon-512.png',
      'icons/icon.svg',
      'manifest.webmanifest',
      'push-sw.js',
    ])
  })
})
