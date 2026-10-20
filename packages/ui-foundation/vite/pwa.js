// `pwa()` from `@tristan2828/ui-foundation/vite`: the app installable (a web
// manifest and icons) and the service worker reminders arrive through
// (issue #167). An app's vite.config.ts:
//
//   import buildInfo, { pwa } from '@tristan2828/ui-foundation/vite'
//   plugins: [react(), tailwindcss(), buildInfo(), pwa({ name: 'Morning Routines', shortName: 'Routines' })]
//
// Serves and builds, at the site root:
// - /manifest.webmanifest: the name, `display: standalone` (which iOS needs
//   before push works there), and the theme's colours.
// - /icons/: an SVG with the name's first letter (Chrome, Android) and
//   plain PNGs in the theme colour (iOS's Home Screen icon must be a PNG,
//   and drawing a letter into one needs a font rasteriser the package
//   doesn't carry). `icon` replaces them all with the app's own PNG.
// - /push-sw.js: ./push-sw.js, showing pushes and opening their path.
// And adds the manifest, theme-color and apple-touch-icon tags to
// index.html. Registering the worker is usePushPermission's, on a click.
//
// Colours default to the package's tokens (styles/theme.css: --primary,
// --primary-foreground, --background), converted to hex as a manifest
// needs. An app that changed its tokens passes its own.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const THEME_CSS = path.join(HERE, '..', 'styles', 'theme.css')
const WORKER_SOURCE = path.join(HERE, 'push-sw.js')
const HEX = /^#[0-9a-f]{6}$/i

// ------------------------------------------------------------- colours

/** The value of `--name` in theme.css's :root block, var() followed. */
export function themeToken(css, name, seen = new Set()) {
  const root = css.slice(css.indexOf(':root'), css.indexOf('.dark'))
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(root)
  if (!match) throw new Error(`pwa: no --${name} in the theme.`)
  const value = match[1].trim()
  const reference = /^var\(--([\w-]+)\)$/.exec(value)
  if (!reference) return value
  if (seen.has(name)) throw new Error(`pwa: --${name} refers to itself.`)
  seen.add(name)
  return themeToken(css, reference[1], seen)
}

/** `oklch(L C H)` → `#rrggbb` (sRGB, clipped). */
export function oklchToHex(value) {
  const match = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)$/.exec(value.trim())
  if (!match) throw new Error(`pwa: can't read ${value} as oklch(L C H); pass the colour as #rrggbb.`)
  const l = Number(match[1]) / (match[2] ? 100 : 1)
  const c = Number(match[3])
  const h = (Number(match[4]) * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)
  // OKLab → LMS (cubed) → linear sRGB (Björn Ottosson's matrices).
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
  const toByte = (x) => {
    const clipped = Math.min(1, Math.max(0, x))
    const gamma = clipped <= 0.0031308 ? 12.92 * clipped : 1.055 * clipped ** (1 / 2.4) - 0.055
    return Math.round(gamma * 255)
  }
  return `#${linear.map((x) => toByte(x).toString(16).padStart(2, '0')).join('')}`
}

function colour(value, token) {
  if (value !== undefined) {
    if (!HEX.test(value)) throw new Error(`pwa: ${token} must be #rrggbb, not ${value}.`)
    return value.toLowerCase()
  }
  return oklchToHex(themeToken(fs.readFileSync(THEME_CSS, 'utf8'), token))
}

