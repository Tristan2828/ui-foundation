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
//   where they were.
// - Guard: the result must mean exactly what the editor shows. If it
//   wouldn't (two blocks fusing, say), the merge throws instead of saving
//   something else; the draft stays on screen.
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

type MdNode = {
  type: string
  position?: { start: { offset?: number }; end: { offset?: number } }
  children?: MdNode[]
  [key: string]: unknown
}

type Block = { type: string; start: number; end: number; source: string; key: string }

const processor = unified().use(remarkParse).use(remarkGfm)

function parse(markdown: string): MdNode {
  return processor.runSync(processor.parse(markdown)) as unknown as MdNode
}

// Fields that are about how a node was written, not what it means.
const STYLE_ONLY = new Set(['position', 'data', 'spread', 'label', 'referenceType'])

// A block's meaning as a comparable string: positions and source style
// dropped, and a reference link resolved to the link it stands for.
function meaning(node: unknown, definitions: Map<string, MdNode>): unknown {
  if (Array.isArray(node)) return node.map((child) => meaning(child, definitions))
  if (!node || typeof node !== 'object') return node
  const md = node as MdNode
  if (md.type === 'linkReference' || md.type === 'imageReference') {
    const definition = definitions.get(String(md.identifier))
    if (definition) {
      return meaning(
        {
          type: md.type === 'linkReference' ? 'link' : 'image',
          url: definition.url,
          title: definition.title ?? null,
          alt: md.alt,
          children: md.children,
        },
        definitions,
      )
    }
  }
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(md).sort()) {
    if (STYLE_ONLY.has(key)) continue
    out[key] = meaning(md[key], definitions)
  }
  if ((md.type === 'link' || md.type === 'image') && out.title === undefined) out.title = null
  return out
}

function blocks(markdown: string): Block[] {
  const tree = parse(markdown)
  const children = tree.children ?? []
  const definitions = new Map<string, MdNode>()
  for (const child of children) if (child.type === 'definition') definitions.set(String(child.identifier), child)
  return children.map((child) => {
    const start = child.position?.start.offset ?? 0
    const end = child.position?.end.offset ?? 0
    return {
      type: child.type,
      start,
      end,
      source: markdown.slice(start, end),
      key: JSON.stringify(meaning(child, definitions)),
    }
  })
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

  const originals = blocks(original)
  const loaded = blocks(baseline)
  const edited = blocks(current)
  const loadedToOriginal = match(originals, loaded)
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

  // Blocks the editor never showed (definitions): after whatever came
  // before them in the original.
  const shown = new Set(loadedToOriginal.values())
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

  let out = ''
  items.forEach((item, k) => {
    const previous = items[k - 1]
    if (!previous) {
      if ('original' in item && item.original === 0) out += original.slice(0, originals[0].start)
    } else if ('original' in previous && 'original' in item && item.original === previous.original + 1) {
      out += original.slice(originals[previous.original].end, originals[item.original].start)
    } else {
      out += '\n\n'
    }
    out += 'original' in item ? originals[item.original].source : item.written.source
  })
  const last = items[items.length - 1]
  if (last && 'original' in last && last.original === originals.length - 1) {
    out += original.slice(originals[originals.length - 1].end)
  } else if (items.length > 0) {
    out += '\n'
  }

  const saved = blocks(out)
    .filter((block) => block.type !== 'definition')
    .map((block) => block.key)
  const shownNow = edited.filter((block) => block.type !== 'definition').map((block) => block.key)
  if (JSON.stringify(saved) !== JSON.stringify(shownNow)) throw new MarkdownMergeError()
  return out
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
