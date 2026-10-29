// The text's own highest heading level (1 for `#`), for `headingFrom="text"`
// on <Markdown> and the rich-text editor: notes pasted or imported from
// another tool often start at `##`, and that level is the one that takes
// the field's `headingLevel`. Parsed as both parse it (remark, GFM), so a
// `#` in a code block or a setext heading counts as they render it.
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

// The little of mdast read here (it isn't a dependency of its own).
type MdNode = { type: string; depth?: number; children?: MdNode[] }

const parser = unified().use(remarkParse).use(remarkGfm)

/** The lowest `depth` of any heading in the text, nested ones included; 1 when it has none. */
export function textTopHeading(markdown: string): number {
  let top = 7
  const visit = (node: MdNode) => {
    if (node.type === 'heading' && node.depth) top = Math.min(top, node.depth)
    for (const child of node.children ?? []) visit(child)
  }
  visit(parser.parse(markdown) as MdNode)
  return top === 7 ? 1 : top
}
