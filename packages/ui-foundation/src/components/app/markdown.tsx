// Long text written as Markdown, rendered to read: headings, lists, links,
// tables (GitHub-flavoured), code and quotes, in the design language's
// type roles and tokens. A record's notes on its view (EntityView) are the
// first use.
//
// Safe by default, and kept that way on purpose:
// - Raw HTML is never rendered. react-markdown escapes it, so `<b>` in the
//   text shows as the characters `<b>`, never as markup, and nothing the
//   author typed silently disappears. Never add rehype-raw.
// - URLs go through react-markdown's default urlTransform, which drops
//   `javascript:` and other unsafe protocols. A link left with no URL
//   renders as its text.
// - Links open in a new tab, so following one never leaves the record.
//
// Headings start at <h3> by default: the page owns the <h1> (the
// record's title) and each section its <h2>, so a `# Heading` in the text
// sits under them instead of competing with the page's own outline. Text
// that sits elsewhere says so with `headingLevel`, the level `#` renders
// as (2 straight under the page's <h1>), each level below it one deeper,
// never past <h6>, so the page's outline never skips a level (axe's
// heading-order). They look like what they are in the text, wherever they
// sit: `#` and `##` on a tinted band, `###` a small uppercase label, and
// the text under them lined up with the words in the band (prose-look.ts).
//
// A table wider than the text scrolls sideways, and while it does, its
// box is a tab stop, named for its columns, that the arrow keys scroll
// (prose-table-scroll.ts). Its cells wrap first, so that's only a table
// with many columns, or a long word in one.
//
// An image (`![alt](url)`, one the rich-text editor uploaded) stays inside
// the text's width, loads only as it nears the screen, and keeps its alt
// text; with none (`![](url)`) it's decorative to a screen reader. Its
// address goes through the same urlTransform: a web address or a path on
// the site (`/api/files/7/content`), never `javascript:` or `data:`.
//
// A quote that starts `[!NOTE]` (GitHub's alert syntax) is a callout: a
// tinted box with its kind's icon (src/lib/markdown-callout.ts).
//
// `==words==` is highlighted words (amber, or `=={green}words==`: yellow,
// green, red): a <mark> on the colour's wash (src/lib/markdown-highlight.ts).
//
// With `foldKey`, each heading at the text's top level has a button before
// it that folds its section away (src/lib/markdown-fold.ts), remembered on
// this device under the key and shared with an editor or NotesOutline
// given the same one. The text itself is never changed.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ComponentProps } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import type { PluggableList } from 'unified'
import remarkGfm from 'remark-gfm'
import { cn } from 'cn'
import { ChevronDownIcon, ExternalLinkIcon, SquareCheckIcon, SquareIcon } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useFolds } from '@/hooks/fold-store'
import { CALLOUT_KINDS, remarkCallouts, type CalloutKind } from '@/lib/markdown-callout'
import { rehypeFold, toggleFold } from '@/lib/markdown-fold'
import { isHighlightColor, remarkHighlights } from '@/lib/markdown-highlight'
import { textTopHeading } from '@/lib/markdown-top-heading'
import {
  CALLOUT_BOX,
  CALLOUT_LOOK,
  DEFAULT_HEADING_LEVEL,
  FOLD_BUTTON,
  FOLD_HEADING,
  headingBand,
  headingClass,
  headingTag,
  PROSE,
  PROSE_INSET,
  type HeadingFrom,
  type HeadingLevel,
} from './prose-look'
import { headerTexts, TABLE_SCROLL_FOCUS, watchTableScroll } from './prose-table-scroll'

const REMARK_PLUGINS = [remarkGfm, remarkCallouts, remarkHighlights]

const HIGHLIGHT_WASH = {
  amber: 'bg-highlight-amber',
  yellow: 'bg-highlight-yellow',
  green: 'bg-highlight-green',
  red: 'bg-highlight-red',
}

function isCalloutKind(value: unknown): value is CalloutKind {
  return CALLOUT_KINDS.includes(value as CalloutKind)
}

// Every element react-markdown hands over carries `node` (the syntax tree
// node). It isn't a DOM attribute, so it's dropped before spreading.
function omitNode<T extends { node?: unknown }>(props: T): Omit<T, 'node'> {
  const rest = { ...props }
  delete rest.node
  return rest
}

// A GFM table in the package's own table, in its box that scrolls
// sideways: a tab stop and a named region only while the table overflows
// it. Watched again after each render, so a header row with new words
// renames it.
function NotesTable({ hidden, ...props }: ComponentProps<'table'>) {
  const boxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const table = box.querySelector('table')
    const region = watchTableScroll(box, table, headerTexts(table))
    return () => region.destroy()
  })
  return (
    <Table
      {...props}
      containerRef={boxRef}
      // Folded away, the box goes with the table.
      containerClassName={cn('rounded-lg border border-border', TABLE_SCROLL_FOCUS, hidden && 'hidden')}
    />
  )
}

