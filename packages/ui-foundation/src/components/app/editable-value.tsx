// A value on a record's view that turns into its form control where it's
// shown, and saves when you leave it (cell-patterns.md "Editable value").
// EntityView wraps every field, section and title marked `edit`; a header
// badge uses <EditableValue> itself. The rules are edit-in-place-store.ts.
//
// - Start: click the value (a link inside it still navigates), or tab to
//   its edit button and press Enter. Hover and focus show it's editable.
// - Save: leave it (click or tab elsewhere), Enter on one line,
//   Ctrl/Cmd+Enter anywhere, or pick a choice. Esc puts the saved value
//   back. Unchanged closes with no request.
// - Saving: the control stays, read-only, with "Saving…" under it, until
//   the server agrees. Failed: it stays, with the draft and the reason.
import { PencilIcon } from 'lucide-react'
import { useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore, type FocusEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { useBlocker } from 'react-router'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { EditInPlaceContext, type EditControlProps, type EditInPlace } from './edit-in-place'
import type { EditInPlaceStore } from './edit-in-place-store'

// What a click on the shown value must leave alone: links navigate,
// buttons do their own thing.
const INTERACTIVE = 'a[href], button, input, select, textarea, [role="button"], [role="link"]'

// Where the caret goes once the control shows: the first match, in this
// order (a picker's text box before its chips' remove buttons).
const FOCUS_ORDER = [
  'input:not([type="hidden"]), textarea, [contenteditable="true"]',
  '[role="combobox"], [role="switch"], button, [tabindex]:not([tabindex="-1"])',
]

// Focus moving here doesn't save the field: a link that leaves the page
// (the leave prompt decides what happens to the draft) or the prompt itself.
const LEAVING = 'a[href]:not([target="_blank"]), [data-leave-guard]'

export type EditableValueProps = {
  /** The field's label: the control's accessible name, and the edit button's ("Edit Name"). */
  label: string
  edit: EditInPlace
  /** The value as the view shows it. */
  children: ReactNode
  /** `inline` in a heading or beside badges, `block` in a field row (default). */
  layout?: 'inline' | 'block'
  className?: string
}

// The field's own control, given what it needs.
function Control({ render, ...props }: EditControlProps<unknown> & { render: EditInPlace['control'] }) {
  return render(props)
}

function useStore(): EditInPlaceStore {
  const store = useContext(EditInPlaceContext)
  if (!store) throw new Error('<EditableValue> works inside an <EntityView>, which runs editing in place.')
  return store
}

export function EditableValue({ label, edit, children, layout = 'block', className }: EditableValueProps) {
  const store = useStore()
  const key = useId()
  const controlId = `${key}-control`
  const describedBy = `${key}-status`

  // The latest config, read by the store whenever it needs it.
  const config = useRef(edit)
  useLayoutEffect(() => {
    config.current = edit
  })
  useEffect(() => store.register(key, () => config.current), [store, key])

  const state = useSyncExternalStore(
    store.subscribe,
    () => store.state(key),
    () => store.state(key),
  )

  const editButton = useRef<HTMLButtonElement>(null)
  const container = useRef<HTMLSpanElement>(null)
  // Set by a keyboard save or Esc: the caret goes back to the edit button.
  const refocus = useRef(false)
  const blurTimer = useRef<number | undefined>(undefined)

  const isOpen = state.status !== 'closed'
  const wasOpen = useRef(false)
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      for (const selector of FOCUS_ORDER) {
        const target = container.current?.querySelector<HTMLElement>(selector)
        if (target) {
          target.focus()
          break
        }
      }
    }
    // Closed: the caret goes back to the value's edit button after a
    // keyboard save or Esc, or whenever closing left it nowhere (a pick
    // from a list), so the keyboard never loses its place.
    if (!isOpen && wasOpen.current && (refocus.current || document.activeElement === document.body)) {
      refocus.current = false
      editButton.current?.focus()
    }
    wasOpen.current = isOpen
  }, [isOpen])

  useEffect(() => () => window.clearTimeout(blurTimer.current), [])

  // Whether an Esc is closing a list inside the control. Read on the way
  // down (window, capture): a picker closes its list from a document
  // listener, before React sees the key, and by then it reads as closed.
  const escapeClosesList = useRef(false)
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      escapeClosesList.current = Boolean((event.target as Element | null)?.closest?.('[aria-expanded="true"]'))
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [isOpen])

  const start = useCallback(() => void store.start(key), [store, key])
  const commit = useCallback(
    (value?: unknown) => {
      window.clearTimeout(blurTimer.current)
      void store.commit(key, value)
    },
    [store, key],
  )
  const cancel = useCallback(() => store.cancel(key), [store, key])

  const onShownClick = (event: MouseEvent) => {
    if ((event.target as Element).closest(INTERACTIVE)) return
    start()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (state.status !== 'open') return
    if (event.key === 'Escape') {
      // A list open inside the control closes first; Esc again gives up.
      if (event.defaultPrevented || escapeClosesList.current) return
      event.preventDefault()
      refocus.current = true
      cancel()
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      refocus.current = true
      commit()
    } else if (event.key === 'Enter' && edit.kind === 'text' && !event.shiftKey && !event.altKey) {
      event.preventDefault()
      refocus.current = true
      commit()
    }
  }

  // Leaving the field saves it. Focus moving into the control's own list
  // (a portal) still counts as inside: React sends its focus events here.
  const onBlur = (event: FocusEvent) => {
    window.clearTimeout(blurTimer.current)
    if ((event.relatedTarget as Element | null)?.closest(LEAVING)) return
    blurTimer.current = window.setTimeout(() => {
      if (store.state(key).status === 'open') void store.commit(key)
    }, 0)
  }
  const onFocus = () => window.clearTimeout(blurTimer.current)

  if (state.status === 'closed') {
    return (
      <span
        data-slot="editable-value"
        onClick={onShownClick}
        className={cn(
          'group/editable relative -mx-1.5 cursor-text items-start gap-1 rounded-md px-1.5 transition-colors hover:bg-muted has-[[data-edit]:focus-visible]:bg-muted',
          layout === 'block' ? 'flex w-full' : 'inline-flex max-w-full align-top',
          className,
        )}
      >
        <span className="min-w-0 flex-1">{children}</span>
        <Button
          ref={editButton}
          data-edit=""
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Edit ${label}`}
          onClick={start}
          className="shrink-0 text-muted-foreground opacity-0 group-hover/editable:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
        >
          <PencilIcon />
        </Button>
      </span>
    )
  }

  const saving = state.status === 'saving'
  return (
    <span
      ref={container}
      data-slot="editable-value"
      data-state={saving ? 'saving' : state.error ? 'failed' : 'editing'}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      onFocus={onFocus}
      className={cn('flex min-w-0 flex-col gap-1.5', layout === 'block' ? 'w-full' : 'w-fit max-w-full', className)}
    >
      <Control
        render={edit.control}
        id={controlId}
        value={state.draft}
        onChange={(value) => store.change(key, value)}
        commit={commit}
        cancel={cancel}
        disabled={saving}
        invalid={!saving && state.error !== null}
        label={label}
        describedBy={describedBy}
        onProblem={(problem) => store.report(key, problem)}
      />
      <span id={describedBy} className="type-body">
        {saving ? (
          <span role="status" className="inline-flex items-center gap-1.5 type-caption text-muted-foreground">
            <Spinner aria-hidden="true" className="size-3.5" />
            Saving…
          </span>
        ) : (
          state.error && <FieldError className="type-caption">{state.error}</FieldError>
        )}
      </span>
    </span>
  )
}

/**
 * While a field holds something unsaved, leaving asks first: an in-app
 * link or Back (React Router's blocker, so the app needs a data router),
 * or closing the tab (`beforeunload`). Rendered by EntityView only while
 * a field is open, so a view nobody's editing never blocks anything.
 */
export function LeaveGuard({ store }: { store: EditInPlaceStore }) {
  const dirty = useSyncExternalStore(
    store.subscribe,
    () => store.dirty,
    () => store.dirty,
  )
  const blocker = useBlocker(({ currentLocation, nextLocation }) => store.dirty && currentLocation.pathname !== nextLocation.pathname)

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  return (
    <Dialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => {
        if (!open && blocker.state === 'blocked') blocker.reset()
      }}
    >
      <DialogContent showCloseButton={false} data-leave-guard="">
        <DialogHeader>
          <DialogTitle>Discard your changes?</DialogTitle>
          <DialogDescription>A field you're editing hasn't been saved. Leaving now loses what you typed.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Keep editing</DialogClose>
          <Button
            variant="destructive"
            onClick={() => {
              store.discard()
              if (blocker.state === 'blocked') blocker.proceed()
            }}
          >
            Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
