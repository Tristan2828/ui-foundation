import type { NodeSchema } from '@milkdown/kit/transformer'

/**
 * An empty paragraph goes to Markdown with `children: []`. Milkdown's own
 * runner opens and closes the node with nothing in it, and its serializer
 * then leaves `children` out. mdast says a paragraph always has the
 * array, and mdast-util-gfm-task-list-item 2.0.1 reads its length: an
 * empty task item ("- [ ] ", Enter at a list's end) threw there, and the
 * edit was never saved.
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
          if (node.content.size === 0) state.addNode('paragraph', [])
          else runner(state, node)
        },
      },
    }
  }
}
