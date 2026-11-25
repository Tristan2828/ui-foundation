// `emoji()` from `@tristan2828/ui-foundation/vite`: the pictures <Emoji>
// draws. An app's vite.config.ts:
//
//   import buildInfo, { emoji, pwa } from '@tristan2828/ui-foundation/vite'
//   plugins: [react(), tailwindcss(), buildInfo(), emoji()]
//
// Serves (in dev) and builds (into dist/) the package's emoji/ folder at
// /assets/emoji-18.0/: one Noto SVG per emoji EmojiField offers, and the
// folder's LICENSE. Under assets/ the reference backend serves them
// immutable (spa.py); the Emoji version in the folder's name makes that
// safe, since a new set is a new folder. A browser downloads only the
// pictures a page shows, each a few KB.
//
// The path is root-relative, as <Emoji> asks for it: apps are served at
// their own root.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

/** The package's emoji/ folder, where scripts/gen-emoji.mjs writes the pictures. */
export const EMOJI_DIR = path.join(HERE, '..', 'emoji')

/** Where <Emoji> asks for them (src/components/app/emoji.tsx's EMOJI_ASSET_PATH), without the leading slash. */
export const EMOJI_ASSET_DIR = 'assets/emoji-18.0'

/** Every file the plugin serves and emits: the SVGs and LICENSE, by name. */
export function emojiFiles(dir = EMOJI_DIR) {
  if (!fs.existsSync(dir)) throw new Error(`emoji: no pictures at ${dir}. Run \`npm run gen:emoji\` in the package.`)
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.svg') || name === 'LICENSE')
    .sort()
}

const TYPES = { '.svg': 'image/svg+xml', '': 'text/plain; charset=utf-8' }

/** @param {{ dir?: string }} [options] `dir` is for tests: another folder of pictures. */
export function emoji(options = {}) {
  const dir = options.dir ?? EMOJI_DIR
  const prefix = `/${EMOJI_ASSET_DIR}/`
  return {
    name: 'ui-foundation:emoji',
    configureServer(server) {
      const names = new Set(emojiFiles(dir))
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        if (!url.startsWith(prefix)) return next()
        const name = decodeURIComponent(url.slice(prefix.length))
        if (!names.has(name)) {
          res.statusCode = 404
          res.end()
          return
        }
        res.setHeader('Content-Type', TYPES[path.extname(name)] ?? 'application/octet-stream')
        res.end(fs.readFileSync(path.join(dir, name)))
      })
    },
    generateBundle() {
      for (const name of emojiFiles(dir)) {
        this.emitFile({ type: 'asset', fileName: `${EMOJI_ASSET_DIR}/${name}`, source: fs.readFileSync(path.join(dir, name)) })
      }
    },
  }
}
