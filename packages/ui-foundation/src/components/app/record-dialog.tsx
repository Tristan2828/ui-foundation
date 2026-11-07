// A record opened in a centered dialog over its list, instead of going to
// the record's page (add-an-entity.md "How a list opens a record").
//
// RecordDialogRoute is the list route's element, and the record's route is
// its child:
//
//   { path: 'widgets', element: <RecordDialogRoute list={<WidgetsTableRoute />} label="Widget" />,
//     children: [{ path: ':id', element: <WidgetViewRoute /> }] }
//
// The address is the record's own (`/widgets/3`) either way; what decides
// dialog or page is the history entry's state, which `useOpenRecord`,
// `<RecordLink>` and `recordDialogState` put there
// (record-dialog-context.ts). So:
//
// - opened from the list, the record is a dialog over the list, and the
//   list stays mounted underneath at its own address (filters, sort, page
//   and scroll as they were);
// - Back, Esc, the backdrop and Close all go back to the list's entry;
// - "Open full page" swaps the entry for the same address with no state;
// - a deep link (pasted, bookmarked, a new tab) has no state and is the
//   full page, as is a record opened over a list other than its own
//   (a link on the home page).
//
// `fullPage={false}` is a record with no page of its own (a dialog only:
// a small record with no notes, where a page would only repeat the
// dialog). There's no Open full page, and a deep link or a link from
// another page opens the dialog over its own list, at the list's plain
// address.
//
// A list that isn't the record's parent route (`listPath`, 4.72): the
// list at /things/list, the record at /things/12, siblings. The route the
// two share wraps them, its `list` drawn at `listPath` (whose own route
// has no element) and every other child the record:
//
//   { path: 'things', element: <RecordDialogRoute list={<ThingsList />} listPath="list" label="Thing" />,
//     children: [{ path: 'list' }, { path: ':id', element: <ThingView /> }] }
//
// Opened from the list, /things/12 is the dialog over /things/list, and
// closing goes back to it; a deep link is the full page, as above.
//
// A sub-record over its parent's page (4.72) is the same route one level
// down: the parent's page is the `list`, the sub-record its child, and
// `fullPage={false}`, so a reload of /parents/7/children/31 is the dialog
// over the parent again:
//
//   { path: 'parents/:id', element: <RecordDialogRoute list={<ParentView />} label="Document" fullPage={false} />,
//     children: [{ path: 'children/:childId', element: <ChildView /> }] }
//
// Inside, the record's route renders as it always does. EntityView sees
// the dialog (useRecordDialog): its heading names the dialog, its back link
// gives way to the dialog's own bar, and not found's way out closes the
// dialog. Its loading, error and not-found states are the dialog's.
import { useCallback, useId, useMemo, type ComponentProps, type ReactNode } from 'react'
import {
  Link,
  UNSAFE_LocationContext as LocationContext,
  useLocation,
  useNavigate,
  useNavigationType,
  useOutlet,
  useResolvedPath,
} from 'react-router'
import { Maximize2Icon, XIcon } from 'lucide-react'
import { cn } from 'cn'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog'
import { escapePassedThrough } from './escape-passthrough'
import { backgroundOf, recordDialogState, RecordDialogContext } from './record-dialog-context'

export type RecordDialogRouteProps = {
  /** The list's own element (the table route), drawn under an open record. */
  list: ReactNode
  /**
   * What one record is ("Widget"): the dialog's name while the record
   * loads, fails or isn't found. Once it loads, its title names the dialog.
   */
  label: string
  /** Extra classes on the dialog's popup (its width, say: `sm:max-w-5xl`). */
  className?: string
  /**
   * False: the record has no full page, only this dialog (DataTable's
   * `opens` kind `dialog-only`). No Open full page, and its address opened
   * any other way (a deep link, a link from another page) is the dialog
   * over the list. True by default.
   */
  fullPage?: boolean
  /**
   * Where the list lives when it isn't this route's own address: a child
   * route of this one with no element (`'list'` for `/things/list`), or
   * an absolute path under it. This route's other children are its
   * records (`/things/12`), drawn over the list when opened from it. Left
   * out, the list is this route's own address and its children are the
   * records (the nested pattern).
   */
  listPath?: string
}

// Two paths are the same address, give or take a trailing slash.
const samePath = (a: string, b: string) => a.replace(/\/+$/, '') === b.replace(/\/+$/, '')

