// Callouts (Notion's coloured boxes) in Markdown: GitHub's alert syntax, a
// quote whose first line is its kind in brackets.
//
//   > [!NOTE]
//   > Measure twice, cut once.
//
// It's plain Markdown, so a note stays readable anywhere (GitHub and
// Obsidian render it as a callout too, anything else as a quote), and
// remark parses it as a blockquote whose first text is the marker. These
// plugins read that marker: `remarkCallouts` for <Markdown> (an element
// react-markdown hands to its `div` component) and `remarkCalloutNodes`
// for the rich-text editor (a `callout` node it has a schema for, written
// back with `calloutHandler`). The merge (markdown-merge.ts) needs
// neither: to it a callout is the quote it's written as.
//
// Five kinds, GitHub's: note, tip, important, warning, caution. The marker
// is kept as it was written (`[!note]` stays lower case) unless the kind
// changes, so an untouched callout never reads as edited.

export const CALLOUT_KINDS = ['note', 'tip', 'important', 'warning', 'caution'] as const

export type CalloutKind = (typeof CALLOUT_KINDS)[number]

type MdNode = {
  type: string
  children?: MdNode[]
  value?: string
  data?: Record<string, unknown>
  [key: string]: unknown
}

// The marker alone on the quote's first line: `[!NOTE]`, any case, spaces
// after it allowed.
const MARKER = /^\[!(note|tip|important|warning|caution)\][ \t]*(?:\n|$)/i

/**
 * A quote that's a callout: its kind and marker as written, with the
 * marker taken out of its first paragraph (and that paragraph too, when
 * the marker was all of it). Null for any other node, untouched.
 */
function takeCallout(node: MdNode): { kind: CalloutKind; marker: string } | null {
  if (node.type !== 'blockquote') return null
  const paragraph = node.children?.[0]
  const text = paragraph?.type === 'paragraph' ? paragraph.children?.[0] : undefined
  if (!paragraph || text?.type !== 'text' || typeof text.value !== 'string') return null
  const found = MARKER.exec(text.value)
  if (!found) return null
  const rest = text.value.slice(found[0].length)
  if (rest) text.value = rest
  else paragraph.children!.shift()
  if (paragraph.children!.length === 0) node.children!.shift()
  return { kind: found[1].toLowerCase() as CalloutKind, marker: found[0].trim() }
}

function visit(node: MdNode, each: (node: MdNode) => void) {
  for (const child of node.children ?? []) visit(child, each)
  each(node)
}

/**
 * For react-markdown: a callout quote becomes a `<div data-callout="note">`
 * (its marker gone), which <Markdown>'s `div` component draws as one.
 */
export function remarkCallouts() {
  return (tree: unknown) => {
    visit(tree as MdNode, (node) => {
      const callout = takeCallout(node)
      if (callout) node.data = { ...node.data, hName: 'div', hProperties: { dataCallout: callout.kind } }
    })
  }
}

/**
 * For the rich-text editor: a callout quote becomes a `callout` node
 * (`kind`, `marker`), which its schema reads and `calloutHandler` writes.
 */
export function remarkCalloutNodes() {
  return (tree: unknown) => {
    visit(tree as MdNode, (node) => {
      const callout = takeCallout(node)
      if (!callout) return
      node.type = 'callout'
      node.kind = callout.kind
      node.marker = callout.marker
    })
  }
}

/** The marker to write for a callout: as it was written, unless its kind changed. */
export function calloutMarker(kind: CalloutKind, written: string | null | undefined): string {
  return written && written.slice(2, -1).toLowerCase() === kind ? written : `[!${kind.toUpperCase()}]`
}

// The slice of mdast-util-to-markdown's state the handler uses.
type ToMarkdownState = {
  enter: (name: string) => () => void
  createTracker: (info: unknown) => { move: (value: string) => void; shift: (value: number) => void; current: () => unknown }
  containerFlow: (node: MdNode, info: unknown) => string
  indentLines: (value: string, map: (line: string, index: number, blank: boolean) => string) => string
}

/**
 * Writes a `callout` node the way remark writes a quote, with the marker
 * as its first line. A first block that isn't a paragraph gets a blank
 * line after the marker, so it can't run into it.
 */
export function calloutHandler(node: MdNode, _parent: unknown, state: ToMarkdownState, info: unknown): string {
  const exit = state.enter('blockquote')
  const tracker = state.createTracker(info)
  tracker.move('> ')
  tracker.shift(2)
  const marker = calloutMarker(node.kind as CalloutKind, node.marker as string | null)
  // Milkdown's serializer starts a container's flow on a new line; the
  // marker's line is that line.
  const body = state.containerFlow(node, tracker.current()).replace(/^\n+/, '')
  const joined = !body ? marker : node.children?.[0]?.type === 'paragraph' ? `${marker}\n${body}` : `${marker}\n\n${body}`
  const value = state.indentLines(joined, (line, _index, blank) => '>' + (blank ? '' : ' ') + line)
  exit()
  return value
}
