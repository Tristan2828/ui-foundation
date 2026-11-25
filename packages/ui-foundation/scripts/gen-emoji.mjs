#!/usr/bin/env node
// Writes the emoji EmojiField offers and the pictures <Emoji> draws, from
// Unicode's own files and Noto's SVGs. Node's own fetch and fs only: no npm
// package. `npm run gen:emoji` reruns it; updating is a yearly job (bump the
// three tags below, rerun, release).
//
// Reads:
// - Unicode's emoji-test.txt: each emoji's group and order. Fully-qualified
//   lines only, without the Component group or any skin-tone modifier
//   (U+1F3FB–1F3FF): the picker has no tones.
// - CLDR's annotations/en.xml and annotationsDerived/en.xml: the name (the
//   `tts` line, in sentence case) and the keywords (the `|` list).
// - Noto's picture of each kept emoji: 2D/svg, or for flags
//   third_party/region-flags/waved-svg. Both name a file by its code points
//   in lower-case hex, joined by `_`, with fe0f left out (Noto's own rule).
//   An emoji with no picture is left out and logged, so the data and the
//   pictures always agree.
//
// Writes:
// - src/components/app/emoji-data.generated.ts: EMOJI_GROUPS_ALL.
// - emoji/: one SVG per entry, made smaller by a few regex passes, and
//   LICENSE (Noto's Apache-2.0 and OFL, the flags' public domain note and
//   the Unicode License v3).
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const EMOJI_VERSION = '18.0'
export const NOTO_TAG = 'v2026-09-24-unicode18_0'
export const CLDR_TAG = 'release-49'

const EMOJI_TEST = `https://unicode.org/Public/${EMOJI_VERSION}.0/emoji/emoji-test.txt`
const CLDR = `https://raw.githubusercontent.com/unicode-org/cldr/${CLDR_TAG}/common`
const NOTO = `https://raw.githubusercontent.com/googlefonts/noto-emoji/${NOTO_TAG}`
const NOTO_TREE = `https://api.github.com/repos/googlefonts/noto-emoji/git/trees/${NOTO_TAG}?recursive=1`
const UNICODE_LICENSE = 'https://www.unicode.org/license.txt'
const PICTURE_DIRS = ['2D/svg', 'third_party/region-flags/waved-svg']

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DATA = path.join(root, 'src/components/app/emoji-data.generated.ts')
const OUT_DIR = path.join(root, 'emoji')

// ------------------------------------------------------------- parsing

const SKIN_TONE = /[\u{1F3FB}-\u{1F3FF}]/u

/** `🏳️‍🌈` → `1f3f3_200d_1f308`: the picture's name (each code point at least four hex digits, fe0f left out). */
export function imageName(emoji) {
  return [...emoji]
    .map((ch) => ch.codePointAt(0))
    .filter((cp) => cp !== 0xfe0f)
    .map((cp) => cp.toString(16).padStart(4, '0'))
    .join('_')
}

/** Unicode's groups in order, each with its fully-qualified emoji (no tones, no Component). */
export function parseEmojiTest(text) {
  const groups = []
  let group = null
  for (const line of text.split('\n')) {
    const heading = /^# group: (.+)$/.exec(line)
    if (heading) {
      group = { label: heading[1].trim(), emojis: [] }
      groups.push(group)
      continue
    }
    const entry = /^([0-9A-F ]+?)\s*; fully-qualified\s*# \S+ E[\d.]+ (.+)$/.exec(line)
    if (!entry || !group) continue
    const emoji = String.fromCodePoint(...entry[1].split(' ').map((hex) => parseInt(hex, 16)))
    if (SKIN_TONE.test(emoji)) continue
    group.emojis.push({ emoji, testName: entry[2].trim() })
  }
  return groups.filter((g) => g.label !== 'Component')
}

const decodeXml = (text) =>
  text.replace(/&(amp|lt|gt|quot|apos|#x[0-9a-f]+|#\d+);/gi, (_, name) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[name.toLowerCase()]
    if (named) return named
    return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1)))
  })

/** CLDR annotations: emoji (fe0f left out) → { tts, keywords }. Later files fill gaps only. */
export function parseAnnotations(...files) {
  const map = new Map()
  for (const xml of files) {
    for (const match of xml.matchAll(/<annotation cp="([^"]+)"( type="tts")?>([^<]*)<\/annotation>/g)) {
      const key = decodeXml(match[1]).replaceAll('️', '')
      const value = decodeXml(match[3]).trim()
      const entry = map.get(key) ?? {}
      if (match[2]) entry.tts ??= value
      else entry.keywords ??= value.split('|').map((word) => word.trim()).filter(Boolean)
      map.set(key, entry)
    }
  }
  return map
}

