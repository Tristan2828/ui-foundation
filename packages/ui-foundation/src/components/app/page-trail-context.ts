// The trail in AppShell's bar (#N5): a page names where it is with
// `usePageTrail`, and the shell draws it between the menu button and the
// search box. Pages that set none get their nav entry's (navTrail).
import { createContext, useContext, useLayoutEffect } from 'react'
import type { PageCrumb } from '@/components/app/page-trail'

export type PageTrailSlot = {
  /** Shows these crumbs in the bar, for the page holding `owner`. */
  set: (owner: object, crumbs: readonly PageCrumb[]) => void
  /** Takes them down again, unless a later page has put up its own. */
  clear: (owner: object) => void
}

export const PageTrailContext = createContext<PageTrailSlot | null>(null)

/**
 * Puts this page's trail in AppShell's bar: from the top (a module, say)
 * down to the page itself, last, every crumb but the last with an `href`.
 * Nothing (`undefined` or `null`) leaves the bar to the nav entry's
 * label. Returns whether there is a bar to show it, so a view outside
 * the shell can draw the trail itself.
 *
 *   usePageTrail([{ label: 'Finance', href: '/finance' }, { label: 'Accounts', href: '/finance/accounts' }, { label: 'Update balances' }])
 */
export function usePageTrail(crumbs: readonly PageCrumb[] | null | undefined): boolean {
  const slot = useContext(PageTrailContext)
  // By value, so a new array each render doesn't put the trail up again.
  const key = crumbs ? JSON.stringify(crumbs.map((crumb) => [crumb.label, crumb.href ?? null])) : null
  useLayoutEffect(() => {
    if (!slot || key === null) return
    const owner = {}
    const parsed = JSON.parse(key) as [string, string | null][]
    slot.set(
      owner,
      parsed.map(([label, href]) => (href === null ? { label } : { label, href })),
    )
    return () => slot.clear(owner)
  }, [slot, key])
  return slot !== null
}
