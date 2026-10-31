// Fill in what a list of records is missing, one record at a time: a size
// for every project without one, a category for each unsorted purchase.
// A screen for clearing a backlog of blanks quickly, beside the list
// (where the same fields stay editable one by one), never instead of it.
//
// - Records: `items` are the ones still missing something, in order, and
//   `renderItem` draws one: its heading and a few values to decide by,
//   then its fields (FillInChoice, or any input). The draft is the app's:
//   it keeps what's picked for each record, and `canSave` says whether
//   there's enough to save.
// - Moving: "Save and next" calls `onSave(item)` (the app saves its draft)
//   and, when it resolves, shows the next record. A saved record usually
//   leaves `items`, so the one after it takes its place; if it stays (still
//   missing something), the queue moves past it. Skip moves on without
//   saving, wrapping from the last record to the first. After either, the
//   focus is on the new record, for a screen reader and the keys below.
// - Keys, while the focus is inside the queue: Enter (not in a textarea,
//   not on a button) is Save and next; with one FillInChoice marked
//   `shortcut`, the number keys pick its choices (not in a text field).
// - Saving: the button shows it's pending; a refusal keeps the record and
//   says why under the buttons, not in a toast.
// - Progress: the app counts (`progress`): a bar and "12 of 160 filled".
// - Groups: records from several sources (a module, a list) name theirs
//   above the heading with `groups` and `getGroup`: its icon and label,
//   and, when the group has its own `progress`, "3 of 12 filled" beside
//   it. With more than one group counted, each one's count is listed
//   under the bar.
// - States: `loading` (skeletons), `error` (ErrorState, with `onRetry`),
//   and an empty queue (`empty`, default "Nothing left to fill in").
//
// The record is a centred column, 40rem at most; the buttons sit under it,
// Skip at the start and Save and next at the end.
import {
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { cn } from 'cn'
import type { AppError } from '@/api/contracts'
import { ErrorState } from '@/components/app/error-state'
import type { IconComponent } from '@/components/app/icon-component'
import { nextFillInKey, resolveFillInIndex } from '@/components/app/fill-in-queue-index'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Toggle } from '@/components/ui/toggle'

export interface FillInQueueProgress {
  /** Records filled so far. */
  done: number
  /** Records in all, filled or not. */
  total: number
  /** The word after the count: "12 of 160 <label>". Default "filled". */
  label?: string
}

export interface FillInQueueGroup {
  id: string
  label: string
  icon?: IconComponent
  /** This group's own count, said beside its name on its records. */
  progress?: Omit<FillInQueueProgress, 'label'>
}

export interface FillInQueueProps<T> {
  /** The records still missing something, in order. */
  items: readonly T[]
  getKey: (item: T) => string | number
  /** One record: its heading and values, then its fields. */
  renderItem: (item: T) => ReactNode
  /** Saves the app's draft for the record; the queue moves on when it resolves. A rejection keeps the record and shows its message. */
  onSave: (item: T) => Promise<void> | void
  /** False disables Save and next (nothing picked yet); a function is asked about the record on screen. Default true. */
  canSave?: boolean | ((item: T) => boolean)
  /** Told when Skip moves past a record without saving. */
  onSkip?: (item: T) => void
  /** A bar and "12 of 160 filled" at the top. The app counts. */
  progress?: FillInQueueProgress
  /** Where records come from: named above each record's heading. */
  groups?: readonly FillInQueueGroup[]
  /** The id of the record's group in `groups`. */
  getGroup?: (item: T) => string
  /** Default "Save and next". */
  saveLabel?: string
  /** Default "Skip". */
  skipLabel?: string
  loading?: boolean
  /** An AppError (ErrorState, with `onRetry`), or the app's own message. */
  error?: AppError | ReactNode
  onRetry?: () => void
  /** The empty queue's title. Default "Nothing left to fill in". */
  empty?: ReactNode
  /** Shows the record at this index; the queue still moves on its own after a save or a skip and reports it. */
  index?: number
  /** Told whenever another record is on screen, or the one on screen moves to another index. */
  onIndexChange?: (index: number, item: T) => void
  className?: string
}

