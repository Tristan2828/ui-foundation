// emoji() from `@tristan2828/ui-foundation/vite`: the files it emits into a
// build, and the dev server serving the same ones.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { emoji } from '../vite/index.js'
import { EMOJI_ASSET_DIR, EMOJI_DIR, emojiFiles } from '../vite/emoji.js'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

function folder(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emoji-'))
  dirs.push(dir)
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text)
  return dir
}

type Emitted = { fileName: string; source: Buffer }
type Middleware = (req: { url: string }, res: FakeResponse, next: () => void) => void
type FakeResponse = {
  statusCode: number
  headers: Record<string, string>
  body: string
  setHeader: (key: string, value: string) => void
  end: (body?: Buffer) => void
}

const plugin = (dir: string) =>
  emoji({ dir }) as unknown as {
    generateBundle: (this: { emitFile: (file: Emitted) => void }) => void
    configureServer: (server: { middlewares: { use: (fn: Middleware) => void } }) => void
  }

describe('emoji()', () => {
  it('emits every SVG and the LICENSE under assets/emoji-18.0/, and nothing else', () => {
    const dir = folder({ '1f436.svg': '<svg/>', '2764.svg': '<svg/>', LICENSE: 'Apache', 'notes.txt': 'x' })
    const emitted: Emitted[] = []
    plugin(dir).generateBundle.call({ emitFile: (file) => emitted.push(file) })
    expect(emitted.map((file) => file.fileName)).toEqual([
      'assets/emoji-18.0/1f436.svg',
      'assets/emoji-18.0/2764.svg',
      'assets/emoji-18.0/LICENSE',
    ])
    expect(String(emitted[0].source)).toBe('<svg/>')
  })

  it("lists the package's own pictures by default", () => {
    expect(EMOJI_ASSET_DIR).toBe('assets/emoji-18.0')
    const files = emojiFiles(EMOJI_DIR)
    expect(files).toContain('1f436.svg')
    expect(files).toContain('LICENSE')
    expect(files.length).toBeGreaterThan(1800)
  })

  it('serves the same files in dev, and a 404 for any other under the folder', () => {
    const dir = folder({ '1f436.svg': '<svg/>', LICENSE: 'Apache' })
    let middleware: Middleware = () => {}
    plugin(dir).configureServer({ middlewares: { use: (fn) => (middleware = fn) } })
    const respond = (url: string) => {
      const res: FakeResponse = {
        statusCode: 200,
        headers: {},
        body: '',
        setHeader(key, value) {
          this.headers[key] = value
        },
        end(body) {
          this.body = body ? String(body) : ''
        },
      }
      let passed = false
      middleware({ url }, res, () => (passed = true))
      return { statusCode: res.statusCode, headers: res.headers, body: res.body, passed }
    }
    expect(respond('/assets/emoji-18.0/1f436.svg')).toMatchObject({
      statusCode: 200,
      body: '<svg/>',
      headers: { 'Content-Type': 'image/svg+xml' },
    })
    expect(respond('/assets/emoji-18.0/nope.svg')).toMatchObject({ statusCode: 404 })
    expect(respond('/assets/emoji-18.0/../package.json')).toMatchObject({ statusCode: 404 })
    expect(respond('/other.js')).toMatchObject({ passed: true })
  })

  it('says how to make the pictures when the folder is missing', () => {
    expect(() => emojiFiles(path.join(os.tmpdir(), 'no-such-emoji-folder'))).toThrow(/gen:emoji/)
  })
})
