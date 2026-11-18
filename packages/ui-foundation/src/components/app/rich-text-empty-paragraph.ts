import type { NodeSchema } from '@milkdown/kit/transformer'

/**
 * How a paragraph goes to Markdown, past Milkdown's own:
 *
 * An empty paragraph goes with `children: []`. Milkdown's own runner opens
 * and closes the node with nothing in it, and its serializer then leaves
 * `children` out. mdast says a paragraph always has the array, and
 * mdast-util-gfm-task-list-item 2.0.1 reads its length: an empty task item
 * ("- [ ] ", Enter at a list's end) threw there, and the edit was never
 * saved.
 *
 * And a paragraph's spaces at its end are left out (4.126, the
 * RichTextEditor review's F22). Markdown drops them on reading, so a pause
 * after a space saved a note that read back without it (and remark-stringify
 * sometimes wrote it as `&#x20;`). A hard break's spaces aren't these: it is
 * a node of its own.
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
          const last = node.lastChild
          const spaces = last?.isText ? (/[ \t]+$/.exec(last.text ?? '')?.[0].length ?? 0) : 0
          const kept = spaces ? node.copy(node.content.cut(0, node.content.size - spaces)) : node
          if (kept.content.size === 0) state.addNode('paragraph', [])
          else runner(state, kept)
        },
      },
    }
  }
}
