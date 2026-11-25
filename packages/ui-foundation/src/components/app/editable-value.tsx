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
//   Ctrl/Cmd+Enter and Esc save what's left now and close it. On a note
//   longer than the screen the line under it is pinned to the screen's
//   bottom edge, so a refusal or a failed save is never off screen, and
//   the first one also toasts.
// - `long-text` without `autosave`: Esc on a changed draft asks
//   ("Discard your changes?") rather than dropping it.
// - Opening by a click puts the caret where the click was, not at the
//   top, and the page doesn't move.
// - The saved value changing elsewhere shows at once when nothing here is
//   unsaved, the caret keeping its block; under unsaved typing the line
//   says so, with "Keep Mine" and "Show Saved".
// - `alwaysEditable`: the control is shown at rest, with no pencil and no
//   click to open, and never closes. Ctrl/Cmd+Enter and Esc save now.
// - `inline`: always editable, and the control is told to look like the
//   value it edits (`inline` among its props).
// - Always editable and a `choice` (`inPlace.rating`'s stars): a
//   value on one line, so "Saving…" and "Saved" sit beside it, not on a
//   line under it, and "Saved" goes after two seconds, as at rest.
// - Saved: once a save lands, "✓ Saved" shows beside the value
//   for two seconds (`role="status"`).
// - `layout="inline"`: the pencil takes no room until hover or
//   focus, so nothing gaps before what follows the value on its line.
//   `keepPencilRoom` (and every value inside a KeyStats) keeps it
//   at rest instead, so nothing moves on hover or focus.
// - `look="row"`: in a record's field list the row is
//   the target (edit-row.ts): it wears the list's row hover and the pencil
//   sits at its end; under 48rem or on a touch screen there's a chevron
//   instead of the pencil. The control still opens in the row.
import { CheckIcon, ChevronRightIcon, PencilIcon } from 'lucide-react'
import { useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type FocusEvent, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { useBlocker } from 'react-router'
import { toast } from 'sonner'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { DiscardChangesDialog } from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { clearPageLeaving, markPageLeaving } from '@/lib/page-leaving'
import { flushPendingEdits, hasPendingEdits, subscribePendingEdits } from '@/lib/pending-edits'
import { caretSpot, placeCaretWhenReady, spotAtPoint, type CaretSpot } from './edit-caret'
import { rebaseMarkdown } from '@/lib/markdown-merge'
import { EditInPlaceContext, type EditControlProps, type EditInPlace } from './edit-in-place'
import type { EditInPlaceStore } from './edit-in-place-store'
import { SAVED_FOR_MS } from './edit-row'
import { escapePassedThrough } from './escape-passthrough'
import { KeepPencilRoomContext } from './keep-pencil-room'

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
  /**
   * Inline, the pencil's room is kept at rest, so nothing
   * moves on hover or focus: a table cell (row-edit-cells.tsx), whose
   * column would otherwise widen, EntityView's title, which ends its line
   * and can fill it, and every value inside a <KeyStats> (which
   * sets it for them: a wrapping row moved the values after it along).
   */
  keepPencilRoom?: boolean
  className?: string
}

