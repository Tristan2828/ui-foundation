// Highlighted words in Markdown: `==words==`, the syntax Obsidian and
// others share, with the colour in braces after the opening marks for any
// but the default amber.
//
//   ==amber, the default==  =={yellow}yellow==  =={green}green==  =={red}red==
//
// It's plain text where nothing reads it (the marks show), and no HTML:
// <Markdown> never renders raw HTML, and the editor never writes any.
// remark has no highlight, so these plugins read the marks from the text
// nodes of a parsed document: `remarkHighlights` for <Markdown> (a `mark`
// element with `data-color`) and `remarkHighlightNodes` for the rich-text
// editor (a `highlight` node it has a mark schema for, written back with
// `highlightHandler`). The merge (markdown-merge.ts) needs neither: to it
// the marks are text.
//
// Marks pair within one parent (a paragraph, a heading, a link's text),
// so words can wrap bold or a link but never run across a block. An opening
// `==` is followed by a non-space, a closing one preceded by one; a lone
// `==` stays text.

export const HIGHLIGHT_COLORS = ['amber', 'yellow', 'green', 'red'] as const

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]

export const DEFAULT_HIGHLIGHT: HighlightColor = 'amber'

export function isHighlightColor(value: unknown): value is HighlightColor {
  return HIGHLIGHT_COLORS.includes(value as HighlightColor)
}

type MdNode = {
  type: string
  children?: MdNode[]
  value?: string
  data?: Record<string, unknown>
  [key: string]: unknown
}

// An opening mark (with its colour, if any) or a closing one.
const MARK = new RegExp(`==(?:[{](${HIGHLIGHT_COLORS.join('|')})[}])?`, 'g')

type Piece = { text: string } | { mark: true; color: HighlightColor | null; start: number; end: number; source: string }

// A text node cut at its marks.
function cut(value: string): Piece[] {
  const pieces: Piece[] = []
  let last = 0
  for (const found of value.matchAll(MARK)) {
    const at = found.index!
    if (at > last) pieces.push({ text: value.slice(last, at) })
    pieces.push({ mark: true, color: (found[1] as HighlightColor | undefined) ?? null, start: at, end: at + found[0].length, source: found[0] })
    last = at + found[0].length
  }
  if (last < value.length) pieces.push({ text: value.slice(last) })
  return pieces
}

type Token = { node: MdNode } | { mark: Extract<Piece, { mark: true }>; before: string; after: string }

/** The children with their `==` pairs wrapped in `wrap(color, children)`; the same array when there's none. */
function wrapMarks(children: MdNode[], wrap: (color: HighlightColor, inner: MdNode[]) => MdNode): MdNode[] {
  if (!children.some((child) => child.type === 'text' && typeof child.value === 'string' && child.value.includes('=='))) return children
  // Flat tokens: nodes, and marks with the text around them.
  const tokens: Token[] = []
  children.forEach((child, childIndex) => {
    if (child.type !== 'text' || typeof child.value !== 'string' || !child.value.includes('==')) {
      tokens.push({ node: child })
      return
    }
    const pieces = cut(child.value)
    pieces.forEach((piece, index) => {
      if ('text' in piece) {
        tokens.push({ node: { type: 'text', value: piece.text } })
      } else {
        const prev = pieces[index - 1]
        const next = pieces[index + 1]
        tokens.push({
          mark: piece,
          before: prev ? ('text' in prev ? prev.text.slice(-1) : 'x') : childIndex === 0 ? ' ' : 'x',
          after: next ? ('text' in next ? next.text.slice(0, 1) : 'x') : childIndex === children.length - 1 ? ' ' : 'x',
        })
      }
    })
  })
  const out: MdNode[] = []
  let open: { color: HighlightColor; at: number; source: string } | null = null
  const text = (value: string) => ({ type: 'text', value })
  const isMark = (token: Token): token is Extract<Token, { mark: unknown }> => 'mark' in token
  for (const token of tokens) {
    if (!isMark(token)) {
      out.push(token.node)
      continue
    }
    const space = (character: string) => /\s/.test(character)
    if (open && token.mark.color === null && !space(token.before) && out.length > open.at + 1) {
      const inner = out.splice(open.at + 1)
      out[open.at] = wrap(open.color, inner)
      open = null
    } else if (!open && !space(token.after)) {
      open = { color: token.mark.color ?? DEFAULT_HIGHLIGHT, at: out.length, source: token.mark.source }
      out.push(text(token.mark.source))
    } else {
      out.push(text(token.mark.source))
    }
  }
  return merge(out)
}

// Neighbouring text nodes joined, so unpaired marks leave the text as it was.
function merge(nodes: MdNode[]): MdNode[] {
  const out: MdNode[] = []
  for (const node of nodes) {
    const last = out[out.length - 1]
    if (last && last.type === 'text' && node.type === 'text') out[out.length - 1] = { type: 'text', value: String(last.value) + String(node.value) }
    else out.push(node)
  }
  return out
}

function visit(node: MdNode, wrap: (color: HighlightColor, inner: MdNode[]) => MdNode) {
  if (!node.children) return
  for (const child of node.children) visit(child, wrap)
  if (node.type === 'code' || node.type === 'inlineCode') return
  node.children = wrapMarks(node.children, wrap)
}

/** For react-markdown: highlighted words become `<mark data-color="amber">`. */
export function remarkHighlights() {
  return (tree: unknown) =>
    visit(tree as MdNode, (color, children) => ({
      type: 'highlight',
      children,
      data: { hName: 'mark', hProperties: { dataColor: color } },
    }))
}

/** For the rich-text editor: highlighted words become `highlight` nodes (`color`), which its mark schema reads and `highlightHandler` writes. */
export function remarkHighlightNodes() {
  return (tree: unknown) => visit(tree as MdNode, (color, children) => ({ type: 'highlight', color, children }))
}

// The slice of mdast-util-to-markdown's state the handler uses.
type ToMarkdownState = {
  enter: (name: string) => () => void
  createTracker: (info: unknown) => { move: (value: string) => string; current: () => unknown }
  containerPhrasing: (node: MdNode, info: unknown) => string
}

/** Writes a `highlight` node as `==words==`, `=={green}words==` for any colour but the default. */
export function highlightHandler(node: MdNode, _parent: unknown, state: ToMarkdownState, info: unknown): string {
  const exit = state.enter('highlight')
  const tracker = state.createTracker(info)
  const color = isHighlightColor(node.color) ? node.color : DEFAULT_HIGHLIGHT
  let value = tracker.move(color === DEFAULT_HIGHLIGHT ? '==' : `=={${color}}`)
  value += tracker.move(state.containerPhrasing(node, { before: value, after: '=', ...(tracker.current() as object) }))
  value += tracker.move('==')
  exit()
  return value
}