const sentenceCase = (text) => (text ? text[0].toUpperCase() + text.slice(1) : text)

// ------------------------------------------------------------ the SVGs

/**
 * Smaller, still the same picture: no XML declaration, DOCTYPE, comments,
 * metadata or title, none of Adobe Illustrator's private data (its
 * `i:aipgf` blobs and the namespaces only they use), and no whitespace
 * between tags.
 */
export function stripSvg(svg) {
  let out = svg
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!DOCTYPE[^[>]*(\[[\s\S]*?\])?\s*>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<metadata[\s\S]*?<\/metadata>/g, '')
    .replace(/<title[\s\S]*?<\/title>/g, '')
    .replace(/<i:aipgf[\s\S]*?<\/i:aipgf>/g, '')
    .replace(/<(i|x|graph):[\w-]+[^>]*\/>/g, '')
    .replace(/\s+xmlns:(i|x|graph)="[^"]*"/g, '')
    .replace(/\s+(i|x|graph):[\w-]+="[^"]*"/g, '')
    .replace(/>\s+</g, '><')
    .trim()
  // An unbound prefix or an undefined entity makes the file fail to load as
  // an image, so refuse rather than write one.
  const declared = new Set(['xml', 'xmlns', ...[...out.matchAll(/xmlns:([\w-]+)=/g)].map((m) => m[1])])
  const used = [
    ...[...out.matchAll(/<\/?([A-Za-z][\w-]*):[\w-]+/g)].map((m) => m[1]),
    ...[...out.matchAll(/\s([A-Za-z][\w-]*):[\w-]+=/g)].map((m) => m[1]),
  ].filter((prefix) => prefix !== 'xmlns')
  const unbound = used.find((prefix) => !declared.has(prefix))
  if (unbound) throw new Error(`gen-emoji: the prefix "${unbound}:" is left unbound after stripping.`)
  const entity = /&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)[\w.-]+;/i.exec(out)
  if (entity) throw new Error(`gen-emoji: the entity ${entity[0]} is left undefined after stripping.`)
  if (!out.startsWith('<svg')) throw new Error('gen-emoji: a picture does not start with <svg after stripping.')
  return out
}

// --------------------------------------------------------- the network

async function get(url, as = 'text') {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': 'ui-foundation-gen-emoji' } })
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      return as === 'json' ? await response.json() : await response.text()
    } catch (error) {
      if (attempt >= 4) throw new Error(`gen-emoji: ${url}: ${error.message}`)
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
    }
  }
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const index = next++
        results[index] = await fn(items[index], index)
      }
    }),
  )
  return results
}

// ---------------------------------------------------------------- main

