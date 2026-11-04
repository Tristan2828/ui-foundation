// A Markdown text's task items (GitHub's `- [ ] to do`, `- [x] done`):
// counted, for a table's "2/5" column (countTasks), and one ticked or
// unticked in the source, for <Markdown>'s `onTasksChange` (toggleTaskAt).
// Parsed as <Markdown> and the rich-text editor parse it (remark, GFM), so
// a `- [ ]` inside a code block, or a `[ ]` that isn't at an item's start,
// is never a task.
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

// The little of mdast read here (it isn't a dependency of its own).
type MdNode = {
  type: string
  checked?: boolean | null
  children?: MdNode[]
  position?: { start: { offset?: number } }
}

const parser = unified().use(remarkParse).use(remarkGfm)

export type TaskCount = {
  /** Task items ticked (`- [x]`). */
  done: number
  /** Every task item, ticked or not, nested ones included. */
  total: number
}

/**
 * How many task items the text has, and how many are ticked: nested
 * items count, plain list items don't. `{ done: 0, total: 0 }` for text
 * with none (or none at all), so a column can show nothing.
 */
export function countTasks(markdown: string | null | undefined): TaskCount {
  const count: TaskCount = { done: 0, total: 0 }
  if (!markdown) return count
  const visit = (node: MdNode) => {
    if (node.type === 'listItem' && typeof node.checked === 'boolean') {
      count.total += 1
      if (node.checked) count.done += 1
    }
    for (const child of node.children ?? []) visit(child)
  }
  visit(parser.parse(markdown) as MdNode)
  return count
}

// An item's marker and its box, from where the item starts: `- [ ]`,
// `1. [x]`, `* [X]`.
const TASK_MARKER = /^([*+-]|\d{1,9}[.)])([ \t]+)\[([ xX])\]/

/**
 * The text with the task item that starts at `offset` (its list marker's
 * place in the text, as the parser gives it) ticked when it wasn't and
 * unticked when it was. Everything else is left exactly as written. The
 * text unchanged when no task item starts there.
 */
export function toggleTaskAt(markdown: string, offset: number): string {
  const match = TASK_MARKER.exec(markdown.slice(offset))
  if (!match) return markdown
  const box = offset + match[1].length + match[2].length + 1
  const next = match[3] === ' ' ? 'x' : ' '
  return markdown.slice(0, box) + next + markdown.slice(box + 1)
}
