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
// - `autosave`: it saves itself a pause after typing stops and stays
//   editable while it does ("Saving…", then "Saved" under it). Leaving,
//   Ctrl/Cmd+Enter and Esc save what's left now and close it.
// - `alwaysEditable`: the control is shown at rest, with no pencil and no
//   click to open, and never closes. Ctrl/Cmd+Enter and Esc save now.
// - `inline`: always editable, and the control is told to look like the
//   value it edits (`inline` among its props).
// - Saved (4.88, F16): once a save lands, "✓ Saved" shows beside the value
//   for two seconds (`role="status"`).
// - `layout="inline"` (4.102): the pencil takes no room until hover or
//   focus, so nothing gaps before what follows the value on its line.
// - `look="row"` (4.88, F15 and F18): in a record's field list the row is
//   the target (edit-row.ts): it wears the list's row hover and the pencil
//   sits at its end; under 48rem or on a touch screen there's a chevron
//   instead of the pencil. The control still opens in the row.
import { CheckIcon, ChevronRightIcon, PencilIcon } from 'lucide-react'
import { useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type FocusEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { useBlocker } from 'react-router'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { DiscardChangesDialog } from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { EditInPlaceContext, type EditControlProps, type EditInPlace } from './edit-in-place'
import type { EditInPlaceStore } from './edit-in-place-store'
import { SAVED_FOR_MS } from './edit-row'
import { escapePassedThrough } from './escape-passthrough'

// What a click on the shown value must leave alone: links navigate,
// buttons and boxes do their own thing (a list item's done box ticks it).
const INTERACTIVE =
  'a[href], button, input, select, textarea, label, [role="button"], [role="link"], [role="checkbox"], [role="switch"]'

// Where the caret goes once the control shows: the first match, in this
// order (a picker's text box before its chips' remove buttons). A box's
// own native input (a checkbox's, hidden and out of the tab order) isn't
// a place to type: a list item's text box comes first.
const FOCUS_ORDER = [
  'input:not([type="hidden"]):not([tabindex="-1"]):not([aria-hidden="true"]), textarea, [contenteditable="true"]',
  '[role="combobox"], [role="switch"], button, [tabindex]:not([tabindex="-1"])',
]

// Focus moving here doesn't save the field: a link that leaves the page
// (the leave prompt decides what happens to the draft) or the prompt itself.
const LEAVING = 'a[href]:not([target="_blank"]), [data-leave-guard]'

// A control holding the field open while something of the app's is in
// front of it (ReferenceCombobox's create form): leaving doesn't save.
const HOLD = '[data-edit-hold]'

export type EditableValueProps = {
  /** The field's label: the control's accessible name, and the edit button's ("Edit Name"). */
  label: string
  edit: EditInPlace
  /** The value as the view shows it. Defaults to the edit's `shown` (an `inPlace` preset's). */
  children?: ReactNode
  /** `inline` in a heading or beside badges, `block` in a field row (default). */
  layout?: 'inline' | 'block'
  /**
   * `value` (the default): hover tints the value itself, as in a header's
   * strip or a title. `row`: the field list's row is the target and wears
   * the hover (edit-row.ts's `editRowClass` on it, as EntityView's rows
   * have); under 48rem or on a touch screen a chevron, not the pencil.
   */
  look?: 'value' | 'row'
  className?: string
}

// The field's own control, given what it needs.
function Control({ render, ...props }: EditControlProps<unknown> & { render: EditInPlace['control'] }) {
  return render(props)
}

/** EditableValue's own props, plus what a list's rows and its Add box need (editable-list.tsx). */
export type EditableFieldProps = EditableValueProps & {
  /**
   * The closed field's own trigger, instead of the value and its pencil:
   * the list's Add button. Given what opens the field; its button is where
   * the caret goes back to.
   */
  trigger?: (start: () => void) => ReactNode
  /** Opens again, empty, once a save from the keyboard succeeds: adding one item after another. */
  reopenAfterKeyboardSave?: boolean
}

function useStore(): EditInPlaceStore {
  const store = useContext(EditInPlaceContext)
  if (!store) throw new Error('<EditableValue> works inside an <EntityView>, which runs editing in place.')
  return store
}

export function EditableValue(props: EditableValueProps) {
  return <EditableField {...props} />
}

export function EditableField({
  label,
  edit,
  children,
  layout = 'block',
  look = 'value',
  className,
  trigger,
  reopenAfterKeyboardSave = false,
}: EditableFieldProps) {
  const store = useStore()
  const key = useId()
  const controlId = `${key}-control`
  const describedBy = `${key}-status`

  const always = Boolean(edit.alwaysEditable || edit.inline)
  const autosave = always || Boolean(edit.autosave)

  // The latest config, read by the store whenever it needs it (`inline`
  // is always editable to it).
  const config = useRef(edit)
  useLayoutEffect(() => {
    config.current = always && !edit.alwaysEditable ? { ...edit, alwaysEditable: true } : edit
  })
  useEffect(() => store.register(key, () => config.current), [store, key])

  const state = useSyncExternalStore(
    store.subscribe,
    () => store.state(key),
    () => store.state(key),
  )

  // "✓ Saved" for a moment once a save lands (saving, then closed).
  const [justSaved, setJustSaved] = useState(false)
  const [seenStatus, setSeenStatus] = useState(state.status)
  if (seenStatus !== state.status) {
    setSeenStatus(state.status)
    if (seenStatus === 'saving' && state.status === 'closed') setJustSaved(true)
    else if (state.status !== 'closed') setJustSaved(false)
  }
  useEffect(() => {
    if (!justSaved) return
    const timer = window.setTimeout(() => setJustSaved(false), SAVED_FOR_MS)
    return () => window.clearTimeout(timer)
  }, [justSaved])

  const editButton = useRef<HTMLButtonElement>(null)
  // Holds a trigger (the list's Add): its button is the one the caret goes back to.
  const triggerBox = useRef<HTMLSpanElement>(null)
  const container = useRef<HTMLSpanElement>(null)
  // Set by a keyboard save or Esc: the caret goes back to the edit button.
  const refocus = useRef(false)
  const blurTimer = useRef<number | undefined>(undefined)

  // An always-editable control starts over (it's uncontrolled: a rich-text
  // editor reads its value once) when the value changed elsewhere while
  // nothing of its own was unsaved and the caret wasn't in it.
  const refresh = useCallback(() => {
    if (!container.current?.contains(document.activeElement)) store.refresh(key)
  }, [store, key])
  useEffect(() => {
    if (always) refresh()
  }, [always, refresh, edit.value])

  const isOpen = state.status !== 'closed'
  const wasOpen = useRef(false)
  useEffect(() => {
    // Always open: the caret stays wherever the person put it.
    if (isOpen && !wasOpen.current && !always) {
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
      ;(editButton.current ?? triggerBox.current?.querySelector('button'))?.focus()
    }
    wasOpen.current = isOpen
  }, [isOpen, always])

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
  // Enter or Ctrl/Cmd+Enter: the caret goes back to the edit button, or
  // the field opens again for the next one.
  const commitFromKeyboard = () => {
    window.clearTimeout(blurTimer.current)
    refocus.current = true
    void store.commit(key).then((closed) => {
      if (!closed || !reopenAfterKeyboardSave) return
      // The caret stays in (or comes back to) the field opening again.
      refocus.current = false
      void store.start(key)
    })
  }

  const onShownClick = (event: MouseEvent) => {
    if ((event.target as Element).closest(INTERACTIVE)) return
    start()
  }

  // Always editable: Ctrl/Cmd+Enter or Esc saves now, the caret staying put.
  const saveNow = () => {
    window.clearTimeout(blurTimer.current)
    void store.commit(key)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (state.status !== 'open') return
    if (event.key === 'Escape') {
      // A list open inside the control closes first; Esc again gives up
      // (or, autosaving, saves what's left and closes: nothing reverts).
      if ((event.defaultPrevented && !escapePassedThrough(event.nativeEvent)) || escapeClosesList.current) return
      event.preventDefault()
      if (always) saveNow()
      else if (autosave) commitFromKeyboard()
      else {
        refocus.current = true
        cancel()
      }
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      if (always) saveNow()
      else commitFromKeyboard()
    } else if (event.key === 'Enter' && edit.kind === 'text' && !event.shiftKey && !event.altKey) {
      event.preventDefault()
      commitFromKeyboard()
    }
  }

  // Leaving the field saves it. Focus moving into the control's own list
  // (a portal) still counts as inside: React sends its focus events here.
  // An autosaving field saves on its way to a link too: leaving the page
  // then waits for that save rather than asking.
  const onBlur = (event: FocusEvent) => {
    window.clearTimeout(blurTimer.current)
    if (!autosave && (event.relatedTarget as Element | null)?.closest(LEAVING)) return
    blurTimer.current = window.setTimeout(() => {
      if (store.state(key).status !== 'open') return
      if (container.current?.querySelector(HOLD)) return
      void store.commit(key).then(() => {
        if (always) refresh()
      })
    }, 0)
  }
  const onFocus = () => window.clearTimeout(blurTimer.current)

  if (state.status === 'closed' && !always) {
    if (trigger)
      return (
        <span ref={triggerBox} className="contents">
          {trigger(start)}
        </span>
      )
    const row = look === 'row'
    const inlineValue = layout === 'inline' && !row
    return (
      <span
        data-slot="editable-value"
        data-look={look}
        onClick={onShownClick}
        className={cn(
          // Inline, the gap is the pencil's own margin, there only while it shows.
          'group/editable relative cursor-text items-start',
          !inlineValue && 'gap-1',
          // A row: the row (editRowClass) wears the hover, not the value.
          !row && '-mx-1.5 rounded-md px-1.5 transition-colors hover:bg-muted has-[[data-edit]:focus-visible]:bg-muted',
          // Inline, the cap is its column plus the 0.75rem the negative
          // margins give back: a parent sized to its content (a title on
          // its line) is sized to the margin box, 0.75rem under the box,
          // and `max-w-full` then wrapped a short value mid-word (4.94).
          layout === 'block' ? 'flex w-full' : cn('inline-flex align-top', row ? 'max-w-full' : 'max-w-[calc(100%+0.75rem)]'),
          className,
        )}
      >
        {/* Muted text (a "Not set", a placeholder) reads as foreground on
            the hover and focus background: muted on bg-muted is under 4.5:1. */}
        <span
          className={cn(
            'min-w-0 flex-1',
            !row &&
              'group-hover/editable:[&_.text-muted-foreground]:text-foreground group-has-[[data-edit]:focus-visible]/editable:[&_.text-muted-foreground]:text-foreground',
          )}
        >
          {children !== undefined ? children : edit.shown}
          {/* Always there, so a screen reader hears "Saved" arrive. */}
          <span
            role="status"
            data-slot="editable-value-saved"
            className="ml-2 inline-flex items-center gap-1 align-baseline type-caption text-success-text empty:hidden"
          >
            {justSaved && (
              <>
                <CheckIcon aria-hidden="true" className="size-3.5" />
                Saved
              </>
            )}
          </span>
        </span>
        <Button
          ref={editButton}
          data-edit=""
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Edit ${label}`}
          onClick={start}
          className={cn(
            'shrink-0 text-muted-foreground opacity-0 focus-visible:opacity-100 pointer-coarse:opacity-100',
            row ? 'group-hover/edit-row:opacity-100 hover:bg-transparent max-md:opacity-100' : 'group-hover/editable:opacity-100',
            // Inline (4.102): at rest the pencil takes no room, so a value
            // in a line ("Harbor Clinic · Tuesdays") is followed by its
            // separator with no gap. Hover or focus opens it out to the
            // value's right, eased (no ease with reduced motion); it's
            // never display:none, so Tab still reaches it and opens it.
            // A touch screen, with no hover, keeps it open.
            inlineValue &&
              'max-w-0 overflow-hidden border-0 transition-[max-width,margin] duration-150 ease-out motion-reduce:transition-none group-hover/editable:ml-1 group-hover/editable:max-w-6 focus-visible:ml-1 focus-visible:max-w-6 pointer-coarse:ml-1 pointer-coarse:max-w-6',
          )}
        >
          {row ? (
            <>
              {/* A phone or a touch screen: a chevron says the row opens. */}
              <PencilIcon className="max-md:hidden pointer-coarse:hidden" />
              <ChevronRightIcon className="hidden max-md:block pointer-coarse:block" />
            </>
          ) : (
            <PencilIcon />
          )}
        </Button>
      </span>
    )
  }

  // Always editable, before the store has it (the first render): the saved value.
  const open = state.status === 'closed' ? { status: 'open' as const, draft: edit.value, error: null, autosave: undefined, revision: 0 } : state
  const saving = open.status === 'saving'
  const autosaving = open.autosave === 'saving'
  const fieldErrors = 'fieldErrors' in open ? (open.fieldErrors ?? undefined) : undefined
  // A refusal about one of the value's own fields shows on that field when
  // the control says it shows them; anything else shows under the control.
  const lineError = edit.errorsOnFields && fieldErrors ? null : open.error
  return (
    <span
      ref={container}
      data-slot="editable-value"
      data-state={saving || autosaving ? 'saving' : open.error ? 'failed' : 'editing'}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      onFocus={onFocus}
      className={cn('flex min-w-0 flex-col gap-1.5', layout === 'block' ? 'w-full' : 'w-fit max-w-full', className)}
    >
      <Control
        key={open.revision ?? 0}
        render={edit.control}
        id={controlId}
        value={open.draft}
        onChange={(value) => store.change(key, value)}
        commit={commit}
        cancel={cancel}
        disabled={saving}
        invalid={!saving && open.error !== null}
        label={label}
        describedBy={describedBy}
        onProblem={(problem) => store.report(key, problem)}
        inline={Boolean(edit.inline)}
        errors={saving ? undefined : fieldErrors}
      />
      <span id={describedBy} className="type-body">
        {autosave ? (
          // A quiet line, always there so a screen reader hears it change:
          // "Saving…" while a save is in flight, "Saved" once nothing typed
          // is waiting, and a refusal's reason above it.
          <>
            {lineError && <FieldError className="type-caption">{lineError}</FieldError>}
            <span role="status" className="inline-flex items-center gap-1.5 type-caption text-muted-foreground">
              {autosaving ? (
                <>
                  <Spinner aria-hidden="true" className="size-3.5" />
                  Saving…
                </>
              ) : (
                open.autosave === 'saved' &&
                !open.error && (
                  <>
                    <CheckIcon aria-hidden="true" className="size-3.5" />
                    Saved
                  </>
                )
              )}
            </span>
          </>
        ) : saving ? (
          <span role="status" className="inline-flex items-center gap-1.5 type-caption text-muted-foreground">
            <Spinner aria-hidden="true" className="size-3.5" />
            Saving…
          </span>
        ) : (
          lineError && <FieldError className="type-caption">{lineError}</FieldError>
        )}
      </span>
    </span>
  )
}

/**
 * While a field holds something unsaved, leaving asks first: an in-app
 * link or Back (React Router's blocker, so the app needs a data router),
 * or closing the tab (`beforeunload`). Rendered by EntityView only while
 * a field is being edited, so a view nobody's editing never blocks anything.
 *
 * When everything unsaved autosaves, an in-app move saves it first and
 * goes on once saved, asking only if that save fails. Closing the tab
 * can't wait, so it starts the save and asks; hiding the page (another
 * tab, a phone's home screen) saves too.
 */
export function LeaveGuard({ store }: { store: EditInPlaceStore }) {
  const dirty = useSyncExternalStore(
    store.subscribe,
    () => store.dirty,
    () => store.dirty,
  )
  const savesOnLeave = useSyncExternalStore(
    store.subscribe,
    () => store.savesOnLeave,
    () => store.savesOnLeave,
  )
  const blocker = useBlocker(({ currentLocation, nextLocation }) => store.dirty && currentLocation.pathname !== nextLocation.pathname)
  const [saveFailed, setSaveFailed] = useState(false)

  const latestBlocker = useRef(blocker)
  useLayoutEffect(() => {
    latestBlocker.current = blocker
  })
  useEffect(() => {
    if (blocker.state !== 'blocked' || !store.savesOnLeave) return
    let live = true
    // The save may close the field; this prompt (and the move it blocked)
    // stays until the save is done.
    const release = store.hold()
    void store.saveAll().then((saved) => {
      if (live) {
        const current = latestBlocker.current
        if (saved && current.state === 'blocked') current.proceed()
        else if (!saved) setSaveFailed(true)
      }
      release()
    })
    return () => {
      live = false
    }
  }, [blocker.state, store])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      void store.saveAll()
      event.preventDefault()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') void store.saveAll()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [dirty, store])

  return (
    <DiscardChangesDialog
      open={blocker.state === 'blocked' && (!savesOnLeave || saveFailed)}
      description="A field you're editing hasn't been saved. Leaving now loses what you typed."
      data-leave-guard=""
      onKeepEditing={() => {
        setSaveFailed(false)
        if (blocker.state === 'blocked') blocker.reset()
      }}
      onDiscard={() => {
        store.discard()
        setSaveFailed(false)
        if (blocker.state === 'blocked') blocker.proceed()
      }}
    />
  )
}
