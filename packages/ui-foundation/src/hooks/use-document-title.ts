import { useEffect, useId } from 'react'

// The browser tab's title, "<page> · <app>", from two sources that can
// arrive in either order: AppShell's (the app's name, and the page its nav
// names for the current path) and the views' own (useDocumentTitle, and
// EntityView's record once it loads). A view's title wins over the nav's
// while that view is mounted, whichever was set first, and the nav's comes
// back when it goes. With neither, the tab keeps the title it had before
// (index.html's).
//
// createDocumentTitles takes the document, so the rules are unit tested
// against a fake one (tests/use-document-title.test.ts).

export const DOCUMENT_TITLE_SEPARATOR = ' · '

type TitleTarget = { title: string }

export type DocumentTitles = {
  /** AppShell's: the app's name and the nav's page (none on the home page). `null` once it unmounts. */
  setShell: (shell: { app: string; page?: string } | null) => void
  /** A view's page title, by the view's id. `undefined` (not loaded yet) leaves the tab to the others; its place is kept. */
  setView: (id: string, page: string | undefined) => void
  /** The view unmounted. */
  releaseView: (id: string) => void
}

export function createDocumentTitles(target: TitleTarget): DocumentTitles {
  let shell: { app: string; page?: string } | null = null
  // In the order views first set a title: the latest one showing wins.
  const views = new Map<string, string | undefined>()
  // The title before anything here set one, put back once nothing sets one.
  let before: string | null = null

  function apply() {
    const view = [...views.values()].reverse().find((page) => page)
    const page = view ?? shell?.page
    const title = shell ? (page ? `${page}${DOCUMENT_TITLE_SEPARATOR}${shell.app}` : shell.app) : page
    if (title) {
      before ??= target.title
      target.title = title
    } else if (before !== null) {
      target.title = before
      before = null
    }
  }

  return {
    setShell(next) {
      shell = next
      apply()
    },
    setView(id, page) {
      views.set(id, page || undefined)
      apply()
    },
    releaseView(id) {
      views.delete(id)
      apply()
    },
  }
}

// One per page, made on first use (never while rendering on a server).
let documentTitles: DocumentTitles | undefined
const titles = () => (documentTitles ??= createDocumentTitles(document))

/**
 * Names the browser tab after this screen while it's mounted: "New Widget"
 * reads "New Widget · <app>" inside `AppShell`. Wins over the page the nav
 * names, whichever arrives first; when the screen goes, the nav's title
 * comes back. `undefined` (a record still loading) leaves the nav's.
 * `EntityView` already does this with its `title`.
 */
export function useDocumentTitle(title: string | undefined): void {
  const id = useId()
  // Two effects, so a changed title keeps this screen's place among others
  // and only unmounting gives it up.
  useEffect(() => {
    titles().setView(id, title)
  }, [id, title])
  useEffect(() => () => titles().releaseView(id), [id])
}

/** AppShell's side: the app's name and the page its nav names. */
export function useShellDocumentTitle(app: string, page: string | undefined): void {
  useEffect(() => {
    titles().setShell({ app, page })
  }, [app, page])
  useEffect(() => () => titles().setShell(null), [])
}
