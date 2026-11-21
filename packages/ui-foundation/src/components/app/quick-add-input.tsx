// A quick add's one line (F1, look I4): what parseQuickAdd reads is
// marked in the box as you type and shown under it as chips, so a misread
// is seen at once. ✕ on a read chip gives its words back to the title
// (the "sun" that wasn't Sunday). The app passes its own chips, the ones
// pressed to set what wasn't typed (a list, a place), after the read ones,
// usually QuickAddChip. No menu opens on a symbol: `#ch` is read as you
// type it, and a symbol that names nothing stays in the title.
//
// The marks are a copy of the line behind the input, its text transparent
// and each read wrapped in a <mark>, kept on the input's own padding,
// font and scroll, so the highlight sits under the typed words. The input
// stays a plain text box for the keyboard, the screen reader and the
// phone's own keyboard; the chips are what a screen reader hears.
import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronDownIcon, XIcon } from 'lucide-react'
import { cn } from 'cn'
import { Input } from '@/components/ui/input'
import { formatPlainDate } from '@/lib/plain-date'
import { parseQuickAdd, type QuickAddOptions, type QuickAddResult, type QuickAddSpan } from '@/lib/quick-add'
import { formatRecurrence } from '@/lib/recurrence-format'

export type QuickAddInputProps = {
  /** The box's visible label ("Add To-Do"). */
  label: ReactNode
  /** What it reads with: today, the zone and the app's tokens (parseQuickAdd's options, less `ignore`). */
  options: Omit<QuickAddOptions, 'ignore'>
  /** The line, when the app holds it. Leave out to let the box hold it. */
  value?: string
  onValueChange?: (value: string) => void
  /**
   * Enter: the line as read. A box that holds its own line empties after
   * it; one the app holds is emptied by the app.
   */
  onSubmit?: (result: QuickAddResult, text: string) => void
  /** Every new reading, for an Add button or the app's chips elsewhere. */
  onResultChange?: (result: QuickAddResult) => void
  /** The app's own chips after the read ones, given the reading (usually QuickAddChip). */
  chips?: (result: QuickAddResult) => ReactNode
  /** A line under the chips: what can be typed. */
  hint?: ReactNode
  placeholder?: string
  /** The read chips' labels. Defaults: Due, Repeats. */
  labels?: { date?: string; recurrence?: string }
  autoFocus?: boolean
  disabled?: boolean
  id?: string
  className?: string
}

const DAY: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }

function clock(time: string, locale: string | undefined): string {
  const [hour, minute] = time.split(':').map(Number)
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(
    Date.UTC(2001, 0, 1, hour, minute),
  )
}

/** Every place each ignored phrase now sits in the line. */
function ignoredSpans(text: string, phrases: string[]): QuickAddSpan[] {
  const spans: QuickAddSpan[] = []
  for (const phrase of phrases) {
    for (let at = text.indexOf(phrase); at !== -1; at = text.indexOf(phrase, at + phrase.length)) {
      spans.push({ start: at, end: at + phrase.length })
    }
  }
  return spans
}

type ReadChip = { id: string; label: string; value: string; giveBack: string[] }

