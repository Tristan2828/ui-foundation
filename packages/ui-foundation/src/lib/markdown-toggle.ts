// Toggle headings (Notion's): the only headings that fold. A plain
// heading never folds and never shows a fold button; a toggle heading
// folds its section, as every heading did before 4.66.0.
//
// In Markdown a toggle heading is a heading whose line ends in Notion's
// own attribute, so a chat that writes Notion's Markdown writes it, and a
// plain heading stays plain Markdown:
//
//   ## Safety {toggle="true"}
//
// Anything else reads it as a heading with those words at its end. These
// plugins take the marker off and mark the heading instead:
// `remarkToggleHeadings` for <Markdown> (a `data-toggle` property
// rehypeFold reads) and for the rich-text editor (its heading node's
// `toggle` attribute, written back with the marker by its schema). The
// marker never counts in a heading's words, so its fold id
// (markdown-fold.ts) is the same plain or toggle.

/** The marker at a toggle heading's end, as it's written. */
export const TOGGLE_MARKER = '{toggle="true"}'

// The marker at the end of a heading's text, the space before it and any
// after it. Single quotes, no quotes and spaces inside the braces are read
// too; it's written back as TOGGLE_MARKER.
const AT_END = /[ \t]*\{\s*toggle\s*=\s*(?:"true"|'true'|true)\s*\}[ \t]*$/

/** `text` without a toggle marker at its end, and whether it had one. */
export function takeToggleMarker(text: string): { text: string; toggle: boolean } {
  const found = AT_END.exec(text)
  return found ? { text: text.slice(0, found.index), toggle: true } : { text, toggle: false }
}

type MdNode = {
  type: string
  depth?: number
  value?: string
  children?: MdNode[]
  data?: Record<string, unknown>
  toggle?: boolean
  [key: string]: unknown
}

/**
 * A heading that's a toggle: true, with the marker taken out of its last
 * text (and that text too, when the marker was all of it). False for any
 * other node, untouched.
 */
export function takeToggle(node: MdNode): boolean {
  if (node.type !== 'heading') return false
  const last = node.children?.[node.children.length - 1]
  if (last?.type !== 'text' || typeof last.value !== 'string') return false
  const taken = takeToggleMarker(last.value)
  if (!taken.toggle) return false
  if (taken.text) last.value = taken.text
  else node.children!.pop()
  return true
}

function visit(node: MdNode, each: (node: MdNode) => void) {
  for (const child of node.children ?? []) visit(child, each)
  each(node)
}

/**
 * Marks each toggle heading, its marker taken out: `toggle: true` on the
 * mdast node (the editor's schema reads it) and a `data-toggle` property
 * on its element (rehypeFold reads it).
 */
export function remarkToggleHeadings() {
  return (tree: unknown) => {
    visit(tree as MdNode, (node) => {
      if (!takeToggle(node)) return
      node.toggle = true
      const hProperties = (node.data?.hProperties as Record<string, unknown> | undefined) ?? {}
      node.data = { ...node.data, hProperties: { ...hProperties, dataToggle: 'true' } }
    })
  }
}
