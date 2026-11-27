import { Fragment, type Node as ProseNode } from '@milkdown/kit/prose/model'
import type { NodeSchema } from '@milkdown/kit/transformer'

const HARD_BREAK = 'hardbreak'

// Text that is code keeps its spaces: they're part of what it says.
const isCode = (node: ProseNode) => node.marks.some((mark) => mark.type.spec.code)

/**
 * A line's spaces at its ends left out: at a text's start and end, and on
 * either side of a hard break. Markdown keeps no indent and drops spaces at
 * a line's end on reading, so these would save a note that reads back
 * without them; remark-stringify writes one at a line's start as `&#x20;`.
 * Not written out escaped instead: four spaces or a tab at a line's start
 * would read back as a code block. Inline code keeps its own. The content
 * itself when there's nothing to leave out.
 */
export function withoutLineSpaces(content: Fragment): Fragment {
  const nodes: ProseNode[] = []
  content.forEach((node) => nodes.push(node))
  let changed = false
  const trim = (index: number, side: 'start' | 'end') => {
    // Past text that is only spaces, to the text that ends the line.
    for (let at = index; at >= 0 && at < nodes.length; at += side === 'start' ? 1 : -1) {
      const node = nodes[at]
      if (!node.isText || isCode(node)) return
      const text = node.text ?? ''
      const kept = side === 'start' ? text.replace(/^[ \t]+/, '') : text.replace(/[ \t]+$/, '')
      if (kept === text) return
      changed = true
      if (kept) {
        nodes[at] = node.type.schema.text(kept, node.marks)
        return
      }
      nodes.splice(at, 1)
      if (side === 'start') at -= 1
    }
  }
  trim(0, 'start')
  trim(nodes.length - 1, 'end')
  for (let index = nodes.length - 1; index >= 0; index--) {
    if (nodes[index].type.name !== HARD_BREAK) continue
    trim(index + 1, 'start')
    trim(index - 1, 'end')
  }
  return changed ? Fragment.fromArray(nodes) : content
}

/**
 * How a paragraph goes to Markdown, past Milkdown's own:
 *
 * An empty paragraph goes with `children: []`. Milkdown's own runner opens
 * and closes the node with nothing in it, and its serializer then leaves
 * `children` out. mdast says a paragraph always has the array, and
 * mdast-util-gfm-task-list-item 2.0.1 reads its length: an empty task item
 * ("- [ ] ", Enter at a list's end) would throw there and the edit would
 * never be saved.
 *
 * And a paragraph carries no indent: spaces at the ends of its lines are
 * left out (withoutLineSpaces), so a pause after a space, or an indent
 * typed at a line's start, never saves as `&#x20;`.
 */
export function withEmptyParagraphChildren<Ctx>(previous: (ctx: Ctx) => NodeSchema): (ctx: Ctx) => NodeSchema {
  return (ctx) => {
    const base = previous(ctx)
    const runner = base.toMarkdown.runner
    return {
      ...base,
      toMarkdown: {
        ...base.toMarkdown,
        runner: (state, node) => {
          const content = withoutLineSpaces(node.content)
          const kept = content === node.content ? node : node.copy(content)
          if (kept.content.size === 0) state.addNode('paragraph', [])
          else runner(state, kept)
        },
      },
    }
  }
}
