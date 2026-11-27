// Saving rich-text edits back to Markdown without rewriting what the
// person didn't touch.
//
// The rich-text editor (RichTextEditor) loads Markdown into a document and
// serializes it back. Its serializer is faithful to meaning but has its own
// style: bullets, table padding, rules and hard breaks come back written
// its way, and a reference-style link comes back inline. Saving that
// whole would quietly rewrite every note anyone opened. So a save is
// assembled block by block:
//
// - `baseline` is the editor's serialization of the document as loaded,
//   `current` its serialization now. Equal means nothing was edited: the
//   original comes back as it was, byte for byte.
// - Otherwise each top-level block (a paragraph, a heading, a whole list or
//   table) is matched by meaning: original ↔ baseline, then baseline ↔
//   current. A block the person didn't change is written from the
//   original's own source; only a changed or new block is written by the
//   editor (in the document's own bullet and rule marks, `markdownStyle`).
// - Blocks the editor can't show (a link reference's definition) are kept
//   where they were. A block the editor shows its own way (a table it
//   padded, marks it nested differently) and that `meaning` still misses is
//   written as the editor shows it, as long as nothing in it is lost
//   (`content`): no text, address or image. A block the editor drops part
//   of (an image, say) is kept as written, and the guard refuses.
// - Guard: the result must mean exactly what the editor shows. If it
//   wouldn't (two blocks fusing, say), the merge throws instead of saving
//   something else; the draft stays on screen.
// - A table and the comment after it that keeps its column widths
//   (markdown-table-widths.ts) are one block: a width changed in the editor
//   is an edit to the table, and an unchanged one keeps the comment as written.
// - A code fence's info string after the language (`title="app.js"`,
//   `{1,3}`) is something the editor can't hold: it loads only the
//   language. `meaning` leaves it out, so an untouched fence still matches
//   and is kept as written; `content` counts it, so a fence is never
//   swapped for the editor's copy that lost it.
// - Line endings: a Windows (CRLF) note compares as if it were LF, and what
//   the editor writes goes back in the document's own ending.
// - A link definition goes once nothing in the text uses it any more (no
//   reference to it and no link to its address): select all and delete
//   leaves an empty text, not an invisible definition.
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { widthsAfterTable } from './markdown-table-widths'

type MdNode = {
  type: string
  position?: { start: { offset?: number }; end: { offset?: number } }
  children?: MdNode[]
  [key: string]: unknown
}

type Block = {
  type: string
  start: number
  end: number
  source: string
  key: string
  content: string
  // References (by identifier) and link or image addresses in the block;
  // for a definition, its own identifier and address.
  references: Set<string>
  urls: Set<string>
}

const processor = unified().use(remarkParse).use(remarkGfm)

function parse(markdown: string): MdNode {
  return processor.runSync(processor.parse(markdown)) as unknown as MdNode
}

// Fields that are about how a node was written, not what it means.
const STYLE_ONLY = new Set(['position', 'data', 'spread', 'label', 'referenceType'])

// Fields the editor can't hold, so it loads a node without them: left out
// of `meaning` (the block the editor shows still matches its original) but
// counted by `content` (nothing is lost by writing the editor's copy).
const EDITOR_DROPS = new Set(['meta'])

// Nodes whose children are inline text: compared as runs of marked text.
const INLINE_PARENTS = new Set(['paragraph', 'heading', 'tableCell'])

// A reference link (or image) as the link it stands for, when its
// definition is in the document.
function resolved(node: MdNode, definitions: Map<string, MdNode>): MdNode {
  if (node.type !== 'linkReference' && node.type !== 'imageReference') return node
  const definition = definitions.get(String(node.identifier))
  if (!definition) return node
  return {
    type: node.type === 'linkReference' ? 'link' : 'image',
    url: definition.url,
    title: definition.title ?? null,
    alt: node.alt,
    children: node.children,
  }
}

