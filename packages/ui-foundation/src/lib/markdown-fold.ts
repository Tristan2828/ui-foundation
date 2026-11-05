// Folding a text by its headings (`foldKey` on <Markdown> and the
// rich-text editor, and NotesOutline beside them). A heading at the top
// level of the text folds everything after it up to the next heading of
// its level or higher: a `##` folds its paragraphs and its `###`s, and
// stops at the next `##` or `#`. Headings inside a quote or a callout
// don't fold.
//
// Folding is the reader's, never the text's: what's folded is a set of
// heading ids, kept on the device (src/hooks/fold-store.ts), and the
// Markdown is never touched. A heading's id is its level and its words
// (`2:Safety`), with `#2`, `#3` added for the second and third heading of
// the same level and words, so the same heading gets the same id in
// <Markdown>, in the editor and in the outline, and keeps it while the
// text around it changes. Renaming a heading opens it.
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

/** A top-level heading, by its level (1 for `#`) and its words. */
export type FoldHeadingInput = { level: number; text: string }

/** A top-level heading as folding sees it. */
export type FoldHeading = FoldHeadingInput & {
  /** Its id in the fold state. */
  id: string
  /** Its index among the text's top-level blocks. */
  index: number
  /** It has something under it to fold. */
  foldable: boolean
  /** The ids of the headings it sits under, outermost first. */
  parents: string[]
  /** The index of the first top-level block after its section (the text's length at the end). */
  end: number
}

/** The plan for a text's top-level blocks: which are headings, which are folded away. */
export type FoldPlan = {
  headings: FoldHeading[]
  /** Indexes of the top-level blocks hidden by a folded heading. */
  hidden: Set<number>
}

function words(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * The plan for a text whose top-level blocks are `blocks`: each one a
 * heading (`{ level, text }`) or `null`. `folded` is the ids folded now.
 */
export function foldPlan(blocks: readonly (FoldHeadingInput | null)[], folded: ReadonlySet<string> = new Set()): FoldPlan {
  const headings: FoldHeading[] = []
  const hidden = new Set<number>()
  const seen = new Map<string, number>()
  // The headings the current block sits under, outermost first.
  const open: FoldHeading[] = []
  blocks.forEach((block, index) => {
    if (block) while (open.length > 0 && open[open.length - 1].level >= block.level) open.pop()!.end = index
    if (open.some((heading) => folded.has(heading.id))) hidden.add(index)
    // Anything after a heading, before one of its level or higher, is its section.
    if (open.length > 0) open[open.length - 1].foldable = true
    if (!block) return
    const text = words(block.text)
    const base = `${block.level}:${text}`
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    const heading: FoldHeading = {
      level: block.level,
      text,
      id: count === 1 ? base : `${base}#${count}`,
      index,
      foldable: false,
      parents: open.map((one) => one.id),
      end: blocks.length,
    }
    headings.push(heading)
    open.push(heading)
  })
  return { headings, hidden }
}

// The little of mdast read here (it isn't a dependency of its own).
export type MdFoldNode = {
  type: string
  depth?: number
  value?: string
  children?: MdFoldNode[]
}

/** A heading's words as the editor reads them: its text and inline code (not raw HTML, not image alt text). */
export function mdText(node: MdFoldNode): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? ''
  if (node.type === 'break') return ' '
  return (node.children ?? []).map(mdText).join('')
}

/** The top-level blocks of an mdast root, as foldPlan takes them. */
export function mdBlocks(root: MdFoldNode): (FoldHeadingInput | null)[] {
  return (root.children ?? []).map((node) =>
    node.type === 'heading' && node.depth ? { level: node.depth, text: mdText(node) } : null,
  )
}

const parser = unified().use(remarkParse).use(remarkGfm)

/** The fold plan for a Markdown text, parsed as <Markdown> and the editor parse it. */
export function markdownFoldPlan(markdown: string, folded?: ReadonlySet<string>): FoldPlan {
  return foldPlan(mdBlocks(parser.parse(markdown) as MdFoldNode), folded)
}

/** Every heading with something to fold: Fold all. */
export function allFoldable(plan: FoldPlan): Set<string> {
  return new Set(plan.headings.filter((heading) => heading.foldable).map((heading) => heading.id))
}

/** `folded` with the heading `id` and every heading it sits under opened: a jump to it. */
export function openTo(plan: FoldPlan, folded: ReadonlySet<string>, id: string): Set<string> {
  const heading = plan.headings.find((one) => one.id === id)
  const next = new Set(folded)
  if (!heading) return next
  for (const parent of heading.parents) next.delete(parent)
  return next
}

/** `folded` with every heading whose section holds the top-level block at `index` opened: the caret moved into it. */
export function openAt(plan: FoldPlan, folded: ReadonlySet<string>, index: number): Set<string> {
  const next = new Set(folded)
  for (const heading of plan.headings) if (heading.index < index && index < heading.end) next.delete(heading.id)
  return next
}

/** `folded` with `id` turned the other way. */
export function toggleFold(folded: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(folded)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

// The little of hast read here.
type HastNode = {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

function hastText(node: HastNode): string {
  if (node.type === 'text') return node.value ?? ''
  if (node.type === 'element' && node.tagName === 'br') return ' '
  if (node.type !== 'element') return ''
  return (node.children ?? []).map(hastText).join('')
}

const HEADING = /^h([1-6])$/

/**
 * For <Markdown> (react-markdown's rehype plugins): marks each top-level
 * heading with its fold id and state, and hides every top-level block a
 * folded heading covers (`hidden`). Raw HTML at the top level, which
 * <Markdown> shows as its characters, is hidden as a paragraph of the same
 * characters. GFM's footnotes, gathered at the end, are never hidden.
 */
export function rehypeFold(options: { folded: ReadonlySet<string> }) {
  return (tree: unknown) => {
    const root = tree as HastNode
    const children = root.children ?? []
    // The blocks: the root's elements and raw HTML; the line breaks between them aren't.
    const at: number[] = []
    children.forEach((node, index) => {
      if (node.type === 'element' || node.type === 'raw') at.push(index)
    })
    const blocks = at.map((index) => {
      const node = children[index]
      const level = node.type === 'element' ? HEADING.exec(node.tagName ?? '')?.[1] : undefined
      return level ? { level: Number(level), text: hastText(node) } : null
    })
    const plan = foldPlan(blocks, options.folded)
    for (const heading of plan.headings) {
      const node = children[at[heading.index]]
      node.properties = {
        ...node.properties,
        dataFoldId: heading.id,
        dataFoldLabel: heading.text,
        dataFoldable: String(heading.foldable),
        dataFolded: String(heading.foldable && options.folded.has(heading.id)),
      }
    }
    for (const block of plan.hidden) {
      const index = at[block]
      let node = children[index]
      if (node.properties?.dataFootnotes !== undefined) continue
      if (node.type === 'raw') {
        node = { type: 'element', tagName: 'p', properties: {}, children: [{ type: 'text', value: node.value ?? '' }] }
        children[index] = node
      }
      node.properties = { ...node.properties, hidden: true }
    }
  }
}