type ShortcutHandler = (digit: number) => boolean
const ShortcutContext = createContext<((handler: ShortcutHandler) => () => void) | null>(null)

const isAppError = (value: unknown): value is AppError =>
  typeof value === 'object' &&
  value !== null &&
  !isValidElement(value) &&
  typeof (value as { kind?: unknown }).kind === 'string' &&
  typeof (value as { message?: unknown }).message === 'string'

const messageOf = (reason: unknown): string => {
  if (typeof reason === 'string' && reason !== '') return reason
  if (typeof reason === 'object' && reason !== null && typeof (reason as { message?: unknown }).message === 'string') {
    const message = (reason as { message: string }).message
    if (message !== '') return message
  }
  return "Couldn't save this record."
}

const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'time', 'datetime-local', 'month', 'week'])

// Where a key types into a field, so it's the field's, not the queue's.
function isTextField(element: HTMLElement): boolean {
  if (element.isContentEditable) return true
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true
  if (element instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(element.type)
  return element.getAttribute('role') === 'combobox' || element.getAttribute('role') === 'textbox'
}

// Where Enter already does something of its own.
function ownsEnter(element: HTMLElement): boolean {
  if (element.isContentEditable || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true
  return (
    element.closest(
      'button, a[href], summary, [role=button], [role=link], [role=combobox], [role=listbox], [role=option], [role=menu], [role=menuitem], [role=menuitemradio], [role=menuitemcheckbox], [role=switch], [role=checkbox], [role=radio], [role=tab]',
    ) !== null
  )
}

export function FillInQueue<T>({
  items,
  getKey,
  renderItem,
  onSave,
  canSave = true,
  onSkip,
  progress,
  groups,
  getGroup,
  saveLabel = 'Save and next',
  skipLabel = 'Skip',
  loading = false,
  error,
  onRetry,
  empty = 'Nothing left to fill in',
  index: indexProp,
  onIndexChange,
  className,
}: FillInQueueProps<T>) {
  const keys = items.map(getKey)
  const [held, setHeld] = useState<{ key: string | number | null; index: number }>(() => ({
    key: indexProp !== undefined ? (keys[indexProp] ?? null) : null,
    index: indexProp ?? 0,
  }))
  const index = resolveFillInIndex(keys, held.key, held.index)
  const current = index === -1 ? undefined : items[index]
  const currentKey = index === -1 ? null : keys[index]
  const savable = current !== undefined && (typeof canSave === 'function' ? canSave(current) : canSave)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [moves, setMoves] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const recordRef = useRef<HTMLDivElement>(null)
  const latest = useRef({ keys, index, items })
  useEffect(() => {
    latest.current = { keys, index, items }
  })

  // Re-pin the hold to the record on screen once the one held has left
  // (adjusting state while rendering, so nothing draws the old one).
  if (index !== -1 && (held.key !== currentKey || held.index !== index)) setHeld({ key: currentKey, index })

  // The app moving the queue to an index.
  const appliedIndex = useRef(indexProp)
  useEffect(() => {
    if (indexProp === undefined || indexProp === appliedIndex.current) return
    appliedIndex.current = indexProp
    const { keys: now } = latest.current
    if (indexProp >= 0 && indexProp < now.length) setHeld({ key: now[indexProp], index: indexProp })
  }, [indexProp])

  const reported = useRef({ index, key: currentKey })
  const onIndexChangeRef = useRef(onIndexChange)
  useEffect(() => {
    onIndexChangeRef.current = onIndexChange
  })
  useEffect(() => {
    if (index === reported.current.index && currentKey === reported.current.key) return
    reported.current = { index, key: currentKey }
    appliedIndex.current = index
    const item = latest.current.items[index]
    if (index !== -1 && item !== undefined) onIndexChangeRef.current?.(index, item)
  }, [index, currentKey])

  // After a move, the focus goes to the record now on screen (to the queue
  // when none is left).
  const focusPending = useRef(false)
  useEffect(() => {
    if (!focusPending.current) return
    focusPending.current = false
    ;(recordRef.current ?? rootRef.current)?.focus()
  }, [moves])

  const moveOn = useCallback((from: string | number) => {
    const { keys: now, index: at } = latest.current
    const next = nextFillInKey(now, from, at)
    setHeld({ key: next, index: next === null ? at : now.indexOf(next) })
    setSaveError(null)
    focusPending.current = true
    setMoves((count) => count + 1)
  }, [])

  const save = async () => {
    if (saving || !savable || current === undefined || currentKey === null) return
    setSaving(true)
    setSaveError(null)
    try {
      await onSave(current)
    } catch (reason) {
      setSaving(false)
      setSaveError(messageOf(reason))
      return
    }
    setSaving(false)
    moveOn(currentKey)
  }

  const skip = () => {
    if (saving || current === undefined || currentKey === null) return
    onSkip?.(current)
    moveOn(currentKey)
  }

  const shortcuts = useRef(new Set<ShortcutHandler>())
  const register = useCallback((handler: ShortcutHandler) => {
    shortcuts.current.add(handler)
    return () => {
      shortcuts.current.delete(handler)
    }
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return
    const target = event.target as HTMLElement
    if (event.key === 'Enter' && !event.shiftKey) {
      if (ownsEnter(target)) return
      event.preventDefault()
      void save()
      return
    }
    if (/^[1-9]$/.test(event.key) && !event.shiftKey && !isTextField(target)) {
      for (const handler of shortcuts.current) {
        if (handler(Number(event.key))) {
          event.preventDefault()
          return
        }
      }
    }
  }

  const counted = groups?.filter((group) => group.progress !== undefined) ?? []
  const progressBar = (progress || counted.length > 1) && (
    <div className="flex flex-col gap-1.5">
      {progress && <ProgressLine progress={progress} />}
      {counted.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 type-caption text-muted-foreground tabular-nums" data-slot="fill-in-queue-groups">
          {counted.map((group) => (
            <li key={group.id}>
              {group.label} {group.progress?.done} of {group.progress?.total}
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  if (error !== undefined && error !== null && error !== false) {
    return (
      <div data-slot="fill-in-queue" data-state="error" className={className}>
        {isAppError(error) ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : (
          <Empty data-state="error">
            <EmptyHeader>
              <EmptyTitle>Something went wrong</EmptyTitle>
              <EmptyDescription>{error as ReactNode}</EmptyDescription>
            </EmptyHeader>
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                Try again
              </Button>
            )}
          </Empty>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div data-slot="fill-in-queue" data-state="loading" aria-busy="true" className={cn('flex flex-col gap-6', className)}>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="mx-auto flex w-full max-w-[40rem] flex-col gap-4">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    )
  }

  if (current === undefined) {
    return (
      <div
        ref={rootRef}
        tabIndex={-1}
        data-slot="fill-in-queue"
        data-state="empty"
        className={cn('flex flex-col gap-6 outline-none', className)}
      >
        {progressBar}
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{empty}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const position = `Record ${index + 1} of ${items.length}`
  const groupId = getGroup?.(current)
  const group = groupId === undefined ? undefined : groups?.find((g) => g.id === groupId)
  return (
    <ShortcutContext.Provider value={register}>
      <div
        ref={rootRef}
        tabIndex={-1}
        data-slot="fill-in-queue"
        data-state="success"
        onKeyDown={onKeyDown}
        className={cn('flex flex-col gap-6 outline-none', className)}
      >
        <div className="flex flex-col gap-2">
          {progressBar}
          <p className="type-caption text-muted-foreground tabular-nums" data-slot="fill-in-queue-position">
            {position}
          </p>
        </div>
        <div className="mx-auto flex w-full max-w-[40rem] flex-col gap-6">
          <div
            ref={recordRef}
            key={currentKey ?? undefined}
            role="group"
            aria-label={position}
            tabIndex={-1}
            data-slot="fill-in-queue-record"
            className="flex flex-col gap-6 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {group && <GroupLine group={group} label={progress?.label} />}
            {renderItem(current)}
          </div>
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={skip} disabled={saving}>
                {skipLabel}
              </Button>
              <Button onClick={() => void save()} disabled={!savable || saving} aria-busy={saving || undefined}>
                {saving && <Spinner aria-hidden="true" role="presentation" aria-label={undefined} data-icon="inline-start" />}
                {saveLabel}
              </Button>
            </div>
            {saveError !== null && (
              <p role="alert" className="text-end type-caption text-destructive-text">
                {saveError}
              </p>
            )}
          </div>
        </div>
      </div>
    </ShortcutContext.Provider>
  )
}

function GroupLine({ group, label = 'filled' }: { group: FillInQueueGroup; label?: string }) {
  const Icon = group.icon
  return (
    <p className="-mb-4 flex items-center gap-1.5 type-caption text-muted-foreground" data-slot="fill-in-queue-group">
      {Icon && <Icon className="size-4" aria-hidden="true" />}
      <span className="font-medium">{group.label}</span>
      {group.progress && (
        <span className="tabular-nums">
          · {group.progress.done} of {group.progress.total} {label}
        </span>
      )}
    </p>
  )
}

function ProgressLine({ progress }: { progress: FillInQueueProgress }) {
  const { done, total, label = 'filled' } = progress
  const share = total > 0 ? Math.min(Math.max(done / total, 0), 1) : 0
  const text = `${done} of ${total} ${label}`
  return (
    <div className="flex flex-col gap-1.5" data-slot="fill-in-queue-progress">
      <div
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={text}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${share * 100}%` }} />
      </div>
      <p className="type-caption text-muted-foreground tabular-nums">{text}</p>
    </div>
  )
}

export interface FillInChoiceProps<V extends string | number> {
  /** Names the row of choices. */
  label: string
  choices: readonly { value: V; label: ReactNode }[]
  value: V | null | undefined
  /** The choice picked, or null when the picked one is clicked again. */
  onChange: (value: V | null) => void
  /** A guess drawn dashed in the info tone, with "Suggested: <label> (<note>)" under the row. */
  suggestion?: { value: V; note?: ReactNode }
  /** The number keys pick in this row while the focus is in the queue (not in a text field). One row per queue. */
  shortcut?: boolean
  className?: string
}

/** One field of a FillInQueue record as a row of toggle buttons: one picked, or none. */
export function FillInChoice<V extends string | number>({
  label,
  choices,
  value,
  onChange,
  suggestion,
  shortcut = false,
  className,
}: FillInChoiceProps<V>) {
  const labelId = useId()
  const register = useContext(ShortcutContext)
  const latest = useRef({ choices, onChange })
  useEffect(() => {
    latest.current = { choices, onChange }
  })
  useEffect(() => {
    if (!shortcut || register === null) return
    return register((digit) => {
      const choice = latest.current.choices[digit - 1]
      if (choice === undefined) return false
      latest.current.onChange(choice.value)
      return true
    })
  }, [shortcut, register])

  const suggested = suggestion ? choices.find((choice) => choice.value === suggestion.value) : undefined
  const keys = shortcut && register !== null
  return (
    <div data-slot="fill-in-choice" className={cn('flex flex-col gap-2', className)}>
      <div id={labelId} className="type-label">
        {label}
      </div>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {choices.map((choice, index) => {
          const pressed = value !== null && value !== undefined && choice.value === value
          const isSuggested = suggested !== undefined && choice.value === suggested.value
          return (
            <Toggle
              key={String(choice.value)}
              variant="outline"
              pressed={pressed}
              onPressedChange={() => onChange(pressed ? null : choice.value)}
              aria-keyshortcuts={keys && index < 9 ? String(index + 1) : undefined}
              data-suggested={isSuggested || undefined}
              className={cn(
                'h-auto min-h-9 px-3 py-1.5',
                isSuggested && 'border-dashed border-info-text',
                'aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90 aria-pressed:hover:text-primary-foreground',
              )}
            >
              {keys && index < 9 && (
                <span
                  aria-hidden="true"
                  className="type-caption tabular-nums text-muted-foreground group-aria-pressed/toggle:text-primary-foreground"
                >
                  {index + 1}
                </span>
              )}
              {choice.label}
            </Toggle>
          )
        })}
      </div>
      {suggested !== undefined && (
        <p className="type-caption text-muted-foreground">
          Suggested: {suggested.label}
          {suggestion?.note !== undefined && suggestion.note !== null && <> ({suggestion.note})</>}
        </p>
      )}
    </div>
  )
}