// An inline value's room for its pencil: none at rest; the pencil's 24px
// and a 4px gap (w-7) while the value is hovered or its pencil focused.
function InlinePencilRoom({ inline, children }: { inline: boolean; children: ReactNode }) {
  if (!inline) return children
  return (
    <span
      data-slot="editable-value-pencil-room"
      className="relative w-0 shrink-0 self-stretch transition-[width] duration-150 ease-out motion-reduce:transition-none group-hover/editable:w-7 group-has-[[data-edit]:focus-visible]/editable:w-7 pointer-coarse:w-7"
    >
      {children}
    </span>
  )
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

// While a field runs past the bottom of the screen, its status line (the
// save's state, a refusal) is pinned to the screen's bottom edge, under the
// field's left edge, so it's never off screen. Not CSS sticky: a
// section's card clips its content (`overflow-hidden`), which stops sticky
// at the card. Returns where to pin it, or null while it shows in place.
//
// Judged by where the field ends with its line in place, pinned or not.
// Pinning takes the line out of the field, so the field's own box is
// shorter by the line while it's pinned: judged by that box, a field whose
// end is within a line of the screen's bottom pinned, shrank, unpinned,
// grew and pinned again, every frame (a conflict's two buttons hopping
// 128px on a phone, never still enough to press).
function usePinnedStatus(
  field: RefObject<HTMLElement | null>,
  enabled: boolean,
): { left: number; width: number } | null {
  const [pin, setPin] = useState<{ left: number; width: number } | null>(null)
  useLayoutEffect(() => {
    if (!enabled) return
    let frame = 0
    // How far the line in place reaches below the rest of the field (the
    // gap and the line), measured whenever it's in place.
    let reserve = 0
    const measure = () => {
      frame = 0
      const element = field.current
      const box = element?.getBoundingClientRect()
      let bottom = box?.bottom
      const line = element?.querySelector<HTMLElement>(':scope > [data-slot="editable-value-status"]')
      if (element && box && line) {
        if (line.hasAttribute('data-pinned')) {
          bottom = box.bottom + reserve
        } else {
          let rest = box.top
          for (const child of element.children) {
            if (child !== line) rest = Math.max(rest, child.getBoundingClientRect().bottom)
          }
          reserve = Math.max(0, box.bottom - rest)
        }
      }
      const runsPast = box !== undefined && bottom !== undefined && box.top < window.innerHeight - 48 && bottom > window.innerHeight
      setPin((current) => {
        if (!runsPast) return null
        const next = { left: Math.round(box.left), width: Math.round(box.width) }
        return current && current.left === next.left && current.width === next.width ? current : next
      })
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', schedule, { capture: true, passive: true })
    window.addEventListener('resize', schedule)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    if (field.current) observer?.observe(field.current)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', schedule)
      observer?.disconnect()
    }
  }, [field, enabled])
  return enabled ? pin : null
}

function useStore(): EditInPlaceStore {
  const store = useContext(EditInPlaceContext)
  if (!store) throw new Error('<EditableValue> works inside an <EntityView>, which runs editing in place.')
  return store
}

// What the store reads: the field, with its `rebase` decided.
type FieldConfig = Omit<EditInPlace, 'rebase'> & { rebase?: (base: unknown, mine: unknown, theirs: unknown) => unknown }

// Long text's "Keep Mine": both sides kept block by block (rebaseMarkdown).
function rebaseText(base: unknown, mine: unknown, theirs: unknown): unknown {
  if (typeof base !== 'string' || typeof mine !== 'string' || typeof theirs !== 'string') return null
  return rebaseMarkdown(base, mine, theirs)
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
  keepPencilRoom: keepPencilRoomProp,
}: EditableFieldProps) {
  const store = useStore()
  const keepRoomHere = useContext(KeepPencilRoomContext)
  const keepPencilRoom = keepPencilRoomProp ?? keepRoomHere
  const key = useId()
  const controlId = `${key}-control`
  const describedBy = `${key}-status`

  const always = Boolean(edit.alwaysEditable || edit.inline)
  const autosave = always || Boolean(edit.autosave)

  // The latest config, read by the store whenever it needs it (`inline`
  // is always editable to it; long text keeps both sides of a conflict
  // block by block unless it says otherwise).
  const config = useRef<FieldConfig>({ ...edit, rebase: undefined })
  useLayoutEffect(() => {
    const rebase = edit.rebase === false ? undefined : (edit.rebase ?? (edit.kind === 'long-text' ? rebaseText : undefined))
    config.current = { ...edit, alwaysEditable: always || edit.alwaysEditable, rebase }
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

  // Where the caret goes once the control shows or starts over: the spot
  // clicked in the read view, or the caret's own block.
  const caretTarget = useRef<CaretSpot | null>(null)
  const stopPlacing = useRef<() => void>(() => {})
  useEffect(() => () => stopPlacing.current(), [])
  const placeCaretSoon = useCallback((spot: CaretSpot) => {
    stopPlacing.current()
    stopPlacing.current = placeCaretWhenReady(() => container.current, spot)
  }, [])

  // The value changed elsewhere (another tab, a phone, an AI chat): the
  // control starts over (it's uncontrolled: a rich-text editor reads its
  // value once) when nothing of its own is unsaved, the caret keeping its
  // block if it was in it; under unsaved typing the store marks a conflict.
  const refresh = useCallback(() => {
    const focused = Boolean(container.current?.contains(document.activeElement))
    const spot = focused && container.current ? caretSpot(container.current) : null
    if (store.refresh(key) && spot) placeCaretSoon(spot)
  }, [store, key, placeCaretSoon])
  useEffect(() => {
    refresh()
  }, [refresh, edit.value])

  // Always editable and one pick (stars): its line is beside it.
  const beside = always && edit.kind === 'choice'
  const autosaved = state.status !== 'closed' && state.autosave === 'saved'
  const [savedGone, setSavedGone] = useState(false)
  const [seenSaved, setSeenSaved] = useState(autosaved)
  if (seenSaved !== autosaved) {
    setSeenSaved(autosaved)
    setSavedGone(false)
  }
  useEffect(() => {
    if (!beside || !autosaved) return
    const timer = window.setTimeout(() => setSavedGone(true), SAVED_FOR_MS)
    return () => window.clearTimeout(timer)
  }, [beside, autosaved])

  const isOpen = state.status !== 'closed'
  const pinned = usePinnedStatus(container, autosave && (isOpen || always))
  const wasOpen = useRef(false)
  useEffect(() => {
    // Always open: the caret stays wherever the person put it.
    if (isOpen && !wasOpen.current && !always) {
      const spot = caretTarget.current
      caretTarget.current = null
      for (const selector of FOCUS_ORDER) {
        const target = container.current?.querySelector<HTMLElement>(selector)
        if (target) {
          // Opened by a click on the text: the page stays where it is.
          target.focus(spot ? { preventScroll: true } : undefined)
          break
        }
      }
      if (spot) placeCaretSoon(spot)
    }
    // Closed: the caret goes back to the value's edit button after a
    // keyboard save or Esc, or whenever closing left it nowhere (a pick
    // from a list), so the keyboard never loses its place.
    if (!isOpen && wasOpen.current && (refocus.current || document.activeElement === document.body)) {
      refocus.current = false
      ;(editButton.current ?? triggerBox.current?.querySelector('button'))?.focus()
    }
    wasOpen.current = isOpen
  }, [isOpen, always, placeCaretSoon])

  // Esc on a changed long text that doesn't autosave: asks first.
  const [askingDiscard, setAskingDiscard] = useState(false)
  const asking = useRef(false)
  useLayoutEffect(() => {
    asking.current = askingDiscard
  })

  // The first refusal or failed save of an autosaving field toasts too:
  // its line may be far from where the person is looking. Once per
  // run of failures; a save that lands starts the count again.
  // A conflict (saved elsewhere) isn't a failed save: its toast says so.
  const failure = state.status !== 'closed' ? state.error : null
  const conflicted = state.status !== 'closed' && Boolean(state.conflict)
  const toasted = useRef(false)
  useEffect(() => {
    if (!autosave) return
    if (failure === null) {
      toasted.current = false
      return
    }
    if (toasted.current) return
    toasted.current = true
    if (conflicted) toast.warning(`${label} changed elsewhere`, { description: 'Keep Mine or Show Saved, under it.' })
    else toast.error(`Couldn't save ${label}`, { description: failure })
  }, [autosave, failure, conflicted, label])

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
    // Long text opens with the caret where it was clicked.
    if (edit.kind === 'long-text') caretTarget.current = spotAtPoint(event.currentTarget, event.clientX, event.clientY)
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
      else if (edit.kind === 'long-text' && !(edit.isEqual ?? sameAsJson)(state.draft, state.initial)) {
        window.clearTimeout(blurTimer.current)
        // This Esc opens the question; it mustn't also close it (or a
        // record dialog around the field) on its way up to the document.
        event.stopPropagation()
        setAskingDiscard(true)
      } else {
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
      if (container.current?.querySelector(HOLD) || asking.current) return
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
    const inlineValue = layout === 'inline' && !row && !keepPencilRoom
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
          // Inline, the cap is its column plus what the negative margins
          // (-mx-1.5) give back: a parent sized to its content (a title on
          // its line) is sized to the margin box, that much under the box,
          // and `max-w-full` then wrapped a short value mid-word. In
          // spacing steps, not rem: at Large and Extra Large the margins
          // grow with --spacing, and a fixed 0.75rem left the record's
          // title 3-5px short of its one line (4.145).
          layout === 'block' ? 'flex w-full' : cn('inline-flex align-top', row ? 'max-w-full' : 'max-w-[calc(100%+var(--spacing)*3)]'),
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
        {/* Inline: the pencil sits in a spacer that takes no room
            at rest, so a value in a line ("Harbor Office · Tuesdays") is
            followed by its separator with no gap. The pencil keeps its
            24px box out of the flow, hidden just past the value over what
            follows (the separator), so it's still a real target to click,
            hover and Tab to. Hover or focus opens the spacer under it,
            eased (at once with reduced motion): what follows moves over,
            the pencil stays put. A touch screen keeps it open. Not over
            the value itself: a click on a short value would land on it. */}
        <InlinePencilRoom inline={inlineValue}>
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
              inlineValue && 'absolute top-0 left-1 z-10',
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
        </InlinePencilRoom>
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
  // Something to say: a save in flight, saved, or why it can't save.
  const hasStatus = autosaving || open.autosave === 'saved' || lineError !== null
  const pin = hasStatus ? pinned : null
  // The saved value changed elsewhere under unsaved typing: the person picks.
  const conflictActions = 'conflict' in open && open.conflict && (
    <span className="mt-1 flex flex-wrap gap-2">
      <Button type="button" size="xs" variant="outline" onClick={() => void store.keepMine(key)}>
        Keep Mine
      </Button>
      <Button type="button" size="xs" variant="ghost" onClick={() => store.takeSaved(key)}>
        Show Saved
      </Button>
    </span>
  )
  return (
    <>
      <span
        ref={container}
        data-slot="editable-value"
        data-state={saving || autosaving ? 'saving' : open.error ? 'failed' : 'editing'}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onFocus={onFocus}
        className={cn(
          'flex min-w-0',
          beside ? 'flex-row flex-wrap items-center gap-x-2 gap-y-1' : 'flex-col gap-1.5',
          layout === 'block' ? 'w-full' : 'w-fit max-w-full',
          className,
        )}
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
        <span
          id={describedBy}
          data-slot="editable-value-status"
          data-pinned={pin ? '' : undefined}
          // Pinned to the screen's bottom edge while the field runs past
          // it, so the save's state and a refusal stay in view.
          style={pin ? { left: pin.left, maxWidth: pin.width } : undefined}
          className={cn(
            'type-body',
            // Beside the value, a refusal takes the line under it.
            beside && (lineError ? 'basis-full' : 'flex items-center'),
            pin && 'fixed bottom-3 z-30 w-fit rounded-md border border-border bg-popover px-2 py-1 text-popover-foreground shadow-md',
          )}
        >
          {autosave ? (
            // A quiet line, always there so a screen reader hears it change:
            // "Saving…" while a save is in flight, "Saved" once nothing typed
            // is waiting, and a refusal's reason above it.
            <>
              {lineError && <FieldError className="type-caption">{lineError}</FieldError>}
              {conflictActions}
              <span role="status" className="inline-flex items-center gap-1.5 type-caption text-muted-foreground">
                {/* Beside a value on one line, the icon alone shows (the
                    words are a screen reader's), so it fits a rail's row. */}
                {autosaving ? (
                  <>
                    <Spinner aria-hidden="true" className="size-3.5" />
                    <span className={cn(beside && 'sr-only')}>Saving…</span>
                  </>
                ) : (
                  open.autosave === 'saved' &&
                  !open.error &&
                  !(beside && savedGone) && (
                    <>
                      <CheckIcon aria-hidden="true" className={cn('size-3.5', beside && 'text-success-text')} />
                      <span className={cn(beside && 'sr-only')}>Saved</span>
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
            <>
              {lineError && <FieldError className="type-caption">{lineError}</FieldError>}
              {conflictActions}
            </>
          )}
        </span>
      </span>
      {/* Outside the field: its keys and focus aren't the field's (a
          portal's events still bubble through React). */}
      <DiscardChangesDialog
        open={askingDiscard}
        data-leave-guard=""
        onKeepEditing={() => setAskingDiscard(false)}
        onDiscard={() => {
          setAskingDiscard(false)
          refocus.current = true
          cancel()
        }}
      />
    </>
  )
}

const sameAsJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

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
  // Typing a rich-text field holds back counts: the tab's prompt is
  // set up from the first key, and a move reports it before it's judged.
  const holding = useSyncExternalStore(subscribePendingEdits, hasPendingEdits, hasPendingEdits)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    flushPendingEdits()
    return store.dirty && currentLocation.pathname !== nextLocation.pathname
  })
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
    if (!dirty && !holding) return
    // Saves started as the page goes ask the browser to finish them
    // (`keepalive`, lib/page-leaving.ts).
    const saveAsLeaving = () => {
      markPageLeaving()
      void store.saveAll()
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      saveAsLeaving()
      // Held-back typing that turned out unchanged leaves nothing to ask about.
      if (store.dirty) event.preventDefault()
    }
    // Hidden (another tab, a phone's home screen, often the last thing a
    // phone tells a page): save now, and while hidden don't wait for the
    // pause. iOS gives no leave prompt, only these.
    const onVisibilityChange = () => {
      const hidden = document.visibilityState === 'hidden'
      store.hurry(hidden)
      if (hidden) saveAsLeaving()
      else clearPageLeaving()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('pagehide', saveAsLeaving)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('pagehide', saveAsLeaving)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      store.hurry(false)
    }
  }, [dirty, holding, store])

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