// ---------------------------------------------------------------- icons

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** A `size`×`size` PNG of one colour (#rrggbb). */
export function solidPng(size, hex) {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 2, 0, 0, 0], 8) // 8-bit RGB, no interlace
  const row = Buffer.alloc(1 + size * 3) // filter byte 0, then the pixels
  for (let x = 0; x < size; x++) row.set(rgb, 1 + x * 3)
  const pixels = zlib.deflateSync(Buffer.concat(Array.from({ length: size }, () => row)))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', pixels),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const escapeXml = (text) =>
  text.replace(/[<>&'"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[ch])

/** A square SVG: the name's first letter on the theme colour. */
export function letterSvg(name, background, foreground) {
  const letter = escapeXml([...name.trim()][0]?.toUpperCase() ?? '')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
    `<rect width="512" height="512" fill="${background}"/>` +
    `<text x="256" y="256" dominant-baseline="central" text-anchor="middle" ` +
    `font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="288" font-weight="600" ` +
    `fill="${foreground}">${letter}</text></svg>\n`
  )
}

// --------------------------------------------------------------- plugin

/**
 * Everything pwa() serves, by path from the site root, for `base`.
 * @param {import('./index').PwaOptions} options
 */
export function pwaFiles(options, base = '/', root = process.cwd()) {
  if (!options?.name?.trim()) throw new Error('pwa: `name` is required (the app as the Home Screen names it).')
  const name = options.name.trim()
  const shortName = options.shortName?.trim() || name
  const theme = colour(options.themeColor, 'primary')
  const onTheme = colour(options.themeForegroundColor, 'primary-foreground')
  const background = colour(options.backgroundColor, 'background')
  const at = (file) => `${base}${file}`

  /** @type {Map<string, { type: string, source: string | Buffer }>} */
  const files = new Map()
  let icons
  let touchIcon
  if (options.icon) {
    const own = path.resolve(root, options.icon)
    if (!own.endsWith('.png') || !fs.existsSync(own)) throw new Error(`pwa: icon must be a PNG file; ${own} isn't one.`)
    files.set('icons/icon.png', { type: 'image/png', source: fs.readFileSync(own) })
    icons = [{ src: at('icons/icon.png'), sizes: '512x512', type: 'image/png', purpose: 'any' }]
    touchIcon = 'icons/icon.png'
  } else {
    files.set('icons/icon.svg', { type: 'image/svg+xml', source: letterSvg(shortName, theme, onTheme) })
    for (const size of [192, 512]) files.set(`icons/icon-${size}.png`, { type: 'image/png', source: solidPng(size, theme) })
    files.set('icons/apple-touch-icon.png', { type: 'image/png', source: solidPng(180, theme) })
    icons = [
      { src: at('icons/icon.svg'), sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: at('icons/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: at('icons/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      // One colour edge to edge: safe to crop to any mask shape.
      { src: at('icons/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]
    touchIcon = 'icons/apple-touch-icon.png'
  }
  const manifest = {
    name,
    short_name: shortName,
    ...(options.description ? { description: options.description } : {}),
    start_url: base,
    scope: base,
    display: 'standalone',
    theme_color: theme,
    background_color: background,
    icons,
  }
  files.set('manifest.webmanifest', {
    type: 'application/manifest+json',
    source: `${JSON.stringify(manifest, null, 2)}\n`,
  })
  const worker = fs.readFileSync(WORKER_SOURCE, 'utf8').replace('__ICON__', options.icon ? at('icons/icon.png') : at('icons/icon-192.png'))
  files.set('push-sw.js', { type: 'text/javascript', source: worker })
  return {
    files,
    tags: [
      { tag: 'link', attrs: { rel: 'manifest', href: at('manifest.webmanifest') }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'theme-color', content: theme }, injectTo: 'head' },
      { tag: 'link', attrs: { rel: 'apple-touch-icon', href: at(touchIcon) }, injectTo: 'head' },
    ],
  }
}

/** @param {import('./index').PwaOptions} options */
export function pwa(options) {
  if (!options?.name?.trim()) throw new Error('pwa: `name` is required (the app as the Home Screen names it).')
  /** @type {ReturnType<typeof pwaFiles>} */
  let built
  return {
    name: 'ui-foundation:pwa',
    configResolved(config) {
      built = pwaFiles(options, config.base, config.root)
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const base = server.config.base
        const url = (req.url ?? '').split('?')[0]
        const file = url.startsWith(base) ? built.files.get(url.slice(base.length)) : undefined
        if (!file) return next()
        res.setHeader('Content-Type', file.type)
        res.end(file.source)
      })
    },
    transformIndexHtml() {
      return built.tags
    },
    generateBundle() {
      for (const [fileName, file] of built.files) this.emitFile({ type: 'asset', fileName, source: file.source })
    },
  }
}