export function QuickAddInput({
  label,
  options,
  value,
  onValueChange,
  onSubmit,
  onResultChange,
  chips,
  hint,
  placeholder,
  labels,
  autoFocus,
  disabled,
  id,
  className,
}: QuickAddInputProps) {
  const ownId = useId()
  const inputId = id ?? `${ownId}-input`
  const hintId = `${ownId}-hint`
  const [ownText, setOwnText] = useState('')
  const text = value ?? ownText
  const [ignored, setIgnored] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const marksRef = useRef<HTMLSpanElement>(null)

  // A phrase given back stays given back while its words are in the line.
  const live = useMemo(() => ignored.filter((phrase) => text.includes(phrase)), [ignored, text])
  // Read again only when what it reads with changes, not each time an app
  // passes a new options object with the same contents.
  const optionsKey = JSON.stringify(options)
  const result = useMemo(
    () => parseQuickAdd(text, { ...(JSON.parse(optionsKey) as QuickAddOptions), ignore: ignoredSpans(text, live) }),
    [text, live, optionsKey],
  )

  const lastResult = useRef<QuickAddResult | null>(null)
  useLayoutEffect(() => {
    if (lastResult.current === result) return
    lastResult.current = result
    onResultChange?.(result)
  }, [result, onResultChange])

  const setText = useCallback(
    (next: string) => {
      if (value === undefined) setOwnText(next)
      onValueChange?.(next)
      if (next === '') setIgnored([])
    },
    [value, onValueChange],
  )

  // The marks follow the input's own scroll as the caret moves along a long line.
  const follow = useCallback(() => {
    const input = inputRef.current
    const marks = marksRef.current
    if (input && marks) marks.style.transform = `translateX(${-input.scrollLeft}px)`
  }, [])
  useLayoutEffect(follow, [text, result, follow])

  const readChips: ReadChip[] = []
  const locale = options.locale
  if (result.date || result.time) {
    const day = result.date ? formatPlainDate(result.date.value, DAY, locale) : ''
    const at = result.time ? clock(result.time.value, locale) : ''
    const giveBack: string[] = []
    if (result.date?.span) giveBack.push(text.slice(result.date.span.start, result.date.span.end))
    if (result.time && result.time.span !== result.recurrence?.span) {
      giveBack.push(text.slice(result.time.span.start, result.time.span.end))
    }
    readChips.push({ id: 'date', label: labels?.date ?? 'Due', value: [day, at].filter(Boolean).join(', '), giveBack })
  }
  if (result.recurrence) {
    const span = result.recurrence.span
    readChips.push({
      id: 'recurrence',
      label: labels?.recurrence ?? 'Repeats',
      value: formatRecurrence(result.recurrence.value, { locale, times: false, weekStart: options.weekStart }),
      giveBack: [text.slice(span.start, span.end)],
    })
  }
  for (const token of result.tokens) {
    readChips.push({ id: `token-${token.key}`, label: token.label, value: token.name, giveBack: [token.text] })
  }

  function giveBack(chip: ReadChip) {
    setIgnored((current) => [...current.filter((phrase) => text.includes(phrase)), ...chip.giveBack])
    inputRef.current?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!result.title && !text.trim()) return
    onSubmit?.(result, text)
    if (value === undefined) {
      setOwnText('')
      setIgnored([])
    }
  }

  // The line with each read in a <mark>, in the line's order.
  const marked: ReactNode[] = []
  let at = 0
  for (const read of result.reads) {
    if (read.start < at) continue
    marked.push(text.slice(at, read.start))
    marked.push(
      <mark key={read.start} data-kind={read.kind} className="rounded-sm bg-info/20 text-transparent ring-1 ring-info-text/40 dark:bg-info/30">
        {text.slice(read.start, read.end)}
      </mark>,
    )
    at = read.end
  }
  marked.push(text.slice(at))

  const appChips = chips?.(result)
  const hasChips = readChips.length > 0 || !!appChips

  return (
    <div data-slot="quick-add-input" className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={inputId} className="text-sm leading-none font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        {/* Same box as the input (its border, padding and type), under it. */}
        <div
          aria-hidden="true"
          data-slot="quick-add-marks"
          className="pointer-events-none absolute inset-0 flex items-center overflow-hidden rounded-md border border-transparent px-2.5 py-1 text-base whitespace-pre md:text-sm"
        >
          <span ref={marksRef} className="text-transparent">
            {marked}
          </span>
        </div>
        <Input
          ref={inputRef}
          id={inputId}
          type="text"
          value={text}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          onScroll={follow}
          onSelect={follow}
          className="relative"
        />
      </div>
      {hasChips && (
        <ul aria-label="Read from the line" className="flex flex-wrap items-center gap-1.5">
          {readChips.map((chip) => (
            <li
              key={chip.id}
              data-slot="quick-add-read"
              data-read={chip.id}
              className="inline-flex h-7 items-center gap-1.5 rounded-full bg-info/10 pr-1 pl-2.5 text-sm text-foreground dark:bg-info/20"
            >
              <span className="text-xs text-foreground/80">{chip.label}</span>
              <span>{chip.value}</span>
              {chip.giveBack.length > 0 ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => giveBack(chip)}
                  aria-label={`Not a ${chip.label.toLowerCase()}: put “${chip.giveBack.join(' ')}” back in the title`}
                  title="Put the words back in the title"
                  className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <XIcon aria-hidden="true" className="size-3.5" />
                </button>
              ) : (
                <span className="w-1.5" />
              )}
            </li>
          ))}
          {appChips}
        </ul>
      )}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

export type QuickAddChipProps = {
  /** What it sets ("List"). */
  label: string
  /** What it's set to now ("Personal"), or nothing for "+ List". */
  value?: ReactNode
  onClick?: () => void
  /** Set by a press rather than typed: drawn solid. */
  set?: boolean
  disabled?: boolean
  className?: string
}

/**
 * The app's own chip in QuickAddInput's row: pressed to set what wasn't
 * typed (a list, a place). Dashed while it shows a default, solid once
 * pressed. Put it in an `<li>`; `chips` returns them.
 */
export function QuickAddChip({ label, value, onClick, set, disabled, className }: QuickAddChipProps) {
  const empty = value === undefined || value === null || value === ''
  return (
    <li className="inline-flex">
      <button
        type="button"
        data-slot="quick-add-chip"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-sm text-foreground outline-none hover:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50',
          set ? 'border-transparent bg-primary/12 dark:bg-primary/20' : 'border-dashed border-border',
          className,
        )}
      >
        {empty ? (
          <span className="text-muted-foreground">+ {label}</span>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">{label}</span>
            <span>{value}</span>
            <ChevronDownIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
          </>
        )}
      </button>
    </li>
  )
}