// The mark an inline node puts on its text, or undefined for text itself.
function markOf(node: MdNode): string | undefined {
  if (node.type === 'strong' || node.type === 'emphasis' || node.type === 'delete') return node.type
  if (node.type === 'link') return `link ${JSON.stringify([node.url, node.title ?? null])}`
  return undefined
}

// Inline content as what a reader sees: each piece of text (or code, an
// image, a break) with the set of marks on it, whichever way they were
// nested. `**[a](u)**` and `[**a**](u)` are the same bold link; a link with
// no text shows nothing.
function runs(nodes: MdNode[], definitions: Map<string, MdNode>, marks: string[] = [], out: Record<string, unknown>[] = []) {
  for (const child of nodes) {
    const node = resolved(child, definitions)
    const mark = markOf(node)
    if (mark) {
      runs(node.children ?? [], definitions, [...marks, mark], out)
      continue
    }
    const set = [...new Set(marks)].sort()
    const last = out.at(-1)
    if (node.type === 'text' && last?.type === 'text' && JSON.stringify(last.marks) === JSON.stringify(set)) {
      last.value = String(last.value) + String(node.value)
    } else {
      out.push({ ...(meaning(node, definitions) as Record<string, unknown>), marks: set })
    }
  }
  return out
}

// A block's meaning as a comparable string: positions and source style
// dropped, a reference link resolved to the link it stands for, inline
// marks compared as a set, and a table's rows all as wide as its widest
// (GFM allows short rows; the editor pads them with empty cells).
function meaning(node: unknown, definitions: Map<string, MdNode>): unknown {
  if (Array.isArray(node)) return node.map((child) => meaning(child, definitions))
  if (!node || typeof node !== 'object') return node
  const md = resolved(node as MdNode, definitions)
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(md).sort()) {
    if (STYLE_ONLY.has(key) || EDITOR_DROPS.has(key)) continue
    const value = md[key]
    // CRLF and LF text mean the same.
    if (typeof value === 'string') out[key] = value.replace(/\r\n?/g, '\n')
    else out[key] = key === 'children' && INLINE_PARENTS.has(md.type) ? runs(md.children ?? [], definitions) : meaning(value, definitions)
  }
  if (LINE_PARENTS.has(md.type)) withoutEndSpaces(out.children as Record<string, unknown>[])
  return finish(md, out)
}

// Blocks whose spaces at either end mean nothing: the editor leaves them
// out of what it writes (rich-text-empty-paragraph.ts), so a note that
// holds one (`&#x20;` at a paragraph's start) still matches what it shows.
const LINE_PARENTS = new Set(['paragraph', 'heading'])

function withoutEndSpaces(children: Record<string, unknown>[]) {
  const first = children[0]
  if (first?.type === 'text') first.value = String(first.value).replace(/^[ \t]+/, '')
  const last = children.at(-1)
  if (last?.type === 'text') last.value = String(last.value).replace(/[ \t]+$/, '')
}

function finish(md: MdNode, out: Record<string, unknown>): unknown {
  if ((md.type === 'link' || md.type === 'image') && out.title === undefined) out.title = null
  if (md.type === 'table') {
    const rows = out.children as { children: unknown[] }[]
    const width = Math.max(0, ...rows.map((row) => row.children.length))
    for (const row of rows) {
      while (row.children.length < width) row.children.push({ children: [], type: 'tableCell' })
    }
    const align = (out.align as unknown[] | undefined) ?? []
    out.align = Array.from({ length: width }, (_value, index) => align[index] ?? null)
  }
  return out
}

