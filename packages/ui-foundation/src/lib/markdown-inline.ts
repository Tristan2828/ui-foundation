// <Markdown inline>: a one-line value's Markdown (a table cell, a card's
// line, a summary) as one run of words, so it sits in a row without
// making it taller. Bold, italic, code and links keep their marks; every
// other mark is its words. Blocks have nowhere to go on one line, so each
// becomes its words, in order, joined so they still read:
//
// - paragraphs (and lines): a space
// - headings, quotes, rules and any other block: " · "
// - a list: its items, " · " between them; numbered with their numbers
//   (`1. a · 2. b`); a task item done starts "✓ ", one to do "☐ "
// - a table: each row as `Header: value` pairs, ", " between them and
//   " · " between rows (the header row itself isn't repeated); cells
//   with no header, or no words, are left out
// - a code block: inline code
// - an image: its alt text, if any
// - a callout: its kind first ("Note: …")
//
// The text itself is never changed: this is how it's drawn on one line.
// A rehype plugin, on the HTML tree after remark-gfm and the package's
// own remark plugins, so what it flattens is what <Markdown> would draw.

type Node = {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: Node[]
}

const KEEP = new Set(['strong', 'em', 'code', 'a'])
const SEPARATOR = ' · '

const text = (value: string): Node => ({ type: 'text', value })

// A node's words alone, marks dropped (a table cell's header, an alt).
function plain(node: Node): string {
  if (node.type === 'text' || node.type === 'raw') return node.value ?? ''
  if (node.tagName === 'img') return typeof node.properties?.alt === 'string' ? node.properties.alt : ''
  return (node.children ?? []).map(plain).join('')
}

const hasWords = (nodes: Node[]) => nodes.some((node) => plain(node).trim() !== '')

// Parts joined with a separator, leaving out the empty ones.
function join(parts: Node[][], separator: string): Node[] {
  const out: Node[] = []
  for (const part of parts.filter(hasWords)) {
    if (out.length > 0) out.push(text(separator))
    out.push(...part)
  }
  return out
}

const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

function rows(table: Node): Node[][] {
  const out: Node[][] = []
  const walk = (node: Node) => {
    for (const child of node.children ?? []) {
      if (child.tagName === 'tr') out.push((child.children ?? []).filter((cell) => cell.tagName === 'td' || cell.tagName === 'th'))
      else walk(child)
    }
  }
  walk(table)
  return out
}

function flattenTable(table: Node): Node[] {
  const head = table.children?.find((child) => child.tagName === 'thead')
  const all = rows(table)
  const headers = head ? rows(head)[0]?.map((cell) => plain(cell).trim()) ?? [] : []
  const body = head ? all.slice(1) : all
  return join(
    body.map((cells) =>
      join(
        cells.map((cell, index) => {
          const words = inline(cell.children ?? [])
          if (!hasWords(words)) return []
          return headers[index] ? [text(`${headers[index]}: `), ...words] : words
        }),
        ', ',
      ),
    ),
    SEPARATOR,
  )
}

function flattenList(list: Node): Node[] {
  const start = Number(list.properties?.start ?? 1) || 1
  const items = (list.children ?? []).filter((child) => child.tagName === 'li')
  return join(
    items.map((item, index) => {
      const box = findBox(item)
      const lead = box ? (box.properties?.checked ? '✓ ' : '☐ ') : list.tagName === 'ol' ? `${start + index}. ` : ''
      const words = blocks(item.children ?? [])
      return hasWords(words) ? [text(lead), ...words] : []
    }),
    SEPARATOR,
  )
}

// A task item's box: GFM puts it first in the item, or in its first paragraph.
function findBox(item: Node): Node | undefined {
  const first = item.children?.find((child) => child.type === 'element')
  if (first?.tagName === 'input') return first
  if (first?.tagName === 'p') return first.children?.find((child) => child.tagName === 'input')
  return undefined
}

// Inline content: the four kept marks stay (their own content flattened),
// anything else is its words.
function inline(nodes: Node[]): Node[] {
  const out: Node[] = []
  for (const node of nodes) {
    // Raw HTML stays its characters, as <Markdown> shows it everywhere.
    if (node.type === 'text' || node.type === 'raw') out.push(text((node.value ?? '').replace(/\s*\n\s*/g, ' ')))
    else if (node.type !== 'element') continue
    else if (node.tagName === 'br') out.push(text(' '))
    else if (node.tagName === 'input') continue
    else if (node.tagName === 'img') {
      const alt = plain(node)
      if (alt) out.push(text(alt))
    } else if (KEEP.has(node.tagName ?? '')) out.push({ ...node, children: node.tagName === 'code' ? [text(plain(node))] : inline(node.children ?? []) })
    else if (isBlock(node)) out.push(...blocks([node]))
    else out.push(...inline(node.children ?? []))
  }
  return out
}

const BLOCKS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'blockquote', 'pre', 'hr', 'div', 'section'])
const isBlock = (node: Node) => node.type === 'element' && BLOCKS.has(node.tagName ?? '')

// One block's words.
function block(node: Node): Node[] {
  switch (node.tagName) {
    case 'ul':
    case 'ol':
      return flattenList(node)
    case 'table':
      return flattenTable(node)
    case 'hr':
      return []
    case 'pre': {
      const code = node.children?.find((child) => child.tagName === 'code')
      const words = plain(code ?? node).trim().replace(/\s*\n\s*/g, ' ')
      return words ? [{ type: 'element', tagName: 'code', properties: {}, children: [text(words)] }] : []
    }
    case 'div': {
      const kind = node.properties?.dataCallout
      const words = blocks(node.children ?? [])
      return typeof kind === 'string' && hasWords(words) ? [text(`${capitalise(kind)}: `), ...words] : words
    }
    case 'p':
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return inline(node.children ?? [])
    default:
      return blocks(node.children ?? [])
  }
}

// A run of siblings, some blocks and some inline: inline stretches stay
// as they are, blocks join with a space after a paragraph into another,
// else " · ".
function blocks(nodes: Node[]): Node[] {
  const out: Node[] = []
  let previous: string | null = null
  let run: Node[] = []
  const flush = () => {
    if (!hasWords(run)) return (run = [])
    if (previous !== null) out.push(text(SEPARATOR))
    out.push(...trim(run))
    previous = 'inline'
    run = []
  }
  for (const node of nodes) {
    if (!isBlock(node)) {
      if (node.type === 'text' && !(node.value ?? '').trim() && run.length === 0) continue
      run.push(...inline([node]))
      continue
    }
    flush()
    const words = block(node)
    // A rule has no words, but the blocks either side of it are apart.
    if (!hasWords(words)) {
      if (previous !== null) previous = node.tagName ?? 'block'
      continue
    }
    if (previous !== null) out.push(text(previous === 'p' && node.tagName === 'p' ? ' ' : SEPARATOR))
    out.push(...words)
    previous = node.tagName ?? 'block'
  }
  flush()
  return trim(out)
}

// No space at either end of the line.
function trim(nodes: Node[]): Node[] {
  const out = [...nodes]
  if (out[0]?.type === 'text') out[0] = text((out[0].value ?? '').trimStart())
  const last = out.length - 1
  if (out[last]?.type === 'text') out[last] = text((out[last].value ?? '').trimEnd())
  return out
}

/** Flattens the whole text to one line of inline content (see above). */
export function rehypeInline() {
  return (tree: Node) => {
    tree.children = blocks(tree.children ?? [])
  }
}