async function main() {
  console.log(`gen-emoji: Emoji ${EMOJI_VERSION}, CLDR ${CLDR_TAG}, Noto ${NOTO_TAG}`)
  const [testText, annotations, derived, tree] = await Promise.all([
    get(EMOJI_TEST),
    get(`${CLDR}/annotations/en.xml`),
    get(`${CLDR}/annotationsDerived/en.xml`),
    get(NOTO_TREE, 'json'),
  ])
  if (!testText.includes(`# Version: ${EMOJI_VERSION}`)) throw new Error('gen-emoji: emoji-test.txt is not the pinned version.')
  if (tree.truncated) throw new Error("gen-emoji: GitHub truncated Noto's file list.")

  // Path → git mode. Some flags are symbolic links (120000) to another
  // flag's file: the link's text is that file's name, in the same folder.
  const files = new Map(tree.tree.filter((node) => node.type === 'blob').map((node) => [node.path, node.mode]))
  const pictureOf = (name) => PICTURE_DIRS.map((dir) => `${dir}/emoji_u${name}.svg`).find((file) => files.has(file))

  const names = parseAnnotations(annotations, derived)
  const groups = parseEmojiTest(testText)
  const missing = []
  const kept = groups.map((group) => ({
    label: group.label.replace(' & ', ' and '),
    emojis: group.emojis.flatMap(({ emoji, testName }) => {
      const image = imageName(emoji)
      const source = pictureOf(image)
      if (!source) {
        missing.push(`${emoji} ${testName} (${image})`)
        return []
      }
      const note = names.get(emoji.replaceAll('️', '')) ?? {}
      return [{ emoji, name: sentenceCase(note.tts ?? testName), keywords: (note.keywords ?? []).join(' '), image, source }]
    }),
  }))
  if (kept.length !== 9) throw new Error(`gen-emoji: expected Unicode's nine groups, found ${kept.length}.`)
  for (const line of missing) console.log(`gen-emoji: no Noto picture, left out: ${line}`)

  const entries = kept.flatMap((group) => group.emojis)
  rmSync(OUT_DIR, { recursive: true, force: true })
  mkdirSync(OUT_DIR, { recursive: true })
  let before = 0
  let after = 0
  await mapLimit(entries, 16, async (entry, index) => {
    let source = entry.source
    if (files.get(source) === '120000') source = path.posix.join(path.posix.dirname(source), (await get(`${NOTO}/${source}`)).trim())
    const raw = await get(`${NOTO}/${source}`)
    let small
    try {
      small = stripSvg(raw)
    } catch (error) {
      throw new Error(`${error.message} (${entry.source})`)
    }
    before += Buffer.byteLength(raw)
    after += Buffer.byteLength(small)
    writeFileSync(path.join(OUT_DIR, `${entry.image}.svg`), small)
    if ((index + 1) % 250 === 0) console.log(`gen-emoji: ${index + 1} of ${entries.length} pictures`)
  })

  const [ofl, apache, flags, unicode] = await Promise.all([
    get(`${NOTO}/LICENSE`),
    get(`${NOTO}/2D/svg/LICENSE`),
    get(`${NOTO}/third_party/region-flags/LICENSE`),
    get(UNICODE_LICENSE),
  ])
  writeFileSync(
    path.join(OUT_DIR, 'LICENSE'),
    [
      `The pictures in this folder are Noto Emoji's SVGs (https://github.com/googlefonts/noto-emoji, tag ${NOTO_TAG}),`,
      'made smaller by scripts/gen-emoji.mjs (comments, metadata and editor data removed). The emoji names and',
      `keywords in src/components/app/emoji-data.generated.ts come from Unicode's emoji-test.txt ${EMOJI_VERSION} and CLDR (${CLDR_TAG}).`,
      '',
      '=== Noto Emoji images and tools: Apache License 2.0 (2D/svg/LICENSE) ===',
      '',
      apache.trim(),
      '',
      '=== Noto Emoji fonts: SIL Open Font License 1.1 (LICENSE) ===',
      '',
      ofl.trim(),
      '',
      '=== Flags (third_party/region-flags/LICENSE) ===',
      '',
      flags.trim(),
      '',
      '=== Unicode emoji data and CLDR annotations: Unicode License v3 ===',
      '',
      unicode.trim(),
      '',
    ].join('\n'),
  )

  const groupsOut = kept.map((group) => ({
    label: group.label,
    emojis: group.emojis.map(({ emoji, name, keywords }) => ({ emoji, name, keywords })),
  }))
  writeFileSync(
    OUT_DATA,
    [
      '// Generated by scripts/gen-emoji.mjs: do not edit. Rerun with `npm run gen:emoji`',
      `// (Emoji ${EMOJI_VERSION}, CLDR ${CLDR_TAG}, Noto ${NOTO_TAG}). Every fully-qualified emoji`,
      "// with a Noto picture and no skin tone, in Unicode's nine groups and order. Names and",
      "// keywords are CLDR's (Unicode License v3: emoji/LICENSE).",
      "import type { EmojiGroup } from './emoji-field-data'",
      '',
      'export const EMOJI_GROUPS_ALL: EmojiGroup[] = [',
      ...groupsOut.flatMap((group) => [
        `  { label: ${JSON.stringify(group.label)}, emojis: [`,
        ...group.emojis.map((entry) => `    ${JSON.stringify(entry)},`),
        '  ] },',
      ]),
      ']',
      '',
    ].join('\n'),
  )

  const mb = (bytes) => `${(bytes / 1e6).toFixed(1)} MB`
  console.log(`gen-emoji: ${entries.length} emoji in ${kept.length} groups, ${missing.length} left out with no picture`)
  console.log(`gen-emoji: pictures ${mb(before)} before stripping, ${mb(after)} after`)
  console.log(`gen-emoji: ${readdirSync(OUT_DIR).length} files in emoji/`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