// Everything in a block a reader could lose: its text (spacing aside),
// code, raw HTML, rules, and every other field `meaning` compares
// (addresses, alt text, a code block's language, a heading's level, task
// boxes), plus what the editor can't hold (`EDITOR_DROPS`). Taken from the
// node's own fields, so a field `meaning` compares can't be missed here.
// Not how any of it is marked or nested (a node's type), nor laid out.
function content(node: MdNode, definitions: Map<string, MdNode>): string {
  const md = resolved(node, definitions)
  let out = ''
  if (md.type === 'thematicBreak') out += '<hr>'
  for (const key of Object.keys(md).sort()) {
    if (key === 'type' || key === 'children' || STYLE_ONLY.has(key)) continue
    const value = md[key]
    if (value === null || value === undefined) continue
    // Text runs on across marks: `a *b*` and `**a b**` hold the same text.
    if (key === 'value' && typeof value === 'string') out += value.replace(/\s+/g, '')
    else out += `<${key}=${JSON.stringify(value)}>`
  }
  for (const child of md.children ?? []) out += content(child, definitions)
  return out
}

// For tests/markdown-merge.test.ts: every field `meaning` compares must be
// one `content` counts. Not part of the package's exports.
export const mergeParts = { parse, meaning, content }

// References and addresses a block uses (see `Block`).
function uses(node: MdNode, references: Set<string> = new Set(), urls: Set<string> = new Set()) {
  if (node.type === 'linkReference' || node.type === 'imageReference' || node.type === 'definition') {
    references.add(String(node.identifier))
  }
  if (typeof node.url === 'string') urls.add(node.url)
  for (const child of node.children ?? []) uses(child, references, urls)
  return { references, urls }
}

// The blocks of the texts merged lately, by text: an editor merges the
// same original and baseline against each edit, so each is parsed once
// per mount, not once per merge. A few, most recent last.
const PARSED = 8
const parsed = new Map<string, Block[]>()

function blocks(markdown: string): Block[] {
  const known = parsed.get(markdown)
  if (known) {
    parsed.delete(markdown)
    parsed.set(markdown, known)
    return known
  }
  const out = parseBlocks(markdown)
  parsed.set(markdown, out)
  if (parsed.size > PARSED) parsed.delete(parsed.keys().next().value as string)
  return out
}

/** How many texts mergeMarkdown has parsed, for tests/markdown-merge-budget.test.ts. */
export const mergeStats = { parses: 0 }

function parseBlocks(markdown: string): Block[] {
  mergeStats.parses += 1
  const tree = parse(markdown)
  const children = tree.children ?? []
  const definitions = new Map<string, MdNode>()
  for (const child of children) if (child.type === 'definition') definitions.set(String(child.identifier), child)
  const out: Block[] = []
  for (let index = 0; index < children.length; index++) {
    const child = children[index]
    // A table's widths are part of it: the comment is taken with the table.
    const widths = child.type === 'table' ? widthsAfterTable(child, children[index + 1]) : null
    const last = widths ? children[++index] : child
    const start = child.position?.start.offset ?? 0
    const end = last.position?.end.offset ?? 0
    const key = meaning(child, definitions)
    out.push({
      type: child.type,
      start,
      end,
      source: markdown.slice(start, end),
      // Tables with no width set read as they always have.
      key: JSON.stringify(widths?.some((width) => width !== null) ? [key, widths] : key),
      content: content(child, definitions),
      ...uses(child),
    })
  }
  return out
}

