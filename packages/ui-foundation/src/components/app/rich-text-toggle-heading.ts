// Toggle headings in the rich-text editor (src/lib/markdown-toggle.ts):
// Milkdown's heading node with a `toggle` attribute, false by default, so
// every heading the text already has stays plain.
// - Read: remarkToggleHeadings takes the `{toggle="true"}` marker off a
//   heading's end and marks it `toggle`, which the schema reads.
// - Written: a toggle heading gets the marker back at its end; a plain one
//   is written as Milkdown writes any heading.
// - Typed: `>## ` at a line's start makes a toggle `##` (`># ` and `>### `
//   likewise), as Notion's `>` makes a toggle.
// - Picked: the slash menu's Toggle heading 1 to 3, and the toolbar's
//   Toggle heading (rich-text-formats.ts).
// Only a toggle heading folds, and only it has a fold button
// (headingView in milkdown-editor.tsx, rich-text-fold.ts).
import { headingSchema } from '@milkdown/kit/preset/commonmark'
import { textblockTypeInputRule } from '@milkdown/kit/prose/inputrules'
import type { NodeSchema } from '@milkdown/kit/transformer'
import { $inputRule, $remark } from '@milkdown/kit/utils'
import { remarkToggleHeadings, TOGGLE_MARKER } from '@/lib/markdown-toggle'

export const toggleHeadingRemark = $remark('remarkToggleHeadings', () => remarkToggleHeadings)

/**
 * Milkdown's heading schema with the `toggle` attribute, read from and
 * written to the Markdown: for `ctx.update(headingSchema.key, …)`.
 */
export function withToggle<Ctx>(previous: (ctx: Ctx) => NodeSchema): (ctx: Ctx) => NodeSchema {
  return (ctx) => {
    const base = previous(ctx)
    return {
      ...base,
      attrs: { ...base.attrs, toggle: { default: false, validate: 'boolean' } },
      parseMarkdown: {
        match: ({ type }) => type === 'heading',
        runner: (state, node, type) => {
          state.openNode(type, { level: node.depth as number, toggle: node.toggle === true })
          state.next(node.children)
          state.closeNode()
        },
      },
      toMarkdown: {
        match: (node) => node.type.name === 'heading',
        runner: (state, node) => {
          state.openNode('heading', undefined, { depth: node.attrs.level })
          // A hard break at the end is left out, as Milkdown's own does.
          const last = node.lastChild
          const content = last?.type.name === 'hardbreak' ? node.content.cut(0, node.content.size - last.nodeSize) : node.content
          state.next(content)
          if (node.attrs.toggle) state.addNode('text', undefined, content.size > 0 ? ` ${TOGGLE_MARKER}` : TOGGLE_MARKER)
          state.closeNode()
        },
      },
    }
  }
}

// `>`, then one to three `#`, then a space, at a line's start.
const TOGGLE_START = /^>(#{1,3})\s$/

export const toggleHeadingInputRule = $inputRule((ctx) =>
  textblockTypeInputRule(TOGGLE_START, headingSchema.type(ctx), (match) => ({ level: match[1].length, toggle: true })),
)
