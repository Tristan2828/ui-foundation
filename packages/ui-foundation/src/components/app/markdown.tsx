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
// Headings start at <h3>: the page owns the <h1> (the record's title) and
// each section its <h2>, so a `# Heading` in the text sits under them
// instead of competing with the page's own outline.
import type { ComponentProps } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from 'cn'
import { ExternalLinkIcon, SquareCheckIcon, SquareIcon } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const REMARK_PLUGINS = [remarkGfm]

// Every element react-markdown hands over carries `node` (the syntax tree
// node). It isn't a DOM attribute, so it's dropped before spreading.
function omitNode<T extends { node?: unknown }>(props: T): Omit<T, 'node'> {
  const rest = { ...props }
  delete rest.node
  return rest
}

const COMPONENTS: Components = {
  h1: (props) => <h3 {...omitNode(props)} className="type-section-title mt-2 text-foreground" />,
  h2: (props) => <h4 {...omitNode(props)} className="type-section-title mt-2 text-foreground" />,
  h3: (props) => <h5 {...omitNode(props)} className="type-label mt-1 text-foreground" />,
  h4: (props) => <h6 {...omitNode(props)} className="type-label mt-1 text-foreground" />,
  h5: (props) => <h6 {...omitNode(props)} className="type-label mt-1 text-foreground" />,
  h6: (props) => <h6 {...omitNode(props)} className="type-label mt-1 text-foreground" />,
  a: (props) => {
    const { href, children, ...rest } = omitNode(props)
    if (!href) return <span>{children}</span>
    return (
      <a
        {...rest}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-primary underline underline-offset-4 hover:text-primary/80"
      >
        {children}
        <ExternalLinkIcon aria-hidden="true" className="ml-0.5 inline size-3 align-baseline" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    )
  },
  ul: (props) => {
    const { className, ...rest } = omitNode(props)
    const isTaskList = className?.includes('contains-task-list')
    return <ul {...rest} className={cn('flex flex-col gap-1', isTaskList ? 'list-none' : 'list-disc pl-6')} />
  },
  ol: (props) => <ol {...omitNode(props)} className="flex list-decimal flex-col gap-1 pl-6" />,
  li: (props) => {
    const { className, ...rest } = omitNode(props)
    return <li {...rest} className={cn(className?.includes('task-list-item') && 'flex items-start gap-2')} />
  },
  // A GitHub task-list box (`- [x] done`). Read-only, so a glyph with its
  // state in words, never a checkbox someone will try to tick.
  input: ({ checked }) =>
    checked ? (
      <SquareCheckIcon role="img" aria-label="Done" className="mt-0.5 size-4 shrink-0 text-foreground" />
    ) : (
      <SquareIcon role="img" aria-label="Not done" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
    ),
  blockquote: (props) => (
    <blockquote {...omitNode(props)} className="flex flex-col gap-3 border-l-2 border-border pl-4 text-muted-foreground" />
  ),
  hr: () => <hr className="border-border" />,
  pre: (props) => (
    <pre
      {...omitNode(props)}
      className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-foreground [&_code]:bg-transparent [&_code]:p-0"
    />
  ),
  code: (props) => <code {...omitNode(props)} className="rounded bg-muted px-1 py-0.5 font-mono text-foreground" />,
  img: (props) => {
    const { alt, ...rest } = omitNode(props)
    return <img {...rest} alt={alt ?? ''} loading="lazy" className="max-w-full rounded-md" />
  },
  // GFM tables use the package's own table, zebra stripes and density
  // tokens included, so a table in the notes reads like every other table.
  table: (props) => <Table {...omitNode(props)} />,
  thead: (props) => <TableHeader {...omitNode(props)} />,
  tbody: (props) => <TableBody {...omitNode(props)} />,
  tr: (props) => <TableRow {...omitNode(props)} />,
  th: (props) => <TableHead {...omitNode(props)} />,
  td: (props) => <TableCell {...omitNode(props)} />,
}

export type MarkdownProps = {
  /** The Markdown source. Raw HTML in it is shown as text, never rendered. */
  children: string
  className?: string
} & Omit<ComponentProps<'div'>, 'children'>

export function Markdown({ children, className, ...rest }: MarkdownProps) {
  return (
    <div
      data-slot="markdown"
      {...rest}
      className={cn('flex min-w-0 flex-col gap-3 type-body text-foreground break-words', className)}
    >
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
