// A page link as <Markdown> draws it (src/lib/page-link.ts says what one
// is): the page icon and the page's title, a link to the page in this tab
// (through the router when there is one), or, for a page the app reports
// removed, "Page removed" and a Restore button. A paragraph that holds
// only a page link is a page line, a row of its own (markdown.tsx marks
// it). The look: styles/index.css "Page links in written text".
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useInRouterContext } from 'react-router'
import { Button } from '@/components/ui/button'
import { PAGE_ICON_PATHS, pageName, type PageLinkInfo } from '@/lib/page-link'
import { restorePage } from './page-restore'

/** The page icon, drawn from the same shape as the editor's (PAGE_ICON_PATHS). */
export function PageIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="page-link-icon"
    >
      {PAGE_ICON_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

function RestorePageButton({ info, name }: { info: PageLinkInfo; name: string }) {
  const [busy, setBusy] = useState(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  return (
    <Button
      variant="outline"
      size="xs"
      disabled={busy}
      aria-label={`Restore ${name}`}
      data-slot="page-restore"
      // Restoring is all it does: a click never reaches whatever the text
      // sits in (a card that opens the record).
      onClick={(event) => {
        event.stopPropagation()
        setBusy(true)
        void restorePage(info, name).then(() => mounted.current && setBusy(false))
      }}
    >
      {busy ? 'Restoring…' : 'Restore'}
    </Button>
  )
}

export type PageLinkViewProps = {
  href: string
  info: PageLinkInfo
  /** The link's own words, as plain text (a removed page's name, when the app gives no title). */
  words: string
  /** The link's own words, as rendered: shown when the app gives no title. */
  children: ReactNode
}

export function PageLinkView({ href, info, words, children }: PageLinkViewProps) {
  const inRouter = useInRouterContext()
  const name = pageName(info, words)
  const title = info.title?.trim() ? info.title.trim() : children
  if (info.removed)
    return (
      <span data-slot="page-link" data-removed="" className="page-link-removed">
        <PageIcon />
        <span className="page-link-title">{title}</span>
        <span className="page-removed-note">Page removed</span>
        {info.onRestore && <RestorePageButton info={info} name={name} />}
      </span>
    )
  const content = (
    <>
      <PageIcon />
      {title}
    </>
  )
  // A page of the app's own opens here, not in a new tab like other links.
  return inRouter ? (
    <Link to={href} data-slot="page-link" className="page-link">
      {content}
    </Link>
  ) : (
    <a href={href} data-slot="page-link" className="page-link">
      {content}
    </a>
  )
}