// Longest common subsequence by meaning: which `to` block is which `from`
// block, as a map from `to` index to `from` index.
function match(from: Block[], to: Block[]): Map<number, number> {
  const table = Array.from({ length: from.length + 1 }, () => new Array<number>(to.length + 1).fill(0))
  for (let i = from.length - 1; i >= 0; i--) {
    for (let j = to.length - 1; j >= 0; j--) {
      table[i][j] = from[i].key === to[j].key ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const pairs = new Map<number, number>()
  let i = 0
  let j = 0
  while (i < from.length && j < to.length) {
    if (from[i].key === to[j].key) {
      pairs.set(j, i)
      i++
      j++
    } else if (table[i + 1][j] >= table[i][j + 1]) i++
    else j++
  }
  return pairs
}

// The original blocks the editor shows: each matched one, and each run of
// unmatched ones between two matches that the editor shows its own way,
// with nothing lost, as the unmatched blocks it has between the same two.
// Those are written as the editor has them; a definition never is.
function shownOwnWay(originals: Block[], loaded: Block[], loadedToOriginal: Map<number, number>): Set<number> {
  const shown = new Set(loadedToOriginal.values())
  const anchors = [[-1, -1], ...[...loadedToOriginal].map(([to, from]) => [from, to]), [originals.length, loaded.length]]
  for (let k = 1; k < anchors.length; k++) {
    const [fromStart, toStart] = anchors[k - 1]
    const [fromEnd, toEnd] = anchors[k]
    const unmatched = originals
      .map((_block, index) => index)
      .slice(fromStart + 1, fromEnd)
      .filter((index) => originals[index].type !== 'definition')
    if (unmatched.length === 0) continue
    const before = unmatched.map((index) => originals[index].content).join('')
    const after = loaded
      .slice(toStart + 1, toEnd)
      .map((block) => block.content)
      .join('')
    if (before === after) for (const index of unmatched) shown.add(index)
  }
  return shown
}

// The original's blocks matched to the baseline's, and which the editor
// shows, worked out once per pair (both are the same for every merge an
// editor makes).
type Loaded = { loadedToOriginal: Map<number, number>; shown: Set<number> }
const loadedPairs = new WeakMap<Block[], WeakMap<Block[], Loaded>>()

function loadedAgainst(originals: Block[], loaded: Block[]): Loaded {
  let byLoaded = loadedPairs.get(originals)
  if (!byLoaded) loadedPairs.set(originals, (byLoaded = new WeakMap()))
  let pair = byLoaded.get(loaded)
  if (!pair) {
    const loadedToOriginal = match(originals, loaded)
    pair = { loadedToOriginal, shown: shownOwnWay(originals, loaded, loadedToOriginal) }
    byLoaded.set(loaded, pair)
  }
  return pair
}

export class MarkdownMergeError extends Error {
  constructor() {
    super("This text can't be saved without changing parts you didn't edit. Undo the last change, or edit it in the form.")
    this.name = 'MarkdownMergeError'
  }
}

// An item of the saved document: an original block (by index) or a block
// the editor wrote. `at` orders editor blocks among originals, for placing
// blocks the editor never saw.
type Item = { original: number; at: number } | { written: Block; at: number }

/**
 * The Markdown to save: `original` with the edits that turned `baseline`
 * (the editor's serialization as loaded) into `current` (its serialization
 * now), every unchanged top-level block kept as `original` wrote it.
 * Throws `MarkdownMergeError` rather than save something that means other
 * than `current`.
 */
export function mergeMarkdown(original: string, baseline: string, current: string): string {
  if (current === baseline) return original
  // The document's own line ending (its first), for what the editor
  // writes, which is always LF.
  const eol = original[original.indexOf('\n') - 1] === '\r' ? '\r\n' : '\n'
  const ownEnding = (text: string) => (eol === '\n' ? text : text.replace(/\r?\n/g, eol))

  const originals = blocks(original)
  const loaded = blocks(baseline)
  const edited = blocks(current)
  const { loadedToOriginal, shown } = loadedAgainst(originals, loaded)
  const editedToLoaded = match(loaded, edited)

  // Each edited block's original, if it is one unchanged.
  const sources = edited.map((_block, index) => {
    const loadedIndex = editedToLoaded.get(index)
    return loadedIndex === undefined ? undefined : loadedToOriginal.get(loadedIndex)
  })
  // A written block sits between the originals around it.
  const items: Item[] = edited.map((block, index) => {
    const source = sources[index]
    if (source !== undefined) return { original: source, at: source }
    const before = sources.slice(0, index).reverse().find((value) => value !== undefined) ?? -1
    const after = sources.slice(index + 1).find((value) => value !== undefined) ?? originals.length
    return { written: block, at: (before + after) / 2 }
  })

  // Blocks the editor never showed (definitions, and any block it dropped
  // part of): after whatever came before them in the original.
  originals.forEach((_block, index) => {
    if (shown.has(index)) return
    let position = 0
    for (let k = items.length - 1; k >= 0; k--) {
      if (items[k].at < index) {
        position = k + 1
        break
      }
    }
    items.splice(position, 0, { original: index, at: index })
  })

  // A definition the original used and nothing uses now (no reference to
  // it, no link to its address: the editor writes a reference link inline)
  // goes with the text that used it.
  const inText = (list: Block[]) => list.filter((block) => block.type !== 'definition')
  const usedBefore = new Set(inText(originals).flatMap((block) => [...block.references]))
  const kept = items.map((item) => ('original' in item ? originals[item.original] : item.written))
  const referencesNow = new Set(inText(kept).flatMap((block) => [...block.references]))
  const urlsNow = new Set(inText(kept).flatMap((block) => [...block.urls]))
  for (let k = items.length - 1; k >= 0; k--) {
    const block = kept[k]
    if (block.type !== 'definition') continue
    const [identifier] = block.references
    const [url] = block.urls
    if (usedBefore.has(identifier) && !referencesNow.has(identifier) && !urlsNow.has(url)) items.splice(k, 1)
  }

  let out = ''
  items.forEach((item, k) => {
    const previous = items[k - 1]
    if (!previous) {
      if ('original' in item && item.original === 0) out += original.slice(0, originals[0].start)
    } else if ('original' in previous && 'original' in item && item.original === previous.original + 1) {
      out += original.slice(originals[previous.original].end, originals[item.original].start)
    } else {
      out += eol + eol
    }
    out += 'original' in item ? originals[item.original].source : ownEnding(item.written.source)
  })
  // The document ends the way the original ended, whichever block is last
  // now: an edit to the last block adds no newline the person didn't type.
  // Text written from nothing ends the way the editor ends it.
  const ending =
    originals.length > 0
      ? original.slice(originals[originals.length - 1].end)
      : ownEnding(current.slice(edited.at(-1)?.end ?? current.length))
  if (items.length > 0) out += ending

  const saved = blocks(out)
    .filter((block) => block.type !== 'definition')
    .map((block) => block.key)
  const shownNow = edited.filter((block) => block.type !== 'definition').map((block) => block.key)
  if (JSON.stringify(saved) !== JSON.stringify(shownNow)) throw new MarkdownMergeError()
  return out
}

// One block of a rebased text, and the text it comes from.
type Piece = { from: 'mine' | 'theirs'; index: number; block: Block }

const keysOf = (list: readonly Block[]) => list.map((block) => block.key).join('\n')

/**
 * Both edits at once, block by block: `mine` and `theirs` each started from
 * `base` (the same saved text, edited in two places: this tab and another
 * tab, a phone or an AI chat). Every top-level block only one side changed
 * takes that side's change; a block neither changed keeps `theirs`'s own
 * bytes. Returns null when both changed the same stretch of blocks (or
 * both added text at the same place), when it can't be done without
 * losing one of them: the caller asks the person instead. A three-way
 * merge (diff3) over blocks matched by meaning, as `mergeMarkdown`
 * matches them; it never merges inside a block.
 */
export function rebaseMarkdown(base: string, mine: string, theirs: string): string | null {
  if (mine === base || mine === theirs) return theirs
  if (theirs === base) return mine
  // What's written goes in theirs's own line ending (the text it lands in).
  const eol = theirs[theirs.indexOf('\n') - 1] === '\r' ? '\r\n' : '\n'
  const ownEnding = (text: string) => text.replace(/\r?\n/g, eol)

  const based = blocks(base)
  const lists = { mine: blocks(mine), theirs: blocks(theirs) }
  const texts = { mine, theirs }
  const theirsAt = new Map([...match(based, lists.theirs)].map(([to, from]) => [from, to]))

  // Each side's changes, as stretches of the base replaced by its own
  // blocks (an insertion is an empty stretch).
  type Hunk = { side: Piece['from']; start: number; end: number; from: number; to: number }
  const hunks = (side: Piece['from']): Hunk[] => {
    const pairs = [...match(based, lists[side])].map(([to, from]) => [from, to]).sort((a, b) => a[0] - b[0])
    const out: Hunk[] = []
    let [b, s] = [-1, -1]
    for (const [nextB, nextS] of [...pairs, [based.length, lists[side].length]]) {
      if (nextB > b + 1 || nextS > s + 1) out.push({ side, start: b + 1, end: nextB, from: s + 1, to: nextS })
      ;[b, s] = [nextB, nextS]
    }
    return out
  }
  const keysIn = (hunk: Hunk) => keysOf(lists[hunk.side].slice(hunk.from, hunk.to))
  const mineHunks = hunks('mine')
  const theirsHunks = hunks('theirs')
  // Both changed the same stretch (or added at the same place) in
  // different ways: no merge. The same change on both sides is one.
  const kept: Hunk[] = [...theirsHunks]
  for (const ours of mineHunks) {
    const clash = theirsHunks.find(
      (other) => (ours.start < other.end && other.start < ours.end) || ours.start === other.start,
    )
    if (!clash) kept.push(ours)
    else if (clash.start !== ours.start || clash.end !== ours.end || keysIn(clash) !== keysIn(ours)) return null
  }
  // In base order; at one place, an insertion before a replacement.
  kept.sort((a, b) => a.start - b.start || a.end - b.end)

  const pieces: Piece[] = []
  const add = (from: Piece['from'], index: number) => pieces.push({ from, index, block: lists[from][index] })
  let next = 0
  const keepBase = (until: number) => {
    // Blocks no one changed: as theirs has them.
    for (; next < until; next++) add('theirs', theirsAt.get(next) as number)
  }
  for (const hunk of kept) {
    keepBase(hunk.start)
    for (let index = hunk.from; index < hunk.to; index++) add(hunk.side, index)
    next = Math.max(next, hunk.end)
  }
  keepBase(based.length)

  let out = ''
  pieces.forEach((piece, k) => {
    const previous = pieces[k - 1]
    const list = lists[piece.from]
    if (!previous) {
      if (piece.index === 0) out += ownEnding(texts[piece.from].slice(0, list[0].start))
    } else if (previous.from === piece.from && previous.index === piece.index - 1) {
      out += ownEnding(texts[piece.from].slice(list[previous.index].end, piece.block.start))
    } else {
      out += eol + eol
    }
    out += piece.from === 'theirs' ? piece.block.source : ownEnding(piece.block.source)
  })
  // The text ends the way theirs ends.
  if (pieces.length > 0) {
    const last = lists.theirs.at(-1)
    out += last ? theirs.slice(last.end) : ownEnding(mine.slice(lists.mine.at(-1)?.end ?? mine.length))
  }
  // Guard, as in mergeMarkdown: the result must read as exactly the blocks
  // picked (two blocks fusing across a seam would be something else).
  return keysOf(blocks(out)) === keysOf(pieces.map((piece) => piece.block)) ? out : null
}

/**
 * The document's own marks, for writing a block the person edited the way
 * the rest is written: its bullet (`-`, `*`, `+`) and its thematic break.
 */
export function markdownStyle(markdown: string): { bullet: '-' | '*' | '+'; rule: '-' | '*' | '_' } {
  const bullet = /^\s*([-*+])\s/m.exec(markdown)?.[1] as '-' | '*' | '+' | undefined
  const rule = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/m.exec(markdown)?.[1] as '-' | '*' | '_' | undefined
  return { bullet: bullet ?? '-', rule: rule ?? '-' }
}
