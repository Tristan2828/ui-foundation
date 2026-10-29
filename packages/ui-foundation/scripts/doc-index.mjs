// The index at the top of each long convention doc (#232): one line per
// section (and per numbered step), its anchor and the lines it spans, so
// an agent reads the index and then only the lines it needs, not the
// whole file. Written from the headings, never by hand:
//
//   node scripts/doc-index.mjs           rewrite the indexes
//   node scripts/doc-index.mjs --check   fail if one is missing or stale (verify:fast)
//
// A doc gets one when it's over LONG lines. Sync copies the docs, index
// and all, into each app's docs/foundation/.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const DOCS = path.join(import.meta.dirname, '..', 'conventions', 'docs')
const LONG = 300
const START = '<!-- index: written by `npm run docs:index` in the package from the headings below; never edit it by hand -->'
const END = '<!-- /index -->'

// GitHub's heading anchors: lower case, punctuation dropped, each space a
// hyphen, a repeat numbered.
function slugger() {
  const seen = new Map()
  return (text) => {
    const base = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/ /g, '-')
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return count ? `${base}-${count}` : base
  }
}

// The text with no index in it, and where one goes: after the title.
function strip(text) {
  const lines = text.split(/\r?\n/)
  const start = lines.indexOf(START)
  if (start !== -1) {
    const end = lines.indexOf(END, start)
    // The index, and the blank line after it.
    lines.splice(start, end - start + 2)
  }
  return lines
}

// Each `##`/`###` heading outside code, and each top-level numbered step
// (`6. **Copy the reference files…**`), with the line it starts on.
function entries(lines) {
  const found = []
  let fenced = false
  for (const [index, line] of lines.entries()) {
    if (/^\s*```/.test(line)) fenced = !fenced
    if (fenced) continue
    const heading = /^(##|###) (.+)$/.exec(line)
    if (heading) found.push({ depth: heading[1].length, text: heading[2].trim(), line: index })
    // A step's bold title can wrap onto the next line.
    const step = /^(\d+)\. \*\*(.+?)\*\*/.exec(`${line} ${(lines[index + 1] ?? '').trim()}`)
    // Depth 4 so a step ends at the next step or heading; listed one level in.
    if (step) found.push({ depth: 4, text: `Step ${step[1]}: ${step[2]}`, line: index })
  }
  return found
}

// Plain words for a link's text: no emphasis marks.
const plain = (text) => text.replace(/\*([^*]+)\*/g, '$1')

function index(lines) {
  const found = entries(lines)
  const slug = slugger()
  for (const entry of found) if (entry.depth < 4) entry.anchor = slug(entry.text)
  // An entry spans to the line before the next one at its depth or above.
  for (const [i, entry] of found.entries()) {
    const next = found.slice(i + 1).find((other) => other.depth <= entry.depth)
    entry.last = (next ? next.line : lines.length) - 1
    while (entry.last > entry.line && lines[entry.last].trim() === '') entry.last--
  }
  return found
}

function render(found, offset) {
  const out = [START, '## Index', '']
  for (const entry of found) {
    const indent = entry.depth === 2 ? '' : '  '
    const label = entry.anchor ? `[${plain(entry.text)}](#${entry.anchor})` : plain(entry.text)
    out.push(`${indent}- ${label} · lines ${entry.line + 1 + offset}–${entry.last + 1 + offset}`)
  }
  out.push('', END, '')
  return out
}

function withIndex(text) {
  const lines = strip(text)
  if (lines.length <= LONG) return lines.join('\n')
  const at = lines.findIndex((line) => line.startsWith('# ')) + 2
  const found = index(lines)
  // The index's own length moves every line under it: it's one line per
  // entry plus a fixed frame, so it's known before it's written.
  const block = render(found, render(found, 0).length)
  return [...lines.slice(0, at), ...block, ...lines.slice(at)].join('\n')
}

const check = process.argv.includes('--check')
const stale = []
for (const name of readdirSync(DOCS).filter((file) => file.endsWith('.md'))) {
  const file = path.join(DOCS, name)
  const text = readFileSync(file, 'utf8')
  const next = withIndex(text)
  if (next === text) continue
  if (check) stale.push(name)
  else {
    writeFileSync(file, next)
    console.log(`docs:index: wrote ${name}`)
  }
}
if (stale.length) {
  console.error(`docs:index --check: the index is missing or out of date in ${stale.join(', ')}. Run \`npm run docs:index\` in packages/ui-foundation, then \`npm run sync\`.`)
  process.exit(1)
}
if (check) console.log('docs:index --check: every long doc has an index that matches its headings')