// Folds a section by its heading's id: given only with `foldKey`.
const FoldContext = createContext<((id: string) => void) | null>(null)

type HeadingProps = ComponentProps<'h1'> & {
  'data-fold-id'?: string
  'data-foldable'?: string
  'data-folded'?: string
  'data-fold-label'?: string
}

// A heading by its Markdown level: the element the page's outline gives
// it (headingTag), the look its level has. The text's colour first, so a
// level's own (`###`'s muted label) wins. With `foldKey`, a top-level one
// (marked by rehypeFold) sits beside its fold button, the look on the two
// together; one with nothing under it keeps the button's room, so its
// words line up with the others'.
function heading(level: number, top: HeadingLevel, textTop: number): Components['h1'] {
  const Tag = headingTag(level, top, textTop)
  return function Heading(props) {
    const toggle = useContext(FoldContext)
    const {
      'data-fold-id': foldId,
      'data-foldable': foldable,
      'data-folded': folded,
      'data-fold-label': label,
      hidden,
      ...rest
    } = omitNode(props) as HeadingProps
    const look = cn('text-foreground', headingClass(level))
    const band = headingBand(level) || undefined
    if (!toggle || foldId === undefined) return <Tag {...rest} hidden={hidden} data-band={band} className={look} />
    const open = folded !== 'true'
    return (
      <div data-fold-id={foldId} hidden={hidden} data-band={band} className={cn(FOLD_HEADING, look)}>
        {foldable === 'true' ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={label || 'Section'}
            data-slot="fold-button"
            className={FOLD_BUTTON}
            onClick={() => toggle(foldId)}
          >
            <ChevronDownIcon aria-hidden="true" className={cn('size-4 transition-transform', !open && '-rotate-90')} />
          </button>
        ) : (
          <span aria-hidden="true" className="-ml-1 w-5 shrink-0" />
        )}
        <Tag {...rest} className="min-w-0 flex-1" />
      </div>
    )
  }
}

// Everything but the headings, which follow `headingLevel` (componentsFor).
const COMPONENTS: Components = {
  a: (props) => {
    const { href, children, ...rest } = omitNode(props)
    if (!href) return <span>{children}</span>
    return (
      <a
        {...rest}
        href={href}
        target="_blank"
        rel="noreferrer"
        className={PROSE.link}
      >
        {children}
        <ExternalLinkIcon aria-hidden="true" className="ml-0.5 inline size-3 align-baseline" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    )
  },
  // A list can mix plain and task items (`- a` then `- [ ] b` is one
  // list): each task item drops its own bullet, the rest keep theirs. Its
  // box is inline, so a loose list's item (its text in a <p>) lays out
  // the same as a tight one's.
  ul: (props) => <ul {...omitNode(props)} className="flex list-disc flex-col gap-1 pl-6" />,
  ol: (props) => <ol {...omitNode(props)} className="flex list-decimal flex-col gap-1 pl-6" />,
  li: (props) => {
    const { className, ...rest } = omitNode(props)
    return <li {...rest} className={cn(className?.includes('task-list-item') && '-ml-6 list-none')} />
  },
  // A GitHub task-list box (`- [x] done`). Read-only, so a glyph with its
  // state in words, never a checkbox someone will try to tick.
  input: ({ checked }) =>
    checked ? (
      <SquareCheckIcon role="img" aria-label="Done" className="mr-2 inline-block size-4 align-[-0.1875rem] text-foreground" />
    ) : (
      <SquareIcon role="img" aria-label="Not done" className="mr-2 inline-block size-4 align-[-0.1875rem] text-muted-foreground" />
    ),
  blockquote: (props) => (
    <blockquote {...omitNode(props)} className="flex flex-col gap-3 border-l-2 border-border pl-4 text-muted-foreground" />
  ),
  hr: ({ hidden }) => <hr hidden={hidden} className={PROSE.rule} />,
  // Highlighted words (remarkHighlights marks them): the colour's wash.
  mark: (props) => {
    const { children, ...rest } = omitNode(props)
    const color = (rest as Record<string, unknown>)['data-color']
    return (
      <mark {...rest} className={cn('rounded-sm text-foreground', isHighlightColor(color) ? HIGHLIGHT_WASH[color] : 'bg-highlight-amber')}>
        {children}
      </mark>
    )
  },
  // A callout (remarkCallouts marks it): its kind's wash and icon, named
  // for screen readers by the kind ("Note: …").
  div: (props) => {
    const { children, ...rest } = omitNode(props)
    const kind = (rest as Record<string, unknown>)['data-callout']
    if (!isCalloutKind(kind)) return <div {...rest}>{children}</div>
    const look = CALLOUT_LOOK[kind]
    const Icon = look.icon
    return (
      <div role="note" data-callout={kind} hidden={rest.hidden} className={cn(CALLOUT_BOX, look.box)}>
        <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', look.tint)} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="sr-only">{look.label}: </span>
          {children}
        </div>
      </div>
    )
  },
  pre: (props) => (
    <pre
      {...omitNode(props)}
      className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-foreground [&_code]:bg-transparent [&_code]:p-0"
    />
  ),
  code: (props) => <code {...omitNode(props)} className="rounded bg-muted px-1 py-0.5 font-mono text-foreground" />,
  img: (props) => {
    const { alt, ...rest } = omitNode(props)
    return <img {...rest} alt={alt ?? ''} loading="lazy" className="h-auto max-w-full rounded-md" />
  },
  // GFM tables use the package's own table, zebra stripes and density
  // tokens included, so a table in the notes reads like every other table.
  table: (props) => <NotesTable {...omitNode(props)} />,
  thead: (props) => <TableHeader {...omitNode(props)} className="bg-muted" />,
  tbody: (props) => <TableBody {...omitNode(props)} />,
  tr: (props) => <TableRow {...omitNode(props)} />,
  // Notes' cells wrap (a cell can hold a sentence) and have a line
  // between columns, so a wide table still reads column by column.
  th: (props) => <TableHead {...omitNode(props)} className="border-r border-border whitespace-normal last:border-r-0" />,
  td: (props) => <TableCell {...omitNode(props)} className="border-r border-border whitespace-normal last:border-r-0" />,
}

