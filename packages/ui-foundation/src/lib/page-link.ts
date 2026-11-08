// Page links: a link in a note that the app says is one of its own pages
// (a child page of a record, or of another page, to any depth). The
// package never knows where pages live or how they nest: the app answers
// `pageLink(href)` for each link's address, and only it can make one
// (`onCreatePage`). The Markdown is never changed by any of this: a page
// link is an ordinary Markdown link, `[Getting Started](/notes/12/pages/3)`.
//
// Drawn by <Markdown> (markdown.tsx) and the rich-text editor
// (rich-text-page-links.ts), in the same look (styles/index.css "Page
// links in written text").

/** What the app knows about a page a link points to. */
export type PageLinkInfo = {
  /**
   * The page's title now, shown in place of the link's own words where
   * the text is read (`<Markdown>`), so a renamed page reads as renamed.
   * The editor shows the words as written, since they're what's saved.
   */
  title?: string
  /** The page is gone (deleted, in the app's bin): drawn as "Page removed". */
  removed?: boolean
  /**
   * Brings a removed page back: a Restore button beside "Page removed".
   * Return the request's promise: while it's pending the button waits,
   * and a rejection is shown as a toast in the gateway's words.
   */
  onRestore?: () => void | Promise<unknown>
}

/**
 * Says whether a link's address is one of the app's pages, and what it
 * knows about it; `null` (or `undefined`) for any other link, which stays
 * an ordinary link.
 */
export type PageLinkResolver = (href: string) => PageLinkInfo | null | undefined

/**
 * Makes a page with this title, wherever the app keeps them (under the
 * record or page whose note this is), and resolves to its address, which
 * goes into the note as `[title](href)`. A rejection leaves the note as it
 * was and shows why.
 */
export type CreatePage = (title: string) => Promise<string>

/**
 * The page icon's shape (lucide's `file-text`, 24×24, stroked): drawn as
 * the React icon in <Markdown> and as plain SVG in the editor's widget,
 * so the two match.
 */
export const PAGE_ICON_PATHS = [
  'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z',
  'M14 2v5a1 1 0 0 0 1 1h5',
  'M10 9H8',
  'M16 13H8',
  'M16 17H8',
] as const

/** A page's name for buttons and screen readers: its title, else the link's words, else "Untitled". */
export function pageName(info: PageLinkInfo, words: string): string {
  return info.title?.trim() || words.trim() || 'Untitled'
}

/** What the page-link look depends on, to tell when it must be drawn again. */
export function pageLinkSignature(info: PageLinkInfo | null | undefined): string {
  if (!info) return '-'
  return JSON.stringify([info.title ?? null, Boolean(info.removed), Boolean(info.onRestore)])
}