export function RecordDialogRoute({ list, label, className, fullPage = true, listPath: listAt }: RecordDialogRouteProps) {
  const location = useLocation()
  const navigationType = useNavigationType()
  const navigate = useNavigate()
  const childOutlet = useOutlet()
  const titleId = useId()
  const listPath = useResolvedPath(listAt ?? '.').pathname
  // With `listPath`, its own (element-less) child is the list, not a record.
  const atList = listAt !== undefined && samePath(location.pathname, listPath)
  const outlet = atList ? null : childOutlet
  const opened = backgroundOf(location.state)
  // Over its own list only: opened from anywhere else, the list under it
  // would be a page the user wasn't on.
  // With no full page, a record opened any other way is the dialog over
  // the list's plain address, with nothing to go back over.
  const background =
    opened && samePath(opened.pathname, listPath)
      ? opened
      : !fullPage && outlet !== null
        ? { pathname: listPath, search: '', hash: '', depth: 0 }
        : null
  const open = outlet !== null && background !== null

  // The list sees the address it was opened from, not the record's, so
  // its URL state (filters, sort, page) stays as it was under the dialog.
  const { pathname, search, hash } = background ?? location
  const listLocation = useMemo(
    () => ({ pathname, search, hash, state: null, key: open ? 'record-dialog-list' : location.key }),
    [pathname, search, hash, open, location.key],
  )
  const listContext = useMemo(() => ({ location: listLocation, navigationType }), [listLocation, navigationType])

  const depth = background?.depth ?? 0
  const close = useCallback(() => {
    if (location.key === 'default' || depth === 0) {
      // The first entry in this tab (a restored session): nothing to go
      // back over, so the list's address replaces the record's.
      void navigate({ pathname, search, hash }, { replace: true })
    } else void navigate(-depth)
  }, [navigate, location.key, depth, pathname, search, hash])
  const dialog = useMemo(() => ({ titleId, close }), [titleId, close])

  // The record's full page: a deep link, or "Open full page".
  if (outlet !== null && !open) return outlet
  // `listPath` given and this route's own address (no index route): there
  // is no list here to draw.
  if (listAt !== undefined && outlet === null && !atList) return null

  return (
    <>
      <LocationContext.Provider value={listContext}>{list}</LocationContext.Provider>
      <Dialog
        open={open}
        onOpenChange={(next, details) => {
          if (next) return
          // An Esc something inside already used (a field edited in place
          // giving up, a picker closing its list) isn't the dialog's. The
          // rich-text editor marks every Esc used, and passes on the ones
          // its menus didn't take.
          const native = details.event
          if (details.reason === 'escape-key' && native.defaultPrevented && !escapePassedThrough(native)) {
            details.cancel()
            return
          }
          close()
        }}
      >
        <DialogContent
          showCloseButton={false}
          // Named by the record's heading once it shows (EntityView puts
          // `titleId` on it); until then, by `label`.
          aria-labelledby={titleId}
          aria-label={label}
          data-slot="record-dialog"
          className={cn(
            'flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl data-closed:hidden',
            className,
          )}
        >
          <div className={cn('flex items-center gap-2 border-b px-2 py-2', fullPage ? 'justify-between' : 'justify-end')}>
            {/* A link, not a button: it goes to an address (and opens in a new tab on Ctrl/Cmd+click). */}
            {fullPage && (
              <Link
                to={{ pathname: location.pathname, search: location.search, hash: location.hash }}
                replace
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                <Maximize2Icon aria-hidden="true" />
                Open full page
              </Link>
            )}
            <DialogClose render={<Button variant="ghost" size="icon-sm" />}>
              <XIcon aria-hidden="true" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
          <div data-slot="record-dialog-body" className="min-h-0 overflow-y-auto p-4 sm:p-6">
            <RecordDialogContext.Provider value={dialog}>{open && outlet}</RecordDialogContext.Provider>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export type RecordLinkProps = Omit<ComponentProps<typeof Link>, 'state'>

/**
 * A link to a record that opens it over the current list (a board's card,
 * a name in a cell). Ctrl/Cmd+click and a new tab still get the full page:
 * the state only travels with an in-app navigation.
 */
export function RecordLink(props: RecordLinkProps) {
  const location = useLocation()
  return <Link {...props} state={recordDialogState(location)} />
}