// The components for each `headingLevel` and level that takes it (`#`,
// or the text's highest with `headingFrom="text"`), made once each.
const BY_LEVEL = new Map<string, Components>()
function componentsFor(top: HeadingLevel, textTop: number): Components {
  const key = `${top}:${textTop}`
  let components = BY_LEVEL.get(key)
  if (!components) {
    components = { ...COMPONENTS }
    for (const level of [1, 2, 3, 4, 5, 6] as const) components[`h${level}`] = heading(level, top, textTop)
    BY_LEVEL.set(key, components)
  }
  return components
}

export type MarkdownProps = {
  /** The Markdown source. Raw HTML in it is shown as text, never rendered. */
  children: string
  /**
   * The HTML level the text's `#` renders as, where the text sits in the
   * page's outline: 2 straight under the page's <h1>, 3 (the default)
   * under a section's <h2>. `##` is one below it, `###` two below, never
   * past <h6>. Only the element changes: each level looks the same.
   */
  headingLevel?: HeadingLevel
  /**
   * Which heading takes `headingLevel`: `'hash'` (the default), `#`;
   * `'text'`, the text's own highest, for notes that start at `##` (an
   * import, a paste). The rest keep their distance from it. The text
   * itself is never rewritten.
   */
  headingFrom?: HeadingFrom
  /**
   * Folds the text by its headings: each heading at its top level gets a
   * button that folds what's under it (to the next heading of its level
   * or higher). What's folded is remembered on this device under this key
   * (name it for the app and the record: `"my-app:task:84:notes"`), and
   * shared with a RichTextEditor or NotesOutline given the same key. The
   * text is never changed.
   */
  foldKey?: string
  className?: string
} & Omit<ComponentProps<'div'>, 'children'>

export function Markdown({
  children,
  headingLevel = DEFAULT_HEADING_LEVEL,
  headingFrom = 'hash',
  foldKey,
  className,
  ...rest
}: MarkdownProps) {
  const textTop = useMemo(() => (headingFrom === 'text' ? textTopHeading(children) : 1), [headingFrom, children])
  const components = useMemo(() => componentsFor(headingLevel, textTop), [headingLevel, textTop])
  const [folded, setFolded] = useFolds(foldKey)
  const rehypePlugins = useMemo<PluggableList>(() => (foldKey === undefined ? [] : [[rehypeFold, { folded }]]), [foldKey, folded])
  const toggle = useCallback((id: string) => setFolded(toggleFold(folded, id)), [folded, setFolded])
  return (
    <div
      data-slot="markdown"
      data-fold-scope={foldKey}
      {...rest}
      className={cn('flex min-w-0 flex-col gap-3 type-body text-foreground break-words', PROSE_INSET, className)}
    >
      <FoldContext.Provider value={foldKey === undefined ? null : toggle}>
        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={rehypePlugins} components={components}>
          {children}
        </ReactMarkdown>
      </FoldContext.Provider>
    </div>
  )
}
